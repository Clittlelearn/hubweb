import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { ethers } from 'ethers';
import type { Plugin } from 'vite';
import { validateBridgeConfig, validateRouteOnChain, bridgeCall, bridgeRpc } from '../src/app/lib/bridge-client';
import { CONTRACTS } from '../src/app/lib/bridge-deployment';

export function localDeploymentRequest(req: { headers: Record<string, any>; socket: { remoteAddress?: string } }) {
  const peer = req.socket.remoteAddress;
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer || '')) return false;
  try {
    const host = new URL(`http://${req.headers.host}`).hostname;
    if (!['localhost', '127.0.0.1', '[::1]'].includes(host) || req.headers['x-bridge-request'] !== '1') return false;
    if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return false;
    if (req.headers['sec-fetch-site'] === 'cross-site') return false;
    return true;
  } catch { return false; }
}

export function bridgeDeployPlugin(projectRoot = process.cwd()): Plugin {
  const lab = path.join(projectRoot, 'tools/bridge-lab');
  const publicPath = path.join(projectRoot, 'public/bridge/routes.json');
  const token = randomBytes(32).toString('hex');
  let publishing = false;
  const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
  const setup = () => {
    const config = validateBridgeConfig(read(publicPath));
    const route = config.routes.find(item => item.endpoints.some(e => e.chainId === 12315) && item.endpoints.some(e => e.chainId === 31338));
    if (!route) throw new Error('HiveX / Local BSC network configuration is missing.');
    const identity = read(path.join(lab, 'runtime/relayer.json'));
    if (!ethers.isAddress(identity.address)) throw new Error('Relayer address is missing.');
    const artifacts = Object.fromEntries(CONTRACTS.map(name => {
      const artifact = read(path.join(lab, 'artifacts', `${name}.json`));
      return [name, { abi: artifact.abi, bytecode: artifact.bytecode }];
    }));
    return { relayer: identity.address, nativeFlowBridge: '0xc1b157ac921cf5b89a35d11b9482aa090a0ce921',
      endpoints: route.endpoints, artifacts, publishToken: token };
  };
  const relayerRunning = () => {
    try {
      const pid = Number(fs.readFileSync(path.join(lab, 'runtime/relay.lock'), 'utf8'));
      const args = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0');
      return args.includes(path.join(lab, 'relay.mjs'));
    } catch { return false; }
  };
  return {
    name: 'local-bridge-deployment', apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__bridge-deploy', async (req, res) => {
        const respond = (status: number, value: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(value));
        };
        if (!localDeploymentRequest(req)) { respond(403, { error: 'Bridge deployment is restricted to the local development browser.' }); return; }
        const resource = req.url?.split('?')[0];
        if (req.method === 'GET' && resource === '/setup') {
          try { respond(200, { ...setup(), relayerRunning: relayerRunning() }); }
          catch { respond(503, { error: 'Deployment setup unavailable. Check bridge-lab artifacts, routes and the existing relayer identity.' }); }
          return;
        }
        if (req.method !== 'POST' || resource !== '/publish') { respond(404, { error: 'Unknown deployment endpoint.' }); return; }
        if (req.headers['x-bridge-token'] !== token) { respond(403, { error: 'Deployment session expired. Reload configuration and resume.' }); return; }
        if (publishing) { respond(409, { error: 'Another route is being verified. Retry publishing shortly.' }); return; }
        publishing = true;
        try {
          let size = 0;
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            const buffer = Buffer.from(chunk); size += buffer.length;
            if (size > 16384) throw new Error('Route request is too large.');
            chunks.push(buffer);
          }
          const { route, owner } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (!ethers.isAddress(owner) || !/^wallet-[0-9a-f-]{36}$/.test(route?.id || '')) throw new Error('Invalid wallet deployment route.');
          validateBridgeConfig({ schemaVersion: 1, environment: 'local-test', routes: [route] });
          const expected = setup();
          const abi = new ethers.Interface([
            'function trustedRelayer() view returns (address)', 'function interchainSecurityModule() view returns (address)',
            'function hook() view returns (address)', 'function defaultIsm() view returns (address)',
            'function defaultHook() view returns (address)', 'function requiredHook() view returns (address)',
            'function owner() view returns (address)', 'function nativeFlowBridge() view returns (address)',
            'function mailbox() view returns (address)', 'function symbol() view returns (string)',
            'function protocolFee() view returns (uint256)', 'function destinationGas(uint32) view returns (uint256)',
          ]);
          // Restrict RPC destinations to the pre-existing local test route before any network access.
          for (const endpoint of route.endpoints) {
            const trusted = expected.endpoints.find(item => item.key === endpoint.key);
            if (!trusted || ['rpcUrl', 'chainId', 'domain', 'type', 'nativeDecimals', 'nativeSymbol'].some(key => endpoint[key] !== (trusted as any)[key])) throw new Error('Route network does not match this test environment.');
            if (![endpoint.ism, endpoint.hook].every(ethers.isAddress)) throw new Error('Missing ISM or Hook address.');
          }
          await validateRouteOnChain(route);
          for (const endpoint of route.endpoints) {
            const addressEquals = async (contract: string, method: string, expectedAddress: string) => {
              const [actual] = await bridgeCall(endpoint, contract, abi, method);
              if (actual.toLowerCase() !== expectedAddress.toLowerCase()) throw new Error(`${endpoint.name}: ${method} mismatch.`);
            };
            await addressEquals(endpoint.ism, 'trustedRelayer', expected.relayer);
            await addressEquals(endpoint.ism, 'mailbox', endpoint.mailbox);
            await addressEquals(endpoint.router, 'interchainSecurityModule', endpoint.ism);
            await addressEquals(endpoint.router, 'hook', endpoint.hook);
            await addressEquals(endpoint.mailbox, 'defaultIsm', endpoint.ism);
            await addressEquals(endpoint.mailbox, 'defaultHook', endpoint.hook);
            await addressEquals(endpoint.mailbox, 'requiredHook', endpoint.hook);
            for (const contract of [endpoint.mailbox, endpoint.router, endpoint.hook]) await addressEquals(contract, 'owner', owner);
            const remote = route.endpoints.find((item: any) => item.key !== endpoint.key);
            const [destinationGas] = await bridgeCall(endpoint, endpoint.router, abi, 'destinationGas', [remote.domain]);
            const [protocolFee] = await bridgeCall(endpoint, endpoint.hook, abi, 'protocolFee');
            const [symbol] = await bridgeCall(endpoint, endpoint.token, abi, 'symbol');
            if (destinationGas !== 300000n || protocolFee !== 0n || symbol !== route.symbol) throw new Error('Router Gas, message fee or token symbol mismatch.');
            if (endpoint.type === 'synthetic') await addressEquals(endpoint.router, 'nativeFlowBridge', expected.nativeFlowBridge);
            if (BigInt(await bridgeRpc<string>(endpoint, 'eth_getBalance', [expected.relayer, 'latest'])) === 0n) throw new Error(`${endpoint.name}: relayer needs Gas.`);
          }
          const current = validateBridgeConfig(read(publicPath));
          const existing = current.routes.find(item => item.id === route.id);
          if (existing && JSON.stringify(existing) !== JSON.stringify(route)) throw new Error('Route ID already exists with different contracts.');
          if (!existing) {
            const next = { ...current, routes: [route, ...current.routes] };
            const temp = `${publicPath}.${randomBytes(8).toString('hex')}.tmp`;
            try { fs.writeFileSync(temp, JSON.stringify(next, null, 2), { flag: 'wx' }); fs.renameSync(temp, publicPath); }
            finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
          }
          respond(200, { routeId: route.id, relayerRunning: relayerRunning() });
        } catch (error) {
          respond(400, { error: error instanceof Error ? error.message : 'Route verification failed.' });
        } finally { publishing = false; }
      });
    },
  };
}
