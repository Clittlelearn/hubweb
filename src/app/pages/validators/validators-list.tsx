import {
  AlertCircle,
  CheckCircle2,
  Shield,
  Users,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import type { ValidatorListItem } from './validators-types';

interface ValidatorsListProps {
  validators: ValidatorListItem[];
  connected: boolean;
  canDelegate: boolean;
  onSelectValidator: (validatorId: number) => void;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'active':
      return 'border-green-500/30 bg-green-500/20 text-green-500';
    case 'warning':
      return 'border-yellow-500/30 bg-yellow-500/20 text-yellow-500';
    case 'inactive':
      return 'border-red-500/30 bg-red-500/20 text-red-500';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function ValidatorsList({
  validators,
  connected,
  canDelegate,
  onSelectValidator,
}: ValidatorsListProps) {
  if (!validators.length) {
    return (
      <div>
        <h2 className='mb-6'>All Validators</h2>
        <Card className='border-border/50 bg-card p-6'>
          <p className='text-sm text-muted-foreground'>
            No validator data is available right now.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h2 className='mb-6'>All Validators</h2>
      <div className='space-y-4'>
        {validators.map((validator, index) => (
          <motion.div
            key={validator.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.08 }}>
            <Card className='cursor-pointer border-border/50 bg-card p-4 transition-colors hover:border-primary/50 sm:p-6'>
              <div className='space-y-4'>
                <div className='flex flex-col items-start justify-between gap-3 sm:flex-row'>
                  <div className='flex items-start gap-3 sm:gap-4'>
                    <div className='rounded-lg bg-primary/10 p-2 sm:p-3'>
                      <Shield className='h-5 w-5 text-primary sm:h-6 sm:w-6' />
                    </div>
                    <div className='flex-1'>
                      <div className='mb-2 flex flex-wrap items-center gap-2 sm:gap-3'>
                        <Link
                          to={`/validators/${validator.id}`}
                          className='text-base font-bold hover:text-primary sm:text-xl'>
                          {validator.name}
                        </Link>
                        <Badge className={getStatusColor(validator.status)}>
                          {validator.status === 'active' ? (
                            <CheckCircle2 className='mr-1 h-3 w-3' />
                          ) : (
                            <AlertCircle className='mr-1 h-3 w-3' />
                          )}
                          {validator.status}
                        </Badge>
                      </div>
                      <p className='mb-3 text-xs text-muted-foreground sm:text-sm'>
                        {validator.description}
                      </p>
                      <div className='flex flex-wrap items-center gap-3 text-xs sm:gap-4 sm:text-sm'>
                        <div className='flex items-center gap-1'>
                          <Users className='h-3.5 w-3.5 text-muted-foreground sm:h-4 sm:w-4' />
                          <span className='text-muted-foreground'>
                            {validator.delegators} delegators
                          </span>
                        </div>
                        <div className='text-muted-foreground'>
                          Commission:{' '}
                          <span className='font-medium text-foreground'>
                            {validator.commission}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className='ml-11 text-left sm:ml-0 sm:text-right'>
                    <p className='mb-1 text-xs text-muted-foreground sm:text-sm'>
                      APY
                    </p>
                    <p className='text-xl font-bold text-green-500 sm:text-2xl'>
                      {validator.apy}
                    </p>
                  </div>
                </div>

                <div className='grid grid-cols-2 gap-4 text-sm md:grid-cols-4'>
                  <div>
                    <p className='mb-1 text-muted-foreground'>Total Delegated</p>
                    <p className='font-medium'>{validator.totalDelegated}</p>
                  </div>
                  <div>
                    <p className='mb-1 text-muted-foreground'>Performance</p>
                    <p className='font-medium text-green-500'>
                      {validator.performance}
                    </p>
                  </div>
                  <div>
                    <p className='mb-1 text-muted-foreground'>Uptime</p>
                    <p className='font-medium'>{validator.uptime}</p>
                  </div>
                  <div>
                    <p className='mb-1 text-muted-foreground'>Commission</p>
                    <p className='font-medium'>{validator.commission}</p>
                  </div>
                </div>

                {connected && canDelegate ? (
                  <Button
                    className='w-full cursor-pointer bg-primary hover:bg-primary/90'
                    onClick={() => onSelectValidator(validator.id)}>
                    Delegate to {validator.name}
                  </Button>
                ) : null}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
