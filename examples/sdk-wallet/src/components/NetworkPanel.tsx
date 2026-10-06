import { NETWORKS } from '../config';
import type { OpenHiveNetwork, NetworkKey } from '../types';

interface NetworkPanelProps {
  connected: boolean;
  isRunning: boolean;
  network: OpenHiveNetwork;
  networkKey: NetworkKey;
  walletChainId: number | null;
  walletOnTargetChain: boolean;
  onNetworkChange: (networkKey: NetworkKey) => void;
  onEnsureNetwork: () => void;
}

export function NetworkPanel({
  connected,
  isRunning,
  network,
  networkKey,
  walletChainId,
  walletOnTargetChain,
  onNetworkChange,
  onEnsureNetwork,
}: NetworkPanelProps) {
  return (
    <section className="panel wallet-panel">
      <div className="panel-heading">
        <h2>Network</h2>
        <span className={walletOnTargetChain ? 'network-badge ready' : 'network-badge'}>
          {walletOnTargetChain ? 'Matched' : 'Switch required'}
        </span>
      </div>

      <label className="field">
        <span>Target network</span>
        <select
          value={networkKey}
          onChange={(event) => onNetworkChange(event.target.value as NetworkKey)}
        >
          {NETWORKS.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label} ({item.chainId})
            </option>
          ))}
        </select>
      </label>

      <div className="network-details">
        <div>
          <span>RPC</span>
          <strong>{network.rpcUrl}</strong>
        </div>
        <div>
          <span>Wallet chain</span>
          <strong>{walletChainId ?? 'Not connected'}</strong>
        </div>
      </div>

      <button
        className="button"
        type="button"
        disabled={!connected || isRunning}
        onClick={onEnsureNetwork}
      >
        Switch / Add Network
      </button>
    </section>
  );
}
