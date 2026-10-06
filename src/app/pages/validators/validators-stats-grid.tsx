import { motion } from 'motion/react';
import { Card } from '../../components/ui/card';
import type { ValidatorStatItem } from './validators-types';

interface ValidatorsStatsGridProps {
  stats: ValidatorStatItem[];
}

export function ValidatorsStatsGrid({ stats }: ValidatorsStatsGridProps) {
  return (
    <div className='grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4'>
      {stats.map((stat, index) => {
        const Icon = stat.icon;

        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className='h-full'>
            <Card
              className={`relative h-full overflow-hidden p-3 transition-all duration-300 group hover:border-opacity-60 sm:p-6 ${stat.gradient} ${stat.border}`}>
              <div
                className={`absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-60 blur-2xl transition-opacity group-hover:opacity-80 ${stat.glowColor}`}
              />
              <div
                className='absolute bottom-0 right-0 h-20 w-20 opacity-[0.04]'
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
                <p
                  className={`text-xl font-bold sm:text-3xl ${stat.valueColor}`}>
                  {stat.value}
                </p>
                <div className='mt-1 flex items-center justify-between sm:mt-2'>
                  <div className='flex items-center gap-2'>
                    <div
                      className={`h-1.5 w-1.5 animate-pulse rounded-full ${stat.dotColor}`}
                    />
                    <p
                      className={`text-xs ${
                        stat.status ? 'text-green-500' : 'text-muted-foreground'
                      }`}>
                      {stat.currency || stat.status || '\u00A0'}
                    </p>
                  </div>
                  {stat.change ? (
                    <span className='text-sm font-medium text-green-500'>
                      {stat.change}
                    </span>
                  ) : null}
                </div>
              </div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
