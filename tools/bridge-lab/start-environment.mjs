import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { Interface, Wallet, isAddress, zeroPadValue } from 'ethers';
import { rpc, pause } from './rpc.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const frontend = path.resolve(root, '../..');
const runtime = path.join(root, 'runtime');
const abi = new Interface([
  'function routers(uint32) view returns (bytes32)',
  'function mailbox() view returns (address)',
  'function localDomain() view returns (uint32)',
  'function trustedRelayer() view returns (address)',
]);

export function options(args) {
  const result = { check: false, noRelay: false, port: 5174, help: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--check') result.check = true;
    else if (args[i] === '--no-relay') result.noRelay = true;
    else if (args[i] === '--help') result.help = true;
    else if (args[i] === '--port') {
      const value = args[++i];
      if (!/^\d+$/.test(value ?? '') || Number(value) < 1024 || Number(value) > 65535) {
        throw new Error('--port requires an integer between 1024 and 65535');
      }
      result.port = Number(value);
    } else throw new Error(`Unknown option: ${args[i]}`);
  }
  return result;
}

export function validateConfig(config) {
  if (config.schemaVersion !== 1 || !config.routes?.length) throw new Error('Missing bridge routes');
  for (const route of config.routes) {
    if (route.endpoints?.length !== 2) throw new Error(`Invalid route: ${route.id}`);
    for (const endpoint of route.endpoints) {
      if (!Number.isSafeInteger(endpoint.chainId) || !Number.isSafeInteger(endpoint.domain)) {
        throw new Error(`Invalid chain/domain: ${endpoint.key}`);
      }
      if (!['http:', 'https:'].includes(new URL(endpoint.rpcUrl).protocol)) throw new Error('Invalid RPC URL');
      for (const field of ['mailbox', 'router', 'token', 'ism', 'hook']) {
        if (!isAddress(endpoint[field]) || /^0x0{40}$/i.test(endpoint[field])) {
          throw new Error(`Invalid ${endpoint.key}.${field}`);
        }
      }
    }
  }
}

export async function checkRoutes(config, relayerAddress, call = rpc, report = console.log) {
  for (const route of config.routes) {
    for (let i = 0; i < 2; i++) {
      const endpoint = route.endpoints[i];
      const remote = route.endpoints[1 - i];
      const request = async (method, params = []) => {
        try { return await call(endpoint.rpcUrl, method, params); }
        catch (error) { throw new Error(`${endpoint.key} (${endpoint.rpcUrl}) ${method}: ${error.cause?.code ?? error.message}`); }
      };
      const read = async (to, method, params = []) => abi.decodeFunctionResult(method,
        await request('eth_call', [{ to, data: abi.encodeFunctionData(method, params) }, 'latest']))[0];
      const chainId = BigInt(await request('eth_chainId'));
      if (chainId !== BigInt(endpoint.chainId)) throw new Error(`${endpoint.key}: wrong chain ID ${chainId}`);
      for (const address of new Set(['mailbox', 'router', 'token', 'ism', 'hook'].map(key => endpoint[key]))) {
        const code = await request('eth_getCode', [address, 'latest']);
        if (!/^0x[0-9a-f]+$/i.test(code) || /^0x0*$/i.test(code)) {
          throw new Error(`${endpoint.key}: missing contract ${address}; restore the original database, do not redeploy blindly`);
        }
      }
      if (Number(await read(endpoint.mailbox, 'localDomain')) !== endpoint.domain) throw new Error(`${endpoint.key}: mailbox domain mismatch`);
      if ((await read(endpoint.router, 'mailbox')).toLowerCase() !== endpoint.mailbox.toLowerCase()) throw new Error(`${endpoint.key}: router mailbox mismatch`);
      if ((await read(endpoint.router, 'routers', [remote.domain])).toLowerCase() !== zeroPadValue(remote.router, 32).toLowerCase()) {
        throw new Error(`${endpoint.key}: remote router enrollment mismatch`);
      }
      if ((await read(endpoint.ism, 'trustedRelayer')).toLowerCase() !== relayerAddress.toLowerCase()) throw new Error(`${endpoint.key}: relayer identity mismatch`);
      if (BigInt(await request('eth_getBalance', [relayerAddress, 'latest'])) === 0n) throw new Error(`${endpoint.key}: relayer has no Gas balance`);
      const head = await request('eth_blockNumber');
      if (!Array.isArray(await request('eth_getLogs', [{ address: endpoint.mailbox, fromBlock: head, toBlock: head }]))) {
        throw new Error(`${endpoint.key}: invalid eth_getLogs response`);
      }
      report(`[OK] ${route.id} / ${endpoint.key}: block=${BigInt(head)}, contracts and enrollment verified`);
    }
  }
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function accountAddress(file) {
  try {
    const account = readJson(path.join(runtime, file));
    const address = new Wallet(account.privateKey).address;
    if (account.address && account.address.toLowerCase() !== address.toLowerCase()) throw new Error('Mismatch');
    return address;
  } catch { throw new Error(`Invalid runtime/${file}: check the existing key and address (key redacted)`); }
}
function matches(pid, script, extra = []) {
  try {
    const args = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0');
    return args.includes(script) && extra.every(arg => args.includes(arg)) && !fs.readFileSync(`/proc/${pid}/stat`, 'utf8').includes(') Z ');
  } catch { return false; }
}
function servicePid(name, script, extra = []) {
  for (const suffix of name === 'relay' ? ['lock', 'pid'] : ['pid']) {
    try {
      const pid = Number(fs.readFileSync(path.join(runtime, `${name}.${suffix}`), 'utf8'));
      if (matches(pid, script, extra)) return pid;
    } catch {}
  }
  return null;
}
async function launch(name, script, args = [], cwd = root) {
  const existing = servicePid(name, script, args);
  if (existing) { console.log(`[OK] ${name}: running pid=${existing}`); return; }
  const fd = fs.openSync(path.join(runtime, `${name}.log`), 'a', 0o600);
  try {
    const child = spawn(process.execPath, [script, ...args], { cwd, detached: true, stdio: ['ignore', fd, fd] });
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    fs.writeFileSync(path.join(runtime, `${name}.pid`), String(child.pid), { mode: 0o600 });
    child.unref();
    await pause(1500);
    if (!matches(child.pid, script, args)) throw new Error(`${name} exited; inspect runtime/${name}.log`);
    console.log(`[OK] ${name}: started pid=${child.pid}`);
  } finally { fs.closeSync(fd); }
}
async function waitFor(label, probe, timeout = 45000) {
  const end = Date.now() + timeout;
  let error;
  do {
    try { return await probe(); } catch (cause) { error = cause; }
    await pause(1000);
  } while (Date.now() < end);
  throw new Error(`${label}: ${error.message}`);
}

export async function ensureLocalRpc({ name, url, chainId, check, start }, call = rpc) {
  try {
    let id;
    try { id = await call(url, 'eth_chainId'); } catch (error) {
      if (check || error.cause?.code !== 'ECONNREFUSED') throw error;
      await start();
      id = await waitFor(name, () => call(url, 'eth_chainId'));
    }
    if (BigInt(id) !== BigInt(chainId)) throw new Error(`wrong chain ID ${id}, expected ${chainId}`);
  } catch (error) {
    throw new Error(`${name} (${url}): ${error.cause?.code ?? error.message}`);
  }
}

export async function frontendReady(url, config, fetcher = fetch) {
  let response;
  try { response = await fetcher(`${url}/bridge/routes.json`, { signal: AbortSignal.timeout(3000) }); }
  catch (error) {
    if (error.cause?.code === 'ECONNREFUSED') return false;
    throw new Error(`Cannot verify frontend port: ${error.message}`);
  }
  if (!response.ok) throw new Error('Frontend port is occupied by an unrecognized server; choose --port');
  let actual;
  try { actual = await response.json(); } catch { throw new Error('Frontend returned non-JSON routes; choose --port'); }
  if (JSON.stringify(actual) !== JSON.stringify(config)) throw new Error('Frontend route configuration differs; choose --port or correct the existing server');
  return true;
}

async function main(args) {
  const opts = options(args);
  if (opts.help) {
    console.log('node start-environment.mjs [--check] [--no-relay] [--port 5174]\nRestores existing chains and contracts. Default start enables the transaction-sending relayer.\n--check: read-only checks; --no-relay: do not start a stopped relayer (does not stop an existing one).');
    return;
  }
  if (process.platform !== 'linux') throw new Error('Run inside WSL, or use Start-Bridge.ps1 from Windows');
  const config = readJson(path.join(frontend, 'public/bridge/routes.json'));
  validateConfig(config);
  // This entry point restores an existing deployment, never initializes a new chain or identity.
  for (const entry of ['local-account.json', 'relayer.json', 'relay-state.json', 'bsc-db', 'evm-db']) {
    if (!fs.existsSync(path.join(runtime, entry))) throw new Error(`Missing runtime/${entry}; restore the existing environment/backup first`);
  }
  for (const db of ['bsc-db', 'evm-db']) {
    if (!fs.existsSync(path.join(runtime, db, 'CURRENT'))) throw new Error(`runtime/${db} is not an existing LevelDB database; restore the original data`);
  }
  accountAddress('local-account.json');
  const relayerAddress = accountAddress('relayer.json');
  const state = readJson(path.join(runtime, 'relay-state.json'));
  const pending = Object.values(state.deliveries ?? {}).filter(item => !item.delivered).length;
  console.log(`Relayer: ${relayerAddress}; pending recorded deliveries: ${pending}`);
  if (pending) console.log('[WARN] Pending hashes are preserved. Startup does not clear/rebroadcast/recover stuck transactions.');
  const lock = path.join(runtime, 'environment-start.lock');
  let ownsLock = false;
  try {
    if (!opts.check) {
      if (fs.existsSync(lock)) {
        const pid = Number(fs.readFileSync(lock, 'utf8'));
        if (!Number.isInteger(pid) || pid <= 0) throw new Error('Invalid startup lock; inspect runtime/environment-start.lock');
        let alive = true;
        try { process.kill(pid, 0); } catch (error) { if (error.code === 'ESRCH') alive = false; else throw error; }
        if (alive) throw new Error(`Another startup is running (pid ${pid})`);
        fs.unlinkSync(lock);
      }
      fs.writeFileSync(lock, String(process.pid), { flag: 'wx', mode: 0o600 });
      ownsLock = true;
    }
    for (const [name, port, chainId, chainArgs] of [['bsc', 8546, 31338, []], ['evm', 8545, 31337, ['--evm']]]) {
      const url = `http://127.0.0.1:${port}`;
      await ensureLocalRpc({ name, url, chainId, check: opts.check,
        start: () => launch(name, path.join(root, 'chain.mjs'), chainArgs) });
      console.log(`[OK] ${name}: RPC ready on ${port}`);
    }
    await checkRoutes(config, relayerAddress);
    const url = `http://127.0.0.1:${opts.port}`;
    if (!await frontendReady(url, config)) {
      if (opts.check) throw new Error(`Frontend is not running on ${opts.port}`);
      const vite = path.join(frontend, 'node_modules/vite/bin/vite.js');
      if (!fs.existsSync(vite)) throw new Error('Frontend dependencies missing; run npm ci in hubfrontend');
      console.log('Building the existing frontend SDK...');
      await new Promise((resolve, reject) => {
        const child = spawn('npm', ['run', 'build:sdk'], { cwd: frontend, stdio: 'inherit' });
        child.once('error', reject);
        child.once('exit', code => code === 0 ? resolve() : reject(new Error(`SDK build failed (${code})`)));
      });
      await launch('frontend', vite, ['--host', '0.0.0.0', '--port', String(opts.port), '--strictPort'], frontend);
      await waitFor('Frontend', async () => { if (!await frontendReady(url, config)) throw new Error('Not listening yet'); });
    }
    const relay = path.join(root, 'relay.mjs');
    if (!opts.check && !opts.noRelay) {
      console.log('[NOTICE] Starting relayer may submit destination transactions for pending source messages.');
      await launch('relay', relay);
    }
    const pid = servicePid('relay', relay);
    if (!pid && !opts.noRelay) throw new Error('Relayer is not running');
    console.log(`Relayer: ${pid ? `running pid=${pid}` : 'not started (--no-relay)'}`);
    console.log(`Hub: http://localhost:${opts.port}/bridge\nDev tools: http://localhost:${opts.port}/dev-tools/native-flow\nLogs: ${runtime}/{bsc,evm,relay,frontend}.log`);
    console.log('Readiness verified for configured RPCs; this is not a seven-node consensus or end-to-end transaction test.');
  } finally {
    if (ownsLock) fs.unlinkSync(lock);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => {
    console.error(`[FAILED] ${error.message}\nExisting data and processes were not removed. Inspect logs; partially started services remain running.`);
    process.exitCode = 1;
  });
}
