import { Check, Copy, Wallet } from 'lucide-react';
import { motion } from 'motion/react';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';
import { TokenIcon } from '../../components/token-icon';
import { shortAddress } from '@/app/lib/format';
import { toExplorer } from '@/app/lib/helper';
import { useWallet } from '@/app/providers/wallet-provider';
import type { TokenInfo } from '@/app/types/common';

interface WalletTokensTabProps {
  tokens: TokenInfo[];
  copiedValue: string | null;
  onCopy: (value: string, label: string) => void;
  onSelectToken?: (value: TokenInfo) => void;
}

export function WalletTokensTab({
  tokens,
  copiedValue,
  onCopy,
  onSelectToken,
}: WalletTokensTabProps) {
  const { currentNetwork, address } = useWallet();

  return (
    <motion.div
      key='tokens'
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className='space-y-3'>
      {tokens.length === 0 ? (
        <Card className='p-6 bg-card border-border/50'>
          <div className='flex flex-col items-center justify-center py-10 text-center'>
            <div className='p-3 rounded-full bg-primary/10 mb-4'>
              <Wallet className='w-6 h-6 text-primary' />
            </div>
            <p className='text-sm font-medium'>No tokens found</p>
            <p className='text-xs text-muted-foreground mt-1'>
              Your wallet does not hold any tokens on this network.
            </p>
          </div>
        </Card>
      ) : (
        tokens.map((token, index) => {
          const isAssetTypeToken = Boolean(token.assetType) && !token.isNative;

          return (
            <motion.div
              key={token.contractAddress || token.assetType || token.symbol}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.08 }}>
              <Card className='p-4 sm:p-5 bg-card border-border/50 hover:border-primary/50 transition-colors cursor-pointer '>
                <div
                  className='flex flex-wrap items-center justify-between gap-3'
                  onClick={() => onSelectToken?.(token)}>
                  <div className='flex min-w-0 max-w-full items-center gap-4'>
                    <TokenIcon
                      src={token.logo}
                      alt={token.name}
                      fallback={token.symbol || token.name}
                      className='h-10 w-10'
                      fallbackClassName={
                        token.isNative ? 'font-bold italic text-sm' : undefined
                      }
                      badgeSrc={
                        isAssetTypeToken ? '/token/flow.svg' : undefined
                      }
                    />
                    <div className='min-w-0'>
                      <div className='flex items-center gap-2'>
                        <p className='min-w-0 break-words font-medium'>{token.name}</p>
                        {token.isNative ? (
                          <Badge className='bg-primary/20 text-primary border-primary/30 text-[10px] px-1.5 py-0'>
                            Native
                          </Badge>
                        ) : null}
                      </div>
                      {!token.isNative &&
                      (token.isFlow || token.contractAddress) ? (
                        <div className='flex items-center gap-1.5 mt-0.5'>
                          {token.isNative ? (
                            <span className='text-sm text-muted-foreground font-mono'>
                              {shortAddress(
                                token.isFlow
                                  ? token.assetType
                                  : token.contractAddress,
                                token.isFlow ? 10 : 8,
                                token.isFlow ? 8 : 6,
                              )}
                            </span>
                          ) : (
                            <button
                              type='button'
                              onClick={(event) => {
                                event.stopPropagation();
                                toExplorer(
                                  token.isFlow ? 'address' : 'token',
                                  token.isFlow
                                    ? address
                                    : token.contractAddress,
                                  { chainId: currentNetwork.chainId },
                                );
                              }}
                              className='text-sm text-muted-foreground font-mono transition-colors hover:text-foreground cursor-pointer'>
                              {shortAddress(
                                token.isFlow
                                  ? token.assetType
                                  : token.contractAddress,
                                token.isFlow ? 10 : 8,
                                token.isFlow ? 8 : 6,
                              )}
                            </button>
                          )}
                          <button
                            type='button'
                            onClick={(event) => {
                              event.stopPropagation();
                              onCopy(
                                token.isFlow
                                  ? token.assetType
                                  : token.contractAddress,
                                token.isFlow
                                  ? `${token.name} asset type`
                                  : `${token.name} contract address`,
                              );
                            }}
                            className='text-muted-foreground hover:text-foreground cursor-pointer'>
                            {copiedValue ===
                            (token.isFlow
                              ? token.assetType
                              : token.contractAddress) ? (
                              <Check className='w-3 h-3 text-green-500' />
                            ) : (
                              <Copy className='w-3 h-3' />
                            )}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className='ml-auto min-w-0 max-w-full break-all text-right'>
                    <p className='font-bold'>{token.balance}</p>
                    <p className='text-xs text-muted-foreground'>
                      {token.symbol || '-'}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })
      )}
    </motion.div>
  );
}
