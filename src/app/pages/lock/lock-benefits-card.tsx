import { Calendar, Gift, TrendingUp, Vote } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { OPENHIVE_TOKENOMICS } from '../../data/openhive-parameters';

const benefits = [
  {
    icon: Gift,
    title: 'Treasury Rewards',
    description:
      'Locked positions can claim rewards from the treasury; rewards are not tied to fixed lock periods',
    iconBg: 'bg-green-500/10',
    iconColor: 'text-green-500',
  },
  {
    icon: Vote,
    title: 'Unlock Voting Rights',
    description: 'Only locked OHI tokens can participate in governance',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
  },
  {
    icon: TrendingUp,
    title: 'Gas Reward Share',
    description: `${OPENHIVE_TOKENOMICS.LOCKED_GAS_REWARD_SHARE_PCT}% of previous-day gas rewards are distributed by locked OHI share`,
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-400',
  },
  {
    icon: Calendar,
    title: 'Open-ended Lock',
    description: `No lock period is selected. Unlock is available after ${OPENHIVE_TOKENOMICS.MIN_UNLOCK_DAYS} day, and rewards can be claimed after ${OPENHIVE_TOKENOMICS.MIN_CLAIM_HOURS} hours`,
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
  },
];

export function LockBenefitsCard() {
  return (
    <Card className='border-border/50 bg-gradient-to-br from-primary/5 to-purple-500/5 p-6'>
      <h3 className='mb-4'>Lock Benefits</h3>
      <div className='space-y-4'>
        {benefits.map((benefit) => {
          const Icon = benefit.icon;

          return (
            <div key={benefit.title} className='flex items-start gap-3'>
              <div className={`mt-1 rounded-lg p-2 ${benefit.iconBg}`}>
                <Icon className={`h-4 w-4 ${benefit.iconColor}`} />
              </div>
              <div>
                <p className='mb-1 font-medium'>{benefit.title}</p>
                <p className='text-sm text-muted-foreground'>
                  {benefit.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
