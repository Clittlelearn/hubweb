import { keccak256, getCreateAddress } from 'ethers';
export async function rpc(url, method, params = []) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }), signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error(`${method}: RPC returned no JSON-RPC envelope (method may be unsupported)`);
  if (!response.ok || result.error) throw new Error(`${method}: ${result.error?.message || response.status}`);
  return result.result;
}
export const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function confirm(url, hashes) {
  for (let attempt = 0; attempt < 120; attempt++) {
    for (const hash of [...new Set(hashes)]) {
      const [receipt, tx] = await Promise.all([
        rpc(url, 'eth_getTransactionReceipt', [hash]), rpc(url, 'eth_getTransactionByHash', [hash]),
      ]);
      if (receipt?.blockHash && tx?.blockHash) {
        if (receipt.blockHash.toLowerCase() !== tx.blockHash.toLowerCase() || BigInt(receipt.blockNumber) !== BigInt(tx.blockNumber)) {
          throw new Error(`Receipt/transaction block mismatch: ${hash}`);
        }
        const block = await rpc(url, 'eth_getBlockByNumber', [receipt.blockNumber, false]);
        if (block?.hash?.toLowerCase() !== receipt.blockHash.toLowerCase()) throw new Error(`Non-canonical receipt: ${hash}`);
        if (BigInt(receipt.status) !== 1n) throw new Error(`Transaction reverted: ${hash}`);
        return receipt;
      }
    }
    await pause(1500);
  }
  throw new Error(`Confirmation timeout. Do not resend before checking ${hashes.join(', ')}`);
}
export async function send(endpoint, wallet, tx, onSubmitted) {
  const chainId = Number(BigInt(await rpc(endpoint.rpcUrl, 'eth_chainId')));
  if (chainId !== endpoint.chainId) throw new Error(`Wrong chain at ${endpoint.rpcUrl}`);
  const nonce = Number(BigInt(await rpc(endpoint.rpcUrl, 'eth_getTransactionCount', [wallet.address, 'pending'])));
  const raw = await wallet.signTransaction({ type: 2, chainId, nonce, gasLimit: 14000000n,
    maxFeePerGas: 2000000000n, maxPriorityFeePerGas: 500000000n, value: 0n, ...tx });
  const localHash = keccak256(raw);
  const hash = await rpc(endpoint.rpcUrl, 'eth_sendRawTransaction', [raw]);
  const rpcHash = hash.startsWith('0x') ? hash : `0x${hash}`;
  console.log(`${endpoint.name}: submitted ${rpcHash}`);
  onSubmitted?.({ hash: rpcHash, localHash, nonce, contractAddress: !tx.to ? getCreateAddress({ from: wallet.address, nonce }) : undefined });
  const receipt = await confirm(endpoint.rpcUrl, [rpcHash, localHash]);
  return { receipt, hash: rpcHash, localHash, nonce,
    contractAddress: receipt.contractAddress || (!tx.to ? getCreateAddress({ from: wallet.address, nonce }) : undefined) };
}
