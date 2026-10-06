import { sendBrowserTransaction } from '@openhive/sdk';
import { getConnectedBrowserProvider } from '../lib/wallet-session';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ethers } from 'ethers';
import { useConnection } from 'wagmi';
import { ERC20 } from '../apis/evm';
import { errorHandling } from '../lib/helper';
import { waitForEthTransaction } from '../lib/hivex-eth-client';
import { scheduleTransactionDataRefresh } from '../lib/transaction-refresh';
import { useWallet } from '../providers/wallet-provider';
import { WALLET_NETWORK_RECONNECT_MESSAGE } from '../lib/wallet-network';

export type FlowDirection = 'in' | 'out';
export type FlowMethod = 'flowIn' | 'requestNativeFlowOut';

export interface FlowTransactionParams {
  amount: string;
  contractAddress: string;
  decimals: number;
  direction: FlowDirection;
  waitForReceipt?: boolean;
}

export interface FlowTransactionResult {
  hash: string;
  method: FlowMethod;
  receipt: Record<string, unknown> | null;
}

export interface FlowTransactionDebugParams extends FlowTransactionParams {
  chainId: number;
  from?: string;
  symbol?: string;
}

// Build the same ABI payload that will be handed to the connected wallet.
// Every bigint is converted to text so the result can be rendered as JSON.
export function buildFlowTransactionDebugInfo({
  amount,
  chainId,
  contractAddress,
  decimals,
  direction,
  from = '',
  symbol = '',
}: FlowTransactionDebugParams) {
  const method = getFlowMethod(direction);
  const rawAmount = ethers.parseUnits(amount, decimals);
  const args =
    direction === 'in' ? [rawAmount] : [from, rawAmount];
  const data = new ethers.Interface(ERC20.ABI).encodeFunctionData(method, args);

  return {
    ethereumRpc: {
      method: 'eth_sendRawTransaction',
      params: ['<signed by wallet after confirmation>'],
      decodedBeforeSigning: {
        transactionType: 'EIP-1559',
        chainId,
        from,
        nonce: '<wallet populated>',
        gasLimit: '<wallet populated>',
        maxPriorityFeePerGas: '<wallet populated>',
        maxFeePerGas: '<wallet populated>',
        to: contractAddress,
        value: '0x0',
        data,
      },
    },
    hivexEthInterfaceMapping: {
      fromAddr: from,
      toAddr: '<resolved by hivex from the contract deployer index>',
      contractAddress,
      args: data.slice(2),
      encodedInfo: '',
      gasTrade: {
        address: from,
        assetType: 'OHI',
      },
      height: '<next block height resolved by hivex>',
      contractTransfer: 0,
      isFindUtxo: false,
      isRpc: true,
      isFlowOutGasTrade: false,
    },
    decodedContractCall: {
      direction: direction === 'in' ? 'Flow In' : 'Flow Out',
      method,
      signature:
        direction === 'in'
          ? 'flowIn(uint256)'
          : 'requestNativeFlowOut(address,uint256)',
      arguments:
        direction === 'in'
          ? { amount: rawAmount.toString() }
          : { recipient: from, amount: rawAmount.toString() },
      amount: {
        display: amount,
        symbol,
        decimals,
        raw: rawAmount.toString(),
      },
    },
  };
}

// Reuse the connected wallet provider and make sure it is on the selected chain.

// Map the UI direction to the contract method name.
function getFlowMethod(direction: FlowDirection): FlowMethod {
  return direction === 'in' ? 'flowIn' : 'requestNativeFlowOut';
}

// Send lock/unlock flow transactions through the connected wallet.
export function useFlowTransaction() {
  const connection = useConnection();
  const { connected, currentNetwork, ensureWalletNetwork } = useWallet();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    FlowTransactionResult,
    Error,
    FlowTransactionParams
  >({
    mutationFn: async ({
      amount,
      contractAddress,
      decimals,
      direction,
      waitForReceipt = true,
    }: FlowTransactionParams) => {
      try {
        if (!connected || !connection.connector) {
          throw new Error('Wallet is not connected.');
        }

        if (!ethers.isAddress(contractAddress)) {
          throw new Error('Flow contract address is invalid.');
        }

        let value: bigint;
        try {
          value = ethers.parseUnits(amount, decimals);
        } catch {
          throw new Error('Amount must be greater than 0.');
        }
        if (value <= 0n) {
          throw new Error('Amount must be greater than 0.');
        }

        if (!await ensureWalletNetwork(currentNetwork.key)) {
          throw new Error(WALLET_NETWORK_RECONNECT_MESSAGE);
        }
        const browserProvider = await getConnectedBrowserProvider(
          connection.connector,
          currentNetwork.chainId,
          connection.address!,
        );

        const addr = connection.address;
        const rpcUrl =
          currentNetwork.service.rpcApi || currentNetwork.rpcs[0];
        const method = getFlowMethod(direction);
        const contract = new ERC20(
          contractAddress,
          currentNetwork.service.rpcApi || currentNetwork.rpcs[0],
        );
        const txData = await contract.getFunction(
          method,
          ...(direction === 'in' ? [value] : [addr, value]),
        );
        const { hash: responseHash } = await sendBrowserTransaction(browserProvider, txData, {
          account: connection.address!, chainId: currentNetwork.chainId, walletName: connection.connector.name,
        });
        let receipt: Record<string, unknown> | null = null;

        if (waitForReceipt) {
          const confirmation = await waitForEthTransaction({
            rpcUrl,
            hashes: [responseHash],
            request: (rpcMethod, rpcParams) =>
              browserProvider.send(rpcMethod, rpcParams),
          });
          const status = confirmation.receipt.status;
          if (status === '0x0' || status === '0') {
            throw new Error('Flow transaction reverted on chain.');
          }
          receipt = confirmation.receipt;
        }

        return {
          hash: responseHash,
          method,
          receipt,
        };
      } catch (error) {
        throw errorHandling(error);
      }
    },
    onSuccess: () => {
      scheduleTransactionDataRefresh(queryClient);
    },
  });

  return {
    ...mutation,
    flowTransaction: mutation.mutate,
    flowTransactionAsync: mutation.mutateAsync,
  };
}
