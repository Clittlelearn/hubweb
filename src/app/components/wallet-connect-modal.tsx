import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Download,
  ExternalLink,
  Loader2,
  SearchX,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { useLockBodyScroll } from "../hooks/use-lock-body-scroll";

interface WalletConnectorOption {
  uid: string;
  id: string;
  name: string;
  icon?: string;
  isRecent: boolean;
}

interface WalletConnectModalProps {
  open: boolean;
  currentNetworkLabel: string;
  chainName: string;
  walletOptions: WalletConnectorOption[];
  isDetectingWallets: boolean;
  connectingWalletUid: string | null;
  connectionError: string | null;
  onClose: () => void;
  onConnect: (walletUid: string) => void;
}

interface RecommendedWallet {
  name: string;
  href: string;
  note: string;
}

const RECOMMENDED_WALLETS: RecommendedWallet[] = [
  {
    name: "MetaMask",
    href: "https://metamask.io/download/",
    note: "Popular EVM browser wallet",
  },
  {
    name: "Phantom",
    href: "https://phantom.com/download",
    note: "Fast multi-chain wallet",
  },
  {
    name: "Coinbase Wallet",
    href: "https://www.coinbase.com/wallet/downloads",
    note: "Simple self-custody wallet",
  },
];

function getWalletAccent(name: string, id: string) {
  const value = `${name} ${id}`.toLowerCase();

  if (value.includes("metamask")) {
    return {
      tile: "from-orange-500/90 via-amber-400/80 to-yellow-300/80",
      ring: "border-orange-500/30",
      badge: "bg-orange-500/15 text-orange-200 border-orange-400/20",
    };
  }

  if (value.includes("phantom")) {
    return {
      tile: "from-violet-500/90 via-fuchsia-400/80 to-indigo-300/80",
      ring: "border-violet-500/30",
      badge: "bg-violet-500/15 text-violet-200 border-violet-400/20",
    };
  }

  if (value.includes("coinbase")) {
    return {
      tile: "from-blue-500/90 via-cyan-400/80 to-sky-300/80",
      ring: "border-blue-500/30",
      badge: "bg-blue-500/15 text-blue-200 border-blue-400/20",
    };
  }

  if (value.includes("okx")) {
    return {
      tile: "from-zinc-100 via-zinc-300 to-zinc-500",
      ring: "border-zinc-400/20",
      badge: "bg-zinc-500/15 text-zinc-200 border-zinc-400/20",
    };
  }

  if (value.includes("rabby")) {
    return {
      tile: "from-cyan-400/90 via-blue-400/80 to-indigo-400/80",
      ring: "border-cyan-500/30",
      badge: "bg-cyan-500/15 text-cyan-200 border-cyan-400/20",
    };
  }

  return {
    tile: "from-primary via-blue-500/80 to-cyan-400/80",
    ring: "border-primary/30",
    badge: "bg-primary/15 text-primary border-primary/20",
  };
}

function getWalletMonogram(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function WalletOptionIcon({
  icon,
  name,
  id,
}: {
  icon?: string;
  name: string;
  id: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const accent = getWalletAccent(name, id);

  return (
    <div
      className={`relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border ${accent.ring} bg-gradient-to-br ${accent.tile} shadow-[0_10px_30px_rgba(0,0,0,0.25)]`}
    >
      {icon && !imageFailed ? (
        <img
          src={icon}
          alt={name}
          className="h-full w-full object-contain"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="text-sm font-semibold text-white/95">
          {getWalletMonogram(name)}
        </span>
      )}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.24),transparent_55%)]" />
    </div>
  );
}

function WalletOptionSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="flex items-center gap-4 rounded-2xl border border-white/6 bg-white/[0.03] p-4"
        >
          <div className="h-12 w-12 animate-pulse rounded-2xl bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-24 animate-pulse rounded bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function WalletConnectModal({
  open,
  currentNetworkLabel,
  chainName,
  walletOptions,
  isDetectingWallets,
  connectingWalletUid,
  connectionError,
  onClose,
  onConnect,
}: WalletConnectModalProps) {
  const hasWallets = walletOptions.length > 0;

  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[180] flex items-center justify-center overflow-hidden p-2 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/75 backdrop-blur-3xl"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative z-10 flex max-h-[calc(100dvh-1rem)] w-full max-w-[1240px] flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#12141c]/95 shadow-[0_30px_120px_rgba(0,0,0,0.55)] sm:max-h-[calc(100dvh-3rem)] sm:rounded-[30px] md:grid md:h-[min(860px,calc(100dvh-3rem))] md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] md:grid-rows-[minmax(0,1fr)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.04)_1px,transparent_1px)] bg-[size:36px_36px] opacity-30" />
            <div className="pointer-events-none absolute left-10 top-10 h-48 w-48 rounded-full bg-primary/10 blur-[100px]" />
            <div className="pointer-events-none absolute bottom-10 right-10 h-56 w-56 rounded-full bg-cyan-500/10 blur-[120px]" />

            <button
              onClick={onClose}
              className="absolute right-4 top-4 z-20 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-muted-foreground transition-colors hover:border-primary/40 hover:text-white backdrop-blur-md"
              aria-label="Close wallet modal"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain md:contents">
              <div className="relative flex min-h-0 flex-col border-b border-white/8 md:border-b-0 md:border-r">
                <div className="shrink-0 border-b border-white/8 px-6 py-6 sm:px-8">
                  <div className="flex items-start justify-between gap-4 lg:pr-14">
                    <div className="space-y-3 flex space-x-2.5">
                      <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
                        <Wallet className="h-6 w-6 " />
                      </div>
                      <div>
                        <h2 className="xl:text-3xl lg:text-2xl font-semibold text-white">
                          Connect a Wallet
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Choose a wallet to connect to {chainName}.
                        </p>
                      </div>
                    </div>
                    {/* <Badge className="border-primary/20 bg-primary/15 text-primary">
                      {currentNetworkLabel}
                    </Badge> */}
                  </div>

                  {connectionError ? (
                    <Card className="mt-5 gap-0 border-red-500/20 bg-red-500/8 p-4 text-sm text-red-100">
                      {connectionError}
                    </Card>
                  ) : null}
                </div>

                <div className="min-h-0 flex-1 overflow-visible px-6 py-6 sm:px-8 md:overflow-y-auto md:overscroll-contain">
                  {isDetectingWallets ? (
                    <WalletOptionSkeleton />
                  ) : hasWallets ? (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.24em] text-primary/80">
                            Installed
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Detected wallets available in this browser.
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="border-white/10 bg-white/[0.03] text-white/80"
                        >
                          {walletOptions.length} Found
                        </Badge>
                      </div>

                      <div className="space-y-3">
                        {walletOptions.map((wallet) => {
                          const accent = getWalletAccent(wallet.name, wallet.id);
                          const isConnecting = connectingWalletUid === wallet.uid;

                          return (
                            <button
                              key={wallet.uid}
                              onClick={() => onConnect(wallet.uid)}
                              disabled={Boolean(connectingWalletUid)}
                              className="group flex w-full items-center gap-4 rounded-[22px] border border-white/8 bg-white/[0.03] p-4 text-left transition-all hover:border-primary/30 hover:bg-primary/[0.06] disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              <WalletOptionIcon
                                icon={wallet.icon}
                                name={wallet.name}
                                id={wallet.id}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-lg font-semibold text-white">
                                    {wallet.name}
                                  </p>
                                  {wallet.isRecent ? (
                                    <Badge className={accent.badge}>Recent</Badge>
                                  ) : null}
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  Connect with {wallet.name} on {currentNetworkLabel}.
                                </p>
                              </div>
                              {isConnecting ? (
                                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                              ) : (
                                <ArrowRight className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-[28px] border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
                      <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.04] text-primary">
                        <SearchX className="h-8 w-8" />
                      </div>
                      <h3 className="mt-5 text-2xl font-semibold text-white">
                        No Wallet Detected
                      </h3>
                      <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
                        We could not find any compatible EVM wallet in this browser.
                        Install a wallet extension or open HiveX inside a wallet browser.
                      </p>

                      <div className="mt-8 grid w-full gap-3">
                        {RECOMMENDED_WALLETS.map((wallet) => (
                          <a
                            key={wallet.name}
                            href={wallet.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-left transition-all hover:border-primary/30 hover:bg-primary/[0.06]"
                          >
                            <div>
                              <p className="font-medium text-white">{wallet.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {wallet.note}
                              </p>
                            </div>
                            <Download className="h-4 w-4 text-primary" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="relative flex min-h-0 flex-col justify-between px-6 py-8 sm:px-10 md:overflow-y-auto">
                <div>
                  <Badge
                    variant="outline"
                    className="border-white/10 bg-white/[0.03] text-white/75"
                  >
                    HiveX Access
                  </Badge>
                  <h3 className="mt-6 text-3xl font-semibold text-white sm:text-4xl">
                    What is a Wallet?
                  </h3>
                  <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
                    Wallets let you hold assets, sign transactions, and use HiveX
                    with one portable identity across the network.
                  </p>

                  <div className="mt-10 space-y-5">
                    <div className="rounded-[26px] border border-white/8 bg-white/[0.03] p-5">
                      <div className="flex items-start gap-4">
                        <div className="flex lg:h-14 lg:w-14 w-10 h-10 shrink-0 items-center justify-center lg:rounded-2xl rounded-xl border border-primary/20 bg-primary/10 text-primary">
                          <Sparkles className="h-6 w-6" />
                        </div>
                        <div>
                          <h4 className="text-xl font-semibold text-white">
                            A Home for Your Digital Assets
                          </h4>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            Send, receive, store, and explore native assets and tokens
                            across HiveX from one secure wallet.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[26px] border border-white/8 bg-white/[0.03] p-5">
                      <div className="flex items-start gap-4">
                        <div className="flex lg:h-14 lg:w-14 w-10 h-10 shrink-0 items-center justify-center lg:rounded-2xl rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                          <ShieldCheck className="h-6 w-6" />
                        </div>
                        <div>
                          <h4 className="text-xl font-semibold text-white">
                            One Login for the Whole Hub
                          </h4>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            Instead of creating a new account for each product, your
                            wallet becomes the identity layer for staking, governance,
                            flow, and asset management.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-10 space-y-4 rounded-[28px] border border-white/8 bg-white/[0.03] p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        Current target network
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {chainName}
                      </p>
                    </div>
                    <Badge className="border-primary/20 bg-primary/15 text-primary">
                      {currentNetworkLabel}
                    </Badge>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button asChild className="h-11 flex-1 rounded-xl">
                      <a
                        href="https://ethereum.org/en/wallets/find-wallet/"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Get a Wallet
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      asChild
                      variant="ghost"
                      className="h-11 flex-1 rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.06]"
                    >
                      <a
                        href="https://ethereum.org/en/wallets/"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Learn More
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
