import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Wallet, ContractFactory, Interface, zeroPadValue, parseEther, getCreateAddress } from 'ethers';
import { rpc, send, confirm } from './rpc.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const runtime = path.join(root, 'runtime');
fs.mkdirSync(runtime, { recursive: true, mode: 0o700 });
const localOnly = process.argv.includes('--local');
if (!localOnly && !process.env.HIVEX_PRIVATE_KEY) throw new Error('Set HIVEX_PRIVATE_KEY in the process environment. It is never written to disk.');
const localWallet = new Wallet(JSON.parse(fs.readFileSync(path.join(runtime, 'local-account.json'))).privateKey);
const hiveWallet = localOnly ? localWallet : new Wallet(process.env.HIVEX_PRIVATE_KEY);
const initialHolder = process.env.BRIDGE_INITIAL_HOLDER || '0x755Ccf704E17570b64E247f0794314e4C8E542CA';
const relayKeyFile = path.join(runtime, 'relayer.json');
if (!fs.existsSync(relayKeyFile)) {
  const wallet = Wallet.createRandom();
  fs.writeFileSync(relayKeyFile, JSON.stringify({ address: wallet.address, privateKey: wallet.privateKey }), { mode: 0o600 });
}
const relayer = JSON.parse(fs.readFileSync(relayKeyFile));
const journalFile = path.join(runtime, localOnly ? 'local-deployment.json' : 'deployment.json');
const deployment = fs.existsSync(journalFile) ? JSON.parse(fs.readFileSync(journalFile)) : {
  schemaVersion: 1, environment: 'local-test', routes: [{ id: localOnly ? 'hbr-local-evm-bsc' : 'hbr-hivex-local-bsc', symbol: 'HBR', decimals: 8,
    name: localOnly ? 'Local EVM / Local BSC' : 'HiveX / Local BSC', security: 'Trusted local relayer', endpoints: [
      { key: localOnly ? 'local-evm' : 'hivex', name: localOnly ? 'Local EVM' : 'HiveX Devnet', chainId: localOnly ? 31337 : 12315, domain: localOnly ? 31337 : 12315,
        rpcUrl: localOnly ? 'http://127.0.0.1:8545' : process.env.HIVEX_RPC_URL || 'http://192.168.1.162:13134', nativeSymbol: localOnly ? 'ETH' : 'OHI', nativeDecimals: 18,
        type: 'synthetic', scale: '1', explorerUrl: '' },
      { key: 'local-bsc', name: 'Local BSC', chainId: 31338, domain: 31338,
        rpcUrl: 'http://127.0.0.1:8546', nativeSymbol: 'BNB', nativeDecimals: 18,
        type: 'collateral', scale: '1', explorerUrl: '' },
    ] }], steps: {}, transactions: [],
};
const save = () => fs.writeFileSync(journalFile, JSON.stringify(deployment, null, 2));
const artifact = name => JSON.parse(fs.readFileSync(path.join(root, 'artifacts', `${name}.json`)));
async function step(key, endpoint, wallet, tx) {
  if (deployment.steps[key]?.receipt) return deployment.steps[key];
  let pending = deployment.steps[key];
  if (pending && process.argv.includes(`--retry-expired-step=${key}`)) {
    // Explicit operator recovery only, after the network's pending entry has expired.
    for (const hash of new Set([pending.hash, pending.localHash])) {
      for (const method of ['eth_getTransactionReceipt', 'eth_getTransactionByHash']) {
        if (await rpc(endpoint.rpcUrl, method, [hash])) throw new Error(`Refusing retry: ${hash} is still known by ${method}`);
      }
    }
    for (const tag of ['latest', 'pending']) {
      const nonce = BigInt(await rpc(endpoint.rpcUrl, 'eth_getTransactionCount', [wallet.address, tag]));
      if (nonce !== BigInt(pending.nonce)) throw new Error(`Refusing retry: ${tag} nonce changed`);
    }
    if (!tx.to) {
      const address = getCreateAddress({ from: wallet.address, nonce: pending.nonce });
      if (await rpc(endpoint.rpcUrl, 'eth_getCode', [address, 'latest']) !== '0x') throw new Error(`Refusing retry: contract already exists at ${address}`);
    }
    deployment.expiredAttempts ??= [];
    deployment.expiredAttempts.push({ step: key, ...pending, reconciledAt: new Date().toISOString() });
    delete deployment.steps[key];
    save();
    pending = undefined;
  }
  const result = pending ? { ...pending, receipt: await confirm(endpoint.rpcUrl, [pending.hash, pending.localHash]) } :
    await send(endpoint, wallet, tx, submitted => { deployment.steps[key] = submitted; save(); });
  if (!tx.to) result.contractAddress = result.receipt.contractAddress || result.contractAddress || getCreateAddress({ from: wallet.address, nonce: result.nonce });
  deployment.steps[key] = result;
  deployment.transactions.push({ step: key, chainId: endpoint.chainId, hash: result.hash, localHash: result.localHash, blockNumber: result.receipt.blockNumber });
  save();
  return result;
}
async function deploy(endpoint, wallet, field, name, args) {
  const compiled = artifact(name);
  const factory = new ContractFactory(compiled.abi, compiled.bytecode);
  const tx = await factory.getDeployTransaction(...args);
  const result = await step(`${endpoint.key}:${field}`, endpoint, wallet, tx);
  endpoint[field] = result.contractAddress;
  if (!endpoint[field] || await rpc(endpoint.rpcUrl, 'eth_getCode', [endpoint[field], 'latest']) === '0x') {
    throw new Error(`Missing deployed code for ${field}`);
  }
  save();
}
async function call(endpoint, wallet, label, name, address, method, args) {
  return step(`${endpoint.key}:${label}`, endpoint, wallet, {
    to: address, data: new Interface(artifact(name).abi).encodeFunctionData(method, args),
  });
}
const [hive, local] = deployment.routes[0].endpoints;
for (const [endpoint, wallet] of [[local, localWallet], [hive, hiveWallet]]) {
  endpoint.deploymentBlock ??= Number(BigInt(await rpc(endpoint.rpcUrl, 'eth_blockNumber')));
  await deploy(endpoint, wallet, 'mailbox', 'Mailbox', [endpoint.domain]);
  await deploy(endpoint, wallet, 'ism', 'TrustedRelayerIsm', [endpoint.mailbox, relayer.address]);
  await deploy(endpoint, wallet, 'hook', 'ProtocolFee', [0n, 0n, wallet.address, wallet.address]);
  await call(endpoint, wallet, 'mailbox-initialize', 'Mailbox', endpoint.mailbox, 'initialize', [wallet.address, endpoint.ism, endpoint.hook, endpoint.hook]);
  if (endpoint.type === 'collateral') {
    await deploy(endpoint, wallet, 'token', 'LabToken', [initialHolder]);
    await deploy(endpoint, wallet, 'router', 'HypERC20Collateral', [endpoint.token, 1n, endpoint.mailbox]);
    await call(endpoint, wallet, 'router-initialize', 'HypERC20Collateral', endpoint.router, 'initialize', [endpoint.hook, endpoint.ism, wallet.address]);
    await step('local:user-gas', endpoint, wallet, { to: initialHolder, value: parseEther('100') });
    await step('local:relay-gas', endpoint, wallet, { to: relayer.address, value: parseEther('100') });
  } else {
    await deploy(endpoint, wallet, 'router', 'HypERC20', [8, 1n, endpoint.mailbox]);
    endpoint.token = endpoint.router;
    await call(endpoint, wallet, 'router-initialize', 'HypERC20', endpoint.router, 'initialize', [0n, 'Bridge Lab Token', 'HBR', endpoint.hook, endpoint.ism, wallet.address, '0xc1b157ac921cf5b89a35d11b9482aa090a0ce921']);
    await step('hive:relay-gas', endpoint, wallet, { to: relayer.address, value: parseEther('100') });
    // Recover journals produced before the raw ETH value unit was corrected.
    if (BigInt(await rpc(endpoint.rpcUrl, 'eth_getBalance', [relayer.address, 'latest'])) < parseEther('1')) {
      await step('hive:relay-gas-wei18', endpoint, wallet, { to: relayer.address, value: parseEther('100') });
    }
    if (localOnly) await step('hive:user-gas', endpoint, wallet, { to: initialHolder, value: parseEther('100') });
  }
}
for (const [source, target, wallet] of [[local, hive, localWallet], [hive, local, hiveWallet]]) {
  const name = source.type === 'collateral' ? 'HypERC20Collateral' : 'HypERC20';
  await call(source, wallet, 'enroll', name, source.router, 'enrollRemoteRouter', [target.domain, zeroPadValue(target.router, 32)]);
  await call(source, wallet, 'destination-gas', name, source.router, 'setDestinationGas(uint32,uint256)', [target.domain, 300000]);
}
save();
const publicPath = path.resolve(root, '../../public/bridge/routes.json');
fs.mkdirSync(path.dirname(publicPath), { recursive: true });
const existing = fs.existsSync(publicPath) ? JSON.parse(fs.readFileSync(publicPath)) : { routes: [] };
const publicConfig = { schemaVersion: deployment.schemaVersion, environment: deployment.environment,
  routes: [...deployment.routes, ...existing.routes.filter(route => route.id !== deployment.routes[0].id)] };
fs.writeFileSync(publicPath, JSON.stringify(publicConfig, null, 2));
console.log(`Deployment verified. Public configuration: ${publicPath}`);
