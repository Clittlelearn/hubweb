import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ethers } from 'ethers';
import { useConnection } from 'wagmi';
import { ERC20 } from '../apis/evm';
import { errorHandling } from '../lib/helper';
import { sendBrowserTransaction } from '@openhive/sdk';
import { getConnectedBrowserProvider } from '../lib/wallet-session';
import { waitForEthTransaction } from '../lib/hivex-eth-client';
import { scheduleTransactionDataRefresh } from '../lib/transaction-refresh';
import { useWallet } from '../providers/wallet-provider';
import { WALLET_NETWORK_RECONNECT_MESSAGE } from '../lib/wallet-network';
import { buildFlowTransferTransaction } from '../lib/flow-transfer';
export interface SendTransactionToken {
  symbol: string;
  decimals: number;
  isNative: boolean;
  isFlow?: boolean;
  contractAddress?: string;
  assetType?: string;
}

export interface SendTransactionParams {
  to: string;
  amount: string;
  token: SendTransactionToken;
  waitForReceipt?: boolean;
}

export interface SendTransactionResult {
  hash: string;
  receipt: Record<string, unknown> | null;
}
export function useSendTransaction() {
  const connection = useConnection();
  const { connected, currentNetwork, ensureWalletNetwork } = useWallet();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    SendTransactionResult,
    Error,
    SendTransactionParams
  >({
    mutationFn: async ({
      to,
      amount,
      token,
      waitForReceipt = false,
    }: SendTransactionParams) => {
      try {
        if (!connected || !connection.connector) {
          throw new Error('Wallet is not connected.');
        }

        if (!ethers.isAddress(to)) {
          throw new Error('Enter a valid wallet address.');
        }

        if (!amount || Number(amount) <= 0 || Number.isNaN(Number(amount))) {
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

        let transaction: ethers.TransactionRequest;
        if (token.isNative) {
          // ETH RPC value uses 18 decimals; native/indexer storage remains 8.
          transaction = { to, value: ethers.parseUnits(amount, 18) };
        } else if (token.isFlow) {
          transaction = await buildFlowTransferTransaction({
            from: connection.address!, to, amount, assetType: token.assetType,
          });
        } else {
          if (!token.contractAddress) throw new Error('Token contract address is missing.');
          const contract = new ERC20(token.contractAddress, currentNetwork.service.rpcApi || currentNetwork.rpcs[0]);
          transaction = await contract.getFunction('transfer', to, ethers.parseUnits(amount, token.decimals));
        }
        const response = await sendBrowserTransaction(browserProvider, transaction, {
          account: connection.address!, chainId: currentNetwork.chainId, walletName: connection.connector.name,
        });
        const confirmation = waitForReceipt ? await waitForEthTransaction({
          rpcUrl: currentNetwork.service.rpcApi || currentNetwork.rpcs[0], hashes: [response.hash],
          request: (method, params) => browserProvider.send(method, params),
        }) : null;
        if (confirmation && BigInt(String(confirmation.receipt.status)) !== 1n) throw new Error('Transaction reverted on chain.');
        return { hash: response.hash, receipt: confirmation?.receipt ?? null };
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
    sendTransaction: mutation.mutate,
    sendTransactionAsync: mutation.mutateAsync,
  };
}
