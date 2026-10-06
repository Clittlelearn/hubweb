import { motion } from 'motion/react';
import { Card } from '../../components/ui/card';
import type { FlowStatItem } from './utils';

interface FlowStatsGridProps {
  stats: FlowStatItem[];
}

export function FlowStatsGrid({ stats }: FlowStatsGridProps) {
  return (
    <div className='grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4'>
      {stats.map((stat, index) => {
        const Icon = stat.icon;

        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.08 }}>
            <Card
              className={`relative overflow-hidden p-3 sm:p-6 bg-gradient-to-br ${stat.gradient} ${stat.border} hover:border-opacity-60 transition-all duration-300 group`}>
              <div
                className={`absolute -top-8 -right-8 w-24 h-24 ${stat.glowColor} rounded-full blur-2xl opacity-60 group-hover:opacity-80 transition-opacity`}
              />
              <div
                className='absolute bottom-0 right-0 w-20 h-20 opacity-[0.04]'
                style={{
                  backgroundImage:
                    'radial-gradient(circle, currentColor 1px, transparent 1px)',
                  backgroundSize: '8px 8px',
                }}
              />
              <div className='relative'>
                <div className='mb-2 flex items-center justify-between sm:mb-4'>
                  <p className='text-xs text-muted-foreground sm:text-sm'>
                    {stat.label}
                  </p>
                  <div className={`rounded-lg p-1.5 sm:p-2 ${stat.iconBg}`}>
                    <Icon className='h-4 w-4 sm:h-5 sm:w-5' />
                  </div>
                </div>
                <p className={`text-xl font-bold sm:text-3xl ${stat.valueColor}`}>
                  {stat.value}
                </p>
                <div className='mt-1 flex items-center gap-2 sm:mt-2'>
                  <div
                    className={`h-1.5 w-1.5 animate-pulse rounded-full ${stat.dotColor}`}
                  />
                  <p className='text-xs text-muted-foreground'>{stat.unit}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
