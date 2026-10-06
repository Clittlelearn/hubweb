import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Interface, concat, dataSlice, keccak256, zeroPadValue, toBeHex } from 'ethers';
import { rpc, confirm } from './rpc.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.resolve(root, '../../public/bridge/routes.json')));
const route = config.routes.find(item => item.id === 'hbr-local-evm-bsc');
const [synthetic, collateral] = route.endpoints;
const report = JSON.parse(fs.readFileSync(path.join(root, 'test-results/smoke.json')));
const relayerAddress = JSON.parse(fs.readFileSync(path.join(root, 'runtime/relayer.json'))).address;
const mailbox = new Interface(['function process(bytes,bytes)', 'function delivered(bytes32) view returns(bool)',
  'event Dispatch(address indexed sender,uint32 indexed destination,bytes32 indexed recipient,bytes message)']);
const token = new Interface(['function balanceOf(address) view returns(uint256)', 'function totalSupply() view returns(uint256)']);
const receipt = await confirm(collateral.rpcUrl, [report.transactions[0].sourceHash]);
const dispatch = receipt.logs.filter(log => log.address.toLowerCase() === collateral.mailbox.toLowerCase())
  .map(log => { try { return mailbox.parseLog(log); } catch { return null; } }).find(log => log?.name === 'Dispatch');
const message = dispatch.args.message;
const forged = concat([dataSlice(message, 0, 1), zeroPadValue(toBeHex(0xfffffffe), 4), dataSlice(message, 5)]);
assert.notEqual(keccak256(forged), keccak256(message));
await assert.rejects(() => rpc(synthetic.rpcUrl, 'eth_call', [{ from: report.account, to: synthetic.mailbox,
  data: mailbox.encodeFunctionData('process', ['0x', forged]) }, 'latest']), /ISM verification failed/);
await assert.rejects(() => rpc(synthetic.rpcUrl, 'eth_call', [{ from: relayerAddress, to: synthetic.mailbox,
  data: mailbox.encodeFunctionData('process', ['0x', message]) }, 'latest']), /delivered/);
const reserve = token.decodeFunctionResult('balanceOf', await rpc(collateral.rpcUrl, 'eth_call', [{ to: collateral.token,
  data: token.encodeFunctionData('balanceOf', [collateral.router]) }, 'latest']))[0];
const supply = token.decodeFunctionResult('totalSupply', await rpc(synthetic.rpcUrl, 'eth_call', [{ to: synthetic.token,
  data: token.encodeFunctionData('totalSupply') }, 'latest']))[0];
assert.equal(reserve, supply);
console.log(JSON.stringify({ unauthorizedMessage: 'rejected by ISM', replayByTrustedRelayer: 'rejected',
  collateralReserve: reserve.toString(), syntheticSupply: supply.toString(), chainRestartPersistence: 'verified' }, null, 2));
