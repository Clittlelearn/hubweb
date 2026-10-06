import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  ExternalLink,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';
import type { FlowHistoryRow } from './utils';

interface FlowRecentHistoryProps {
  flows: FlowHistoryRow[];
}

export function FlowRecentHistory({ flows }: FlowRecentHistoryProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.55 }}>
      <div className='mb-6 flex items-center gap-3'>
        <Activity className='h-5 w-5 text-primary' />
        <h2>Recent Flows</h2>
      </div>
      <Card className='border-border/50 bg-card p-6'>
        {flows.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-10 text-center'>
            <div className='mb-4 rounded-full bg-primary/10 p-3'>
              <Activity className='h-6 w-6 text-primary' />
            </div>
            <p className='text-sm font-medium'>No recent flows</p>
            <p className='mt-1 text-xs text-muted-foreground'>
              Flow In and Flow Out transactions will appear here after they are
              submitted.
            </p>
          </div>
        ) : (
          <div className='space-y-3'>
            {flows.map((flow, index) => (
              <motion.div
                key={flow.id || `${flow.txHash}-${index}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.55 + index * 0.06 }}>
                <div className='flex flex-col items-start justify-between gap-3 rounded-lg border border-border/30 bg-secondary/30 p-3 transition-colors hover:border-primary/30 sm:flex-row sm:items-center sm:gap-0 sm:p-4'>
                  <div className='flex items-center gap-3 sm:gap-4'>
                    <div
                      className={`rounded-lg p-2 sm:p-2.5 ${
                        flow.type === 'in'
                          ? 'bg-green-500/10'
                          : 'bg-red-500/10'
                      }`}>
                      {flow.type === 'in' ? (
                        <ArrowDownRight className='h-4 w-4 text-green-500 sm:h-5 sm:w-5' />
                      ) : (
                        <ArrowUpRight className='h-4 w-4 text-red-500 sm:h-5 sm:w-5' />
                      )}
                    </div>
                    <div>
                      <div className='flex items-center gap-2'>
                        <p className='text-sm font-medium sm:text-base'>
                          Flow {flow.type === 'in' ? 'In' : 'Out'}
                        </p>
                        <Badge
                          className={`px-1.5 py-0 text-[10px] ${
                            flow.type === 'in'
                              ? 'border-green-500/30 bg-green-500/20 text-green-500'
                              : 'border-red-500/30 bg-red-500/20 text-red-500'
                          }`}>
                          {flow.asset}
                        </Badge>
                      </div>
                      <div className='mt-1 flex flex-wrap items-center gap-2'>
                        <p className='text-xs text-muted-foreground'>
                          {flow.timestamp}
                        </p>
                        <span className='hidden text-muted-foreground/30 sm:inline'>
                          •
                        </span>
                        <p className='hidden font-mono text-xs text-muted-foreground sm:inline'>
                          {flow.txHash}
                        </p>
                        <button className='hidden cursor-pointer text-muted-foreground hover:text-foreground sm:inline'>
                          <ExternalLink className='h-3 w-3' />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className='ml-11 text-left sm:ml-0 sm:text-right'>
                    <p
                      className={`font-bold ${
                        flow.type === 'in' ? 'text-green-500' : 'text-red-500'
                      }`}>
                      {flow.type === 'in' ? '+' : '-'}
                      {flow.amount}
                    </p>
                    <Badge className='mt-1 border-green-500/20 bg-green-500/10 px-1.5 py-0 text-[10px] text-green-500'>
                      {flow.status}
                    </Badge>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  );
}
