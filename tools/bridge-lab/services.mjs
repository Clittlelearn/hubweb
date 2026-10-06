import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { rpc, pause } from './rpc.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const runtime = path.join(root, 'runtime');
fs.mkdirSync(runtime, { recursive: true, mode: 0o700 });
const services = { bsc: ['chain.mjs'], evm: ['chain.mjs', '--evm'], relay: ['relay.mjs'] };
const action = process.argv[2] || 'start';
const names = process.argv.slice(3).length ? process.argv.slice(3) : Object.keys(services);
for (const name of names) {
  if (!services[name]) throw new Error(`Unknown service ${name}`);
  const pidFile = path.join(runtime, `${name}.pid`);
  let pid = fs.existsSync(pidFile) ? Number(fs.readFileSync(pidFile, 'utf8')) : 0;
  let running = false;
  try {
    const args = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
    running = args.includes(path.join(root, services[name][0])) &&
      (name === 'evm' ? args.includes('--evm') : name === 'bsc' ? !args.includes('--evm') : true);
  } catch {}
  if (action === 'stop') {
    if (running) process.kill(pid, 'SIGTERM');
    console.log(`${name}: ${running ? 'stopping' : 'not running'}`);
    continue;
  }
  if (running) { console.log(`${name}: running pid=${pid}`); continue; }
  if (name !== 'relay') {
    try { await rpc(`http://127.0.0.1:${name === 'evm' ? 8545 : 8546}`, 'eth_chainId'); console.log(`${name}: RPC already listening`); continue; } catch {}
  }
  const log = fs.openSync(path.join(runtime, `${name}.log`), 'a');
  const child = spawn(process.execPath, [path.join(root, services[name][0]), ...services[name].slice(1)], {
    cwd: root, detached: true, stdio: ['ignore', log, log],
  });
  fs.writeFileSync(pidFile, String(child.pid));
  child.unref();
  fs.closeSync(log);
  await pause(1200);
  if (name !== 'relay') await rpc(`http://127.0.0.1:${name === 'evm' ? 8545 : 8546}`, 'eth_chainId');
  console.log(`${name}: started pid=${child.pid}`);
}
