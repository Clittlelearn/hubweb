import { ethers, type TransactionRequest } from 'ethers';

export interface WalletProvider {
  request(args: { method: string; params?: any[] }): Promise<any>;
}
export interface WalletContext {
  account: string;
  chainId: number;
  walletName?: string;
}

export async function walletRequest(provider: WalletProvider, method: string, params: any[] = [], timeout = 15000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      provider.request({ method, params }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Wallet ${method} timed out. Check the wallet before trying again.`)), timeout);
      }),
    ]);
  } finally { clearTimeout(timer); }
}

export async function assertWalletContext(provider: WalletProvider, context: WalletContext) {
  const accounts = await walletRequest(provider, 'eth_accounts') as string[];
  if (!ethers.isAddress(context.account) || accounts?.[0]?.toLowerCase() !== context.account.toLowerCase()) {
    throw new Error('Wallet account changed. Reconnect or select the original account. No transaction was sent.');
  }
  if (BigInt(await walletRequest(provider, 'eth_chainId')) !== BigInt(context.chainId)) {
    throw new Error('Wallet network changed. Switch to the requested network. No transaction was sent.');
  }
}

// All wallet sends use the selected EIP-1193 provider, not a global window.ethereum.
// Return the hash immediately; confirmation belongs to the bounded polling layer.
export async function sendWalletTransactionRequest(
  provider: WalletProvider, transaction: TransactionRequest, context: WalletContext,
): Promise<{ hash: string }> {
  await assertWalletContext(provider, context);
  const tx = await ethers.resolveProperties(transaction);
  if (tx.from && String(tx.from).toLowerCase() !== context.account.toLowerCase()) {
    throw new Error('Transaction from address does not match the selected wallet. No transaction was sent.');
  }
  if (tx.chainId != null && BigInt(tx.chainId) !== BigInt(context.chainId)) {
    throw new Error('Transaction chain ID does not match the selected wallet. No transaction was sent.');
  }
  const request: Record<string, unknown> = {
    from: ethers.getAddress(context.account), chainId: ethers.toQuantity(context.chainId),
    data: tx.data ?? '0x', value: ethers.toQuantity(tx.value ?? 0),
  };
  if (tx.to != null) {
    if (typeof tx.to !== 'string' || !ethers.isAddress(tx.to)) throw new Error('Invalid transaction recipient.');
    request.to = ethers.getAddress(tx.to);
  }
  for (const key of ['nonce', 'type', 'gasPrice', 'maxFeePerGas', 'maxPriorityFeePerGas'] as const) {
    if (tx[key] != null) request[key] = ethers.toQuantity(tx[key]!);
  }
  if (tx.accessList != null) request.accessList = ethers.accessListify(tx.accessList);
  const isOkx = /okx|okex/i.test(context.walletName ?? '') ||
    Boolean((provider as WalletProvider & { isOkxWallet?: boolean }).isOkxWallet);
  if (context.chainId === 12315 && isOkx && tx.gasPrice == null && tx.maxFeePerGas == null) {
    const price = await walletRequest(provider, 'eth_gasPrice');
    if (typeof price !== 'string' || !/^0x[0-9a-f]+$/i.test(price) || BigInt(price) <= 0n) {
      throw new Error('Wallet RPC returned an invalid Gas price. No transaction was sent.');
    }
    request.type = '0x0';
    request.gasPrice = price;
    delete request.maxPriorityFeePerGas;
  }
  const gas = tx.gasLimit != null ? BigInt(tx.gasLimit) :
    (BigInt(await walletRequest(provider, 'eth_estimateGas', [request])) * 120n + 99n) / 100n;
  if (gas <= 0n) throw new Error('Wallet RPC returned an invalid Gas estimate. No transaction was sent.');
  request.gas = ethers.toQuantity(gas);
  await assertWalletContext(provider, context);
  // Never automatically retry or cancel a signing request: a late hash may be real.
  const hash = await provider.request({ method: 'eth_sendTransaction', params: [request] });
  if (typeof hash !== 'string' || !ethers.isHexString(hash, 32)) {
    throw new Error('Wallet returned an invalid transaction hash. Check wallet history before retrying.');
  }
  return { hash };
}

export async function sendBrowserTransaction(
  provider: ethers.BrowserProvider, tx: TransactionRequest, expected?: Partial<WalletContext>,
) {
  const transport: WalletProvider = { request: ({ method, params }) => provider.send(method, params ?? []) };
  const account = expected?.account ?? (tx.from ? String(await tx.from) : (await walletRequest(transport, 'eth_accounts'))[0]);
  const chainId = expected?.chainId ?? Number(BigInt(await walletRequest(transport, 'eth_chainId')));
  return sendWalletTransactionRequest(transport, tx, { account, chainId, walletName: expected?.walletName });
}
