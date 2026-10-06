import { motion, AnimatePresence } from 'motion/react';
import { X, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useLockBodyScroll } from '../hooks/use-lock-body-scroll';
import { Button } from './ui/button';

type TransactionStatus = 'confirm' | 'pending' | 'success' | 'error';
type TransactionConfirmResult = void | string | { hash?: string | null };

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<TransactionConfirmResult>;
  title: string;
  children: React.ReactNode;
  confirmText?: string;
}

export function TransactionModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  children,
  confirmText = 'Confirm Transaction',
}: TransactionModalProps) {
  const [status, setStatus] = React.useState<TransactionStatus>('confirm');
  const [txHash, setTxHash] = React.useState<string>('');

  const [errStr, setErrorStr] = React.useState<string>('');

  useLockBodyScroll(isOpen);

  React.useEffect(() => {
    if (!isOpen) {
      // Reset status when modal closes
      setTimeout(() => setStatus('confirm'), 300);
      setTxHash('');
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    try {
      setStatus('pending');
      setErrorStr('');
      const result = await onConfirm();
      const nextTxHash =
        typeof result === 'string'
          ? result
          : typeof result === 'object'
            ? result?.hash
            : '';

      setTxHash(nextTxHash ?? '');
      setStatus('success');
      // Auto close after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      setStatus('error');
      if (error instanceof Error) {
        setErrorStr(error.message);
      }
    }
  };

  const handleClose = () => {
    if (status !== 'pending') {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className='fixed inset-0 bg-black/80 backdrop-blur-sm z-50 mb-0'
          />

          {/* Modal */}
          <div className='fixed inset-0 flex items-center justify-center z-50 p-4'>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className='max-h-[calc(100vh-2rem)] w-full max-w-md overflow-x-hidden overflow-y-auto rounded-2xl border border-border/50 bg-[#0a0b14] shadow-2xl'
              onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className='relative p-6 border-b border-border/30'>
                <div className='absolute -top-20 -right-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl' />
                <div className='relative flex items-center justify-between'>
                  <h3 className='text-xl font-bold'>{title}</h3>
                  {status !== 'pending' && (
                    <button
                      onClick={handleClose}
                      className='p-2 hover:bg-secondary/50 rounded-lg transition-colors'>
                      <X className='w-5 h-5' />
                    </button>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className='p-6'>
                {status === 'confirm' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className='space-y-6'>
                    {children}
                    <div className='flex gap-3'>
                      <Button
                        onClick={handleClose}
                        variant='outline'
                        className='flex-1'>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleConfirm}
                        className='flex-1 bg-primary hover:bg-primary/90'>
                        {confirmText}
                      </Button>
                    </div>
                  </motion.div>
                )}

                {status === 'pending' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className='text-center py-8'>
                    <div className='inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4'>
                      <Loader2 className='w-8 h-8 text-primary animate-spin' />
                    </div>
                    <h4 className='text-lg font-semibold mb-2'>
                      Processing Transaction
                    </h4>
                    <p className='text-sm text-muted-foreground'>
                      Waiting for wallet or network confirmation
                    </p>
                  </motion.div>
                )}

                {status === 'success' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className='text-center py-8'>
                    <div className='inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4'>
                      <CheckCircle2 className='w-8 h-8 text-green-500' />
                    </div>
                    <h4 className='text-lg font-semibold mb-2 text-green-500'>
                      Transaction Complete!
                    </h4>
                    {txHash && (
                      <div className='mt-4 p-3 rounded-lg bg-secondary/30 border border-border/30'>
                        <p className='text-xs text-muted-foreground mb-1'>
                          Transaction Hash
                        </p>
                        <p className='text-xs font-mono text-foreground break-all'>
                          {txHash.slice(0, 10)}...{txHash.slice(-8)}
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}

                {status === 'error' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className='text-center py-8'>
                    <div className='inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-4'>
                      <AlertCircle className='w-8 h-8 text-red-500' />
                    </div>
                    <h4 className='text-lg font-semibold mb-2 text-red-500'>
                      Transaction Failed
                    </h4>
                    <p className='text-sm text-muted-foreground mb-4'>
                      {errStr ||
                        'The transaction was rejected or failed to complete'}
                    </p>
                    <Button
                      onClick={handleClose}
                      variant='outline'
                      className='w-full'>
                      Close
                    </Button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// Add React import
import * as React from 'react';
