import { ethers } from 'ethers';
import { confirmationFailure, TRANSACTION_CONFIRMATION_ATTEMPTS } from './transaction-confirmation';

const DEFAULT_POLL_ATTEMPTS = TRANSACTION_CONFIRMATION_ATTEMPTS;
const DEFAULT_POLL_DELAY_MS = 1500;
const DEFAULT_REQUEST_TIMEOUT_MS = 5000;

type EthRpcRequest = <T>(method: string, params: unknown[]) => Promise<T>;

interface JsonRpcEnvelope<T> {
  jsonrpc?: string;
  id?: string | number;
  result?: T;
  error?: { code?: number; message?: string; data?: unknown };
  status?: { code?: string | number; errorCallstack?: string[] };
}

export interface EthTransactionConfirmation {
  hash: string;
  receipt: Record<string, unknown>;
  transaction: Record<string, unknown>;
  attempts: number;
}

export interface SignedTransactionResult {
  localHash: string;
  rpcHash: string;
  rawTransaction: string;
  nonce: number;
  confirmation: EthTransactionConfirmation;
}

export interface TransactionProgress {
  attempt: number;
  hashes: string[];
  receiptFound: boolean;
  transactionFound: boolean;
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getStatusError(payload: JsonRpcEnvelope<unknown>) {
  if (payload.status?.code === undefined || String(payload.status.code) === '0') {
    return '';
  }

  return (
    payload.status.errorCallstack?.filter(Boolean).join(' | ') ||
    `HiveX RPC status ${payload.status.code}`
  );
}

async function postJson<T>(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<JsonRpcEnvelope<T>> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal,
  });
  const text = await response.text();
  let payload: JsonRpcEnvelope<T>;

  try {
    payload = JSON.parse(text) as JsonRpcEnvelope<T>;
  } catch {
    throw new Error(
      `RPC returned HTTP ${response.status} with a non-JSON response.`,
    );
  }

  if (!response.ok) {
    throw new Error(
      payload.error?.message ||
        getStatusError(payload) ||
        `RPC returned HTTP ${response.status}.`,
    );
  }

  return payload;
}

export async function jsonRpc<T>(
  rpcUrl: string,
  method: string,
  params: unknown[] = [],
): Promise<T> {
  const payload = await postJson<T>(rpcUrl, {
    jsonrpc: '2.0',
    id: Date.now(),
    method,
    params,
  });

  if (payload.error) {
    throw new Error(`${method}: ${payload.error.message || 'RPC error'}`);
  }
  if (payload.result === undefined) {
    throw new Error(`${method}: response has no result.`);
  }
  return payload.result;
}

async function pollEthMethod(
  rpcUrl: string,
  method: 'eth_getTransactionReceipt' | 'eth_getTransactionByHash',
  hash: string,
  request?: EthRpcRequest,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (request) {
      return await Promise.race([
        request<Record<string, unknown> | null>(method, [hash]),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`${method} timed out.`)),
            DEFAULT_REQUEST_TIMEOUT_MS,
          );
        }),
      ]);
    }
    const payload = await postJson<Record<string, unknown> | null>(rpcUrl, {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params: [hash],
    }, {}, AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS));
    if (payload.error) throw new Error(payload.error.message || `${method} failed.`);
    return payload.result ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function hasTextField(value: Record<string, unknown> | null, field: string) {
  return typeof value?.[field] === 'string' && value[field] !== '';
}

export async function waitForEthTransaction({
  rpcUrl,
  hashes,
  attempts = DEFAULT_POLL_ATTEMPTS,
  delayMs = DEFAULT_POLL_DELAY_MS,
  onProgress,
  request,
}: {
  rpcUrl: string;
  hashes: string[];
  attempts?: number;
  delayMs?: number;
  onProgress?: (progress: TransactionProgress) => void;
  request?: EthRpcRequest;
}): Promise<EthTransactionConfirmation> {
  const candidates = [
    ...new Set(hashes.filter((hash) => ethers.isHexString(hash, 32))),
  ];
  if (candidates.length === 0) {
    throw new Error('No valid transaction hash is available for confirmation.');
  }
  attempts = Math.max(1, Math.min(DEFAULT_POLL_ATTEMPTS, Math.floor(attempts) || DEFAULT_POLL_ATTEMPTS));

  let lastReceiptFound = false;
  let lastTransactionFound = false;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    for (const hash of candidates) {
      const [receipt, transaction] = await Promise.all([
        pollEthMethod(rpcUrl, 'eth_getTransactionReceipt', hash, request),
        pollEthMethod(rpcUrl, 'eth_getTransactionByHash', hash, request),
      ]);
      const receiptFound = hasTextField(receipt, 'transactionHash');
      const transactionFound =
        hasTextField(transaction, 'hash') ||
        hasTextField(transaction, 'transactionHash');
      lastReceiptFound ||= receiptFound;
      lastTransactionFound ||= transactionFound;
      onProgress?.({
        attempt,
        hashes: candidates,
        receiptFound: lastReceiptFound,
        transactionFound: lastTransactionFound,
      });

      if (receiptFound && transactionFound) {
        return {
          hash,
          receipt: receipt!,
          transaction: transaction!,
          attempts: attempt,
        };
      }
    }
    if (attempt < attempts) await sleep(delayMs);
  }

  throw confirmationFailure(candidates, attempts);
}

async function readNonce(rpcUrl: string, address: string) {
  let quantity: string;
  try {
    quantity = await jsonRpc<string>(rpcUrl, 'eth_getTransactionCount', [
      address,
      'pending',
    ]);
  } catch {
    quantity = await jsonRpc<string>(rpcUrl, 'eth_getTransactionCount', [
      address,
      'latest',
    ]);
  }
  return Number(BigInt(quantity));
}

export function walletForGenesis(privateKey: string, expectedAddress: string) {
  const wallet = new ethers.Wallet(privateKey.trim());
  if (wallet.address.toLowerCase() !== expectedAddress.toLowerCase()) {
    throw new Error(
      `Private key resolves to ${wallet.address}, not the configured genesis account.`,
    );
  }
  return wallet;
}

export async function sendSignedTransaction({
  rpcUrl,
  privateKey,
  expectedAddress,
  chainId,
  to,
  data = '0x',
  value = 0n,
  gasLimit = 8_000_000n,
  onSubmitted,
  onProgress,
}: {
  rpcUrl: string;
  privateKey: string;
  expectedAddress: string;
  chainId: number;
  to?: string;
  data?: string;
  value?: bigint;
  gasLimit?: bigint;
  onSubmitted?: (hashes: { localHash: string; rpcHash: string }) => void;
  onProgress?: (progress: TransactionProgress) => void;
}): Promise<SignedTransactionResult> {
  const wallet = walletForGenesis(privateKey, expectedAddress);
  const nonce = await readNonce(rpcUrl, wallet.address);
  const rawTransaction = await wallet.signTransaction({
    type: 2,
    chainId,
    nonce,
    to,
    data,
    value,
    gasLimit,
    maxPriorityFeePerGas: ethers.parseUnits('0.5', 'gwei'),
    maxFeePerGas: ethers.parseUnits('1', 'gwei'),
  });
  const localHash = ethers.keccak256(rawTransaction);
  const rpcResultHash = await jsonRpc<string>(rpcUrl, 'eth_sendRawTransaction', [
    rawTransaction,
  ]);
  const rpcHash = rpcResultHash.startsWith('0x')
    ? rpcResultHash
    : `0x${rpcResultHash}`;
  onSubmitted?.({ localHash, rpcHash });
  const confirmation = await waitForEthTransaction({
    rpcUrl,
    hashes: [localHash, rpcHash],
    onProgress,
  });
  const status = confirmation.receipt.status;
  if (status === '0x0' || status === '0') {
    throw new Error(`Transaction ${confirmation.hash} reverted on chain.`);
  }
  return { localHash, rpcHash, rawTransaction, nonce, confirmation };
}

export function describeError(value: unknown) {
  return value instanceof Error ? value.message : String(value);
}
