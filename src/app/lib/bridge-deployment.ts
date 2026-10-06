import { sendWalletTransactionRequest } from '@openhive/sdk';
import { ethers, type Eip1193Provider } from 'ethers';
import { confirmationFailure, TRANSACTION_CONFIRMATION_ATTEMPTS } from './transaction-confirmation';
import { bridgeRpc, bridgeCall, ensureBridgeWallet, validateRouteOnChain, validateBridgeConfig,
  type BridgeEndpoint, type BridgeRoute } from './bridge-client';

export const DEPLOY_STORAGE = 'hub.bridge.deployments.v1';
export const CONTRACTS = ['Mailbox', 'TrustedRelayerIsm', 'ProtocolFee', 'BridgeTestToken', 'HypERC20', 'HypERC20Collateral'] as const;
export type ContractName = typeof CONTRACTS[number];
export interface Artifact { abi: ethers.InterfaceAbi; bytecode: string }
export interface DeploymentSetup {
  relayer: string;
  nativeFlowBridge: string;
  endpoints: [BridgeEndpoint, BridgeEndpoint];
  artifacts: Record<ContractName, Artifact>;
  publishToken: string;
}
export interface DeploymentForm {
  name: string; symbol: string; decimals: number; supply: string; holder: string; relayGas: string;
}
export interface DeploymentStep {
  key: string; label: string; endpoint: string;
  state: 'awaiting-wallet' | 'submitted' | 'confirmed' | 'reverted';
  from: string; to?: string; data: string; value: string; nonce: string;
  hash?: string; blockNumber?: string; blockHash?: string; contractAddress?: string;
}
export interface DeploymentRun {
  version: 1; id: string; createdAt: number; account: string;
  form: DeploymentForm; relayer: string; nativeFlowBridge: string;
  artifactHashes: Record<string, string>; route: BridgeRoute;
  steps: DeploymentStep[]; published: boolean; error?: string;
}
export const newAddress = (value: string) => ethers.isAddress(value) && value !== ethers.ZeroAddress;

export async function assertDeploymentAccount(provider: Eip1193Provider, account: string) {
  const accounts = await provider.request({ method: 'eth_accounts' }) as string[];
  if (!accounts?.[0] || accounts[0].toLowerCase() !== account.toLowerCase()) {
    throw new Error(`Wallet account changed. Selected: ${accounts?.[0] || 'none'}; deployer: ${account}. Reconnect or select a deployment for this account.`);
  }
}

export async function ensureDeploymentWallet(provider: Eip1193Provider, endpoint: BridgeEndpoint, account: string, call = bridgeRpc) {
  await assertDeploymentAccount(provider, account);
  await ensureBridgeWallet(provider, endpoint, account);
  await assertDeploymentAccount(provider, account);
  if (BigInt(await call<string>(endpoint, 'eth_chainId')) !== BigInt(endpoint.chainId)) {
    throw new Error(`${endpoint.name}: RPC chain ID mismatch (${endpoint.rpcUrl}).`);
  }
  // Equal chain IDs do not distinguish a reset local chain or a different testnet.
  const rpcHead = await call<any>(endpoint, 'eth_getBlockByNumber', ['latest', false]);
  const walletHead = await provider.request({ method: 'eth_getBlockByNumber', params: ['latest', false] });
  if (rpcHead?.number == null || walletHead?.number == null) throw new Error(`${endpoint.name}: cannot verify wallet/RPC block identity.`);
  const height = ethers.toQuantity(BigInt(rpcHead.number) < BigInt(walletHead.number) ? rpcHead.number : walletHead.number);
  const rpcBlock = await call<any>(endpoint, 'eth_getBlockByNumber', [height, false]);
  const walletBlock = await provider.request({ method: 'eth_getBlockByNumber', params: [height, false] });
  if (!ethers.isHexString(rpcBlock?.hash, 32) || rpcBlock.hash.toLowerCase() !== walletBlock?.hash?.toLowerCase()) {
    throw new Error(`${endpoint.name}: wallet and deployment RPC do not match at block ${BigInt(height)} (chain ${endpoint.chainId}, RPC ${endpoint.rpcUrl}). Check the wallet RPC and deployment network configuration before signing.`);
  }
  await assertDeploymentAccount(provider, account);
  if (BigInt(await provider.request({ method: 'eth_chainId' })) !== BigInt(endpoint.chainId)) throw new Error('Wallet network changed during deployment checks.');
}

export async function checkDeploymentGas(provider: Eip1193Provider, endpoint: BridgeEndpoint, account: string, call = bridgeRpc) {
  await ensureDeploymentWallet(provider, endpoint, account, call);
  const balance = BigInt(await provider.request({ method: 'eth_getBalance', params: [account, 'latest'] }));
  await assertDeploymentAccount(provider, account);
  if (BigInt(await provider.request({ method: 'eth_chainId' })) !== BigInt(endpoint.chainId)) throw new Error('Wallet network changed during Gas checks.');
  if (balance === 0n) throw new Error(`${endpoint.name}: deployer ${account} has 0 ${endpoint.nativeSymbol} for Gas (chain ${endpoint.chainId}, RPC ${endpoint.rpcUrl}). Both deployment chains need native Gas; bridged ERC20 tokens do not pay it.`);
}

export function createDeployment(setup: DeploymentSetup, form: DeploymentForm, account: string): DeploymentRun {
  if (!newAddress(account) || !newAddress(form.holder) || !newAddress(setup.relayer) || !newAddress(setup.nativeFlowBridge)) throw new Error('Enter valid non-zero account addresses.');
  if (!form.name.trim() || form.name.length > 64 || !/^[A-Za-z0-9_-]{1,12}$/.test(form.symbol)) throw new Error('Enter a token name and a symbol of 1-12 letters, numbers, underscores or hyphens.');
  if (!Number.isInteger(form.decimals) || form.decimals < 0 || form.decimals > 18) throw new Error('Decimals must be between 0 and 18.');
  if (!/^\d+(\.\d+)?$/.test(form.supply) || !/^\d+(\.\d+)?$/.test(form.relayGas)) throw new Error('Supply and relayer Gas must be decimal amounts.');
  const supply = ethers.parseUnits(form.supply, form.decimals);
  const gas = ethers.parseEther(form.relayGas);
  if (supply <= 0n || supply > ethers.MaxUint256 || gas < 0n || gas > ethers.parseEther('100')) throw new Error('Supply or relayer Gas amount is out of range.');
  const id = `wallet-${crypto.randomUUID()}`;
  const endpoints = structuredClone(setup.endpoints);
  for (const endpoint of endpoints) {
    endpoint.mailbox = endpoint.router = endpoint.token = '';
    delete (endpoint as any).ism; delete (endpoint as any).hook;
    endpoint.deploymentBlock = 0;
  }
  return { version: 1, id, createdAt: Date.now(), account: ethers.getAddress(account), form: { ...form },
    relayer: setup.relayer, nativeFlowBridge: setup.nativeFlowBridge,
    artifactHashes: Object.fromEntries(CONTRACTS.map(name => [name, ethers.keccak256(setup.artifacts[name].bytecode)])),
    route: { id, name: `${form.name} · ${new Date().toLocaleString()}`, symbol: form.symbol, decimals: form.decimals,
      security: 'Trusted local relayer', endpoints }, steps: [], published: false };
}

export function readDeployments(storage: Pick<Storage, 'getItem'> = localStorage): DeploymentRun[] {
  const raw = storage.getItem(DEPLOY_STORAGE);
  if (!raw) return [];
  const runs = JSON.parse(raw);
  if (!Array.isArray(runs) || runs.some(run => run.version !== 1 || !Array.isArray(run.steps) || !newAddress(run.account) || !run.route?.endpoints)) {
    throw new Error('Stored deployment history is invalid. Export browser data before starting a new deployment.');
  }
  return runs;
}

export function persistDeployment(run: DeploymentRun, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage) {
  const runs = readDeployments(storage);
  const next = [run, ...runs.filter(item => item.id !== run.id)];
  // A failed storage write stops the workflow before the next signing request.
  storage.setItem(DEPLOY_STORAGE, JSON.stringify(next));
}

function checkTransaction(step: DeploymentStep, transaction: any) {
  if (transaction.from?.toLowerCase() !== step.from.toLowerCase() ||
    (transaction.to || '').toLowerCase() !== (step.to || '').toLowerCase() ||
    (transaction.input ?? transaction.data)?.toLowerCase() !== step.data.toLowerCase() ||
    BigInt(transaction.value ?? -1) !== BigInt(step.value) || BigInt(transaction.nonce ?? -1) !== BigInt(step.nonce)) {
    throw new Error('Transaction does not match the saved deployment request.');
  }
}

export async function attachDeploymentHash(endpoint: BridgeEndpoint, step: DeploymentStep, hash: string) {
  if (!ethers.isHexString(hash, 32)) throw new Error('Enter a 32-byte transaction hash.');
  const transaction = await bridgeRpc(endpoint, 'eth_getTransactionByHash', [hash]);
  if (!transaction) throw new Error('Transaction is not indexed yet. Keep the hash and check again.');
  checkTransaction(step, transaction);
  step.hash = hash; step.state = 'submitted';
}

export async function confirmDeploymentStep(endpoint: BridgeEndpoint, step: DeploymentStep, call = bridgeRpc, attempts = TRANSACTION_CONFIRMATION_ATTEMPTS) {
  if (!step.hash || !ethers.isHexString(step.hash, 32)) throw new Error('Transaction hash is required before resuming confirmation.');
  attempts = Math.max(1, Math.min(TRANSACTION_CONFIRMATION_ATTEMPTS, Math.floor(attempts) || TRANSACTION_CONFIRMATION_ATTEMPTS));
  for (let attempt = 0; attempt < attempts; attempt++) {
    const receipt = await call<any>(endpoint, 'eth_getTransactionReceipt', [step.hash]);
    const tx = await call<any>(endpoint, 'eth_getTransactionByHash', [step.hash]);
    if (tx) checkTransaction(step, tx);
    if (receipt?.blockHash && tx?.blockHash && receipt.blockNumber != null && tx.blockNumber != null) {
      if (receipt.blockHash.toLowerCase() !== tx.blockHash.toLowerCase() || BigInt(receipt.blockNumber) !== BigInt(tx.blockNumber)) throw new Error('Receipt/by-hash block mismatch.');
      const block = await call<any>(endpoint, 'eth_getBlockByNumber', [receipt.blockNumber, false]);
      if (block?.hash?.toLowerCase() !== receipt.blockHash.toLowerCase()) throw new Error('Deployment transaction is not in the canonical block.');
      if (receipt.status == null) throw new Error('Transaction receipt has no status.');
      if (BigInt(receipt.status) !== 1n) { step.state = 'reverted'; throw new Error(`Transaction reverted: ${step.hash}`); }
      step.blockNumber = receipt.blockNumber; step.blockHash = receipt.blockHash;
      if (!step.to) {
        const expected = ethers.getCreateAddress({ from: step.from, nonce: BigInt(step.nonce) });
        if (!receipt.contractAddress || receipt.contractAddress.toLowerCase() !== expected.toLowerCase()) throw new Error('Unexpected deployment contract address.');
        if (await call<string>(endpoint, 'eth_getCode', [expected, 'latest']) === '0x') throw new Error('Deployed contract has no runtime code.');
        step.contractAddress = receipt.contractAddress;
      }
      step.state = 'confirmed';
      return;
    }
    if (attempt + 1 < attempts) await new Promise(resolve => setTimeout(resolve, 1500));
  }
  throw confirmationFailure([step.hash], attempts);
}

export async function submitDeploymentStep(provider: Eip1193Provider, endpoint: BridgeEndpoint, step: DeploymentStep,
  persist: () => void, call = bridgeRpc) {
  if (step.hash) { await confirmDeploymentStep(endpoint, step, call); persist(); return; }
  if (step.state === 'awaiting-wallet' && step.nonce) throw new Error('A wallet request has no recorded hash. Enter its transaction hash before resuming; it will not be resent automatically.');
  await ensureDeploymentWallet(provider, endpoint, step.from, call);
  const nonce = await call<string>(endpoint, 'eth_getTransactionCount', [step.from, 'pending']);
  const request = { from: step.from, ...(step.to ? { to: step.to } : {}), data: step.data, value: step.value, nonce };
  const gas = BigInt(await provider.request({ method: 'eth_estimateGas', params: [request] }));
  if (gas <= 0n) throw new Error('Wallet returned an invalid Gas estimate.');
  await ensureDeploymentWallet(provider, endpoint, step.from, call);
  step.nonce = nonce; step.state = 'awaiting-wallet'; persist();
  try {
    const { hash } = await sendWalletTransactionRequest(provider, { ...request, nonce: Number(BigInt(nonce)), gasLimit: gas * 120n / 100n }, { account: step.from, chainId: endpoint.chainId });
    if (typeof hash !== 'string' || !ethers.isHexString(hash, 32)) throw new Error('Wallet returned no valid hash. Reconcile this request before continuing.');
    step.hash = hash; step.state = 'submitted'; persist();
  } catch (error) {
    if (Number((error as any)?.code) === 4001) { step.nonce = ''; persist(); }
    throw error;
  }
  await confirmDeploymentStep(endpoint, step, call);
  persist();
}

export async function runDeployment(run: DeploymentRun, setup: DeploymentSetup, provider: Eip1193Provider,
  save: () => void, progress: (label: string) => void, cancelled: () => boolean = () => false) {
  await assertDeploymentAccount(provider, run.account);
  const connectedChain = BigInt(await provider.request({ method: 'eth_chainId' }));
  if (!run.route.endpoints.some(endpoint => BigInt(endpoint.chainId) === connectedChain)) throw new Error(`Wallet chain ${connectedChain} is not one of this deployment's networks. Select a configured deployment network first.`);
  for (const name of CONTRACTS) if (run.artifactHashes[name] !== ethers.keccak256(setup.artifacts[name].bytecode)) throw new Error('Compiled artifacts changed since this deployment started. Keep the original artifacts to resume.');
  if (run.relayer.toLowerCase() !== setup.relayer.toLowerCase()) throw new Error('Relayer identity changed. Restore the original relayer to resume.');
  for (const endpoint of run.route.endpoints) {
    const trusted = setup.endpoints.find(item => item.key === endpoint.key);
    if (!trusted || trusted.chainId !== endpoint.chainId || trusted.domain !== endpoint.domain || trusted.rpcUrl !== endpoint.rpcUrl) throw new Error('Deployment network configuration changed.');
    if (cancelled()) throw new Error('Deployment paused before wallet checks.');
    progress(`Checking ${endpoint.name}: ${run.account}`);
    await checkDeploymentGas(provider, endpoint, run.account);
  }
  const execute = async (endpoint: BridgeEndpoint, label: string, data: string, to?: string, value = 0n) => {
    if (cancelled()) throw new Error('Deployment paused. Saved transactions remain available for confirmation.');
    const key = `${endpoint.key}:${label}`;
    let step = run.steps.find(item => item.key === key);
    if (!step) {
      step = { key, label, endpoint: endpoint.key, state: 'awaiting-wallet', from: run.account,
        to, data, value: ethers.toQuantity(value), nonce: '' };
      run.steps.push(step); save();
    }
    if (step.data !== data || (step.to || '') !== (to || '') || BigInt(step.value) !== value || step.from !== run.account) throw new Error('Saved deployment step differs from the current plan.');
    progress(`${endpoint.name}: ${label}`);
    // Recheck confirmed steps against the current chain before using their outputs.
    await submitDeploymentStep(provider, endpoint, step, save);
    return step;
  };
  const deploy = async (endpoint: BridgeEndpoint, field: string, name: ContractName, args: unknown[]) => {
    const artifact = setup.artifacts[name];
    const tx = await new ethers.ContractFactory(artifact.abi, artifact.bytecode).getDeployTransaction(...args);
    const step = await execute(endpoint, `Deploy ${name}`, tx.data!);
    (endpoint as any)[field] = step.contractAddress;
    endpoint.deploymentBlock ||= Number(BigInt(step.blockNumber!));
    save();
  };
  const invoke = (endpoint: BridgeEndpoint, label: string, name: ContractName, to: string, method: string, args: unknown[]) =>
    execute(endpoint, label, new ethers.Interface(setup.artifacts[name].abi).encodeFunctionData(method, args), to);
  const local = run.route.endpoints.find(item => item.type === 'collateral')!;
  const hive = run.route.endpoints.find(item => item.type === 'synthetic')!;
  for (const endpoint of [local, hive]) {
    await deploy(endpoint, 'mailbox', 'Mailbox', [endpoint.domain]);
    await deploy(endpoint, 'ism', 'TrustedRelayerIsm', [endpoint.mailbox, run.relayer]);
    await deploy(endpoint, 'hook', 'ProtocolFee', [0n, 0n, run.account, run.account]);
    const { ism, hook } = endpoint as BridgeEndpoint & { ism: string; hook: string };
    await invoke(endpoint, 'Initialize Mailbox', 'Mailbox', endpoint.mailbox, 'initialize', [run.account, ism, hook, hook]);
    if (endpoint.type === 'collateral') {
      await deploy(endpoint, 'token', 'BridgeTestToken', [run.form.name, run.form.symbol, run.form.decimals, run.form.holder, ethers.parseUnits(run.form.supply, run.form.decimals)]);
      await deploy(endpoint, 'router', 'HypERC20Collateral', [endpoint.token, 1n, endpoint.mailbox]);
      await invoke(endpoint, 'Initialize Router', 'HypERC20Collateral', endpoint.router, 'initialize', [hook, ism, run.account]);
    } else {
      await deploy(endpoint, 'router', 'HypERC20', [run.form.decimals, 1n, endpoint.mailbox]);
      endpoint.token = endpoint.router; save();
      await invoke(endpoint, 'Initialize Router', 'HypERC20', endpoint.router, 'initialize', [0n, run.form.name, run.form.symbol, hook, ism, run.account, run.nativeFlowBridge]);
    }
  }
  for (const [endpoint, remote] of [[local, hive], [hive, local]]) {
    const contract = endpoint.type === 'collateral' ? 'HypERC20Collateral' : 'HypERC20';
    await invoke(endpoint, 'Enroll remote Router', contract, endpoint.router, 'enrollRemoteRouter', [remote.domain, ethers.zeroPadValue(remote.router, 32)]);
    await invoke(endpoint, 'Set destination Gas', contract, endpoint.router, 'setDestinationGas(uint32,uint256)', [remote.domain, 300000]);
    const gasStep = run.steps.find(item => item.key === `${endpoint.key}:Fund relayer`);
    if (gasStep) await execute(endpoint, 'Fund relayer', '0x', run.relayer, BigInt(gasStep.value));
    else {
      const balance = BigInt(await bridgeRpc<string>(endpoint, 'eth_getBalance', [run.relayer, 'latest']));
      const desired = ethers.parseEther(run.form.relayGas);
      if (balance < desired) await execute(endpoint, 'Fund relayer', '0x', run.relayer, desired - balance);
    }
  }
  progress('Verifying both chains');
  validateBridgeConfig({ schemaVersion: 1, environment: 'local-test', routes: [run.route] });
  await validateRouteOnChain(run.route);
  const [bridge] = await bridgeCall(hive, hive.router, new ethers.Interface(['function nativeFlowBridge() view returns (address)']), 'nativeFlowBridge');
  if (bridge.toLowerCase() !== run.nativeFlowBridge.toLowerCase()) throw new Error('Native Flow bridge address mismatch.');
  save();
}
