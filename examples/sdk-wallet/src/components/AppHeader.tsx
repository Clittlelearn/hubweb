import { shortAddress } from '../lib/utils';

interface AppHeaderProps {
  address: string;
  connected: boolean;
  isConnecting: boolean;
  status: string;
  onConnect: () => void;
}

export function AppHeader({
  address,
  connected,
  isConnecting,
  status,
  onConnect,
}: AppHeaderProps) {
  return (
    <header className="header">
      <div>
        <p className="eyebrow">OpenHive SDK</p>
        <h1>Wallet Example</h1>
      </div>
      <div className="wallet-actions">
        <div className="wallet-status">
          <span className={connected ? 'status-dot live' : 'status-dot'} />
          <span>{connected ? shortAddress(address) : status}</span>
        </div>
        <button
          className="button primary"
          type="button"
          disabled={isConnecting}
          onClick={onConnect}
        >
          {connected ? 'Reconnect' : 'Connect Wallet'}
        </button>
      </div>
    </header>
  );
}
