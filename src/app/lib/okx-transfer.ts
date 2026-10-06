import { ethers, type JsonRpcSigner, type TransactionRequest } from 'ethers';
import { isOkxWallet } from './injected-wallets';

// HiveX's feeHistory is not a usable EIP-1559 fee oracle. Supply the legacy
// fields explicitly for OKX on this devnet; never substitute a different RPC.
export async function prepareOkxTransfer(
  signer: JsonRpcSigner,
  transaction: TransactionRequest,
  walletName: string,
  chainId: number,
): Promise<TransactionRequest> {
  if (chainId !== 12315 || !isOkxWallet(walletName)) return transaction;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const prepare = async () => {
    const provider = signer.provider;
    const verifyContext = async () => {
      const actualChain = await provider.send('eth_chainId', []);
      const accounts = await provider.send('eth_accounts', []) as string[];
      if (BigInt(actualChain) !== BigInt(chainId) ||
        accounts[0]?.toLowerCase() !== signer.address.toLowerCase()) {
        throw new Error('Wallet account or network changed. No transaction was sent.');
      }
    };
    await verifyContext();
    const quotedPrice = await provider.send('eth_gasPrice', []);
    if (typeof quotedPrice !== 'string' || !/^0x[0-9a-f]+$/i.test(quotedPrice) || BigInt(quotedPrice) <= 0n) {
      throw new Error('Wallet RPC returned an invalid Gas price. No transaction was sent.');
    }
    const prepared: TransactionRequest = {
      ...transaction,
      from: signer.address,
      chainId,
      type: 0,
      gasPrice: BigInt(quotedPrice),
      data: transaction.data ?? '0x',
    };
    delete prepared.maxFeePerGas;
    delete prepared.maxPriorityFeePerGas;
    const estimate = await signer.estimateGas(prepared);
    if (estimate <= 0n) throw new Error('Wallet RPC returned an invalid Gas estimate. No transaction was sent.');
    prepared.gasLimit = estimate;
    await verifyContext();
    return prepared;
  };
  try {
    return await Promise.race([
      prepare(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Wallet Gas estimation timed out. No transaction was sent.')), 15_000);
      }),
    ]);
  } finally { clearTimeout(timer); }
}
