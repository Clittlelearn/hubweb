import { CopyButton } from '../../components/copy-button';
import type { GovernanceTokenInfo } from '../../types/api-service/governance';

export function GovernanceTokenDetails({ info }: { info: GovernanceTokenInfo }) {
  const identifiers: Array<[string, string | undefined]> = [
    ['Token hash (asset type)', info.assetType],
    ['ERC20 contract', info.tokenContractAddress],
    ['Proposal transaction hash', info.proposalTransactionHash],
  ];

  return <dl aria-label='Proposal token details' className='min-w-0 space-y-3 border-y border-border/40 py-4 text-sm'>
    <div className='min-w-0'>
      <dt className='text-xs text-muted-foreground'>Token name</dt>
      <dd className='mt-1 break-words font-medium'>{info.tokenName || '--'}</dd>
    </div>
    {identifiers.map(([label, value]) => <div key={label} className='min-w-0'>
      <dt className='text-xs text-muted-foreground'>{label}</dt>
      <dd className='mt-1 flex min-w-0 items-start gap-2'>
        <code className='min-w-0 flex-1 break-all text-xs leading-5'>{value || '--'}</code>
        {value && <CopyButton value={value} label={label}
          className='flex size-6 shrink-0 items-center justify-center rounded-sm hover:bg-secondary'
          iconClassName='size-3.5' />}
      </dd>
    </div>)}
  </dl>;
}
