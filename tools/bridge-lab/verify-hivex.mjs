import fs from 'node:fs';
import assert from 'node:assert/strict';
import { Interface, concat, dataSlice, zeroPadValue, toBeHex } from 'ethers';
import { rpc, confirm } from './rpc.mjs';
import { relayOnce } from './relay.mjs';

const route = JSON.parse(fs.readFileSync(new URL('../../public/bridge/routes.json', import.meta.url))).routes.find(item => item.id === 'hbr-hivex-local-bsc');
const [hive, bsc] = route.endpoints;
const report = JSON.parse(fs.readFileSync(new URL('./test-results/hivex/ui.json', import.meta.url)));
const account = report.records[0].account;
const relayer = JSON.parse(fs.readFileSync(new URL('./runtime/relayer.json', import.meta.url))).address;
const token = new Interface(['function balanceOf(address) view returns(uint256)', 'function totalSupply() view returns(uint256)']);
const mailbox = new Interface(['function process(bytes,bytes)',
  'event Dispatch(address indexed sender,uint32 indexed destination,bytes32 indexed recipient,bytes message)']);
const read = async (endpoint, method, args = []) => token.decodeFunctionResult(method,
  await rpc(endpoint.rpcUrl, 'eth_call', [{ to: endpoint.token, data: token.encodeFunctionData(method, args) }, 'latest']))[0];
const balances = {
  userBsc: await read(bsc, 'balanceOf', [account]), userHiveX: await read(hive, 'balanceOf', [account]),
  reserve: await read(bsc, 'balanceOf', [bsc.router]), supply: await read(hive, 'totalSupply'),
};
assert.equal(balances.reserve, balances.supply);
assert.equal(balances.userHiveX, balances.supply);
assert.equal(balances.userBsc + balances.reserve, 1000000n * 100000000n);
const transactions = [];
for (const tx of report.transactions) {
  const endpoint = route.endpoints.find(endpoint => endpoint.chainId === tx.chainId);
  const byNodeHash = await confirm(endpoint.rpcUrl, [tx.hash]);
  const byRawHash = await confirm(endpoint.rpcUrl, [tx.localHash]);
  assert.equal(byNodeHash.blockHash, byRawHash.blockHash);
}
for (const record of report.records) {
  const source = route.endpoints.find(endpoint => endpoint.key === record.sourceKey);
  const target = route.endpoints.find(endpoint => endpoint.key !== record.sourceKey);
  const sourceReceipt = await confirm(source.rpcUrl, [record.sourceHash]);
  const destinationReceipt = await confirm(target.rpcUrl, [record.destinationHash]);
  transactions.push({ sourceChain: source.name, sourceHash: record.sourceHash, sourceBlock: sourceReceipt.blockNumber,
    destinationHash: record.destinationHash, destinationBlock: destinationReceipt.blockNumber, messageId: record.messageId });
}
const inbound = report.records.find(record => record.sourceKey === bsc.key);
const receipt = await confirm(bsc.rpcUrl, [inbound.sourceHash]);
const event = receipt.logs.filter(log => log.address === bsc.mailbox).map(log => {
  try { return mailbox.parseLog(log); } catch { return null; }
}).find(event => event?.name === 'Dispatch');
assert.ok(event);
const message = event.args.message;
const forged = concat([dataSlice(message, 0, 1), zeroPadValue(toBeHex(0xfffffffe), 4), dataSlice(message, 5)]);
const simulate = (from, data) => rpc(hive.rpcUrl, 'eth_call', [{ from, to: hive.mailbox,
  data: mailbox.encodeFunctionData('process', ['0x', data]) }, 'latest']);
await assert.rejects(() => simulate(account, forged));
assert.equal(await simulate(relayer, forged), '0x', 'Trusted relayer dry run is the positive control');
await assert.rejects(() => simulate(relayer, message));
const nonceBefore = await rpc(hive.rpcUrl, 'eth_getTransactionCount', [relayer, 'latest']);
await relayOnce();
assert.equal(await rpc(hive.rpcUrl, 'eth_getTransactionCount', [relayer, 'latest']), nonceBefore);
assert.equal(await read(hive, 'totalSupply'), balances.supply);
const height = await rpc(hive.rpcUrl, 'eth_blockNumber');
const canonical = (await rpc(hive.rpcUrl, 'eth_getBlockByNumber', [height, false])).hash;
const nodes = [];
for (const suffix of [110, 161, 162, 163, 164, 165, 166]) {
  const url = `http://192.168.1.${suffix}:13134`;
  assert.equal((await rpc(url, 'eth_getBlockByNumber', [height, false])).hash, canonical);
  assert.equal((await rpc(url, 'eth_getLogs', [{ fromBlock: '0x321', toBlock: '0x321' }])).length, 6);
  nodes.push({ url, height: Number(BigInt(height)), blockHash: canonical });
}
const result = { testedAt: new Date().toISOString(), routeId: route.id,
  balances: Object.fromEntries(Object.entries(balances).map(([key, value]) => [key, value.toString()])), transactions, nodes,
  checks: ['Two-direction receipts/by-hash/canonical blocks', 'Wallet raw and node hash aliases agree', 'Collateral reserve equals synthetic supply',
    'User token conservation', 'Unauthorized relayer rejected with trusted positive control',
    'Replay rejected', 'Relayer rescan sends no transaction', 'Seven-node block hash and historical log agreement'] };
fs.writeFileSync(new URL('./test-results/hivex/verification.json', import.meta.url), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
