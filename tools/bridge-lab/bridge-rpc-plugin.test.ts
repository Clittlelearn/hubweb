import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { bridgeRpcHandler } from '../bridge-rpc-plugin';

const config = JSON.parse(fs.readFileSync(new URL('../../public/bridge/routes.json', import.meta.url), 'utf8'));
const endpoint = config.routes.flatMap((route: any) => route.endpoints).find((item: any) => item.chainId === 31338);

test('LAN read proxy resolves server-owned routes and rejects writes, batches, foreign URLs and cross-origin requests', async t => {
  const upstream: any[] = [];
  const handler = bridgeRpcHandler(() => config, async (url, init) => {
    upstream.push({ url, payload: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify({ result: '0x7a6a' }));
  });
  const server = createServer(handler);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const origin = 'http://127.0.0.1:' + (server.address() as any).port;
  const body = { jsonrpc: '2.0', id: 12, method: 'eth_chainId', params: [], bridgeEndpoint: endpoint };
  const send = (payload: any, headers = {}) => fetch(origin, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Bridge-Read': '1', Origin: origin, ...headers }, body: JSON.stringify(payload) });
  assert.equal((await (await send(body)).json()).result, '0x7a6a');
  assert.equal(upstream[0].url, endpoint.rpcUrl);
  assert.equal(upstream[0].payload.bridgeEndpoint, undefined);
  for (const method of ['eth_sendTransaction', 'eth_sendRawTransaction', 'eth_sign', 'personal_unlockAccount', 'evm_setAccountBalance', 'debug_traceTransaction']) {
    assert.equal((await send({ ...body, method })).status, 400);
  }
  assert.equal((await send([body])).status, 400);
  assert.equal((await send({ ...body, bridgeEndpoint: { ...endpoint, rpcUrl: 'http://169.254.169.254/' } })).status, 400);
  assert.equal((await send({ ...body, bridgeEndpoint: { ...endpoint, chainId: 1 } })).status, 400);
  assert.equal((await send(body, { Origin: 'http://other-host' })).status, 403);
  assert.equal((await send(body, { 'X-Bridge-Read': '' })).status, 403);
  assert.equal((await send({ ...body, params: ['x'.repeat(65536)] })).status, 413);
  assert.equal(upstream.length, 1, 'rejected requests never reach a node');
});

test('offline upstream becomes an actionable JSON RPC error', async t => {
  const server = createServer(bridgeRpcHandler(() => config, async () => { throw new Error('ECONNREFUSED'); }));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const response = await fetch('http://127.0.0.1:' + (server.address() as any).port, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Bridge-Read': '1' },
    body: JSON.stringify({ id: 1, method: 'eth_chainId', params: [], bridgeEndpoint: endpoint }),
  });
  assert.equal(response.status, 502);
  assert.match((await response.json()).error.message, /Local BSC RPC is unavailable on the Hub server/);
});
