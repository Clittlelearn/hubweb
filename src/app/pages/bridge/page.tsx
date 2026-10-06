import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useConnection } from 'wagmi';
import { ethers, type Eip1193Provider } from 'ethers';
import { ArrowDownUp, ArrowRight, CheckCircle2, Clock3, RefreshCw, Wallet, LoaderCircle, AlertCircle, ExternalLink, Search } from 'lucide-react';
import { useWallet } from '../../providers/wallet-provider';
import { Button } from '../../components/ui/button';
import { CopyButton } from '../../components/copy-button';
import BridgeDeployment from './deployment';
import { readBridgeSubmissions, saveBridgeSubmission, recoverBridgeTransfer, reconcileBridgeSubmission, type BridgeSubmission } from '../../lib/bridge-transfer-recovery';
import {
  bridgeAmount, bridgeCall, bridgeError, bridgeRpc, quoteBridge, readBridgeBalance,
  refreshBridgeRecord, routeEnds, sendWalletTransaction, validateBridgeConfig,
  validateRouteOnChain, waitBridgeReceipt, TOKEN_ABI, ROUTER_ABI,
  type BridgeRecord, type BridgeEndpoint,
} from '../../lib/bridge-client';

const HISTORY_KEY = 'hub.bridge.history.v1';
const FORM_KEY = 'hub.bridge.form.v1';
const inputClass = 'w-full min-w-0 rounded-md border border-border bg-background px-3 py-3 text-sm outline-none focus:border-emerald-400 disabled:opacity-60';
const short = (value: string) => `${value.slice(0, 8)}...${value.slice(-6)}`;
function readStored<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
}
function readHistory(): BridgeRecord[] {
  const value = readStored<unknown>(HISTORY_KEY, []);
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is BridgeRecord => {
    try {
      validateBridgeConfig({ schemaVersion: 1, environment: 'saved', routes: [item.route] });
      routeEnds(item.route, item.sourceKey);
      return typeof item.id === 'string' && ethers.isHexString(item.sourceHash, 32) && ethers.isAddress(item.account) &&
        ethers.isAddress(item.recipient) && Number.isFinite(item.createdAt) &&
        Number.isSafeInteger(item.destinationStartBlock) && item.destinationStartBlock >= 0 && typeof item.amount === 'string' &&
        ['source-pending', 'relaying', 'delivered', 'failed', 'confirmation-failed'].includes(item.stage);
    } catch { return false; }
  }).slice(0, 100);
}

function AddressField({ label, value }: { label: string; value?: string }) {
  return <div className='min-w-0'>
    <dt className='text-xs text-muted-foreground'>{label}</dt>
    <dd className='mt-1 flex min-w-0 items-start gap-2'>
      <code className='min-w-0 flex-1 select-text break-all text-xs leading-5'>{value || '--'}</code>
      {value && <CopyButton value={value} label={label} iconClassName='size-3.5'
        className='flex size-7 shrink-0 items-center justify-center rounded-sm hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring' />}
    </dd>
  </div>;
}

function BridgeAddresses({ source, target, recipient }: { source: BridgeEndpoint; target: BridgeEndpoint; recipient: string }) {
  return <section aria-label='Bridge addresses' className='min-w-0 space-y-3'>
    <h3 className='text-sm font-medium'>Contract calls & recipient</h3>
    <dl className='grid min-w-0 gap-x-6 gap-y-3 sm:grid-cols-2'>
      <AddressField label={`${source.name} · Source call (Router)`} value={source.router} />
      <AddressField label={`${target.name} · Delivery call (Mailbox)`} value={target.mailbox} />
      <AddressField label={`${source.name} · Source ERC20`} value={source.token} />
      <AddressField label={`${target.name} · Destination Router`} value={target.router} />
      <AddressField label={`${target.name} · Destination ERC20`} value={target.token} />
      <AddressField label={`${target.name} · ERC20 recipient`} value={ethers.isAddress(recipient) && recipient !== ethers.ZeroAddress ? recipient : undefined} />
    </dl>
  </section>;
}

export default function BridgePage() {
  const [view, setView] = useState<'transfer' | 'deploy'>(() => new URLSearchParams(window.location.search).get('view') === 'deploy' ? 'deploy' : 'transfer');
  const wallet = useWallet();
  const connection = useConnection();
  const [form, setForm] = useState(() => {
    const fallback = { routeId: '', sourceKey: '', amount: '', recipient: '' };
    const stored = readStored(FORM_KEY, fallback);
    return Object.keys(fallback).every(key => typeof stored?.[key] === 'string') ? stored : fallback;
  });
  const [history, setHistory] = useState(readHistory);
  const historyRef = useRef(history);
  historyRef.current = history;
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [checking, setChecking] = useState(false);
  const [submissions, setSubmissions] = useState<BridgeSubmission[]>(() => {
    try { return readBridgeSubmissions(); } catch { return []; }
  });
  const [recoveryHash, setRecoveryHash] = useState('');
  const [recovering, setRecovering] = useState(false);
  const sending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    try { localStorage.setItem(FORM_KEY, JSON.stringify(form)); } catch { setStorageError('Browser storage unavailable. Keep your transaction hashes before refreshing.'); }
  }, [form]);
  useEffect(() => {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch { setStorageError('Browser storage unavailable. Keep your transaction hashes before refreshing.'); }
  }, [history]);

  const config = useQuery({ queryKey: ['bridge-config'], queryFn: async () => {
    const response = await fetch('/bridge/routes.json', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Bridge route configuration is unavailable.');
    return validateBridgeConfig(await response.json());
  }, staleTime: 30000, retry: 1 });
  const route = config.data?.routes.find(item => item.id === form.routeId) || config.data?.routes[0];
  const sourceKey = route?.endpoints.some(item => item.key === form.sourceKey) ? form.sourceKey : route?.endpoints[1].key;
  const ends = route && sourceKey ? routeEnds(route, sourceKey) : undefined;
  const recipient = form.recipient.trim() || (ethers.isAddress(wallet.address) ? wallet.address : '');
  const amount = useMemo(() => {
    try { return route ? bridgeAmount(form.amount, route.decimals) : null; } catch { return null; }
  }, [form.amount, route]);
  const readyAccount = wallet.connected && ethers.isAddress(wallet.address);
  const routeCheck = useQuery({ queryKey: ['bridge-route-check', route], enabled: Boolean(route) && view === 'transfer',
    queryFn: () => validateRouteOnChain(route!), staleTime: 20000, retry: 1 });
  const balances = useQuery({ queryKey: ['bridge-balances', route, sourceKey, wallet.address, recipient],
    enabled: Boolean(route && ends && readyAccount && ethers.isAddress(recipient) && routeCheck.isSuccess && view === 'transfer'),
    queryFn: async () => {
      const [source, target] = await Promise.all([readBridgeBalance(ends!.source, wallet.address), readBridgeBalance(ends!.target, recipient)]);
      return { source, target };
    }, refetchInterval: query => query.state.status === 'error' ? false : 10000, retry: false });
  const quote = useQuery({ queryKey: ['bridge-quote', route, sourceKey, recipient, amount?.toString()],
    enabled: Boolean(ends && amount && ethers.isAddress(recipient) && routeCheck.isSuccess && view === 'transfer'),
    queryFn: () => quoteBridge(ends!.source, ends!.target, recipient, amount!), staleTime: 10000, retry: 1 });

  const pendingIds = history.filter(item => ['source-pending', 'relaying'].includes(item.stage)).map(item => item.id).join(',');
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const rows = await Promise.all(historyRef.current.filter(item => ['source-pending', 'relaying'].includes(item.stage)).map(async item => {
          try { return await refreshBridgeRecord(item); }
          catch (failure) { return { ...item, error: bridgeError(failure) }; }
        }));
        if (!cancelled && rows.length) setHistory(current => current.map(item => rows.find(row => row.id === item.id) || item));
      } finally { inFlight = false; }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [pendingIds]);

  const updateForm = (patch: Partial<typeof form>) => { setForm(current => ({ ...current, ...patch })); setError(''); };
  const balanceText = (value?: bigint) => value === undefined || !route ? '--' : ethers.formatUnits(value, route.decimals);
  const visibleSubmissions = submissions.filter(item => item.account.toLowerCase() === wallet.address.toLowerCase() && ['awaiting-wallet', 'submitted'].includes(item.state));
  const activePending = visibleSubmissions.length > 0 || history.some(item => item.account.toLowerCase() === wallet.address.toLowerCase() && item.route.id === route?.id && ['source-pending', 'relaying'].includes(item.stage));
  const visibleHistory = history.filter(item => !readyAccount || item.account.toLowerCase() === wallet.address.toLowerCase());

  function saveSubmission(submission: BridgeSubmission) {
    const next = saveBridgeSubmission(submission);
    if (mounted.current) setSubmissions(next);
  }

  function saveRecord(record: BridgeRecord) {
    const stored = readHistory();
    const existing = stored.find(item => item.id === record.id);
    const next = [existing?.stage === 'delivered' ? existing : record, ...stored.filter(item => item.id !== record.id)].slice(0, 100);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    if (mounted.current) setHistory(next);
  }

  async function recover() {
    if (!route || !sourceKey || !readyAccount || recovering) return;
    setRecovering(true); setError('');
    try {
      const pending = readBridgeSubmissions().find(item => item.account.toLowerCase() === wallet.address.toLowerCase() &&
        item.route.id === route.id && item.sourceKey === sourceKey && ['awaiting-wallet', 'submitted'].includes(item.state));
      const hash = recoveryHash.trim();
      if (pending) {
        const reconciled = await reconcileBridgeSubmission(pending, hash);
        if (reconciled.state === 'rejected' || pending.phase !== 'transfer') {
          saveSubmission(reconciled); setRecoveryHash(''); return;
        }
      }
      const record = await recoverBridgeTransfer(pending?.route ?? route, pending?.sourceKey ?? sourceKey, wallet.address, hash);
      saveRecord(record);
      if (pending) saveSubmission({ ...pending, hash, state: 'tracked' });
      setRecoveryHash('');
      void balances.refetch();
    } catch (failure) { setError(bridgeError(failure)); }
    finally { setRecovering(false); }
  }

  async function submit() {
    if (sending.current || activePending || !route || !ends || !amount) return;
    sending.current = true;
    setError('');
    const selectedRoute = route;
    const { source, target } = ends;
    const account = wallet.address;
    let sentHash = '';
    try {
      if (!ethers.isAddress(recipient) || recipient === ethers.ZeroAddress) throw new Error('Enter a non-zero recipient address.');
      const provider = await connection.connector?.getProvider() as Eip1193Provider | undefined;
      if (!provider) throw new Error('Connect a wallet before sending.');
      const send = async (phase: BridgeSubmission['phase'], to: string, data: string, value = 0n, onHash?: (hash: string) => void) => {
        const submission: BridgeSubmission = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, account, phase,
          route: selectedRoute, sourceKey: source.key, to, data, value: ethers.toQuantity(value), state: 'awaiting-wallet', createdAt: Date.now() };
        const hash = await sendWalletTransaction(provider, source, account, to, data, value, {
          beforeSend: nonce => {
            if (!mounted.current) throw new Error('Bridge page closed before the wallet request.');
            if (readBridgeSubmissions().some(item => item.account.toLowerCase() === account.toLowerCase() && ['awaiting-wallet', 'submitted'].includes(item.state))) {
              throw new Error('A saved wallet request needs reconciliation before another transaction can be sent.');
            }
            submission.nonce = nonce;
            saveSubmission(submission);
          },
          onSubmitted: hash => {
            submission.hash = hash; submission.state = 'submitted'; saveSubmission(submission);
            if (onHash) { onHash(hash); submission.state = 'tracked'; saveSubmission(submission); }
          },
          onRejected: () => { submission.state = 'rejected'; saveSubmission(submission); },
        });
        if (phase !== 'transfer') {
          setProgress(`Confirming ${phase} ${short(hash)}`);
          await waitBridgeReceipt(source, hash);
          submission.state = 'confirmed'; saveSubmission(submission);
        }
        return hash;
      };
      setProgress('Checking route and balance');
      await validateRouteOnChain(selectedRoute);
      const balance = await readBridgeBalance(source, account);
      if (balance < amount) throw new Error('Insufficient token balance on the source chain.');
      if (source.type === 'collateral') {
        const [allowance] = await bridgeCall(source, source.token, TOKEN_ABI, 'allowance', [account, source.router]);
        if (allowance < amount) {
          setProgress('Confirm token approval in your wallet');
          // Zero-reset supports tokens that reject nonzero-to-nonzero allowance changes.
          if (allowance > 0n) {
            await send('approval-reset', source.token, TOKEN_ABI.encodeFunctionData('approve', [source.router, 0n]));
          }
          if (!mounted.current) return;
          setProgress('Confirm token approval in your wallet');
          await send('approval', source.token, TOKEN_ABI.encodeFunctionData('approve', [source.router, amount]));
        }
      }
      const fee = await quoteBridge(source, target, recipient, amount);
      if (!mounted.current) return;
      const destinationStartBlock = Number(BigInt(await bridgeRpc<string>(target, 'eth_blockNumber')));
      setProgress('Confirm bridge transfer in your wallet');
      sentHash = await send('transfer', source.router,
        ROUTER_ABI.encodeFunctionData('transferRemote', [target.domain, ethers.zeroPadValue(recipient, 32), amount]), fee,
        hash => saveRecord({ id: `${source.chainId}:${hash}`, account, recipient, amount: ethers.formatUnits(amount, selectedRoute.decimals),
          rawAmount: amount.toString(), createdAt: Date.now(), sourceHash: hash, destinationStartBlock,
          stage: 'source-pending', route: selectedRoute, sourceKey: source.key }));
      if (mounted.current) { updateForm({ amount: '' }); void balances.refetch(); }
    } catch (failure) {
      if (mounted.current) setError(sentHash ? `Transaction submitted: ${sentHash}. ${bridgeError(failure)}` : bridgeError(failure));
    } finally {
      sending.current = false;
      if (mounted.current) setProgress('');
    }
  }

  async function refreshAll() {
    setChecking(true);
    try { await Promise.all([config.refetch(), routeCheck.refetch(), balances.refetch(), quote.refetch()]); }
    finally { setChecking(false); }
  }

  const busy = Boolean(progress);
  const validationError = error || (config.error && bridgeError(config.error)) || (routeCheck.error && bridgeError(routeCheck.error)) ||
    (balances.error && bridgeError(balances.error)) || (quote.error && bridgeError(quote.error));
  return (
    <div className='mx-auto max-w-5xl space-y-7'>
      <header className='flex items-center justify-between gap-4 border-b border-border pb-5'>
        <div><h1 className='text-2xl font-semibold'>Bridge</h1><p className='mt-1 text-sm text-muted-foreground'>Hyperlane Warp Route</p></div>
        <div className='flex items-center gap-3'>
          {config.data?.environment === 'local-test' && <span className='text-xs text-amber-400'>Local test network</span>}
          <Button variant='ghost' size='icon' title='Refresh bridge status' aria-label='Refresh bridge status' onClick={() => void refreshAll()} disabled={checking || busy}>
            <RefreshCw className={checking ? 'animate-spin' : ''} />
          </Button>
        </div>
      </header>

      <div role='tablist' aria-label='Bridge view' className='flex gap-5 border-b border-border'>
        {(['transfer', 'deploy'] as const).map(tab => <button key={tab} type='button' role='tab' aria-selected={view === tab}
          disabled={busy} onClick={() => setView(tab)} className={`border-b-2 px-1 pb-3 text-sm ${view === tab ? 'border-emerald-400 text-foreground' : 'border-transparent text-muted-foreground'}`}>
          {tab === 'transfer' ? 'Transfer' : 'Deploy contracts'}
        </button>)}
      </div>
      {view === 'deploy' ? <BridgeDeployment onPublished={id => { updateForm({ routeId: id, sourceKey: '' }); void config.refetch(); }} /> : <>

      {config.isPending ? <div className='flex items-center gap-2 py-10 text-muted-foreground'><LoaderCircle className='size-4 animate-spin' />Loading bridge routes</div> : !route ? <p role='status'>No bridge routes deployed.</p> : (
        <div className='grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]'>
          <form onSubmit={event => { event.preventDefault(); void submit(); }} className='min-w-0 space-y-5'>
            <label className='block space-y-2 text-sm'><span className='text-muted-foreground'>Asset</span>
              <select aria-label='Bridge asset' className={inputClass} disabled={busy} value={route.id} onChange={event => updateForm({ routeId: event.target.value, sourceKey: '' })}>
                {config.data?.routes.map(item => <option key={item.id} value={item.id}>{item.symbol} · {item.name}</option>)}
              </select>
            </label>
            <div className='grid grid-cols-[minmax(0,1fr)_40px_minmax(0,1fr)] items-end gap-2'>
              <label className='min-w-0 space-y-2 text-sm'><span className='text-muted-foreground'>From</span>
                <select aria-label='Source chain' className={inputClass} disabled={busy} value={sourceKey} onChange={event => updateForm({ sourceKey: event.target.value })}>
                  {route.endpoints.map(item => <option key={item.key} value={item.key}>{item.name}</option>)}
                </select>
              </label>
              <Button type='button' variant='ghost' size='icon' className='mb-1' aria-label='Reverse bridge direction' title='Reverse bridge direction' disabled={busy} onClick={() => updateForm({ sourceKey: ends!.target.key })}><ArrowDownUp /></Button>
              <div className='min-w-0 space-y-2 text-sm'><span className='text-muted-foreground'>To</span><div className={`${inputClass} flex items-center gap-2`}>
                <img src='/chain/openhive.svg' className={`size-5 shrink-0 ${ends?.target.key === 'hivex' ? '' : 'hidden'}`} alt='' /><span className='break-words'>{ends?.target.name}</span>
              </div></div>
            </div>
            <label className='block space-y-2 text-sm'>
              <span className='flex flex-wrap items-center justify-between gap-2'><span className='text-muted-foreground'>Amount</span><span className='text-xs text-muted-foreground'>Available: {balanceText(balances.data?.source)} {route.symbol}</span></span>
              <div className='flex items-center gap-2'>
                <input aria-label='Bridge amount' className={inputClass} placeholder='0.00' inputMode='decimal' value={form.amount} disabled={busy} onChange={event => updateForm({ amount: event.target.value })} />
                <Button type='button' variant='outline' disabled={busy || balances.data?.source === undefined} onClick={() => updateForm({ amount: balanceText(balances.data?.source) })}>Max</Button>
              </div>
            </label>
            <label className='block space-y-2 text-sm'><span className='text-muted-foreground'>Recipient on {ends?.target.name}</span>
              <input aria-label='Destination recipient' className={`${inputClass} font-mono`} placeholder={readyAccount ? wallet.address : '0x...'} value={form.recipient} disabled={busy} onChange={event => updateForm({ recipient: event.target.value })} />
            </label>
            {ends && <BridgeAddresses source={ends.source} target={ends.target} recipient={recipient} />}
            <dl className='space-y-3 border-y border-border py-4 text-sm'>
              <div className='flex justify-between gap-3'><dt className='text-muted-foreground'>Receive</dt><dd>{amount ? ethers.formatUnits(amount, route.decimals) : '0'} {route.symbol}</dd></div>
              <div className='flex justify-between gap-3'><dt className='text-muted-foreground'>Message fee</dt><dd>{quote.data !== undefined ? `${ethers.formatUnits(quote.data, ends!.source.nativeDecimals)} ${ends!.source.nativeSymbol}` : '--'}</dd></div>
              <div className='flex justify-between gap-3'><dt className='text-muted-foreground'>Network gas</dt><dd>Quoted by wallet</dd></div>
            </dl>
            {activePending && <p className='text-sm text-amber-400'>A transfer is pending. Track it below before sending another.</p>}
            {validationError && <p role='alert' className='break-words text-sm text-red-400'>{validationError}</p>}
            {storageError && <p role='alert' className='break-words text-sm text-amber-400'>{storageError}</p>}
            {!wallet.connected ? <Button type='button' className='w-full' onClick={wallet.connect}><Wallet />Connect wallet</Button> : (
              <Button type='submit' className='h-auto min-h-11 w-full whitespace-normal bg-emerald-600 py-3 text-white hover:bg-emerald-500' disabled={busy || activePending || !amount || !ethers.isAddress(recipient) || recipient === ethers.ZeroAddress || !routeCheck.isSuccess || quote.data === undefined || !balances.data || (amount > balances.data.source)}>
                {busy ? <LoaderCircle className='animate-spin' /> : <ArrowRight />}{progress || `Bridge ${route.symbol}`}
              </Button>
            )}
          </form>

          <aside className='min-w-0 space-y-5 border-t border-border pt-5 text-sm lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0'>
            <h2 className='font-semibold'>Route status</h2>
            <p className={routeCheck.isSuccess ? 'text-emerald-400' : 'text-amber-400'}>{routeCheck.isSuccess ? 'Contracts verified' : routeCheck.isFetching ? 'Checking contracts' : 'Route unavailable'}</p>
            <dl className='space-y-4'>
              <div><dt className='text-muted-foreground'>Security module</dt><dd className='mt-1'>{route.security}</dd></div>
              <div><dt className='text-muted-foreground'>Destination balance</dt><dd className='mt-1 break-all'>{balanceText(balances.data?.target)} {route.symbol}</dd></div>
              {route.endpoints.map(endpoint => <div key={endpoint.key}>
                <dt className='text-muted-foreground'>{endpoint.name} router</dt>
                <dd className='mt-1 flex min-w-0 items-center gap-2 font-mono text-xs'><span className='break-all'>{endpoint.router}</span></dd>
                <dd className='mt-1 text-xs text-muted-foreground'>Chain {endpoint.chainId} · Domain {endpoint.domain}</dd>
              </div>)}
            </dl>
          </aside>
        </div>
      )}
      {!route && config.error && <p role='alert' className='text-red-400'>{bridgeError(config.error)}</p>}

      <section className='border-t border-border pt-6'>
        <h2 className='mb-4 text-base font-semibold'>Transfers</h2>
        <form className='mb-5 flex min-w-0 items-end gap-2' onSubmit={event => { event.preventDefault(); void recover(); }}>
          <label className='min-w-0 flex-1 space-y-2 text-sm'><span>Source transaction hash</span>
            <input aria-label='Source transaction hash' className={`${inputClass} font-mono`} value={recoveryHash}
              onChange={event => setRecoveryHash(event.target.value)} placeholder='0x...' disabled={recovering} />
          </label>
          <Button type='submit' variant='outline' size='icon' title='Recover existing transaction' aria-label='Recover existing transaction'
            disabled={recovering || busy || !readyAccount || !ethers.isHexString(recoveryHash.trim(), 32)}>
            {recovering ? <LoaderCircle className='animate-spin' /> : <Search />}
          </Button>
        </form>
        {visibleSubmissions.map(item => <div key={item.id} className='mb-4 min-w-0 space-y-2 border-b border-border pb-4 text-sm'>
          <p className='text-amber-400'>{item.phase === 'transfer' ? 'Bridge transfer' : 'Token approval'}: {item.hash ? 'Awaiting confirmation' : 'Wallet result unknown'}</p>
          <p className='break-all font-mono text-xs'>{item.hash || 'No hash returned by wallet'}</p>
          {item.hash && <Button type='button' variant='ghost' size='icon' title='Use saved transaction hash' aria-label='Use saved transaction hash'
            onClick={() => { updateForm({ routeId: item.route.id, sourceKey: item.sourceKey }); setRecoveryHash(item.hash!); }}><Search /></Button>}
        </div>)}
        {!visibleHistory.length ? <p className='py-6 text-sm text-muted-foreground'>No bridge transfers yet.</p> : <div className='divide-y divide-border'>
          {visibleHistory.map(record => {
            const { source, target } = routeEnds(record.route, record.sourceKey);
            const confirmationFailed = record.stage === 'confirmation-failed';
            const failed = record.stage === 'failed' || confirmationFailed;
            const status = { 'source-pending': 'Confirming source', relaying: 'Waiting for delivery', delivered: 'Delivered', failed: 'Source reverted', 'confirmation-failed': 'Transaction confirmation failed' }[record.stage];
            return <article key={record.id} className='grid min-w-0 gap-3 py-5 sm:grid-cols-[minmax(0,1fr)_auto]'>
              <div className='min-w-0 space-y-2'>
                <p className='flex flex-wrap items-center gap-2 text-sm'><strong>{record.amount} {record.route.symbol}</strong><span className='text-muted-foreground'>{source.name}</span><ArrowRight className='size-3 text-muted-foreground' /><span className='text-muted-foreground'>{target.name}</span></p>
                <BridgeAddresses source={source} target={target} recipient={record.recipient} />
                <p className='break-all font-mono text-xs'>Source transaction: {record.sourceHash} {source.explorerUrl && <a title='View source transaction' aria-label='View source transaction' href={`${source.explorerUrl}/tx/${record.sourceHash}`} target='_blank' rel='noreferrer'><ExternalLink className='inline size-3' /></a>}</p>
                {record.messageId && <p className='break-all font-mono text-xs text-muted-foreground'>Cross-chain message: {record.messageId}</p>}
                {record.destinationHash && <p className='break-all font-mono text-xs'>Destination transaction: {record.destinationHash}</p>}
                {record.error && <p className='break-words text-xs text-amber-400'>{record.error}</p>}
              </div>
              <div className='space-y-2 text-xs sm:text-right'><p className={`flex items-center gap-2 sm:justify-end ${record.stage === 'delivered' ? 'text-emerald-400' : failed ? 'text-red-400' : 'text-amber-400'}`}>
                {record.stage === 'delivered' ? <CheckCircle2 className='size-4' /> : failed ? <AlertCircle className='size-4' /> : <Clock3 className='size-4' />}{status}</p><p className='text-muted-foreground'>{new Date(record.createdAt).toLocaleString()}</p>
                {confirmationFailed && <Button variant='ghost' size='icon' title='Recheck saved transaction' aria-label='Recheck saved transaction'
                  onClick={() => setHistory(current => current.map(item => item.id === record.id ? { ...item, stage: 'source-pending', sourceConfirmationAttempts: 0, error: undefined } : item))}><RefreshCw /></Button>}
              </div>
            </article>;
          })}
        </div>}
      </section>
      </>}
    </div>
  );
}
