import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  CheckCircle2,
  CircleDashed,
  FlaskConical,
  KeyRound,
  LoaderCircle,
  Play,
  Rocket,
  Send,
  Vote,
  FilePlus2,
  Trash2,
} from 'lucide-react';
import { ethers } from 'ethers';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { CopyButton } from '@/app/components/copy-button';
import {
  describeError,
  jsonRpc,
  sendSignedTransaction,
  walletForGenesis,
  type TransactionProgress,
} from '@/app/lib/hivex-eth-client';

const GENESIS_ACCOUNT = '0x755Ccf704E17570b64E247f0794314e4C8E542CA';
const NATIVE_FLOW_BRIDGE = '0xc1b157ac921cf5b89a35d11b9482aa090a0ce921';
const RAW_TX_PLACEHOLDER = '0x000000000000000000000000000000000000dEaD';
const TOKEN_CONSTRUCTOR = [
  'constructor(string tokenName,string tokenSymbol,uint8 tokenDecimals,uint256 initialSupply,string logoUrl,address initialHolder,address bridge)',
] as const;

type Tool = 'deploy' | 'proposal' | 'vote';
type WorkflowStep = Tool | null;
type StageStatus = 'idle' | 'running' | 'success' | 'error';

interface StageState {
  status: StageStatus;
  detail: string;
  hash?: string;
  localHash?: string;
  subject?: string;
}

interface LogEntry {
  id: number;
  time: string;
  message: string;
  level: 'info' | 'success' | 'error';
}

const EMPTY_STAGE: StageState = { status: 'idle', detail: 'Not started' };
const WORKFLOW_STORAGE_KEY = 'openhive.native-flow-test.workflow.v1';
const PRIVATE_KEY_SESSION_KEY = 'openhive.native-flow-test.private-key.v1';

interface PersistedWorkflowState {
  rpcUrl: string;
  chainId: string;
  tokenName: string;
  tokenSymbol: string;
  decimals: string;
  initialSupply: string;
  initialHolder: string;
  logoUrl: string;
  duration: string;
  minVote: string;
  exchangeRate: string;
  contractAddress: string;
  proposalHash: string;
  proposalAssetName: string;
  deployedContractAddress: string;
  activeTool: Tool;
  deployStage: StageState;
  proposalStage: StageState;
  voteStage: StageState;
  logs: LogEntry[];
}

function normalizeStage(value: unknown): StageState {
  if (!value || typeof value !== 'object') return EMPTY_STAGE;
  const candidate = value as Partial<StageState>;
  const validStatuses: StageStatus[] = ['idle', 'running', 'success', 'error'];
  if (!candidate.status || !validStatuses.includes(candidate.status)) {
    return EMPTY_STAGE;
  }

  const wasRunning = candidate.status === 'running';
  return {
    status: wasRunning ? 'error' : candidate.status,
    detail: wasRunning
      ? 'Page refreshed while confirmation was running. Check the stored hashes before retrying.'
      : typeof candidate.detail === 'string'
        ? candidate.detail
        : EMPTY_STAGE.detail,
    hash: typeof candidate.hash === 'string' ? candidate.hash : undefined,
    localHash:
      typeof candidate.localHash === 'string' ? candidate.localHash : undefined,
    subject: typeof candidate.subject === 'string' ? candidate.subject : undefined,
  };
}

function loadWorkflowState(): Partial<PersistedWorkflowState> {
  try {
    const raw = window.localStorage.getItem(WORKFLOW_STORAGE_KEY);
    if (!raw) return {};
    const value = JSON.parse(raw) as Record<string, unknown>;
    const text = (key: string) =>
      typeof value[key] === 'string' ? (value[key] as string) : undefined;
    const logs = Array.isArray(value.logs)
      ? value.logs
          .filter(
            (entry): entry is LogEntry =>
              Boolean(entry) &&
              typeof entry === 'object' &&
              typeof (entry as LogEntry).id === 'number' &&
              typeof (entry as LogEntry).time === 'string' &&
              typeof (entry as LogEntry).message === 'string' &&
              ['info', 'success', 'error'].includes((entry as LogEntry).level),
          )
          .slice(-200)
      : [];

    return {
      rpcUrl: text('rpcUrl'),
      chainId: text('chainId'),
      tokenName: text('tokenName'),
      tokenSymbol: text('tokenSymbol'),
      decimals: text('decimals'),
      initialSupply: text('initialSupply'),
      initialHolder: text('initialHolder'),
      logoUrl: text('logoUrl'),
      duration: text('duration'),
      minVote: text('minVote'),
      exchangeRate: text('exchangeRate'),
      contractAddress: text('contractAddress'),
      proposalHash: text('proposalHash'),
      proposalAssetName: text('proposalAssetName') ?? text('tokenSymbol'),
      deployedContractAddress: text('deployedContractAddress'),
      activeTool: ['deploy', 'proposal', 'vote'].includes(String(value.activeTool))
        ? value.activeTool as Tool : 'proposal',
      deployStage: normalizeStage(value.deployStage),
      proposalStage: normalizeStage(value.proposalStage),
      voteStage: normalizeStage(value.voteStage),
      logs,
    };
  } catch {
    return {};
  }
}

function loadSessionPrivateKey() {
  try {
    return window.sessionStorage.getItem(PRIVATE_KEY_SESSION_KEY) || '';
  } catch {
    return '';
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className='block min-w-0 space-y-1.5'>
      <span className='text-xs font-medium text-muted-foreground'>{label}</span>
      {children}
    </label>
  );
}

function StageIcon({ status }: { status: StageStatus }) {
  if (status === 'running') {
    return <LoaderCircle className='h-5 w-5 animate-spin text-primary' />;
  }
  if (status === 'success') {
    return <CheckCircle2 className='h-5 w-5 text-green-400' />;
  }
  return <CircleDashed className='h-5 w-5 text-muted-foreground' />;
}

function HashValue({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className='grid min-w-0 grid-cols-[82px_minmax(0,1fr)_28px] items-start gap-2 text-xs'>
      <span className='text-muted-foreground'>{label}</span>
      <code className='break-all font-mono leading-5 text-foreground'>
        {value}
      </code>
      <CopyButton value={value} label={label} className='flex size-7 items-center justify-center rounded-sm hover:bg-secondary' iconClassName='size-3.5' />
    </div>
  );
}

function StageRow({
  title,
  state,
  action,
  actionLabel,
  disabled,
}: {
  title: string;
  state: StageState;
  action: () => void;
  actionLabel: string;
  disabled: boolean;
}) {
  return (
    <section aria-label='Transaction result' className='min-w-0 border-t border-border/50 py-4'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-start'>
        <div className='flex min-w-0 flex-1 items-start gap-3'>
          <div className='min-w-0 flex-1 space-y-2'>
            <div className='flex items-center gap-2'>
              <span className='shrink-0'><StageIcon status={state.status} /></span>
              <h2 className='text-sm font-semibold'>{title}</h2>
            </div>
            <p
              role={state.status === 'error' ? 'alert' : 'status'}
              className={`break-words text-xs leading-5 ${
                state.status === 'error' ? 'text-red-400' : 'text-muted-foreground'
              }`}>
              {state.detail}
            </p>
            <div className='space-y-1'>
              <HashValue label='Target' value={state.subject} />
              <HashValue label='Local hash' value={state.localHash} />
              <HashValue label='Node hash' value={state.hash} />
            </div>
          </div>
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          disabled={disabled}
          onClick={action}
          className='w-full sm:w-auto'>
          {state.status === 'running' ? (
            <LoaderCircle className='animate-spin' />
          ) : (
            <Play />
          )}
          {actionLabel}
        </Button>
      </div>
    </section>
  );
}

export default function NativeFlowTestPage() {
  const [restored] = useState(loadWorkflowState);
  const [rpcUrl, setRpcUrl] = useState(restored.rpcUrl ?? '/hivex-dev-rpc');
  const [chainId, setChainId] = useState(restored.chainId ?? '12315');
  const [privateKey, setPrivateKey] = useState(loadSessionPrivateKey);
  const [tokenName, setTokenName] = useState(restored.tokenName ?? 'ppst');
  const [tokenSymbol, setTokenSymbol] = useState(restored.tokenSymbol ?? 'PPST');
  const [decimals, setDecimals] = useState(restored.decimals ?? '8');
  const [initialSupply, setInitialSupply] = useState(
    restored.initialSupply ?? '1000000000',
  );
  const [initialHolder, setInitialHolder] = useState(restored.initialHolder ?? GENESIS_ACCOUNT);
  const initialHolderError = !ethers.isAddress(initialHolder.trim()) || initialHolder.trim().toLowerCase() === ethers.ZeroAddress
    ? 'Enter a valid non-zero initial holder address.' : '';
  const [logoUrl, setLogoUrl] = useState(restored.logoUrl ?? 'www.1.com');
  const [duration, setDuration] = useState(restored.duration ?? '6m');
  const [minVote, setMinVote] = useState(restored.minVote ?? '1');
  const [exchangeRate, setExchangeRate] = useState(restored.exchangeRate ?? '1');
  const [contractAddress, setContractAddress] = useState(
    restored.contractAddress ?? '',
  );
  const [proposalHash, setProposalHash] = useState(restored.proposalHash ?? '');
  const [proposalAssetName, setProposalAssetName] = useState(restored.proposalAssetName ?? '');
  const [deployedContractAddress, setDeployedContractAddress] = useState(restored.deployedContractAddress ?? '');
  const [activeTool, setActiveTool] = useState<Tool>(restored.activeTool ?? 'proposal');
  const [busy, setBusy] = useState<WorkflowStep>(null);
  const submitting = useRef(false);
  const [deployStage, setDeployStage] = useState<StageState>(
    restored.deployStage ?? EMPTY_STAGE,
  );
  const [proposalStage, setProposalStage] = useState<StageState>(
    restored.proposalStage ?? EMPTY_STAGE,
  );
  const [voteStage, setVoteStage] = useState<StageState>(
    restored.voteStage ?? EMPTY_STAGE,
  );
  const [logs, setLogs] = useState<LogEntry[]>(restored.logs ?? []);

  useEffect(() => {
    const snapshot: PersistedWorkflowState = {
      rpcUrl,
      chainId,
      tokenName,
      tokenSymbol,
      decimals,
      initialSupply,
      initialHolder,
      logoUrl,
      duration,
      minVote,
      exchangeRate,
      contractAddress,
      proposalHash,
      proposalAssetName,
      deployedContractAddress,
      activeTool,
      deployStage,
      proposalStage,
      voteStage,
      logs: logs.slice(-200),
    };
    try {
      window.localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Storage can be unavailable in locked-down browser profiles.
    }
  }, [
    rpcUrl,
    chainId,
    tokenName,
    tokenSymbol,
    decimals,
    initialSupply,
    initialHolder,
    logoUrl,
    duration,
    minVote,
    exchangeRate,
    contractAddress,
    proposalHash,
    proposalAssetName,
    deployedContractAddress,
    activeTool,
    deployStage,
    proposalStage,
    voteStage,
    logs,
  ]);

  useEffect(() => {
    try {
      if (privateKey) {
        window.sessionStorage.setItem(PRIVATE_KEY_SESSION_KEY, privateKey);
      } else {
        window.sessionStorage.removeItem(PRIVATE_KEY_SESSION_KEY);
      }
    } catch {
      // Keep the signer in React state when session storage is unavailable.
    }
  }, [privateKey]);

  const keyState = useMemo(() => {
    if (!privateKey.trim()) return { valid: false, message: 'Private key required' };
    try {
      const wallet = walletForGenesis(privateKey, GENESIS_ACCOUNT);
      return { valid: true, message: wallet.address };
    } catch (error) {
      return { valid: false, message: describeError(error) };
    }
  }, [privateKey]);

  const addLog = (message: string, level: LogEntry['level'] = 'info') => {
    setLogs((current) => [
      ...current,
      {
        id: Date.now() + current.length,
        time: new Date().toLocaleTimeString(),
        message,
        level,
      },
    ]);
  };

  const progressMessage = (label: string, progress: TransactionProgress) => {
    const receipt = progress.receiptFound ? 'receipt found' : 'receipt pending';
    const transaction = progress.transactionFound
      ? 'transaction found'
      : 'transaction pending';
    return `${label}: poll ${progress.attempt}, ${receipt}, ${transaction}`;
  };

  const validateBase = () => {
    if (!rpcUrl.trim()) throw new Error('RPC URL is required.');
    const parsedChainId = Number(chainId);
    if (!Number.isSafeInteger(parsedChainId) || parsedChainId <= 0) {
      throw new Error('Chain ID must be a positive integer.');
    }
    if (!keyState.valid) throw new Error(keyState.message);
    return parsedChainId;
  };

  const executeDeploy = async () => {
    const parsedChainId = validateBase();
    if (initialHolderError) throw new Error(initialHolderError);
    const holder = ethers.getAddress(initialHolder.trim());
    const tokenDecimals = Number(decimals);
    if (!Number.isInteger(tokenDecimals) || tokenDecimals < 0 || tokenDecimals > 255) {
      throw new Error('Token decimals must be an integer from 0 to 255.');
    }

    setDeployStage({ status: 'running', detail: 'Loading creation bytecode...' });
    addLog('Loading LockableToken creation bytecode.');
    const bytecodeResponse = await fetch('/contracts/LockableToken5.bin');
    if (!bytecodeResponse.ok) {
      throw new Error('Unable to load /contracts/LockableToken5.bin.');
    }
    const bytecode = (await bytecodeResponse.text()).trim();
    const factory = new ethers.ContractFactory(
      TOKEN_CONSTRUCTOR,
      bytecode.startsWith('0x') ? bytecode : `0x${bytecode}`,
    );
    const deployment = await factory.getDeployTransaction(
      tokenName.trim(),
      tokenSymbol.trim(),
      tokenDecimals,
      ethers.parseUnits(initialSupply.trim(), tokenDecimals),
      logoUrl.trim(),
      holder,
      NATIVE_FLOW_BRIDGE,
    );
    const result = await sendSignedTransaction({
      rpcUrl,
      privateKey,
      expectedAddress: GENESIS_ACCOUNT,
      chainId: parsedChainId,
      data: deployment.data?.toString() || '0x',
      gasLimit: 12_000_000n,
      onSubmitted: ({ localHash, rpcHash }) => {
        setDeployStage({
          status: 'running',
          detail: 'Deployment broadcast; waiting for both Ethereum query interfaces...',
          localHash,
          hash: rpcHash,
        });
      },
      onProgress: (progress) => {
        setDeployStage((current) => ({
          ...current,
          status: 'running',
          detail: progressMessage('Deploy', progress),
        }));
      },
    });
    const receiptAddress = result.confirmation.receipt.contractAddress;
    const nextContractAddress =
      typeof receiptAddress === 'string' && ethers.isAddress(receiptAddress)
        ? ethers.getAddress(receiptAddress)
        : ethers.getCreateAddress({ from: GENESIS_ACCOUNT, nonce: result.nonce });
    const code = await jsonRpc<string>(rpcUrl, 'eth_getCode', [
      nextContractAddress,
      'latest',
    ]);
    if (!code || code === '0x') {
      throw new Error(`Deployment confirmed but ${nextContractAddress} has no code.`);
    }

    setDeployedContractAddress(nextContractAddress);
    setDeployStage({
      status: 'success',
      detail: `Contract ${nextContractAddress} is deployed and has runtime code.`,
      localHash: result.localHash,
      hash: result.rpcHash,
    });
    addLog(`Token deployed at ${nextContractAddress}.`, 'success');
    return nextContractAddress;
  };

  const executeProposal = async () => {
    const parsedChainId = validateBase();
    const targetContract = contractAddress.trim();
    if (!ethers.isAddress(targetContract) || targetContract === ethers.ZeroAddress) {
      throw new Error('Enter a non-zero ERC20 contract address.');
    }
    const parsedMinVote = Number(minVote);
    if (!Number.isSafeInteger(parsedMinVote) || parsedMinVote <= 0) {
      throw new Error('Minimum vote must be a positive integer.');
    }
    const assetName = proposalAssetName.trim();
    if (!/^[0-9A-Za-z]+$/.test(assetName)) {
      throw new Error('Proposal asset name must contain only letters and numbers.');
    }
    const normalizedContract = ethers.getAddress(targetContract);
    setProposalStage({ status: 'running', detail: 'Checking ERC20 contract...', subject: normalizedContract });
    const code = await jsonRpc<string>(rpcUrl, 'eth_getCode', [normalizedContract, 'latest']);
    if (!code || code === '0x') throw new Error('No contract code at the proposal ERC20 address on this network.');
    const peerChainTokenAddress = normalizedContract
      .slice(2)
      .toLowerCase()
      .padStart(64, '0');
    const businessPayload = {
      type: 'proposal',
      to: GENESIS_ACCOUNT,
      asset_name: assetName,
      contract_addr: normalizedContract,
      cross_chain_investment_contract_addr: '',
      cross_chain_tx_type: 0,
      peer_chain_token_addr: peerChainTokenAddress,
      exchange_rate: exchangeRate.trim(),
      identifier: `${assetName.toLowerCase()} native bridge`,
      title: `${assetName} native bridge`,
      min_vote: parsedMinVote,
      duration: duration.trim(),
      is_find_utxo: true,
      sponsor_gas: false,
      gas_asset: { addr: GENESIS_ACCOUNT, asset_type: 'OHI' },
      encoded_info: `${assetName} native flow proposal`,
    };

    setProposalStage({
      status: 'running',
      detail: 'Signing the proposal as an EIP-1559 raw transaction...',
      subject: normalizedContract,
    });
    addLog('Signing and broadcasting the proposal through eth_sendRawTransaction.');
    const result = await sendSignedTransaction({
      rpcUrl,
      privateKey,
      expectedAddress: GENESIS_ACCOUNT,
      chainId: parsedChainId,
      to: RAW_TX_PLACEHOLDER,
      data: ethers.hexlify(ethers.toUtf8Bytes(JSON.stringify(businessPayload))),
      gasLimit: 4_000_000n,
      onSubmitted: ({ localHash, rpcHash }) => {
        setProposalStage({
          status: 'running',
          detail: 'Proposal broadcast; waiting for both Ethereum query interfaces...',
          localHash,
          hash: rpcHash,
          subject: normalizedContract,
        });
      },
      onProgress: (progress) => {
        setProposalStage((current) => ({
          ...current,
          status: 'running',
          detail: progressMessage('Proposal', progress),
        }));
      },
    });

    setProposalStage({
      status: 'success',
      detail: 'Proposal confirmed by both Ethereum query interfaces. Its hash becomes the native asset type after activation.',
      localHash: result.localHash,
      hash: result.rpcHash,
      subject: normalizedContract,
    });
    addLog(`Proposal created: ${result.rpcHash}.`, 'success');
    return result.rpcHash;
  };

  const executeVote = async () => {
    const parsedChainId = validateBase();
    const targetProposal = proposalHash.trim();
    if (!ethers.isHexString(targetProposal, 32) || targetProposal === ethers.ZeroHash) {
      throw new Error('Enter a non-zero 32-byte proposal hash.');
    }
    const businessPayload = {
      type: 'vote',
      to: GENESIS_ACCOUNT,
      vote_hash: targetProposal,
      vote: '1',
      is_find_utxo: true,
      sponsor_gas: false,
      gas_asset: { addr: GENESIS_ACCOUNT, asset_type: 'OHI' },
      encoded_info: 'approve native flow proposal',
    };
    setVoteStage({
      status: 'running',
      detail: 'Signing the vote JSON as an EIP-1559 raw transaction...',
      subject: targetProposal,
    });
    addLog('Signing and broadcasting one approval vote through eth_sendRawTransaction.');
    const result = await sendSignedTransaction({
      rpcUrl,
      privateKey,
      expectedAddress: GENESIS_ACCOUNT,
      chainId: parsedChainId,
      to: RAW_TX_PLACEHOLDER,
      data: ethers.hexlify(ethers.toUtf8Bytes(JSON.stringify(businessPayload))),
      gasLimit: 3_000_000n,
      onSubmitted: ({ localHash, rpcHash }) => {
        setVoteStage({
          status: 'running',
          detail: 'Vote broadcast; waiting for both Ethereum query interfaces...',
          localHash,
          hash: rpcHash,
          subject: targetProposal,
        });
      },
      onProgress: (progress) => {
        setVoteStage((current) => ({
          ...current,
          status: 'running',
          detail: progressMessage('Vote', progress),
        }));
      },
    });
    setVoteStage({
      status: 'success',
      detail: 'Vote confirmed by eth_getTransactionReceipt and eth_getTransactionByHash.',
      localHash: result.localHash,
      hash: result.rpcHash,
      subject: targetProposal,
    });
    addLog(`Vote confirmed: ${result.rpcHash}.`, 'success');
  };

  const runStep = async (
    step: Tool,
    action: () => Promise<unknown>,
  ) => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(step);
    if (step === 'deploy') { setDeployStage(EMPTY_STAGE); setDeployedContractAddress(''); }
    if (step === 'proposal') setProposalStage(EMPTY_STAGE);
    if (step === 'vote') setVoteStage(EMPTY_STAGE);
    try {
      await action();
    } catch (error) {
      const message = describeError(error);
      const markError = (current: StageState) => ({
        ...current,
        status: 'error' as const,
        detail: message,
      });
      if (step === 'deploy') setDeployStage(markError);
      if (step === 'proposal') setProposalStage(markError);
      if (step === 'vote') setVoteStage(markError);
      addLog(message, 'error');
    } finally {
      submitting.current = false;
      setBusy(null);
    }
  };

  const isBusy = busy !== null;

  return (
    <div className='mx-auto max-w-7xl space-y-6'>
      <header className='flex flex-col gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-end sm:justify-between'>
        <div className='space-y-1'>
          <div className='flex items-center gap-2 text-primary'>
            <FlaskConical className='h-5 w-5' />
            <span className='text-xs font-semibold uppercase'>Devnet Tool</span>
          </div>
          <h1 className='text-2xl font-bold sm:text-3xl'>Native Flow Test</h1>
        </div>
      </header>

      <div className='grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]'>
        <div className='min-w-0 space-y-6'>
          <section className='min-w-0 border-b border-border/60 pb-6'>
            <div className='pb-4'>
              <h2 className='text-sm font-semibold'>Connection and signer</h2>
            </div>
            <fieldset disabled={isBusy} className='grid min-w-0 gap-4 sm:grid-cols-2'>
              <Field label='RPC URL'>
                <Input value={rpcUrl} onChange={(event) => setRpcUrl(event.target.value)} />
              </Field>
              <Field label='Chain ID'>
                <Input value={chainId} onChange={(event) => setChainId(event.target.value)} inputMode='numeric' />
              </Field>
              <Field label='Genesis account'>
                <Input value={GENESIS_ACCOUNT} readOnly className='font-mono text-xs' />
              </Field>
              <Field label='Test signer private key (tab session)'>
                <div className='relative'>
                  <KeyRound className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                  <Input
                    type='password'
                    aria-label='Test signer private key (tab session)'
                    value={privateKey}
                    autoComplete='off'
                    spellCheck={false}
                    onChange={(event) => setPrivateKey(event.target.value)}
                    placeholder='Paste private key'
                    className='pl-9 font-mono'
                  />
                </div>
                <span
                  className={`block break-all text-[11px] ${
                    keyState.valid ? 'text-green-400' : 'text-muted-foreground'
                  }`}>
                  {keyState.message}
                </span>
              </Field>
            </fieldset>
          </section>

          <div role='tablist' aria-label='Native Flow tools' className='grid grid-cols-3 border-b border-border'>
            {([
              { id: 'deploy', label: 'ERC20', icon: Rocket },
              { id: 'proposal', label: 'Proposal', icon: FilePlus2 },
              { id: 'vote', label: 'Vote', icon: Vote },
            ] as const).map(({ id, label, icon: Icon }, index, tabs) => (
              <button key={id} type='button' role='tab' id={`tool-tab-${id}`} aria-controls={`tool-panel-${id}`}
                aria-selected={activeTool === id} tabIndex={activeTool === id ? 0 : -1} disabled={isBusy}
                onClick={() => setActiveTool(id)}
                onKeyDown={(event) => {
                  const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
                    : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
                    : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
                  if (next < 0) return;
                  event.preventDefault();
                  setActiveTool(tabs[next].id);
                  document.getElementById(`tool-tab-${tabs[next].id}`)?.focus();
                }}
                className={`flex h-11 min-w-0 items-center justify-center gap-2 border-b-2 text-sm font-medium transition-colors disabled:opacity-60 ${activeTool === id ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                <Icon className='size-4 shrink-0' />{label}
              </button>
            ))}
          </div>

          {activeTool === 'deploy' && <section role='tabpanel' id='tool-panel-deploy' aria-labelledby='tool-tab-deploy' className='min-w-0 space-y-5'>
            <h2 className='text-base font-semibold'>Deploy ERC20</h2>
            <fieldset disabled={isBusy} className='grid min-w-0 gap-4 sm:grid-cols-2'>
              <Field label='Token name'><Input value={tokenName} onChange={(event) => setTokenName(event.target.value)} /></Field>
              <Field label='Symbol'><Input value={tokenSymbol} onChange={(event) => setTokenSymbol(event.target.value.toUpperCase())} /></Field>
              <Field label='Decimals'><Input type='number' min={0} max={255} value={decimals} onChange={(event) => setDecimals(event.target.value)} /></Field>
              <Field label='Initial supply'><Input value={initialSupply} onChange={(event) => setInitialSupply(event.target.value)} inputMode='decimal' /></Field>
              <Field label='Logo URL'><Input value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} /></Field>
              <div className='min-w-0 space-y-1.5'>
                <Field label='Initial holder'><Input value={initialHolder} onChange={(event) => setInitialHolder(event.target.value)} disabled={isBusy} placeholder='0x...' aria-invalid={Boolean(initialHolderError)} aria-describedby={initialHolderError ? 'initial-holder-error' : undefined} className='font-mono text-xs' /></Field>
                {initialHolderError && <p id='initial-holder-error' className='text-xs text-red-400'>{initialHolderError}</p>}
              </div>
              <div className='min-w-0 sm:col-span-2'><Field label='Native Flow bridge'><Input value={NATIVE_FLOW_BRIDGE} readOnly className='font-mono text-xs' /></Field></div>
            </fieldset>
            <StageRow title='Deployment transaction' state={deployStage} action={() => void runStep('deploy', executeDeploy)} actionLabel='Deploy ERC20' disabled={isBusy || !keyState.valid || Boolean(initialHolderError)} />
            <HashValue label='Contract' value={deployedContractAddress} />
          </section>}

          {activeTool === 'proposal' && <section role='tabpanel' id='tool-panel-proposal' aria-labelledby='tool-tab-proposal' className='min-w-0 space-y-5'>
            <h2 className='text-base font-semibold'>Create Native Flow proposal</h2>
            <fieldset disabled={isBusy} className='grid min-w-0 gap-4 sm:grid-cols-2'>
              <div className='min-w-0 sm:col-span-2'><Field label='ERC20 contract address'>
                <Input value={contractAddress} onChange={(event) => setContractAddress(event.target.value)} placeholder='0x...' className='font-mono text-xs' />
              </Field></div>
              <Field label='Asset name'><Input value={proposalAssetName} onChange={(event) => setProposalAssetName(event.target.value)} /></Field>
              <Field label='Proposal duration'><Input value={duration} onChange={(event) => setDuration(event.target.value)} /></Field>
              <Field label='Minimum vote'><Input type='number' min={1} step={1} value={minVote} onChange={(event) => setMinVote(event.target.value)} /></Field>
              <Field label='Exchange rate'><Input value={exchangeRate} onChange={(event) => setExchangeRate(event.target.value)} inputMode='decimal' /></Field>
              <div className='min-w-0 sm:col-span-2'><Field label='Proposer'><Input value={GENESIS_ACCOUNT} readOnly className='font-mono text-xs' /></Field></div>
            </fieldset>
            <StageRow title='Proposal transaction' state={proposalStage} action={() => void runStep('proposal', executeProposal)} actionLabel='Create proposal'
              disabled={isBusy || !keyState.valid || !ethers.isAddress(contractAddress.trim()) || contractAddress.trim() === ethers.ZeroAddress || !proposalAssetName.trim()} />
            <HashValue label='Proposal ID' value={proposalStage.status === 'success' ? proposalStage.hash : undefined} />
          </section>}

          {activeTool === 'vote' && <section role='tabpanel' id='tool-panel-vote' aria-labelledby='tool-tab-vote' className='min-w-0 space-y-5'>
            <h2 className='text-base font-semibold'>Approve proposal</h2>
            <fieldset disabled={isBusy} className='grid min-w-0 gap-4'>
              <Field label='Proposal hash'><Input value={proposalHash} onChange={(event) => setProposalHash(event.target.value)} placeholder='0x...' className='font-mono text-xs' /></Field>
              <Field label='Voter'><Input value={GENESIS_ACCOUNT} readOnly className='font-mono text-xs' /></Field>
            </fieldset>
            <StageRow title='Approval transaction' state={voteStage} action={() => void runStep('vote', executeVote)} actionLabel='Submit approval'
              disabled={isBusy || !keyState.valid || !ethers.isHexString(proposalHash.trim(), 32) || proposalHash.trim() === ethers.ZeroHash} />
          </section>}
        </div>

        <aside className='min-w-0 border-t border-border/60 pt-4 xl:sticky xl:top-24 xl:h-[calc(100vh-7rem)] xl:border-l xl:border-t-0 xl:pt-0'>
          <div className='flex items-center justify-between border-b border-border/50 px-4 py-3'>
            <div className='flex items-center gap-2'>
              <Send className='h-4 w-4 text-primary' />
              <h2 className='text-sm font-semibold'>Execution log</h2>
            </div>
            <button
              type='button'
              onClick={() => setLogs([])}
              title='Clear execution log' aria-label='Clear execution log'
              className='flex size-8 items-center justify-center rounded-sm text-muted-foreground hover:bg-secondary hover:text-foreground'>
              <Trash2 className='size-4' />
            </button>
          </div>
          <div className='max-h-96 overflow-auto p-4 font-mono text-xs leading-5 xl:h-[calc(100%-57px)] xl:max-h-none'>
            {logs.length === 0 ? (
              <div className='flex h-full min-h-80 flex-col items-center justify-center gap-3 text-center text-muted-foreground'>
                <Vote className='h-7 w-7' />
                <p>No transactions.</p>
              </div>
            ) : (
              <ol className='space-y-3'>
                {logs.map((entry) => (
                  <li key={entry.id} className='grid min-w-0 grid-cols-[72px_minmax(0,1fr)] gap-2'>
                    <span className='text-muted-foreground'>{entry.time}</span>
                    <span
                      className={`min-w-0 [overflow-wrap:anywhere] ${
                        entry.level === 'error'
                          ? 'text-red-400'
                          : entry.level === 'success'
                            ? 'text-green-400'
                            : 'text-foreground'
                      }`}>
                      {entry.message}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
