import { CheckCircle2, LoaderCircle, XCircle } from 'lucide-react';

import { Badge } from './ui/badge';
import { cn } from './ui/utils';

export type TransactionStatus = 'success' | 'error' | 'loading';

const STATUS_META: Record<
  TransactionStatus,
  {
    label: string;
    icon: typeof CheckCircle2;
    className: string;
    iconClassName?: string;
  }
> = {
  success: {
    label: 'Success',
    icon: CheckCircle2,
    className: 'border-green-500/20 bg-green-500/10 text-green-400',
  },
  error: {
    label: 'Failed',
    icon: XCircle,
    className: 'border-red-500/20 bg-red-500/10 text-red-400',
  },
  loading: {
    label: 'Loading',
    icon: LoaderCircle,
    className: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    iconClassName: 'animate-spin',
  },
};

interface TransactionStatusBadgeProps {
  status: TransactionStatus;
  label?: string;
  className?: string;
}

export function TransactionStatusBadge({
  status,
  label,
  className,
}: TransactionStatusBadgeProps) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <Badge
      variant='outline'
      className={cn('p-0 text-[10px] font-medium', meta.className, className)}>
      <Icon className={cn('h-3 w-3', meta.iconClassName)} />
      {/* {label ?? meta.label} */}
    </Badge>
  );
}
