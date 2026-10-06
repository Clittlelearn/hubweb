import { LockBenefitsCard } from './lock-benefits-card';
import { LockFormCard } from './lock-form-card';

export function LockTokensSection({
  lockAmount,
  lockVotingPower,
  availableBalance,
  tokenSymbol,
  onAmountChange,
  onOpenConfirm,
}: {
  lockAmount: string;
  lockVotingPower: number;
  availableBalance: string;
  tokenSymbol: string;
  onAmountChange: (value: string) => void;
  onOpenConfirm: () => void;
}) {
  return (
    <div>
      <h2 className='mb-6'>Lock {tokenSymbol} Tokens</h2>
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
        <LockFormCard
          lockAmount={lockAmount}
          lockVotingPower={lockVotingPower}
          availableBalance={availableBalance}
          tokenSymbol={tokenSymbol}
          onAmountChange={onAmountChange}
          onOpenConfirm={onOpenConfirm}
        />

        <LockBenefitsCard />
      </div>
    </div>
  );
}
