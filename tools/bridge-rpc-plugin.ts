import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { validateBridgeConfig, type BridgeConfig } from '../src/app/lib/bridge-client';

const READ_METHODS = new Set([
  'eth_chainId', 'eth_blockNumber', 'eth_getBlockByNumber', 'eth_getBlockByHash',
  'eth_getBalance', 'eth_getCode', 'eth_getTransactionCount',
  'eth_getTransactionReceipt', 'eth_getTransactionByHash', 'eth_getLogs', 'eth_call',
]);

export function bridgeRpcHandler(readConfig: () => BridgeConfig, upstream = fetch) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const reply = (status: number, body: unknown) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(body));
    };
    let id: string | number | null = null;
    const fail = (status: number, message: string) => reply(status, { jsonrpc: '2.0', id, error: { code: -32603, message } });
    try {
      if (req.method !== 'POST' || req.headers['x-bridge-read'] !== '1' ||
        !req.headers['content-type']?.startsWith('application/json') ||
        req.headers['sec-fetch-site'] === 'cross-site' ||
        (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)) {
        fail(403, 'Only same-origin bridge read requests are allowed.'); return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        const bytes = Buffer.from(chunk);
        size += bytes.length;
        if (size > 65536) { fail(413, 'Bridge read request is too large.'); return; }
        chunks.push(bytes);
      }
      const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!payload || Array.isArray(payload) || !READ_METHODS.has(payload.method) || !Array.isArray(payload.params)) {
        fail(400, 'This bridge endpoint accepts read-only ETH RPC methods, not signing or administration.'); return;
      }
      if (typeof payload.id === 'string' || typeof payload.id === 'number') id = payload.id;
      const requested = payload.bridgeEndpoint;
      // Resolve only exact endpoints from server-owned routes, never an arbitrary client URL.
      const endpoint = readConfig().routes.flatMap(route => route.endpoints).find(item =>
        item.key === requested?.key && item.chainId === requested?.chainId && item.rpcUrl === requested?.rpcUrl);
      if (!endpoint) { fail(400, 'Bridge network is not configured on this Hub server.'); return; }
      let result;
      try {
        const response = await upstream(endpoint.rpcUrl, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id, method: payload.method, params: payload.params }),
          signal: AbortSignal.timeout(12000),
        });
        if (!response.ok) throw new Error('Upstream HTTP failure');
        result = await response.json();
        if (!result || Array.isArray(result) || (result.result === undefined && !result.error)) throw new Error('Invalid RPC response');
      } catch {
        fail(502, `${endpoint.name} RPC is unavailable on the Hub server. Check the existing chain service or tunnel.`); return;
      }
      reply(200, { jsonrpc: '2.0', id, ...(result.error ? { error: result.error } : { result: result.result }) });
    } catch {
      fail(400, 'Invalid bridge read request or unavailable route configuration.');
    }
  };
}

export function bridgeRpcPlugin(projectRoot = process.cwd()): Plugin {
  const handler = bridgeRpcHandler(() => validateBridgeConfig(JSON.parse(
    fs.readFileSync(path.join(projectRoot, 'public/bridge/routes.json'), 'utf8'),
  )));
  return {
    name: 'bridge-read-rpc', apply: 'serve',
    configureServer(server) { server.middlewares.use('/__bridge-rpc', handler); },
  };
}
