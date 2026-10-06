import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Wallet, Interface, zeroPadValue, keccak256 } from 'ethers';
import { rpc, send } from './rpc.mjs';
import { relayOnce } from './relay.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
if (!process.env.BRIDGE_USER_PRIVATE_KEY) throw new Error('Set BRIDGE_USER_PRIVATE_KEY for the funded test wallet.');
const wallet = new Wallet(process.env.BRIDGE_USER_PRIVATE_KEY);
const route = JSON.parse(fs.readFileSync(path.resolve(root, '../../public/bridge/routes.json'))).routes.find(route => route.id === 'hbr-local-evm-bsc');
const [synthetic, collateral] = route.endpoints;
const token = new Interface(['function balanceOf(address) view returns(uint256)', 'function totalSupply() view returns(uint256)',
  'function approve(address,uint256) returns(bool)', 'function transfer(address,uint256) returns(bool)']);
const router = new Interface(['function transferRemote(uint32,bytes32,uint256) payable returns(bytes32)']);
const mailbox = new Interface(['function process(bytes,bytes)', 'function delivered(bytes32) view returns(bool)',
  'event Dispatch(address indexed sender,uint32 indexed destination,bytes32 indexed recipient,bytes message)']);
async function balance(endpoint, account) {
  return token.decodeFunctionResult('balanceOf', await rpc(endpoint.rpcUrl, 'eth_call', [{ to: endpoint.token, data: token.encodeFunctionData('balanceOf', [account]) }, 'latest']))[0];
}
const report = { testedAt: new Date().toISOString(), route: route.id, account: wallet.address, transactions: [], checks: [] };
const initial = { collateral: await balance(collateral, wallet.address), synthetic: await balance(synthetic, wallet.address), reserve: await balance(collateral, collateral.router) };
const amount = 12500000000n;
await send(collateral, wallet, { to: collateral.token, data: token.encodeFunctionData('approve', [collateral.router, amount]) });
const outbound = await send(collateral, wallet, { to: collateral.router, data: router.encodeFunctionData('transferRemote', [synthetic.domain, zeroPadValue(wallet.address, 32), amount]) });
report.transactions.push({ direction: 'Local BSC -> Local EVM', sourceHash: outbound.hash, block: outbound.receipt.blockNumber });
await relayOnce();
assert.equal(await balance(collateral, wallet.address), initial.collateral - amount);
assert.equal(await balance(collateral, collateral.router), initial.reserve + amount);
assert.equal(await balance(synthetic, wallet.address), initial.synthetic + amount);
report.checks.push('Collateral locked and synthetic token minted: exactly 125 HBR.');

const backAmount = 5000000000n;
const returned = await send(synthetic, wallet, { to: synthetic.router, data: router.encodeFunctionData('transferRemote', [collateral.domain, zeroPadValue(wallet.address, 32), backAmount]) });
report.transactions.push({ direction: 'Local EVM -> Local BSC', sourceHash: returned.hash, block: returned.receipt.blockNumber });
await relayOnce();
assert.equal(await balance(collateral, wallet.address), initial.collateral - amount + backAmount);
assert.equal(await balance(collateral, collateral.router), initial.reserve + amount - backAmount);
assert.equal(await balance(synthetic, wallet.address), initial.synthetic + amount - backAmount);
report.checks.push('Synthetic burned and collateral released: exactly 50 HBR.');

const dispatch = outbound.receipt.logs.filter(log => log.address.toLowerCase() === collateral.mailbox.toLowerCase())
  .map(log => { try { return mailbox.parseLog(log); } catch { return null; } }).find(log => log?.name === 'Dispatch');
const messageId = keccak256(dispatch.args.message);
const processData = mailbox.encodeFunctionData('process', ['0x', dispatch.args.message]);
await assert.rejects(() => rpc(synthetic.rpcUrl, 'eth_call', [{ from: wallet.address, to: synthetic.mailbox, data: processData }, 'latest']));
report.checks.push('Already delivered message cannot be processed twice.');
const after = await balance(synthetic, wallet.address);
await relayOnce();
assert.equal(await balance(synthetic, wallet.address), after);
report.checks.push('Relayer replay/rescan does not duplicate balances.');
report.messageId = messageId;
report.finalBalances = { collateral: (await balance(collateral, wallet.address)).toString(), synthetic: after.toString(), reserve: (await balance(collateral, collateral.router)).toString() };
report.deliveryTransactions = JSON.parse(fs.readFileSync(path.join(root, 'runtime/relay-state.json'))).deliveries;
fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
fs.writeFileSync(path.join(root, 'test-results/smoke.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ checks: report.checks, balances: report.finalBalances, messageId }, null, 2));
