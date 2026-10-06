import { assertWalletContext, sendWalletTransactionRequest } from '@openhive/sdk';
import { ethers, type Eip1193Provider } from 'ethers';
import { confirmationFailure, TRANSACTION_CONFIRMATION_ATTEMPTS } from './transaction-confirmation';

export interface BridgeEndpoint {
  key: string;
  name: string;
  chainId: number;
  domain: number;
  rpcUrl: string;
  nativeSymbol: string;
  nativeDecimals: number;
  type: 'synthetic' | 'collateral';
  scale: string;
  token: string;
  router: string;
  mailbox: string;
  deploymentBlock: number;
  explorerUrl?: string;
}
export interface BridgeRoute {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  security: string;
  endpoints: [BridgeEndpoint, BridgeEndpoint];
}
export interface BridgeConfig {
  schemaVersion: 1;
  environment: string;
  routes: BridgeRoute[];
}
export type BridgeStage = 'source-pending' | 'relaying' | 'delivered' | 'failed' | 'confirmation-failed';
export interface BridgeRecord {
  id: string;
  account: string;
  recipient: string;
  amount: string;
  rawAmount: string;
  createdAt: number;
  sourceHash: string;
  messageId?: string;
  sourceBlock?: number;
  destinationHash?: string;
  destinationStartBlock: number;
  stage: BridgeStage;
  error?: string;
  sourceConfirmationAttempts?: number;
  route: BridgeRoute;
  sourceKey: string;
}

export const TOKEN_ABI = new ethers.Interface([
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
]);
export const ROUTER_ABI = new ethers.Interface([
  'function routers(uint32) view returns (bytes32)',
  'function mailbox() view returns (address)',
  'function scale() view returns (uint256)',
  'function wrappedToken() view returns (address)',
  'function quoteTransferRemote(uint32,bytes32,uint256) view returns (tuple(address token,uint256 amount)[])',
  'function transferRemote(uint32,bytes32,uint256) payable returns (bytes32)',
]);
export const MAILBOX_ABI = new ethers.Interface([
  'function localDomain() view returns (uint32)',
  'function delivered(bytes32) view returns (bool)',
  'event Dispatch(address indexed sender,uint32 indexed destination,bytes32 indexed recipient,bytes message)',
  'event ProcessId(bytes32 indexed messageId)',
]);

export function bridgeError(error: unknown): string {
  const value = error as { code?: number; message?: string; shortMessage?: string; info?: { error?: { message?: string } } };
  if (value?.code === 4001 || /user rejected|user denied/i.test(value?.message || '')) return 'Wallet request rejected. No new transaction was sent.';
  return value?.info?.error?.message || value?.shortMessage || value?.message || 'Bridge request failed.';
}

export async function bridgeRpc<T = any>(endpoint: BridgeEndpoint, method: string, params: unknown[] = []): Promise<T> {
  // A browser's loopback belongs to the visitor, not to the Hub host.
  // Server-side route validation/relaying must continue using the original RPC.
  const proxy = typeof window !== 'undefined' && ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(endpoint.rpcUrl).hostname);
  const response = await fetch(proxy ? '/__bridge-rpc' : endpoint.rpcUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(proxy ? { 'X-Bridge-Read': '1' } : {}) },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params,
      ...(proxy ? { bridgeEndpoint: { key: endpoint.key, chainId: endpoint.chainId, rpcUrl: endpoint.rpcUrl } } : {}),
    }),
    signal: AbortSignal.timeout(12000),
  });
  const envelope = await response.json();
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) throw new Error(`${endpoint.name}: ${method} returned no JSON-RPC response. Check node RPC support.`);
  if (!response.ok || envelope.error) throw new Error(`${endpoint.name}: ${envelope.error?.message || response.statusText}`);
  if (envelope.result === undefined) throw new Error(`${endpoint.name}: RPC returned no result.`);
  return envelope.result as T;
}

export async function bridgeCall(endpoint: BridgeEndpoint, address: string, abi: ethers.Interface, method: string, args: unknown[] = []) {
  const data = abi.encodeFunctionData(method, args);
  const result = await bridgeRpc<string>(endpoint, 'eth_call', [{ to: address, data }, 'latest']);
  return abi.decodeFunctionResult(method, result);
}

export function validateBridgeConfig(value: unknown): BridgeConfig {
  const config = value as BridgeConfig;
  if (config?.schemaVersion !== 1 || !Array.isArray(config.routes)) throw new Error('Invalid bridge configuration.');
  const routeIds = new Set<string>();
  for (const route of config.routes) {
    if (!route.id || routeIds.has(route.id) || !route.symbol || !Number.isInteger(route.decimals) || route.decimals < 0 || route.decimals > 36 || route.endpoints?.length !== 2) {
      throw new Error('Invalid bridge route.');
    }
    routeIds.add(route.id);
    for (const endpoint of route.endpoints) {
      if (!endpoint.key || !endpoint.name || !Number.isSafeInteger(endpoint.chainId) || endpoint.chainId <= 0 ||
        !Number.isInteger(endpoint.domain) || endpoint.domain < 0 || endpoint.domain > 0xffffffff ||
        !['synthetic', 'collateral'].includes(endpoint.type) || endpoint.scale !== '1' ||
        !Number.isInteger(endpoint.nativeDecimals) || endpoint.nativeDecimals < 0 || endpoint.nativeDecimals > 36 ||
        !Number.isSafeInteger(endpoint.deploymentBlock) || endpoint.deploymentBlock < 0 ||
        ![endpoint.router, endpoint.token, endpoint.mailbox].every(address => ethers.isAddress(address) && address !== ethers.ZeroAddress)) {
        throw new Error('Bridge route contains an invalid chain or contract.');
      }
      const url = new URL(endpoint.rpcUrl);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid bridge RPC URL.');
    }
    const [a, b] = route.endpoints;
    if (a.chainId === b.chainId || a.domain === b.domain || a.key === b.key) throw new Error('Bridge endpoints must be different chains and domains.');
  }
  return config;
}

export function routeEnds(route: BridgeRoute, sourceKey: string) {
  const source = route.endpoints.find(endpoint => endpoint.key === sourceKey);
  const target = route.endpoints.find(endpoint => endpoint.key !== sourceKey);
  if (!source || !target) throw new Error('Select a valid bridge direction.');
  return { source, target };
}

export function bridgeAmount(amount: string, decimals: number): bigint {
  if (!/^\d+(\.\d+)?$/.test(amount)) throw new Error('Enter a positive decimal amount.');
  let raw: bigint;
  try { raw = ethers.parseUnits(amount, decimals); } catch { throw new Error(`Use at most ${decimals} decimal places.`); }
  if (raw <= 0n || raw > ethers.MaxUint256) throw new Error('Amount is outside the supported range.');
  return raw;
}

export async function validateRouteOnChain(route: BridgeRoute) {
  await Promise.all(route.endpoints.map(async (endpoint, index) => {
    const remote = route.endpoints[1 - index];
    const [chainId, routerCode, tokenCode, remoteRouter, mailbox, domain, decimals, scale, logs] = await Promise.all([
      bridgeRpc<string>(endpoint, 'eth_chainId'),
      bridgeRpc<string>(endpoint, 'eth_getCode', [endpoint.router, 'latest']),
      bridgeRpc<string>(endpoint, 'eth_getCode', [endpoint.token, 'latest']),
      bridgeCall(endpoint, endpoint.router, ROUTER_ABI, 'routers', [remote.domain]),
      bridgeCall(endpoint, endpoint.router, ROUTER_ABI, 'mailbox'),
      bridgeCall(endpoint, endpoint.mailbox, MAILBOX_ABI, 'localDomain'),
      bridgeCall(endpoint, endpoint.token, TOKEN_ABI, 'decimals'),
      bridgeCall(endpoint, endpoint.router, ROUTER_ABI, 'scale'),
      bridgeRpc(endpoint, 'eth_getLogs', [{ address: endpoint.mailbox, fromBlock: 'latest', toBlock: 'latest' }]),
    ]);
    if (!Array.isArray(logs)) throw new Error(`${endpoint.name}: eth_getLogs is required for bridge message tracking.`);
    if (Number(BigInt(chainId)) !== endpoint.chainId || routerCode === '0x' || tokenCode === '0x' ||
      remoteRouter[0].toLowerCase() !== ethers.zeroPadValue(remote.router, 32).toLowerCase() ||
      mailbox[0].toLowerCase() !== endpoint.mailbox.toLowerCase() || Number(domain[0]) !== endpoint.domain ||
      Number(decimals[0]) !== route.decimals || scale[0] !== 1n) throw new Error(`${endpoint.name}: on-chain route configuration does not match.`);
    if (endpoint.type === 'collateral') {
      const [token] = await bridgeCall(endpoint, endpoint.router, ROUTER_ABI, 'wrappedToken');
      if (token.toLowerCase() !== endpoint.token.toLowerCase()) throw new Error('Collateral token mismatch.');
    } else if (endpoint.token.toLowerCase() !== endpoint.router.toLowerCase()) throw new Error('Synthetic token must be its router.');
  }));
  return true;
}

export async function readBridgeBalance(endpoint: BridgeEndpoint, account: string): Promise<bigint> {
  return (await bridgeCall(endpoint, endpoint.token, TOKEN_ABI, 'balanceOf', [account]))[0];
}

export async function quoteBridge(source: BridgeEndpoint, target: BridgeEndpoint, recipient: string, amount: bigint) {
  const [quotes] = await bridgeCall(source, source.router, ROUTER_ABI, 'quoteTransferRemote', [target.domain, ethers.zeroPadValue(recipient, 32), amount]);
  let fee = 0n;
  for (const quote of quotes) {
    if (quote.token === ethers.ZeroAddress) fee += quote.amount;
    else if (source.type !== 'collateral' || quote.token.toLowerCase() !== source.token.toLowerCase() || quote.amount !== amount) {
      throw new Error('This route requests an unsupported fee token.');
    }
  }
  return fee;
}

export async function bridgeWalletRequest(provider: Eip1193Provider, method: string, params?: unknown[], timeoutMs = 15000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      provider.request({ method, ...(params ? { params } : {}) }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Wallet ${method} timed out. Check the wallet before trying again.`)), timeoutMs);
      }),
    ]);
  } finally { clearTimeout(timer); }
}

export async function ensureBridgeWallet(provider: Eip1193Provider, endpoint: BridgeEndpoint, account: string) {
  const chainId = ethers.toQuantity(endpoint.chainId);
  if (BigInt(await bridgeWalletRequest(provider, 'eth_chainId')) !== BigInt(endpoint.chainId)) {
    try { await bridgeWalletRequest(provider, 'wallet_switchEthereumChain', [{ chainId }], 120000); }
    catch (error) {
      if (Number((error as { code?: number }).code) !== 4902) throw error;
      await bridgeWalletRequest(provider, 'wallet_addEthereumChain', [{ chainId, chainName: endpoint.name,
        nativeCurrency: { name: endpoint.nativeSymbol, symbol: endpoint.nativeSymbol, decimals: endpoint.nativeDecimals },
        rpcUrls: [endpoint.rpcUrl], ...(endpoint.explorerUrl ? { blockExplorerUrls: [endpoint.explorerUrl] } : {}),
      }], 120000);
      await bridgeWalletRequest(provider, 'wallet_switchEthereumChain', [{ chainId }], 120000);
    }
  }
  await assertWalletContext(provider, { account, chainId: endpoint.chainId });
}

export async function sendWalletTransaction(provider: Eip1193Provider, endpoint: BridgeEndpoint, account: string, to: string, data: string, value = 0n,
  lifecycle: { beforeSend?: (nonce: string) => void; onSubmitted?: (hash: string) => void; onRejected?: () => void; timeoutMs?: number } = {}) {
  await ensureBridgeWallet(provider, endpoint, account);
  const tx = { from: account, to, data, value: ethers.toQuantity(value) };
  const estimated = BigInt(await bridgeWalletRequest(provider, 'eth_estimateGas', [tx]));
  // Confirm account and chain again after estimation, immediately before the signing request.
  await ensureBridgeWallet(provider, endpoint, account);
  const nonce = lifecycle.beforeSend ? ethers.toQuantity(await bridgeWalletRequest(provider, 'eth_getTransactionCount', [account, 'pending'])) : undefined;
  if (nonce !== undefined) lifecycle.beforeSend?.(nonce);
  // Keep this handler attached after timeout: a late wallet hash must still be saved.
  const submitted = Promise.resolve().then(() => sendWalletTransactionRequest(provider, { ...tx, ...(nonce === undefined ? {} : { nonce: Number(BigInt(nonce)) }), gasLimit: estimated * 120n / 100n }, { account, chainId: endpoint.chainId }))
    .then(({ hash }) => {
      if (typeof hash !== 'string' || !ethers.isHexString(hash, 32)) throw new Error('Wallet returned an invalid transaction hash; its result is unknown.');
      lifecycle.onSubmitted?.(hash);
      return hash;
    }, error => {
      if (Number(error?.code) === 4001) lifecycle.onRejected?.();
      throw error;
    });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([submitted, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Wallet did not return a transaction hash within 120 seconds. The transaction may already be on chain. Recover its hash; do not resend.')), lifecycle.timeoutMs ?? 120000);
    })]);
  } finally { clearTimeout(timer); }
}

export async function readConfirmedReceipt(endpoint: BridgeEndpoint, hash: string) {
  const [receipt, transaction] = await Promise.all([
    bridgeRpc(endpoint, 'eth_getTransactionReceipt', [hash]), bridgeRpc(endpoint, 'eth_getTransactionByHash', [hash]),
  ]);
  if (!receipt?.blockHash || !transaction?.blockHash || receipt.blockNumber == null || transaction.blockNumber == null) return null;
  if (receipt.blockHash.toLowerCase() !== transaction.blockHash.toLowerCase()) throw new Error('Receipt and transaction belong to different blocks.');
  if (receipt.status == null) throw new Error('Receipt has no execution status.');
  return receipt;
}

export async function waitBridgeReceipt(endpoint: BridgeEndpoint, hash: string) {
  for (let attempt = 0; attempt < TRANSACTION_CONFIRMATION_ATTEMPTS; attempt++) {
    const receipt = await readConfirmedReceipt(endpoint, hash);
    if (receipt) {
      if (BigInt(receipt.status) !== 1n) throw new Error(`Transaction reverted: ${hash}`);
      return receipt;
    }
    if (attempt + 1 < TRANSACTION_CONFIRMATION_ATTEMPTS) await new Promise(resolve => setTimeout(resolve, 1500));
  }
  throw confirmationFailure([hash]);
}

function unconfirmedSourceRecord(record: BridgeRecord, error?: string): BridgeRecord {
    const sourceConfirmationAttempts = (record.sourceConfirmationAttempts || 0) + 1;
    return { ...record, sourceConfirmationAttempts, error,
      ...(sourceConfirmationAttempts >= TRANSACTION_CONFIRMATION_ATTEMPTS ? {
        stage: 'confirmation-failed' as const, error: confirmationFailure([record.sourceHash]).message,
      } : {}) };
}

export async function refreshBridgeRecord(record: BridgeRecord): Promise<BridgeRecord> {
  if (record.stage === 'delivered' || record.stage === 'failed' || record.stage === 'confirmation-failed') return record;
  const { source, target } = routeEnds(record.route, record.sourceKey);
  let receipt;
  try { receipt = await readConfirmedReceipt(source, record.sourceHash); }
  catch (error) {
    return unconfirmedSourceRecord(record, bridgeError(error));
  }
  if (!receipt) return unconfirmedSourceRecord(record);
  if (BigInt(receipt.status) !== 1n) return { ...record, stage: 'failed', error: 'Source transaction reverted. No bridge message was dispatched.' };
  let messageId = record.messageId;
  if (!messageId) {
    for (const log of receipt.logs || []) {
      if (log.address?.toLowerCase() !== source.mailbox.toLowerCase()) continue;
      let parsed: ethers.LogDescription | null;
      try { parsed = MAILBOX_ABI.parseLog(log); } catch { continue; }
      if (parsed?.name === 'Dispatch' && parsed.args.sender.toLowerCase() === source.router.toLowerCase() &&
        Number(parsed.args.destination) === target.domain && parsed.args.recipient.toLowerCase() === ethers.zeroPadValue(target.router, 32).toLowerCase()) {
        messageId = ethers.keccak256(parsed.args.message);
        break;
      }
    }
    if (!messageId) throw new Error('Source confirmed but its Dispatch log is not available. Keep this transaction for reconciliation.');
  }
  const [delivered] = await bridgeCall(target, target.mailbox, MAILBOX_ABI, 'delivered', [messageId]);
  const next: BridgeRecord = { ...record, sourceConfirmationAttempts: 0, messageId, sourceBlock: Number(BigInt(receipt.blockNumber)), stage: 'relaying', error: undefined };
  if (!delivered) return next;
  const head = Number(BigInt(await bridgeRpc<string>(target, 'eth_blockNumber')));
  for (let from = record.destinationStartBlock; from <= head; from += 500) {
    const logs = await bridgeRpc<any[]>(target, 'eth_getLogs', [{ address: target.mailbox,
      topics: [MAILBOX_ABI.getEvent('ProcessId')!.topicHash, messageId],
      fromBlock: ethers.toQuantity(from), toBlock: ethers.toQuantity(Math.min(head, from + 499)) }]);
    for (const log of logs) {
      if (log.removed) continue;
      const targetReceipt = await readConfirmedReceipt(target, log.transactionHash);
      if (targetReceipt && BigInt(targetReceipt.status) === 1n && targetReceipt.blockHash.toLowerCase() === log.blockHash.toLowerCase()) {
        return { ...next, stage: 'delivered', destinationHash: log.transactionHash };
      }
    }
  }
  return { ...next, error: 'Destination state is delivered; waiting for its transaction index.' };
}
