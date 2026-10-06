import fs from 'node:fs';
import assert from 'node:assert/strict';
import { keccak256, getBytes } from 'ethers';
import { rpc } from './rpc.mjs';

const deployment = JSON.parse(fs.readFileSync(new URL('./runtime/deployment.json', import.meta.url)));
const url = process.argv[2] || deployment.routes[0].endpoints[0].rpcUrl;
const tx = deployment.steps['hivex:mailbox-initialize'];
const receipt = await rpc(url, 'eth_getTransactionReceipt', [tx.hash]);
assert.ok(receipt.logs.length >= 1, 'Historical receipt must expose persisted events');
const logs = await rpc(url, 'eth_getLogs', [{ blockHash: receipt.blockHash }]);
const own = logs.filter(log => log.transactionHash === receipt.transactionHash);
assert.deepEqual(own, receipt.logs);
const bloom = new Uint8Array(256);
for (const log of receipt.logs) {
  for (const value of [log.address, ...log.topics]) {
    const hash = getBytes(keccak256(value));
    for (let i = 0; i < 6; i += 2) {
      const bit = ((hash[i] << 8) | hash[i + 1]) & 2047;
      bloom[255 - Math.floor(bit / 8)] |= 1 << (bit % 8);
    }
  }
}
assert.equal(receipt.logsBloom, `0x${Buffer.from(bloom).toString('hex')}`);
const first = receipt.logs[0];
const matches = await rpc(url, 'eth_getLogs', [{ fromBlock: receipt.blockNumber, toBlock: receipt.blockNumber,
  address: [first.address], topics: [[first.topics[0]], null] }]);
assert.ok(matches.length > 0);
assert.ok(matches.every(log => log.address === first.address && log.topics[0] === first.topics[0]));
assert.deepEqual(await rpc(url, 'eth_getLogs', [{ blockHash: receipt.blockHash, address: `0x${'ff'.repeat(20)}` }]), []);
for (const filter of [{ address: '0x123' }, { topics: ['0x123'] }, { blockHash: receipt.blockHash, fromBlock: 'latest' },
  { fromBlock: '0x2', toBlock: '0x1' }, { fromBlock: '0x01' }]) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getLogs', params: [filter] }) });
  assert.equal((await response.json()).error?.code, -32602);
}
const byRaw = await rpc(url, 'eth_getTransactionReceipt', [tx.localHash]);
assert.equal(byRaw.logs.length, receipt.logs.length);
assert.equal(byRaw.logsBloom, receipt.logsBloom);
console.log(JSON.stringify({ url, block: Number(BigInt(receipt.blockNumber)), historicalLogs: receipt.logs.length,
  checks: ['receipt/getLogs agreement', 'bloom independently recomputed', 'address/topics OR and wildcard',
    'blockHash and range queries', 'invalid parameters rejected', 'raw hash receipt alias'] }));
