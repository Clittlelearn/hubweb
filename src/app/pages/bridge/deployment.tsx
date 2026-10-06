import { useEffect, useRef, useState } from 'react';
import { useConnection } from 'wagmi';
import { ethers, type Eip1193Provider } from 'ethers';
import { Check, CheckCircle2, CircleDashed, Download, LoaderCircle, Pause, Plus, RefreshCw, Rocket, Wallet } from 'lucide-react';
import { useWallet } from '../../providers/wallet-provider';
import { Button } from '../../components/ui/button';
import { CopyButton } from '../../components/copy-button';
import { bridgeError } from '../../lib/bridge-client';
import { assertDeploymentAccount, attachDeploymentHash, createDeployment, persistDeployment, readDeployments, runDeployment,
  type DeploymentForm, type DeploymentRun, type DeploymentSetup } from '../../lib/bridge-deployment';

const FORM_KEY = 'hub.bridge.deployment.form.v1';
const inputs = 'w-full min-w-0 rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-emerald-400 disabled:opacity-60';
const defaults: DeploymentForm = { name: 'Bridge Test Token', symbol: 'HBR', decimals: 8, supply: '1000000', holder: '', relayGas: '0.1' };
function initialForm(): DeploymentForm {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(FORM_KEY) || '{}') }; } catch { return defaults; }
}
async function setupRequest(): Promise<DeploymentSetup & { relayerRunning: boolean }> {
  const response = await fetch('/__bridge-deploy/setup', { headers: { 'x-bridge-request': '1' }, cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Local bridge deployment service is unavailable.');
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
}
function Address({ label, value }: { label: string; value?: string }) {
  return <div className='min-w-0'><dt className='text-xs text-muted-foreground'>{label}</dt><dd className='mt-1 flex min-w-0 items-start gap-2'>
    <code className='min-w-0 flex-1 break-all text-xs leading-5'>{value || '--'}</code>
    {value && <CopyButton value={value} label={label} className='flex size-7 shrink-0 items-center justify-center rounded-sm hover:bg-secondary' iconClassName='size-3.5' />}
  </dd></div>;
}

export default function BridgeDeployment({ onPublished }: { onPublished: (id: string) => void }) {
  const wallet = useWallet();
  const connection = useConnection();
  const [setup, setSetup] = useState<(DeploymentSetup & { relayerRunning: boolean })>();
  const [form, setForm] = useState(initialForm);
  const [runs, setRuns] = useState<DeploymentRun[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [hash, setHash] = useState('');
  const inFlight = useRef(false);
  const paused = useRef(false);
  const mounted = useRef(true);
  const selectedAccount = useRef('');
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const run = runs.find(item => item.id === selected);
  const accountMismatch = Boolean(run && wallet.connected && run.account.toLowerCase() !== wallet.address.toLowerCase());
  const networkMismatch = Boolean(setup && connection.chainId && !setup.endpoints.some(endpoint => endpoint.chainId === connection.chainId));
  const displayed = run?.form || form;
  const unresolved = run?.steps.find(step => step.state === 'awaiting-wallet' && step.nonce && !step.hash);
  const confirmed = run?.steps.filter(step => step.state === 'confirmed').length || 0;

  async function refreshSetup() {
    setLoading(true);
    try { setSetup(await setupRequest()); setError(''); }
    catch (failure) { setSetup(undefined); setError(bridgeError(failure)); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    mounted.current = true;
    try { setRuns(readDeployments()); setHistoryLoaded(true); }
    catch (failure) { setStorageError(bridgeError(failure)); }
    void refreshSetup();
    return () => { mounted.current = false; paused.current = true; };
  }, []);
  useEffect(() => {
    if (!historyLoaded || !setup || !wallet.connected || selectedAccount.current === wallet.address.toLowerCase()) return;
    if (busy) { paused.current = true; return; }
    selectedAccount.current = wallet.address.toLowerCase();
    const matching = runs.find(item => item.account.toLowerCase() === wallet.address.toLowerCase() &&
      item.route.endpoints.every(endpoint => setup.endpoints.some(target => target.key === endpoint.key &&
        target.chainId === endpoint.chainId && target.domain === endpoint.domain && target.rpcUrl === endpoint.rpcUrl)));
    setSelected(matching?.id || ''); setError(''); setProgress(''); setHash('');
  }, [historyLoaded, setup, wallet.connected, wallet.address, busy, runs]);
  useEffect(() => {
    try { localStorage.setItem(FORM_KEY, JSON.stringify(form)); }
    catch { setStorageError('Deployment history cannot be saved in this browser.'); }
  }, [form]);
  const update = (key: keyof DeploymentForm, value: string | number) => setForm(current => ({ ...current, [key]: value }));

  async function deploy() {
    if (inFlight.current || !setup || storageError) return;
    inFlight.current = true; paused.current = false; setBusy(true); setError('');
    const perform = async () => {
      let current: DeploymentRun | undefined;
      const save = () => {
        try { persistDeployment(current!); }
        finally {
          if (mounted.current) {
            setRuns(previous => [structuredClone(current!), ...previous.filter(item => item.id !== current!.id)]);
            setSelected(current!.id);
          }
        }
      };
      try {
        // Another tab may have advanced this journal while this tab was idle.
        const stored = readDeployments();
        const latest = run ? stored.find(item => item.id === run.id) : undefined;
        if (run && !latest) throw new Error('Deployment history changed. Reload before continuing.');
        const provider = await connection.connector?.getProvider() as Eip1193Provider | undefined;
        if (!provider || !ethers.isAddress(wallet.address)) throw new Error('Connect a wallet before deploying.');
        await assertDeploymentAccount(provider, wallet.address);
        const activeSetup = await setupRequest();
        if (mounted.current) setSetup(activeSetup);
        const chain = BigInt(await provider.request({ method: 'eth_chainId' }));
        if (!activeSetup.endpoints.some(endpoint => BigInt(endpoint.chainId) === chain)) throw new Error(`Wallet chain ${chain} is not a deployment network. Select ${activeSetup.endpoints.map(endpoint => `${endpoint.name} (${endpoint.chainId})`).join(' or ')}.`);
        if (latest && latest.account.toLowerCase() !== wallet.address.toLowerCase()) throw new Error('Reconnect the original deployer wallet to resume.');
        if (!latest && stored.some(item => item.steps.some(step => ['awaiting-wallet', 'submitted'].includes(step.state) && step.nonce))) throw new Error('A previous deployment has unresolved transactions. Resume it before creating another.');
        current = latest ? structuredClone(latest) : createDeployment(activeSetup, { ...form, holder: form.holder || wallet.address }, wallet.address);
        current.error = undefined; save();
        if (current.published) { onPublished(current.id); setProgress('Route already registered'); return; }
        await runDeployment(current, activeSetup, provider, save, label => { if (mounted.current) setProgress(label); }, () => paused.current);
        if (paused.current) throw new Error('Deployment paused before route publication.');
        setProgress('Registering route with the relayer');
        const response = await fetch('/__bridge-deploy/publish', { method: 'POST',
          headers: { 'content-type': 'application/json', 'x-bridge-request': '1', 'x-bridge-token': activeSetup.publishToken },
          body: JSON.stringify({ route: current.route, owner: current.account }), signal: AbortSignal.timeout(120000) });
        const published = await response.json();
        if (!response.ok) throw new Error(published.error || 'Route publication failed.');
        current.published = true; save();
        if (mounted.current) {
          setSetup(previous => previous ? { ...previous, relayerRunning: published.relayerRunning } : previous);
          onPublished(current.id);
          setProgress('Both chains verified; route registered');
        }
      } catch (failure) {
        const message = bridgeError(failure);
        if (current) {
          current.error = message;
          try { save(); } catch { if (mounted.current) setStorageError('Could not persist deployment state. Export the recorded hashes before leaving.'); }
        }
        if (mounted.current) setError(message);
      }
    };
    try {
      if (!navigator.locks) throw new Error('Browser deployment locking is unavailable. Use localhost in a supported browser.');
      await navigator.locks.request('hub-bridge-deployment', { ifAvailable: true }, async lock => {
        if (!lock) throw new Error('A deployment is already running in another browser tab.');
        await perform();
      });
    } catch (failure) { setError(bridgeError(failure)); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }

  async function attachHash() {
    if (!run || !unresolved || busy) return;
    setBusy(true); setError('');
    try {
      if (!navigator.locks) throw new Error('Browser deployment locking is unavailable.');
      await navigator.locks.request('hub-bridge-deployment', { ifAvailable: true }, async lock => {
        if (!lock) throw new Error('A deployment is already running in another browser tab.');
        const current = readDeployments().find(item => item.id === run.id);
        const step = current?.steps.find(item => item.key === unresolved.key);
        if (!current || !step || step.hash || step.state !== 'awaiting-wallet' || step.nonce !== unresolved.nonce) throw new Error('Deployment history changed. Reload before reconciling this transaction.');
        const endpoint = current.route.endpoints.find(item => item.key === step.endpoint)!;
        await attachDeploymentHash(endpoint, step, hash.trim());
        delete current.error;
        persistDeployment(current); setRuns(readDeployments()); setHash('');
      });
    } catch (failure) { setError(bridgeError(failure)); }
    finally { setBusy(false); }
  }
  function download() {
    if (!run) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `bridge-${run.id}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section className='min-w-0 space-y-6' aria-label='Deploy bridge contracts'>
    <div className='flex flex-wrap items-center justify-between gap-3'>
      <h2 className='text-lg font-semibold'>Deploy bridge contracts</h2>
      <div className='flex items-center gap-2'>
        <Button variant='ghost' size='icon' aria-label='Refresh deployment setup' title='Refresh deployment setup' disabled={busy || loading} onClick={() => void refreshSetup()}><RefreshCw className={loading ? 'animate-spin' : ''} /></Button>
        <Button variant='ghost' size='icon' aria-label='Export deployment' title='Export deployment' disabled={!run} onClick={download}><Download /></Button>
        <Button variant='outline' size='icon' aria-label='New deployment' title='New deployment' disabled={busy} onClick={() => { setSelected(''); setError(''); setProgress(''); setHash(''); }}><Plus /></Button>
      </div>
    </div>
    {runs.length > 0 && <label className='block space-y-2 text-sm'><span>Deployment</span>
      <select className={inputs} value={selected} disabled={busy} onChange={event => { setSelected(event.target.value); setError(''); setHash(''); setProgress(''); }}>
        <option value=''>New deployment</option>
        {runs.map(item => <option key={item.id} value={item.id}>{item.form.symbol} · {item.account.slice(0, 8)}...{item.account.slice(-4)} · {new Date(item.createdAt).toLocaleString()} · {item.published ? 'Registered' : 'In progress'}</option>)}
      </select>
    </label>}
    <div className='grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]'>
      <div className='min-w-0 space-y-5'>
        <div className='grid gap-4 sm:grid-cols-2'>
          <label className='min-w-0 space-y-2 text-sm'><span>Token name</span><input className={inputs} value={displayed.name} maxLength={64} disabled={busy || Boolean(run)} onChange={event => update('name', event.target.value)} /></label>
          <label className='min-w-0 space-y-2 text-sm'><span>Token symbol</span><input className={inputs} value={displayed.symbol} maxLength={12} disabled={busy || Boolean(run)} onChange={event => update('symbol', event.target.value)} /></label>
          <label className='min-w-0 space-y-2 text-sm'><span>Decimals</span><input className={inputs} type='number' min={0} max={18} value={displayed.decimals} disabled={busy || Boolean(run)} onChange={event => update('decimals', Number(event.target.value))} /></label>
          <label className='min-w-0 space-y-2 text-sm'><span>Initial supply · Local BSC</span><input className={inputs} inputMode='decimal' value={displayed.supply} disabled={busy || Boolean(run)} onChange={event => update('supply', event.target.value)} /></label>
        </div>
        <label className='block space-y-2 text-sm'><span>Initial holder · Local BSC</span><input className={`${inputs} font-mono`} placeholder={wallet.address || '0x...'} value={displayed.holder} disabled={busy || Boolean(run)} onChange={event => update('holder', event.target.value)} /></label>
        <label className='block space-y-2 text-sm'><span>Relayer minimum Gas balance · each chain</span><input className={inputs} inputMode='decimal' value={displayed.relayGas} disabled={busy || Boolean(run)} onChange={event => update('relayGas', event.target.value)} /></label>
        <dl className='grid min-w-0 gap-4 border-y border-border py-4 sm:grid-cols-2'>
          <Address label='Connected wallet' value={wallet.connected ? wallet.address : undefined} />
          <div><dt className='text-xs text-muted-foreground'>Wallet chain</dt><dd className='mt-1 break-words text-sm'>{connection.chainId ? `${setup?.endpoints.find(endpoint => endpoint.chainId === connection.chainId)?.name || 'Unconfigured network'} (${connection.chainId})` : '--'}</dd></div>
          <Address label='Deployer' value={run?.account || wallet.address} />
          <Address label='Trusted relayer' value={run?.relayer || setup?.relayer} />
          <Address label='Native Flow bridge' value={run?.nativeFlowBridge || setup?.nativeFlowBridge} />
          <div><dt className='text-xs text-muted-foreground'>Relayer process</dt><dd className={`mt-1 text-sm ${setup?.relayerRunning ? 'text-emerald-400' : 'text-amber-400'}`}>{setup ? setup.relayerRunning ? 'Running' : 'Offline' : 'Checking'}</dd></div>
        </dl>
        {(run?.route.endpoints || setup?.endpoints)?.map(endpoint => <div key={endpoint.key} className='flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs'>
          {endpoint.key === 'hivex' && <img src='/chain/openhive.svg' className='size-5' alt='' />}
          <strong>{endpoint.name}</strong><span className='text-muted-foreground'>Chain {endpoint.chainId} · Domain {endpoint.domain}</span><span className='break-all text-muted-foreground'>{endpoint.rpcUrl}</span>
        </div>)}
        {unresolved && <div className='space-y-2 border-l-2 border-amber-400 pl-3'>
          <label className='block space-y-2 text-sm'><span>Unrecorded wallet transaction hash · {unresolved.label}</span><input className={`${inputs} font-mono`} value={hash} disabled={busy} onChange={event => setHash(event.target.value)} placeholder='0x...' /></label>
          <Button variant='outline' disabled={busy || !hash} onClick={() => void attachHash()}><Check />Verify transaction hash</Button>
        </div>}
        {(accountMismatch || networkMismatch || error || run?.error || storageError) && <p role='alert' className='break-words text-sm text-red-400'>{storageError || (accountMismatch ? 'This deployment belongs to another account. Select New deployment or reconnect its original deployer.' : networkMismatch ? `Wallet chain ${connection.chainId} is not in the configured deployment pair.` : error || run?.error)}</p>}
        {progress && <p role='status' className='flex items-center gap-2 text-sm text-muted-foreground'>{busy && <LoaderCircle className='size-4 shrink-0 animate-spin' />}{progress}</p>}
        <div className='flex items-center gap-2'>
          {!wallet.connected ? <Button className='flex-1' onClick={wallet.connect}><Wallet />Connect wallet</Button> : <Button className='h-auto min-h-11 flex-1 whitespace-normal bg-emerald-600 py-3 text-white hover:bg-emerald-500' disabled={busy || !setup || accountMismatch || networkMismatch || Boolean(storageError) || Boolean(run?.published) || Boolean(unresolved)} onClick={() => void deploy()}>
            {busy ? <LoaderCircle className='animate-spin' /> : <Rocket />}{run?.published ? 'Route registered' : run ? 'Resume deployment' : 'Deploy both chains'}
          </Button>}
          {busy && <Button variant='outline' size='icon' aria-label='Pause after current transaction' title='Pause after current transaction' onClick={() => { paused.current = true; setProgress('Pausing after current transaction'); }}><Pause /></Button>}
        </div>
      </div>
      <aside className='min-w-0 space-y-4 border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0'>
        <h3 className='text-sm font-semibold'>Deployment progress <span className='ml-2 text-muted-foreground'>{confirmed} confirmed</span></h3>
        {!run?.steps.length ? <p className='text-sm text-muted-foreground'>Not started</p> : <ol className='divide-y divide-border'>
          {run.steps.map(step => <li key={step.key} className='min-w-0 py-3 text-xs'>
            <div className='flex items-start gap-2'>{step.state === 'confirmed' ? <CheckCircle2 className='size-4 shrink-0 text-emerald-400' /> : <CircleDashed className='size-4 shrink-0 text-amber-400' />}<div className='min-w-0'><p className='font-medium'>{step.label}</p><p className='mt-1 text-muted-foreground'>{step.endpoint} · {step.state}</p></div></div>
            {step.hash && <div className='mt-2 flex min-w-0 items-start gap-1'><code className='min-w-0 flex-1 break-all leading-5'>{step.hash}</code><CopyButton value={step.hash} label='Transaction hash' className='flex size-6 shrink-0 items-center justify-center' iconClassName='size-3' /></div>}
          </li>)}
        </ol>}
      </aside>
    </div>
    {run && <section aria-label='Deployed contract addresses' className='space-y-4 border-t border-border pt-5'>
      <h3 className='text-base font-semibold'>Contract addresses</h3>
      <div className='grid min-w-0 gap-6 md:grid-cols-2'>{run.route.endpoints.map(endpoint => <div key={endpoint.key} className='min-w-0 space-y-3'>
        <h4 className='text-sm font-semibold'>{endpoint.name}</h4><dl className='space-y-3'>{['mailbox', 'ism', 'hook', 'router', 'token'].map(field => <Address key={field} label={field === 'token' ? 'ERC20' : field === 'ism' ? 'ISM' : field[0].toUpperCase() + field.slice(1)} value={(endpoint as any)[field]} />)}</dl>
      </div>)}</div>
    </section>}
  </section>;
}
