import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Wallet, Interface, keccak256, zeroPadValue, toQuantity } from 'ethers';
import { rpc, send, confirm, pause } from './rpc.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(root, '../../public/bridge/routes.json');
const statePath = path.join(root, 'runtime/relay-state.json');
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath)) : { cursors: {}, deliveries: {} };
const relayer = new Wallet(JSON.parse(fs.readFileSync(path.join(root, 'runtime/relayer.json'))).privateKey);
const mailbox = new Interface([
  'event Dispatch(address indexed sender,uint32 indexed destination,bytes32 indexed recipient,bytes message)',
  'function delivered(bytes32) view returns (bool)',
  'function process(bytes metadata,bytes message) payable',
]);
function save() {
  fs.writeFileSync(`${statePath}.tmp`, JSON.stringify(state, null, 2), { mode: 0o600 });
  fs.renameSync(`${statePath}.tmp`, statePath);
}
export async function relayOnce() {
  const config = JSON.parse(fs.readFileSync(configPath));
  for (const route of config.routes) {
    for (let index = 0; index < route.endpoints.length; index++) {
      const source = route.endpoints[index];
      const target = route.endpoints[1 - index];
      const cursorKey = `${source.chainId}:${source.mailbox}`;
      const head = Number(BigInt(await rpc(source.rpcUrl, 'eth_blockNumber')));
      const start = Math.max(source.deploymentBlock, (state.cursors[cursorKey] ?? source.deploymentBlock) - 3);
      // Bound each getLogs query and replay a small overlap after restart.
      for (let from = start; from <= head; from += 200) {
        const to = Math.min(head, from + 199);
        const logs = await rpc(source.rpcUrl, 'eth_getLogs', [{ address: source.mailbox,
          topics: [mailbox.getEvent('Dispatch').topicHash], fromBlock: toQuantity(from), toBlock: toQuantity(to) }]);
        for (const log of logs) {
          if (log.removed) continue;
          const parsed = mailbox.parseLog(log);
          if (parsed.args.sender.toLowerCase() !== source.router.toLowerCase() || Number(parsed.args.destination) !== target.domain ||
            parsed.args.recipient.toLowerCase() !== zeroPadValue(target.router, 32).toLowerCase()) continue;
          const message = parsed.args.message;
          const id = keccak256(message);
          const deliveredData = await rpc(target.rpcUrl, 'eth_call', [{ to: target.mailbox,
            data: mailbox.encodeFunctionData('delivered', [id]) }, 'latest']);
          if (mailbox.decodeFunctionResult('delivered', deliveredData)[0]) continue;
          const sourceReceipt = await confirm(source.rpcUrl, [log.transactionHash]);
          if (sourceReceipt.blockHash.toLowerCase() !== log.blockHash.toLowerCase()) throw new Error(`Source reorg at ${log.transactionHash}`);
          const pending = state.deliveries[id];
          const result = pending?.hash ? { ...pending, receipt: await confirm(target.rpcUrl, [pending.hash, pending.localHash]) } :
            await send(target, relayer, { to: target.mailbox, data: mailbox.encodeFunctionData('process', ['0x', message]) }, submitted => {
              state.deliveries[id] = { ...submitted, sourceHash: log.transactionHash, destinationChainId: target.chainId };
              save();
            });
          state.deliveries[id] = { ...state.deliveries[id], ...result, messageId: id, delivered: true };
          save();
          console.log(`Delivered ${source.name} -> ${target.name}: message=${id} tx=${result.hash}`);
        }
        state.cursors[cursorKey] = to;
        save();
      }
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const lockPath = path.join(root, 'runtime/relay.lock');
  if (fs.existsSync(lockPath)) {
    const pid = Number(fs.readFileSync(lockPath, 'utf8'));
    let alive = false;
    try { process.kill(pid, 0); alive = true; } catch {}
    if (alive) throw new Error(`Relayer already running (pid ${pid}).`);
    fs.unlinkSync(lockPath);
  }
  fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx', mode: 0o600 });
  const stop = () => { try { fs.unlinkSync(lockPath); } catch {} process.exit(); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  console.log(`Trusted local relayer: ${relayer.address}`);
  do {
    try { await relayOnce(); } catch (error) { console.error(error.message); }
    if (process.argv.includes('--once')) break;
    await pause(3000);
  } while (true);
  stop();
}
