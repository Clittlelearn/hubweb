import { motion } from 'motion/react';
import { Card } from '../../components/ui/card';
import type { LockStatItem } from './utils';

export function LockStatsGrid({ stats }: { stats: LockStatItem[] }) {
  return (
    <div className='grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-4'>
      {stats.map((stat, index) => {
        const Icon = stat.icon;

        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}>
            <Card
              className={`bg-gradient-to-br p-3 sm:p-4 ${stat.gradient} ${stat.border}`}>
              <div className='mb-1 flex items-center gap-2 sm:mb-2 sm:gap-3'>
                <div className={`rounded-lg p-1 sm:p-1.5 ${stat.iconBg}`}>
                  <Icon
                    className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${stat.iconColor}`}
                  />
                </div>
                <p className='text-[10px] text-muted-foreground sm:text-xs'>
                  {stat.label}
                </p>
              </div>
              <p
                className={`text-lg font-bold sm:text-xl md:text-2xl ${stat.valueColor}`}>
                {stat.value}
              </p>
              <p className='mt-0.5 text-[10px] text-muted-foreground sm:text-xs'>
                {stat.unit}
              </p>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
