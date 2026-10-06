import { Activity } from 'lucide-react';
import { motion } from 'motion/react';
import { Card } from '../../components/ui/card';

export function FlowSidebar() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.45 }}
      className='space-y-6 lg:col-span-2'>
      <Card className='border-border/50 bg-card p-6'>
        <div className='mb-4 flex items-center gap-3'>
          <div className='rounded-lg bg-blue-500/10 p-2'>
            <Activity className='h-5 w-5 text-blue-400' />
          </div>
          <h3>Flow Info</h3>
        </div>
        <div className='space-y-4 text-sm'>
          <div className='flex items-start gap-3'>
            <div className='mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-500' />
            <div>
              <p className='mb-0.5 font-medium'>Flow In</p>
              <p className='text-xs text-muted-foreground'>
                <span>
                  Convert the corresponding ERC20 token into an Flow asset.
                </span>
                <br />
                <span>
                  These voted assets are recognized on HiveX as gas-usable
                  base layer assets.
                </span>
              </p>
            </div>
          </div>
          <div className='flex items-start gap-3'>
            <div className='mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500' />
            <div>
              <p className='mb-0.5 font-medium'>Flow Out</p>
              <p className='text-xs text-muted-foreground'>
                <span>
                  Convert an Flow asset back into its corresponding ERC20 token.
                </span>
                <br />
                <span>
                  This is the reverse path when you want to exit back to ERC20
                  form.
                </span>
              </p>
            </div>
          </div>
          <div className='flex items-start gap-3'>
            <div className='mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary' />
            <div>
              <p className='mb-0.5 font-medium'>Flow Assets</p>
              <p className='text-xs text-muted-foreground'>
                <span>
                  An Flow token is an asset voted out from ERC20 tokens and can
                  be used as gas on HiveX.
                </span>
                <span>
                  It represents the base layer form of that ERC20 asset inside
                  the network.
                </span>
              </p>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
