import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_FORM_STATE,
  DEFAULT_NETWORK_KEY,
  getNetworkByKey,
} from './config';
import { AppHeader } from './components/AppHeader';
import { NetworkPanel } from './components/NetworkPanel';
import { ResultPanel } from './components/ResultPanel';
import { SdkCallForm } from './components/SdkCallForm';
import {
  connectInjectedWallet,
  ensureWalletNetwork,
  getCurrentWalletState,
  listenToWalletChanges,
} from './lib/wallet';
import { runSdkTransaction } from './lib/sdk-transaction';
import {
  getSuggestedTarget,
  summarizeResult,
  toErrorMessage,
} from './lib/utils';
import type { NetworkKey, SdkFormState, SdkRunMode } from './types';

function App() {
  const [networkKey, setNetworkKey] =
    useState<NetworkKey>(DEFAULT_NETWORK_KEY);
  const [form, setForm] = useState<SdkFormState>(DEFAULT_FORM_STATE);
  const [address, setAddress] = useState('');
  const [walletChainId, setWalletChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState('Disconnected');
  const [error, setError] = useState('');
  const [output, setOutput] = useState('');

  const network = useMemo(() => getNetworkByKey(networkKey), [networkKey]);
  const connected = Boolean(address);
  const walletOnTargetChain = walletChainId === network.chainId;

  useEffect(() => {
    void refreshWalletState();

    return listenToWalletChanges({
      onAccountsChanged: (nextAddress) => {
        setAddress(nextAddress);
        setStatus(nextAddress ? 'Wallet connected' : 'Disconnected');
      },
      onChainChanged: setWalletChainId,
    });
  }, []);

  useEffect(() => {
    setForm((currentForm) => ({
      ...currentForm,
      targetAddress: getSuggestedTarget(currentForm.method, address),
    }));
  }, [form.method]);

  useEffect(() => {
    if (!address) {
      return;
    }

    setForm((currentForm) =>
      currentForm.targetAddress
        ? currentForm
        : {
            ...currentForm,
            targetAddress: getSuggestedTarget(currentForm.method, address),
          },
    );
  }, [address]);

  async function refreshWalletState() {
    try {
      const walletState = await getCurrentWalletState();
      setAddress(walletState.address);
      setWalletChainId(walletState.chainId);
      setStatus(walletState.status);
    } catch (err) {
      setError(toErrorMessage(err));
    }
  }

  async function connectWallet() {
    setIsConnecting(true);
    setError('');

    try {
      const nextAddress = await connectInjectedWallet();
      await refreshWalletState();
      setStatus('Wallet connected');
      return nextAddress;
    } catch (err) {
      setError(toErrorMessage(err));
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }

  async function switchOrAddNetwork() {
    setError('');

    try {
      setWalletChainId(await ensureWalletNetwork(network));
    } catch (err) {
      setError(toErrorMessage(err));
    }
  }

  async function runSdkCall(mode: SdkRunMode) {
    setIsRunning(true);
    setError('');
    setOutput('');

    try {
      const from = address || (await connectWallet());

      if (mode === 'send') {
        setWalletChainId(await ensureWalletNetwork(network));
      }

      const { result, receipt } = await runSdkTransaction({
        mode,
        form,
        from,
        network,
      });

      setOutput(JSON.stringify(summarizeResult(result, receipt), null, 2));
      setStatus(mode === 'send' ? 'Transaction submitted' : 'Transaction built');
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsRunning(false);
    }
  }

  function updateForm<K extends keyof SdkFormState>(
    key: K,
    value: SdkFormState[K],
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));
  }

  return (
    <div className="app-shell">
      <AppHeader
        address={address}
        connected={connected}
        isConnecting={isConnecting}
        status={status}
        onConnect={() => void connectWallet()}
      />

      <main className="content-grid">
        <NetworkPanel
          connected={connected}
          isRunning={isRunning}
          network={network}
          networkKey={networkKey}
          walletChainId={walletChainId}
          walletOnTargetChain={walletOnTargetChain}
          onNetworkChange={setNetworkKey}
          onEnsureNetwork={() => void switchOrAddNetwork()}
        />

        <SdkCallForm
          form={form}
          isRunning={isRunning}
          onRun={(mode) => void runSdkCall(mode)}
          onUpdate={updateForm}
        />

        <ResultPanel
          error={error}
          isRunning={isRunning}
          output={output}
          status={status}
        />
      </main>
    </div>
  );
}

export { App };
