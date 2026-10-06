import { ArrowDownRight, ArrowUpRight, ChevronDown, Code2, Receipt } from 'lucide-react';
import { motion } from 'motion/react';
import { TransactionStatusBadge } from '../../components/transaction-status-badge';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { shortAddress } from '@/app/lib/format';
import { toExplorer } from '@/app/lib/helper';
import { useWallet } from '@/app/providers/wallet-provider';
import { type ReactNode, useState } from 'react';

export interface WalletTransactionRow {
  txHash: string;
  kind: string;
  direction: 'in' | 'out';
  status: 'success' | 'pending' | 'failed';
  amount: string;
  symbol: string;
  timestampLabel: string;
  counterpartyRole: string;
  counterpartyAddress: string;
  assetType: string;
  blockHeight: number;
  hasAmount: boolean;
  rawUtxo: string;
}

interface WalletTransactionsTabProps {
  transactions: WalletTransactionRow[];
  isLoading?: boolean;
  error?: Error | null;
}

function toBadgeStatus(status: WalletTransactionRow['status']) {
  if (status === 'pending') {
    return 'loading' as const;
  }
  if (status === 'failed') {
    return 'error' as const;
  }
  return 'success' as const;
}

const JSON_TOKEN_PATTERN =
  /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

function formatUtxoJson(rawUtxo: string) {
  try {
    return JSON.stringify(JSON.parse(rawUtxo), null, 2);
  } catch {
    return rawUtxo.trim() || '[]';
  }
}

function highlightJson(json: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let tokenIndex = 0;
  let match: RegExpExecArray | null;

  JSON_TOKEN_PATTERN.lastIndex = 0;
  while ((match = JSON_TOKEN_PATTERN.exec(json)) !== null) {
    if (match.index > cursor) {
      nodes.push(json.slice(cursor, match.index));
    }

    const [token, quotedString, keySeparator, literal, number] = match;
    if (quotedString) {
      nodes.push(
        <span
          key={`json-token-${tokenIndex++}`}
          className={keySeparator ? 'text-sky-300' : 'text-emerald-300'}>
          {quotedString}
        </span>,
      );
      if (keySeparator) {
        nodes.push(keySeparator);
      }
    } else {
      nodes.push(
        <span
          key={`json-token-${tokenIndex++}`}
          className={
            literal ? 'text-violet-300' : number ? 'text-amber-300' : ''
          }>
          {token}
        </span>,
      );
    }

    cursor = JSON_TOKEN_PATTERN.lastIndex;
  }

  if (cursor < json.length) {
    nodes.push(json.slice(cursor));
  }

  return nodes;
}

export function WalletTransactionsTab({
  transactions,
  isLoading = false,
  error = null,
}: WalletTransactionsTabProps) {
  const { currentNetwork } = useWallet();
  const [expandedTransactions, setExpandedTransactions] = useState<Set<string>>(
    () => new Set(),
  );

  const txAmount = (tx: WalletTransactionRow) => {
    const isIncome = tx.direction === 'in';
    return tx.hasAmount ? `${isIncome ? '+' : '-'}${tx.amount} ${tx.symbol}` : 'No asset transfer';
  };

  return (
    <motion.div
      key='transactions'
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}>
      <div className='space-y-4'>
        <Card className='border-border/50 bg-card p-4 sm:p-6'>
          {isLoading ? (
            <div className='space-y-3'>
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className='h-[76px] animate-pulse rounded-lg border border-border/30 bg-secondary/20'
                />
              ))}
            </div>
          ) : error ? (
            <div className='rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300'>
              {error.message || 'Failed to load transactions.'}
            </div>
          ) : transactions.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-10 text-center'>
              <div className='p-3 rounded-full bg-primary/10 mb-4'>
                <Receipt className='w-6 h-6 text-primary' />
              </div>
              <p className='text-sm font-medium'>No transactions found</p>
              <p className='text-xs text-muted-foreground mt-1'>
                There are no transactions for this wallet on the current
                network.
              </p>
            </div>
          ) : (
            <div className='space-y-3'>
              {transactions.map((tx, index) => {
                const isIncome = tx.direction === 'in';

                const displayAddress = tx.counterpartyAddress.startsWith('0x')
                  ? shortAddress(tx.counterpartyAddress)
                  : tx.counterpartyAddress;
                const rowKey = tx.txHash || `${tx.timestampLabel}-${index}`;
                const isExpanded = expandedTransactions.has(rowKey);

                return (
                  <motion.div
                    key={rowKey}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.08 }}>
                    <div className='flex flex-col gap-3 rounded-xl border border-border/30 bg-secondary/30 p-3 transition-colors hover:border-primary/30 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4'>
                      <div className='flex min-w-0 items-start gap-3 sm:gap-4'>
                        <div
                          className={`mt-0.5 shrink-0 rounded-lg p-2 ${
                            isIncome ? 'bg-green-500/10' : 'bg-red-500/10'
                          }`}>
                          {isIncome ? (
                            <ArrowDownRight className='h-5 w-5 text-green-500' />
                          ) : (
                            <ArrowUpRight className='h-5 w-5 text-red-500' />
                          )}
                        </div>
                        <div className='min-w-0 space-y-1.5'>
                          <div className='flex flex-wrap items-center gap-1.5 sm:gap-2'>
                            <p className='text-sm font-medium sm:text-base'>
                              {tx.kind}
                            </p>
                            <TransactionStatusBadge
                              status={toBadgeStatus(tx.status)}
                              className='shrink-0'
                            />
                          </div>
                          <p className='text-sm text-muted-foreground'>
                            <span className='mr-1 text-foreground/70'>
                              {tx.counterpartyRole}:
                            </span>
                            {tx.counterpartyAddress ? (
                              <button
                                type='button'
                                onClick={() =>
                                  toExplorer(
                                    'address',
                                    tx.counterpartyAddress,
                                    {
                                      chainId: currentNetwork.chainId,
                                    },
                                  )
                                }
                                className='cursor-pointer break-all text-left text-muted-foreground transition-colors hover:text-foreground'>
                                {displayAddress}
                              </button>
                            ) : (
                              <span className='break-all'>--</span>
                            )}
                          </p>
                          <p className='text-xs text-muted-foreground'>
                            {tx.blockHeight ? `Block #${tx.blockHeight}` : tx.timestampLabel}
                            {tx.assetType ? ` · ${tx.assetType === 'OHI' ? 'OHI' : `Asset ${shortAddress(tx.assetType)}`}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className='border-t border-border/30 pt-3 text-right sm:min-w-[148px] sm:border-t-0 sm:pt-0'>
                        <p
                          className={`text-sm font-bold sm:text-base ${
                            isIncome ? 'text-green-500' : 'text-red-500'
                          }`}>
                          {txAmount(tx)}
                        </p>
                        {tx.txHash ? (
                          <button
                            type='button'
                            onClick={() =>
                              toExplorer('tx', tx.txHash, {
                                chainId: currentNetwork.chainId,
                              })
                            }
                            className='mt-1 cursor-pointer text-[11px] font-mono text-muted-foreground transition-colors hover:text-foreground sm:mt-0.5 sm:text-xs'>
                            {shortAddress(tx.txHash, 10, 8)}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className='mt-2 flex justify-end'>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        className='h-7 gap-1.5 text-xs text-muted-foreground'
                        onClick={() => {
                          setExpandedTransactions((current) => {
                            const next = new Set(current);
                            if (next.has(rowKey)) next.delete(rowKey);
                            else next.add(rowKey);
                            return next;
                          });
                        }}>
                        <Code2 className='h-3.5 w-3.5' />
                        {isExpanded ? 'Hide UTXO' : 'View formatted UTXO'}
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </Button>
                    </div>
                    {isExpanded ? (
                      <div className='mt-2 overflow-hidden rounded-lg border border-border/40 bg-background/70'>
                        <div className='border-b border-border/40 bg-secondary/30 px-3 py-2 text-xs font-medium text-muted-foreground'>
                          Formatted UTXO JSON
                        </div>
                        <pre className='max-h-72 overflow-auto p-3 text-left font-mono text-xs leading-5 text-slate-300'>
                          {highlightJson(formatUtxoJson(tx.rawUtxo))}
                        </pre>
                      </div>
                    ) : null}
                  </motion.div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </motion.div>
  );
}
