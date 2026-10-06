import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import ganache from 'ganache';
import { ethers } from 'ethers';
import { CONTRACTS, createDeployment, runDeployment } from '../../src/app/lib/bridge-deployment';
import { bridgeDeployPlugin } from '../bridge-deploy-plugin';

// Isolated in-memory test chains. No configured HiveX/Local BSC RPC is contacted.
const root = path.dirname(fileURLToPath(import.meta.url));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-bridge-deploy-test-'));
const a = ganache.server({ chain: { chainId: 12315, hardfork: 'shanghai' }, wallet: { deterministic: true }, logging: { quiet: true } });
const b = ganache.server({ chain: { chainId: 31338, hardfork: 'shanghai' }, wallet: { deterministic: true }, logging: { quiet: true } });
let api: http.Server | undefined;
try {
  await a.listen(0, '127.0.0.1'); await b.listen(0, '127.0.0.1');
  const servers = [a, b];
  const account = Object.keys(a.provider.getInitialAccounts())[0];
  const relayer = ethers.Wallet.createRandom().address;
  const placeholder = '0x1111111111111111111111111111111111111111';
  const endpoints = servers.map((server, index) => ({ key: index ? 'local-bsc' : 'hivex', name: index ? 'Local BSC' : 'HiveX Devnet',
    chainId: index ? 31338 : 12315, domain: index ? 31338 : 12315, rpcUrl: `http://127.0.0.1:${(server.address() as any).port}`,
    nativeSymbol: index ? 'BNB' : 'OHI', nativeDecimals: 18, type: index ? 'collateral' : 'synthetic', scale: '1',
    token: placeholder, router: placeholder, mailbox: placeholder, deploymentBlock: 0 }));
  const routesFile = path.join(temporary, 'public/bridge/routes.json');
  fs.mkdirSync(path.dirname(routesFile), { recursive: true });
  fs.writeFileSync(routesFile, JSON.stringify({ schemaVersion: 1, environment: 'local-test', routes: [
    { id: 'retained-old-route', name: 'Old route fixture', symbol: 'OLD', decimals: 8, security: 'Test', endpoints },
  ] }));
  const lab = path.join(temporary, 'tools/bridge-lab');
  fs.mkdirSync(path.join(lab, 'runtime'), { recursive: true });
  fs.mkdirSync(path.join(lab, 'artifacts'));
  fs.writeFileSync(path.join(lab, 'runtime/relayer.json'), JSON.stringify({ address: relayer, privateKey: 'MUST_NOT_BE_EXPOSED' }));
  for (const name of CONTRACTS) fs.copyFileSync(path.join(root, 'artifacts', `${name}.json`), path.join(lab, 'artifacts', `${name}.json`));
  let middleware: any;
  const plugin = bridgeDeployPlugin(temporary);
  (plugin.configureServer as any)({ middlewares: { use: (_prefix: string, handler: any) => { middleware = handler; } } });
  api = http.createServer((req, res) => { req.url = req.url!.replace('/__bridge-deploy', ''); void middleware(req, res); });
  await new Promise<void>(resolve => api!.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(api.address() as any).port}`;
  const response = await fetch(`${origin}/__bridge-deploy/setup`, { headers: { 'x-bridge-request': '1' } });
  const setupText = await response.text();
  assert.ok(!setupText.includes('MUST_NOT_BE_EXPOSED'));
  const setup = JSON.parse(setupText);
  const run = createDeployment(setup, { name: 'Fresh Test', symbol: 'NEW', decimals: 8, supply: '12500', holder: account, relayGas: '0.01' }, account);
  let network = 0;
  let broadcasts = 0;
  let saves = 0;
  const provider = { request: async ({ method, params }: any) => {
    if (method === 'wallet_switchEthereumChain') { network = BigInt(params[0].chainId) === 12315n ? 0 : 1; return null; }
    if (method === 'eth_sendTransaction') broadcasts++;
    return servers[network].provider.request({ method, params: params || [] } as any);
  } };
  const save = () => { saves++; fs.writeFileSync(path.join(temporary, 'journal.json'), JSON.stringify(run)); };
  await assert.rejects(runDeployment(run, setup, provider, save, () => {}, () => broadcasts >= 5), /paused/);
  const resumed = JSON.parse(fs.readFileSync(path.join(temporary, 'journal.json'), 'utf8'));
  assert.equal(resumed.steps.filter((step: any) => step.state === 'confirmed').length, 5);
  await runDeployment(resumed, setup, provider, () => { saves++; }, label => console.log(label));
  assert.equal(broadcasts, 19, '17 configuration transactions and 2 relayer top-ups, with no duplicate deployments after resume');
  assert.equal(resumed.steps.filter((step: any) => step.state === 'confirmed').length, 19);
  const publish = (token: string, route = resumed.route) => fetch(`${origin}/__bridge-deploy/publish`, { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-bridge-request': '1', 'x-bridge-token': token, origin }, body: JSON.stringify({ route, owner: account }) });
  assert.equal((await publish('bad-token')).status, 403);
  const result = await publish(setup.publishToken);
  const body = await result.json();
  assert.equal(result.status, 200, JSON.stringify(body));
  assert.equal(body.relayerRunning, false);
  assert.equal((await publish(setup.publishToken)).status, 200, 'publication retry is idempotent');
  const saved = JSON.parse(fs.readFileSync(routesFile, 'utf8'));
  assert.deepEqual(saved.routes.map((route: any) => route.id), [resumed.id, 'retained-old-route']);
  const invalid = structuredClone(resumed.route); invalid.endpoints[0].rpcUrl = 'http://invalid.example';
  assert.equal((await publish(setup.publishToken, invalid)).status, 400, 'untrusted RPC rejected before access');
  console.log(JSON.stringify({ result: 'PASS', broadcasts, saves, confirmed: resumed.steps.length, routesRetained: saved.routes.length }));
} finally {
  if (api) await new Promise<void>(resolve => api!.close(() => resolve()));
  await a.close(); await b.close();
  fs.rmSync(temporary, { recursive: true, force: true });
}
