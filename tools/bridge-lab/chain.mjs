import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ganache from 'ganache';
import { Wallet, parseEther } from 'ethers';

const root = path.dirname(fileURLToPath(import.meta.url));
const runtime = path.join(root, 'runtime');
fs.mkdirSync(runtime, { recursive: true, mode: 0o700 });
const keyFile = path.join(runtime, 'local-account.json');
if (!fs.existsSync(keyFile)) {
  const account = Wallet.createRandom();
  fs.writeFileSync(keyFile, JSON.stringify({ address: account.address, privateKey: account.privateKey }), { mode: 0o600 });
}
const account = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
const evm = process.argv.includes('--evm');
const chainId = evm ? 31337 : 31338;
const port = evm ? 8545 : 8546;
const server = ganache.server({
  chain: { chainId, networkId: chainId, hardfork: 'shanghai' },
  database: { dbPath: path.join(runtime, evm ? 'evm-db' : 'bsc-db') },
  wallet: { accounts: [{ secretKey: account.privateKey, balance: `0x${parseEther('10000').toString(16)}` }], lock: true },
  miner: { blockGasLimit: 30000000 },
  logging: { quiet: true },
});
await server.listen(port, '127.0.0.1');
console.log(`Local ${evm ? 'EVM' : 'BSC-style EVM'}: http://127.0.0.1:${port}, chainId=${chainId}, operator=${account.address}`);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await server.close(); process.exit(); });
