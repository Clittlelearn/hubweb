import { Link, Outlet, useLocation, useMatches } from 'react-router';
import {
  Wallet,
  Lock,
  Vote,
  Shield,
  Users,
  ArrowLeftRight,
  ChevronDown,
  ExternalLink,
  Copy,
  Check,
  Menu,
  X,
  FlaskConical,
  Cable,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useWallet } from '../providers/wallet-provider';
import { NETWORKS } from '../lib/wallet';
import { OpenHiveLogo } from '../components/openhive-logo';
import { PixelAvatar } from '../components/pixel-avatar';
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useCopyFeedback } from '../hooks/use-copy-feedback';
import { useLockBodyScroll } from '../hooks/use-lock-body-scroll';
import { useConnection } from 'wagmi';

const APP_NAME = 'HiveX Hub';

export default function AppLayout() {
  const location = useLocation();
  const matches = useMatches();
  const {
    connected,
    address,
    connect,
    disconnect,
    currentNetwork,
    network,
    setNetwork,
    walletData,
    explorerUrl,
    shortAddress,
  } = useWallet();
  const connection = useConnection();
  const walletNetwork = NETWORKS.find(item => item.chainId === connection.chainId);
  const connectedChainNames: Record<number, string> = { 31338: 'Local BSC', 31337: 'Local EVM' };
  const networkLabel = connected
    ? walletNetwork?.chainName || connectedChainNames[connection.chainId ?? 0] || (connection.chainId ? `Chain ${connection.chainId}` : 'Network unavailable')
    : currentNetwork.label;
  const networkColor = connected ? walletNetwork?.color || 'bg-amber-500' : currentNetwork.color;
  const networkTextColor = connected ? walletNetwork?.textColor || 'text-amber-400' : currentNetwork.textColor;
  const [networkOpen, setNetworkOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const networkRef = useRef<HTMLDivElement>(null);
  const walletRef = useRef<HTMLDivElement>(null);
  const { copiedValue, copy } = useCopyFeedback();

  useLockBodyScroll(menuOpen);

  useEffect(() => {
    const titledMatch = [...matches].reverse().find((match) => {
      const handle = match.handle as { title?: string } | undefined;
      return typeof handle?.title === 'string' && handle.title.length > 0;
    });

    const pageTitle = (titledMatch?.handle as { title?: string } | undefined)
      ?.title;

    document.title = pageTitle ? `${pageTitle} | ${APP_NAME}` : APP_NAME;
  }, [matches]);

  // Close overlay on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        networkRef.current &&
        !networkRef.current.contains(e.target as Node)
      ) {
        setNetworkOpen(false);
      }
      if (walletRef.current && !walletRef.current.contains(e.target as Node)) {
        setWalletOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleCopyAddress = useCallback(() => {
    if (!address) return;
    void copy(address, {
      key: address,
      successMessage: 'Wallet address copied.',
      errorTitle: 'Wallet address copy failed',
      errorMessage:
        'Unable to copy the wallet address. Check browser permissions and try again.',
    });
  }, [address, copy]);

  const navItems = [
    {
      path: '/wallet',
      label: 'Wallet',
      icon: Wallet,
      desc: 'Assets & Transfers',
    },
    {
      path: '/validators',
      label: 'Validators',
      icon: Shield,
      desc: 'Delegate & Stake & Earn',
    },
    // {
    //   path: '/delegate',
    //   label: 'Delegate',
    //   icon: Users,
    //   desc: 'Positions & Rewards',
    // },
    { path: '/lock', label: 'Lock', icon: Lock, desc: 'Lock OHI for Power' },
    {
      path: '/governance',
      label: 'Governance',
      icon: Vote,
      desc: 'Proposals & Voting',
    },
    {
      path: '/flow',
      label: 'Flow',
      icon: ArrowLeftRight,
      desc: 'ERC20 ↔ Native',
    },
    { path: '/bridge', label: 'Bridge', icon: Cable, desc: 'Cross-chain transfers' },
    {
      path: '/dev-tools/native-flow',
      label: 'Dev Tools',
      icon: FlaskConical,
      desc: 'Native Flow Test',
    },
  ];

  return (
    <div className='min-h-screen bg-background relative overflow-x-clip'>
      {/* Grid background */}
      <div className='absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none' />

      {/* Gradient orbs */}
      <div className='absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none' />
      <div className='absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none' />

      <div className='relative z-10'>
        {/* Header */}
        <header className='border-b border-border/50 backdrop-blur-sm bg-background/80 relative z-50 sticky top-0'>
          <div className='container mx-auto px-3 sm:px-4 md:px-6 py-3 md:py-4'>
            <div className='flex items-center justify-between gap-2'>
              {/* Left: Logo + Desktop Nav */}
              <div className='flex items-center gap-2 xl:gap-8 min-w-0'>
                <Link
                  to='/'
                  className='flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0'>
                  <OpenHiveLogo size={28} className='sm:w-8 sm:h-8' />
                  <h1 className='hidden min-[480px]:block text-lg sm:text-2xl font-bold whitespace-nowrap uppercase'>
                    <span className='text-white'>Hive</span>
                    <span className='text-primary'>X</span>
                    <span className='text-muted-foreground ml-1 sm:ml-1.5 text-sm sm:text-lg hidden sm:inline'>
                      Hub
                    </span>
                  </h1>
                </Link>

                {/* Leave enough room for the bridge entry and wallet controls. */}
                <nav className='hidden 2xl:flex items-center gap-1'>
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link key={item.path} to={item.path}>
                        <Button
                          variant={isActive ? 'default' : 'ghost'}
                          className={
                            isActive
                              ? 'bg-primary/20 text-primary hover:bg-primary/30 cursor-pointer'
                              : 'text-muted-foreground hover:text-foreground cursor-pointer'
                          }>
                          <Icon className='w-4 h-4 mr-2' />
                          {item.label}
                        </Button>
                      </Link>
                    );
                  })}
                </nav>
              </div>

              {/* Right: Network + Wallet + Hamburger */}
              <div className='flex items-center gap-2 sm:gap-3 md:gap-4 shrink-0'>
                {/* Network dropdown */}
                <div ref={networkRef} className='relative md:block hidden'>
                  <button
                    aria-label={`Wallet network: ${networkLabel}`}
                    title={connected && connection.chainId ? `Chain ID: ${connection.chainId}` : currentNetwork.chainName}
                    onClick={() => setNetworkOpen(!networkOpen)}
                    className='flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors cursor-pointer'>
                    <div
                      className={`w-2 h-2 rounded-full ${networkColor}`}
                    />
                    <span
                      className={`text-xs sm:text-sm ${networkTextColor}`}>
                      {networkLabel}
                    </span>
                    <ChevronDown
                      className={`w-3 h-3 sm:w-3.5 sm:h-3.5 text-muted-foreground transition-transform ${
                        networkOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {networkOpen && (
                    <div className='absolute top-full right-0 mt-2 min-w-[140px] bg-card border border-border rounded-lg shadow-xl overflow-hidden z-50'>
                      {NETWORKS.map((n) => (
                        <button
                          key={n.key}
                          onClick={() => {
                            setNetwork(n.key);
                            setNetworkOpen(false);
                          }}
                          className={`flex items-center gap-2.5 px-4 py-2.5 w-full text-left transition-colors cursor-pointer ${
                            (connected ? connection.chainId === n.chainId : network === n.key)
                              ? 'bg-primary/10'
                              : 'hover:bg-secondary/50'
                          }`}>
                          <div className={`w-2 h-2 rounded-full ${n.color}`} />
                          <span
                            className={`text-sm ${
                              (connected ? connection.chainId === n.chainId : network === n.key)
                                ? n.textColor
                                : 'text-muted-foreground'
                            }`}>
                            {n.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Wallet button — responsive */}
                {connected ? (
                  <div ref={walletRef} className='relative'>
                    <button
                      aria-label='Connected wallet account'
                      onClick={() => setWalletOpen(!walletOpen)}
                      className='flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-card/60 border border-border/50 hover:border-primary/50 transition-colors cursor-pointer'>
                      <OpenHiveLogo
                        size={24}
                        className='hidden sm:block sm:w-6 sm:h-6'
                      />
                      <span className='max-w-[10rem] truncate font-mono text-xs sm:text-sm' title={address}>
                        {shortAddress}
                      </span>
                      <PixelAvatar
                        address={address || ''}
                        size={28}
                        className='rounded-full sm:w-8 sm:h-8'
                      />
                    </button>

                    {/* Wallet dropdown */}
                    {walletOpen && (
                      <div aria-label='Connected wallet menu' className='absolute top-full right-0 mt-2 w-[280px] sm:w-[300px] bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-50'>
                        <div className='px-4 sm:px-5 py-3 sm:py-4 border-b border-border/50'>
                          <p className='text-primary text-center text-sm sm:text-base'>
                            Connected Wallet
                          </p>
                        </div>
                        <div className='px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-between border-b border-border/50'>
                          <div className='flex items-center gap-2 sm:gap-3 min-w-0'>
                            <PixelAvatar
                              address={address || ''}
                              size={28}
                              className='rounded-full shrink-0 sm:w-8 sm:h-8'
                            />
                            <a
                              href={explorerUrl}
                              target='_blank'
                              rel='noopener noreferrer'
                              className='flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground hover:text-primary transition-colors min-w-0'>
                              <span className='font-mono truncate'>
                                {shortAddress}
                              </span>
                              <ExternalLink className='w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0' />
                            </a>
                          </div>
                          <button
                            onClick={handleCopyAddress}
                            className='p-1.5 sm:p-2 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer text-muted-foreground hover:text-white shrink-0'>
                            {copiedValue === address ? (
                              <Check className='w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400' />
                            ) : (
                              <Copy className='w-3.5 h-3.5 sm:w-4 sm:h-4' />
                            )}
                          </button>
                        </div>
                        <div className='p-3 sm:p-4'>
                          <button
                            onClick={() => {
                              disconnect();
                              setWalletOpen(false);
                            }}
                            className='w-full py-2.5 sm:py-3 rounded-lg bg-secondary/30 border border-border/50 text-muted-foreground hover:text-white hover:border-red-500/50 hover:bg-red-500/10 transition-colors cursor-pointer text-xs sm:text-sm'>
                            Disconnect Wallet
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <Button
                      onClick={connect}
                      className='bg-primary hover:bg-primary/90 cursor-pointer hidden sm:flex'>
                      <Wallet className='w-4 h-4 mr-2' />
                      Connect Wallet
                    </Button>
                    <Button
                      onClick={connect}
                      size='icon'
                      className='bg-primary hover:bg-primary/90 cursor-pointer sm:hidden w-9 h-9'>
                      <Wallet className='w-4 h-4' />
                    </Button>
                  </>
                )}

                {/* Hamburger — visible below xl */}
                <button
                  onClick={() => setMenuOpen(true)}
                  className='2xl:hidden p-1.5 sm:p-2 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer text-muted-foreground hover:text-white'
                  aria-label='Open navigation menu'>
                  <Menu className='w-5 h-5 sm:w-6 sm:h-6' />
                </button>
              </div>
            </div>
            <div aria-label='Wallet network' className={`mt-2 flex min-w-0 items-center gap-2 text-xs md:hidden ${networkTextColor}`}>
              <span className={`size-2 shrink-0 rounded-full ${networkColor}`} />
              <span className='break-words'>{networkLabel}{connected && connection.chainId ? ` (${connection.chainId})` : ''}</span>
            </div>
          </div>
        </header>

        {/* ─── Full-screen Overlay Menu ─── */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              className='fixed inset-0 z-[100] flex flex-col'
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}>
              {/* Backdrop */}
              <motion.div
                className='absolute inset-0 bg-background/90 backdrop-blur-xl'
                onClick={() => setMenuOpen(false)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />

              {/* Decorative gradient orbs */}
              <div className='absolute top-1/4 left-1/3 w-72 h-72 bg-primary/15 rounded-full blur-[100px] pointer-events-none' />
              <div className='absolute bottom-1/4 right-1/4 w-60 h-60 bg-purple-500/15 rounded-full blur-[100px] pointer-events-none' />

              {/* Grid pattern */}
              <div className='absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.04)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none' />

              {/* Top bar */}
              <motion.div
                className='relative flex items-center justify-between px-4 sm:px-6 md:px-8 py-4 md:py-5'
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}>
                <Link
                  to='/'
                  className='flex items-center gap-2 cursor-pointer'
                  onClick={() => setMenuOpen(false)}>
                  <OpenHiveLogo size={28} />
                  <span className='text-lg sm:text-xl font-bold'>
                    <span className='text-white'>Hive</span>
                    <span className='text-primary'>X</span>
                    <span className='text-muted-foreground ml-1 text-sm sm:text-base'>
                      Hub
                    </span>
                  </span>
                </Link>
                <button
                  onClick={() => setMenuOpen(false)}
                  className='p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-primary/40 transition-all cursor-pointer text-muted-foreground hover:text-white'>
                  <X className='w-5 h-5' />
                </button>
              </motion.div>

              {/* Content area */}
              <div className='relative flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 pb-6'>
                <div className='max-w-lg mx-auto sm:max-w-xl md:max-w-2xl'>
                  {/* Navigation grid */}
                  <div className='grid grid-cols-2 sm:grid-cols-2 gap-2 sm:gap-4 mb-6 sm:mb-8'>
                    {navItems.map((item, i) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === item.path;
                      return (
                        <motion.div
                          key={item.path}
                          initial={{ y: 30, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{
                            delay: 0.12 + i * 0.06,
                            type: 'spring',
                            stiffness: 300,
                            damping: 28,
                          }}>
                          <Link
                            to={item.path}
                            onClick={() => setMenuOpen(false)}
                            className={`group flex items-center gap-3 p-3 sm:p-5 rounded-xl sm:rounded-2xl border transition-all duration-200 ${
                              isActive
                                ? 'bg-primary/10 border-primary/40 shadow-[0_0_24px_rgba(99,102,241,0.15)]'
                                : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-primary/30 hover:shadow-[0_0_20px_rgba(99,102,241,0.08)]'
                            }`}>
                            <div
                              className={`p-2 sm:p-3 rounded-lg sm:rounded-xl transition-colors ${
                                isActive
                                  ? 'bg-primary/20 text-primary'
                                  : 'bg-white/[0.05] text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                              }`}>
                              <Icon className='w-4 h-4 sm:w-6 sm:h-6' />
                            </div>
                            <div className='flex-1 min-w-0'>
                              <p
                                className={`font-semibold text-sm sm:text-lg ${
                                  isActive ? 'text-primary' : 'text-white'
                                }`}>
                                {item.label}
                              </p>
                              <p className='text-[10px] sm:text-sm text-muted-foreground truncate'>
                                {item.desc}
                              </p>
                            </div>
                            {isActive && (
                              <div className='w-2 h-2 rounded-full bg-primary animate-pulse shrink-0' />
                            )}
                          </Link>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Bottom section: Network + Wallet */}
                  <motion.div
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{
                      delay: 0.45,
                      type: 'spring',
                      stiffness: 300,
                      damping: 28,
                    }}
                    className='space-y-4'>
                    {/* Network switcher */}
                    <div className='p-4 sm:p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]'>
                      <p className='text-xs text-muted-foreground mb-3 uppercase tracking-wider'>
                        Network
                      </p>
                      <div className='flex gap-2 sm:gap-3'>
                        {NETWORKS.map((n) => (
                          <button
                            key={n.key}
                            onClick={() => setNetwork(n.key)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3 rounded-xl transition-all cursor-pointer ${
                              network === n.key
                                ? `bg-white/[0.06] border border-white/10 ring-2 ${n.ringColor} shadow-sm`
                                : 'bg-transparent border border-transparent hover:bg-white/[0.03]'
                            }`}>
                            <div
                              className={`w-2 h-2 rounded-full ${n.color} ${
                                network === n.key ? 'animate-pulse' : ''
                              }`}
                            />
                            <span
                              className={`text-sm ${
                                network === n.key
                                  ? n.textColor
                                  : 'text-muted-foreground'
                              }`}>
                              {n.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Wallet section */}
                    <div className='p-4 sm:p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]'>
                      {connected ? (
                        <div className='space-y-4'>
                          <div className='flex items-center justify-between'>
                            <div className='flex items-center gap-3'>
                              <PixelAvatar
                                address={address || ''}
                                size={36}
                                className='rounded-full'
                              />
                              <div className='min-w-0'>
                                <p className='text-sm font-medium text-white truncate font-mono'>
                                  {shortAddress}
                                </p>
                                <p className='text-xs text-muted-foreground'>
                                  {walletData.nativeBalance} OHI
                                </p>
                              </div>
                            </div>
                            <div className='flex items-center gap-2'>
                              <OpenHiveLogo size={16} />
                              <span className='text-sm text-white'>
                                {walletData.tokenPriceUsd}
                              </span>
                              <span className='text-xs text-green-400'>
                                {walletData.tokenPriceChange}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              disconnect();
                              setMenuOpen(false);
                            }}
                            className='w-full py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-muted-foreground hover:text-white hover:border-red-500/40 hover:bg-red-500/10 transition-all cursor-pointer text-sm'>
                            Disconnect Wallet
                          </button>
                        </div>
                      ) : (
                        <Button
                          onClick={() => {
                            connect();
                            setMenuOpen(false);
                          }}
                          className='w-full h-12 bg-primary hover:bg-primary/90 cursor-pointer rounded-xl'>
                          <Wallet className='w-4 h-4 mr-2' />
                          Connect Wallet
                        </Button>
                      )}
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main content */}
        <main className='container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8'>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
