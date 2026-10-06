import {
  Check,
  ChevronDown,
  ExternalLink,
  LoaderCircle,
  Send,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TokenIcon } from '../../components/token-icon';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { useLockBodyScroll } from '@/app/hooks/use-lock-body-scroll';
import { useSendTransaction } from '@/app/hooks/use-send-transaction';
import { useFeedback } from '@/app/providers/feedback-provider';
import { useWallet } from '@/app/providers/wallet-provider';
import type { TokenInfo } from '@/app/types/common';
import {
  formatAmount,
  restoreFormattedAmount,
  shortAddress,
} from '@/app/lib/format';
import { toExplorer } from '@/app/lib/helper';
import { ethers } from 'ethers';

interface WalletSendModalProps {
  token?: TokenInfo | null;
  tokens: TokenInfo[];
  open: boolean;
  onClose: () => void;
  onSent?: () => Promise<void> | void;
}

export function WalletSendModal({
  token,
  tokens,
  open,
  onClose,
  onSent,
}: WalletSendModalProps) {
  const { currentNetwork } = useWallet();

  const { showError, showSuccess } = useFeedback();
  const { sendTransactionAsync, isPending } = useSendTransaction();

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);

  const [dropdown, setDropdown] = useState(false);
  const [error, setError] = useState('');
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<'loading' | 'success'>(
    'loading',
  );
  const [sentHash, setSentHash] = useState('');
  const ddRef = useRef<HTMLDivElement>(null);

  const sendInfos = useMemo(() => {
    if (!selectedToken) {
      return [];
    }
    return [
      {
        label: 'Sending',
        value: `${formatAmount(amount || '0', selectedToken.decimals)} ${selectedToken.symbol || '-'}`,
      },
      {
        label: 'To',
        value: shortAddress(recipient),
      },
      // {
      //   label: 'Estimated Fee',
      //   value: '-',
      // },
    ];
  }, [amount, recipient, selectedToken]);
  const isConfirmLoading = confirmModalOpen && confirmState === 'loading';
  const isBusy = isPending || isConfirmLoading;

  useLockBodyScroll(open);

  useEffect(() => {
    if (open) {
      setSelectedToken(token);
    } else {
      setSelectedToken(null);
    }

    return;
  }, [open]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ddRef.current && !ddRef.current.contains(event.target as Node)) {
        setDropdown(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (tokens.length === 0) {
      setSelectedToken(null);
      return;
    }

    setSelectedToken((currentToken) => {
      if (!currentToken) {
        return tokens[0];
      }

      return (
        tokens.find(
          (item) =>
            (item.contractAddress || item.assetType || item.symbol) ===
            (currentToken.contractAddress ||
              currentToken.assetType ||
              currentToken.symbol),
        ) ?? tokens[0]
      );
    });
  }, [tokens]);

  const reset = () => {
    setRecipient('');
    setAmount('');
    setSelectedToken(tokens[0] ?? null);
    setError('');
    setDropdown(false);
    setConfirmModalOpen(false);
    setConfirmState('loading');
    setSentHash('');
  };

  const close = () => {
    if (isBusy) {
      return;
    }

    reset();
    onClose();
  };

  const handleSend = async () => {
    if (!selectedToken) {
      setError('No selectedToken is available to send.');
      return;
    }

    if (!recipient.trim() || !recipient.startsWith('0x')) {
      setError('Enter a valid address starting with 0x.');
      return;
    } else if (!ethers.isAddress(recipient)) {
      setError('Enter a valid wallet address.');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Amount must be greater than 0.');
      return;
    }

    const avail = parseFloat(
      restoreFormattedAmount(selectedToken.balance || '0'),
    );
    if (parseFloat(amount) > avail) {
      setError('Insufficient balance.');
      return;
    }

    setError('');
    setSentHash('');
    setConfirmState('loading');
    setConfirmModalOpen(true);

    try {
      const result = await sendTransactionAsync({
        to: recipient,
        amount,
        token: selectedToken,
      });

      if (onSent) {
        await onSent();
      }
      setSentHash(result.hash);
      setConfirmState('success');
      showSuccess(
        'Transaction sent',
        `${formatAmount(amount, selectedToken.decimals)} ${selectedToken.symbol} was sent successfully.`,
      );
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Failed to send the transaction.';

      setConfirmModalOpen(false);
      setConfirmState('loading');
      setSentHash('');
      setError(message);
      showError('Transaction failed', message);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm'
          onClick={() => {
            if (!isBusy) {
              close();
            }
          }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25 }}
            className='w-full max-w-lg'
            onClick={(event) => event.stopPropagation()}>
            <Card className='overflow-hidden border-border/50 bg-card p-0'>
              <div className='flex items-center justify-between border-b border-border/30 px-6 py-5'>
                <div className='flex items-center gap-3'>
                  <div className='rounded-lg bg-primary/10 p-2'>
                    <Send className='h-5 w-5 text-primary' />
                  </div>
                  <h3 className='text-xl font-bold'>Send Tokens</h3>
                </div>
                <button
                  type='button'
                    onClick={close}
                    aria-label='Close transfer'
                    disabled={isBusy}
                  className='cursor-pointer p-1 text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50'>
                  <X className='h-5 w-5' />
                </button>
              </div>

              <div className='space-y-5 p-6'>
                {confirmModalOpen ? (
                  confirmState === 'loading' ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className='space-y-4 py-8 text-center'>
                      <div className='mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15'>
                        <LoaderCircle className='h-8 w-8 animate-spin text-primary' />
                      </div>
                      <h3 className='text-xl font-bold'>
                        Confirming Transaction
                      </h3>
                      <p className='text-sm text-muted-foreground'>
                        Waiting for the transaction hash to be confirmed
                        on-chain.
                      </p>
                      {sendInfos.length ? (
                        <div className='space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-left'>
                          {sendInfos.map((item, index) => (
                            <div
                              key={index}
                              className='flex items-center justify-between gap-4'>
                              <span className='text-muted-foreground'>
                                {item.label}
                              </span>
                              <span className='font-medium'>{item.value}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className='space-y-4 py-8 text-center'>
                      <div className='mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20'>
                        <Check className='h-8 w-8 text-green-500' />
                      </div>
                      <h3 className='text-xl font-bold'>Transaction Sent!</h3>
                      <p className='text-sm text-muted-foreground'>
                        {amount} {selectedToken?.symbol || ''} sent to{' '}
                        {recipient.slice(0, 8)}...{recipient.slice(-4)}
                      </p>
                      {sentHash ? (
                        <p className='text-xs font-mono text-muted-foreground'>
                          TxHash: {shortAddress(sentHash, 10, 8)}
                        </p>
                      ) : null}
                      {sentHash ? (
                        <Button
                          type='button'
                          variant='outline'
                          onClick={() =>
                            toExplorer('tx', sentHash, {
                              chainId: currentNetwork.chainId,
                            })
                          }
                          className='cursor-pointer border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground'>
                          <ExternalLink className='mr-2 h-4 w-4' />
                          View on Explorer
                        </Button>
                      ) : null}
                      <Button
                        onClick={close}
                        className='mt-4 cursor-pointer bg-primary hover:bg-primary/90'>
                        Done
                      </Button>
                    </motion.div>
                  )
                ) : (
                  <>
                    <div>
                      <label className='mb-2 block text-sm text-muted-foreground'>
                        Token
                      </label>
                      <div className='relative' ref={ddRef}>
                        <button
                          type='button'
                          onClick={() => setDropdown(!dropdown)}
                          className='flex w-full cursor-pointer items-center justify-between rounded-lg border border-border/50 bg-secondary/30 p-3 transition-colors hover:border-primary/50'>
                          <div className='flex items-center gap-3'>
                            <TokenIcon
                              src={selectedToken?.logo}
                              alt={
                                selectedToken?.name ||
                                selectedToken?.symbol ||
                                'Token'
                              }
                              fallback={
                                selectedToken?.symbol ||
                                selectedToken?.name ||
                                'Token'
                              }
                              className='h-8 w-8'
                              fallbackClassName={
                                selectedToken?.isNative
                                  ? 'text-xs font-bold italic'
                                  : 'text-xs font-semibold tracking-[0.04em]'
                              }
                              badgeSrc={
                                selectedToken?.isFlow
                                  ? '/token/flow.svg'
                                  : undefined
                              }
                            />
                            <span className='font-medium'>
                              {selectedToken?.name || 'Select token'}
                            </span>
                            <span className='text-sm text-muted-foreground'>
                              Bal: {selectedToken?.balance || '0'}
                            </span>
                          </div>
                          <ChevronDown
                            className={`h-4 w-4 text-muted-foreground transition-transform ${
                              dropdown ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                        <AnimatePresence>
                          {dropdown ? (
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              transition={{ duration: 0.15 }}
                              className='absolute z-20 mt-1 max-h-64 w-full overflow-y-auto overscroll-contain rounded-lg border border-border/50 bg-card shadow-xl'>
                              {tokens.map((nextToken) => (
                                <button
                                  key={
                                    nextToken.assetType ||
                                    nextToken.contractAddress ||
                                    nextToken.symbol
                                  }
                                  type='button'
                                  onClick={() => {
                                    setSelectedToken(nextToken);
                                    setDropdown(false);
                                  }}
                                  className={`flex w-full cursor-pointer items-center justify-between p-3 transition-colors hover:bg-secondary/50 ${
                                    (selectedToken?.contractAddress ||
                                      selectedToken?.assetType ||
                                      selectedToken?.symbol) ===
                                    (nextToken.contractAddress ||
                                      nextToken.assetType ||
                                      nextToken.symbol)
                                      ? 'bg-secondary/30'
                                      : ''
                                  }`}>
                                  <div className='flex items-center gap-3'>
                                    <TokenIcon
                                      src={nextToken.logo}
                                      alt={nextToken.name || nextToken.symbol}
                                      fallback={
                                        nextToken.symbol || nextToken.name
                                      }
                                      className='h-8 w-8'
                                      fallbackClassName={
                                        nextToken.isNative
                                          ? 'text-xs font-bold italic'
                                          : 'text-xs font-semibold tracking-[0.04em]'
                                      }
                                      badgeSrc={
                                        nextToken.isFlow
                                          ? '/token/flow.svg'
                                          : undefined
                                      }
                                    />
                                    <span className='font-medium'>
                                      {nextToken.name}
                                    </span>
                                  </div>
                                  <div>
                                    <span className='text-sm text-muted-foreground'>
                                      {nextToken.balance}
                                    </span>
                                    <span className=' text-xs pl-0.5 opacity-50'>
                                      {nextToken.symbol || '-'}
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </div>
                    </div>

                    <div>
                      <label className='mb-2 block text-sm text-muted-foreground'>
                        Recipient Address
                      </label>
                      <Input
                        placeholder='0x...'
                        value={recipient}
                        onChange={(event) => {
                          setRecipient(event.target.value);
                          if (error) {
                            setError('');
                          }
                        }}
                        className='border-border/50 bg-secondary/30 font-mono'
                      />
                    </div>

                    <div>
                      <div className='mb-2 flex items-center justify-between'>
                        <label className='text-sm text-muted-foreground'>
                          Amount
                        </label>
                        <button
                          type='button'
                          onClick={() =>
                            setAmount(
                              restoreFormattedAmount(
                                selectedToken?.balance || '0',
                              ),
                            )
                          }
                          className='cursor-pointer text-xs text-primary hover:text-primary/80'>
                          MAX
                        </button>
                      </div>
                      <Input
                        type='number'
                        placeholder='0.00'
                        value={amount}
                        onChange={(event) => {
                          setAmount(event.target.value);
                          if (error) {
                            setError('');
                          }
                        }}
                        className='border-border/50 bg-secondary/30'
                      />
                    </div>

                    {amount && recipient ? (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className='space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm'>
                        {sendInfos.map((item, i) => {
                          return (
                            <div key={i} className='flex justify-between'>
                              <span className='text-muted-foreground'>
                                {item.label}
                              </span>
                              <span className='font-medium'>{item.value}</span>
                            </div>
                          );
                        })}
                      </motion.div>
                    ) : null}

                    {error ? (
                      <p className='text-sm text-red-400'>{error}</p>
                    ) : null}

                    <Button
                      onClick={handleSend}
                      disabled={!selectedToken || isPending}
                      className='h-12 w-full cursor-pointer bg-primary hover:bg-primary/90'>
                      <Send className='mr-2 h-4 w-4' />
                      {isPending
                        ? 'Sending...'
                        : `Send ${selectedToken?.symbol || 'Token'}`}
                    </Button>
                  </>
                )}
              </div>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
