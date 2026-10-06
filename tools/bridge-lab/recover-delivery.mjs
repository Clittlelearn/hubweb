import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Interface, Wallet, keccak256, zeroPadValue, isHexString } from 'ethers';
import { rpc, confirm } from './rpc.mjs';

// Explicit recovery for this lab's unchanged rpc.mjs transaction envelope.
// Replay is allowed only when the reconstructed signature matches the saved hash.
const root = path.dirname(fileURLToPath(import.meta.url));
const id = process.argv[2];
if (!isHexString(id, 32)) throw new Error('Usage: node recover-delivery.mjs <messageId> [--execute]');
const execute = process.argv.includes('--execute');
const statePath = path.join(root, 'runtime/relay-state.json');
const lockPath = path.join(root, 'runtime/relay.lock');
const config = JSON.parse(fs.readFileSync(path.resolve(root, '../../public/bridge/routes.json')));
const mailbox = new Interface([
  'event Dispatch(address indexed sender,uint32 indexed destination,bytes32 indexed recipient,bytes message)',
  'function delivered(bytes32) view returns(bool)', 'function process(bytes,bytes) payable',
]);
let locked = false;
try {
  // Require the normal relayer to be stopped, including removal of its lock.
  fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx', mode: 0o600 });
  locked = true;
  const state = JSON.parse(fs.readFileSync(statePath));
  const pending = state.deliveries[id];
  assert.ok(pending?.hash && pending.localHash && !pending.delivered, 'No unresolved saved delivery');
  assert.ok(Number.isSafeInteger(pending.nonce), 'Missing saved nonce');
  const route = config.routes.find(route => route.id === 'hbr-hivex-local-bsc');
  assert.ok(route, 'Missing known lab route');
  const target = route.endpoints.find(endpoint => endpoint.chainId === pending.destinationChainId);
  assert.equal(target?.key, 'hivex', 'This recovery is restricted to the HiveX lab destination');
  const source = route.endpoints.find(endpoint => endpoint !== target);
  assert.equal(BigInt(await rpc(source.rpcUrl, 'eth_chainId')), BigInt(source.chainId));
  const sourceReceipt = await confirm(source.rpcUrl, [pending.sourceHash]);
  const dispatches = sourceReceipt.logs.filter(log => log.address.toLowerCase() === source.mailbox.toLowerCase())
    .map(log => { try { return mailbox.parseLog(log); } catch { return null; } })
    .filter(log => log?.name === 'Dispatch' && keccak256(log.args.message) === id);
  assert.equal(dispatches.length, 1, 'Source message must be unique');
  const dispatch = dispatches[0].args;
  assert.equal(dispatch.sender.toLowerCase(), source.router.toLowerCase());
  assert.equal(Number(dispatch.destination), target.domain);
  assert.equal(dispatch.recipient.toLowerCase(), zeroPadValue(target.router, 32).toLowerCase());
  const deliveredData = mailbox.encodeFunctionData('delivered', [id]);
  const wallet = new Wallet(JSON.parse(fs.readFileSync(path.join(root, 'runtime/relayer.json'))).privateKey);
  const checks = [];
  for (const suffix of ['110', '161', '162', '163', '164', '165', '166']) {
    const url = `http://192.168.1.${suffix}:13134`;
    assert.equal(BigInt(await rpc(url, 'eth_chainId')), BigInt(target.chainId));
    const height = await rpc(url, 'eth_blockNumber');
    const block = await rpc(url, 'eth_getBlockByNumber', [height, false]);
    assert.ok(block?.hash, 'Missing canonical head');
    const delivered = mailbox.decodeFunctionResult('delivered', await rpc(url, 'eth_call', [{ to: target.mailbox, data: deliveredData }, 'latest']))[0];
    assert.equal(delivered, false, `Message already delivered on ${suffix}; reconcile instead of replaying`);
    for (const hash of new Set([pending.hash, pending.localHash])) {
      for (const method of ['eth_getTransactionReceipt', 'eth_getTransactionByHash']) {
        assert.equal(await rpc(url, method, [hash]), null, `Old transaction known on ${suffix}; confirm it instead`);
      }
    }
    for (const tag of ['latest', 'pending']) {
      assert.equal(BigInt(await rpc(url, 'eth_getTransactionCount', [wallet.address, tag])), BigInt(pending.nonce), `Relayer nonce changed on ${suffix}`);
    }
    checks.push({ host: suffix, height, hash: block.hash });
  }
  assert.equal(new Set(checks.map(check => `${check.height}:${check.hash}`)).size, 1, 'Wait for all nodes to agree');
  const tx = { type: 2, chainId: target.chainId, nonce: pending.nonce, to: target.mailbox,
    data: mailbox.encodeFunctionData('process', ['0x', dispatch.message]), value: 0n,
    gasLimit: 14000000n, maxFeePerGas: 2000000000n, maxPriorityFeePerGas: 500000000n };
  const raw = await wallet.signTransaction(tx);
  assert.equal(keccak256(raw), pending.localHash, 'Reconstructed transaction differs; refusing new signature');
  await rpc(target.rpcUrl, 'eth_call', [{ from: wallet.address, to: tx.to, data: tx.data, gas: '0xd59f80', value: '0x0' }, 'latest']);
  console.log(JSON.stringify({ execute, messageId: id, sourceHash: pending.sourceHash,
    originalDestinationHash: pending.hash, exactRawHash: pending.localHash, nonce: pending.nonce, checks }, null, 2));
  if (execute) {
    const save = () => {
      fs.writeFileSync(`${statePath}.tmp`, JSON.stringify(state, null, 2), { mode: 0o600 });
      fs.renameSync(`${statePath}.tmp`, statePath);
    };
    const stamp = new Date().toISOString();
    fs.copyFileSync(statePath, `${statePath}.before-recovery-${Date.now()}`, fs.constants.COPYFILE_EXCL);
    state.recoveryAttempts ??= [];
    const attempt = { messageId: id, startedAt: stamp, previous: { ...pending }, exactRawHash: pending.localHash, checks, status: 'prepared' };
    state.recoveryAttempts.push(attempt);
    save();
    const result = await rpc(target.rpcUrl, 'eth_sendRawTransaction', [raw]);
    const hash = result.startsWith('0x') ? result : `0x${result}`;
    assert.ok(isHexString(hash, 32), 'Invalid broadcast result; inspect old raw hash before retrying');
    state.deliveries[id] = { ...pending, hash };
    attempt.hash = hash;
    attempt.status = 'submitted';
    save();
    console.log(`Replayed original destination transaction: ${hash}`);
    const receipt = await confirm(target.rpcUrl, [hash, pending.localHash]);
    const delivered = mailbox.decodeFunctionResult('delivered', await rpc(target.rpcUrl, 'eth_call', [{ to: target.mailbox, data: deliveredData }, 'latest']))[0];
    assert.equal(delivered, true, 'Confirmed transaction did not deliver the message');
    state.deliveries[id] = { ...state.deliveries[id], receipt, messageId: id, delivered: true };
    attempt.status = 'confirmed';
    attempt.completedAt = new Date().toISOString();
    save();
    console.log(JSON.stringify({ messageId: id, destinationHash: hash, localHash: pending.localHash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash, status: receipt.status, delivered }, null, 2));
  }
} finally {
  if (locked) fs.unlinkSync(lockPath);
}
