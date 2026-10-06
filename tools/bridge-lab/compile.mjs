import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import solc from 'solc';

const root = path.dirname(fileURLToPath(import.meta.url));
const hyperlane = process.env.HYPERLANE_ROOT || '/home/wbl/hyperlane/solidity';
const entries = ['contracts/Mailbox.sol', 'contracts/isms/TrustedRelayerIsm.sol',
  'contracts/token/HypERC20.sol', 'contracts/token/HypERC20Collateral.sol',
  'contracts/hooks/ProtocolFee.sol'];
const sources = Object.fromEntries(entries.map(name => [name, { content: fs.readFileSync(path.join(hyperlane, name), 'utf8') }]));
sources['LabToken.sol'] = { content: fs.readFileSync(path.join(root, 'contracts/LabToken.sol'), 'utf8') };
sources['BridgeTestToken.sol'] = { content: fs.readFileSync(path.join(root, 'contracts/BridgeTestToken.sol'), 'utf8') };
const output = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources,
  settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris',
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } } }
}), { import: name => {
  for (const base of [hyperlane, path.join(root, 'node_modules')]) {
    const candidate = path.resolve(base, name);
    if (fs.existsSync(candidate)) return { contents: fs.readFileSync(candidate, 'utf8') };
  }
  return { error: `Missing import: ${name}` };
} }));
const errors = (output.errors || []).filter(error => error.severity === 'error');
if (errors.length) throw new Error(errors.map(error => error.formattedMessage).join('\n'));
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
for (const contracts of Object.values(output.contracts)) {
  for (const [name, contract] of Object.entries(contracts)) {
    if (!contract.evm.bytecode.object) continue;
    fs.writeFileSync(path.join(root, 'artifacts', `${name}.json`), JSON.stringify({
      abi: contract.abi, bytecode: `0x${contract.evm.bytecode.object}`,
      deployedBytecode: `0x${contract.evm.deployedBytecode.object}`,
    }, null, 2));
  }
}
console.log(`Compiled Hyperlane contracts with solc ${solc.version()} (Paris EVM).`);
