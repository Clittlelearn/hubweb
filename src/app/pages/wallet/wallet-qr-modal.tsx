import { QrCode, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { Card } from '../../components/ui/card';
import { useLockBodyScroll } from '@/app/hooks/use-lock-body-scroll';

interface WalletQrModalProps {
  open: boolean;
  onClose: () => void;
  address: string;
}

export function WalletQrModal({
  open,
  onClose,
  address,
}: WalletQrModalProps) {
  useLockBodyScroll(open);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm'
          onClick={onClose}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25 }}
            className='w-full max-w-md'
            onClick={(event) => event.stopPropagation()}>
            <Card className='overflow-hidden border-border/50 bg-card p-0'>
              <div className='flex items-center justify-between border-b border-border/30 px-6 py-5'>
                <div className='flex items-center gap-3'>
                  <div className='rounded-lg bg-primary/10 p-2'>
                    <QrCode className='h-5 w-5 text-primary' />
                  </div>
                  <h3 className='text-xl font-bold'>QR Code</h3>
                </div>
                <button
                  type='button'
                  onClick={onClose}
                  className='cursor-pointer p-1 text-muted-foreground hover:text-foreground'>
                  <X className='h-5 w-5' />
                </button>
              </div>
              <div className='space-y-5 p-6'>
                <div className='flex items-center justify-center'>
                  <QRCodeSVG
                    value={address}
                    size={200}
                    level='M'
                    includeMargin
                  />
                </div>
                <p className='text-center text-sm text-muted-foreground'>
                  Scan this QR code to send tokens to this address.
                </p>
              </div>
            </Card>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
