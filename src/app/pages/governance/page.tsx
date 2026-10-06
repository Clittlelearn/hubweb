import { motion } from 'motion/react';
import { Button } from '../../components/ui/button';
import { useWallet } from '../../providers/wallet-provider';
import { ConnectWalletPrompt } from '../../components/connect-wallet-prompt';
import { useApiService } from '@/app/hooks/use-app-apis';
import { useFetchData } from '@/app/hooks/use-fetch-data';
import { useMemo, useState } from 'react';
import { GovernanceVotingPower } from './governance-voting-power';
import { GovernanceProposalsList } from './governance-proposals-list';
import { GovernanceVoteModal } from './governance-vote-modal';
import { useGovernancePageState } from './use-governance-page-state';
import {
  normalizeFlatProposals,
  normalizeGovernanceSummary,
  normalizeProposals,
} from './utils';

const GOVERNANCE_STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'passed', label: 'Passed' },
  { value: 'canceled', label: 'Canceled' },
] as const;

type GovernanceStatusFilter =
  (typeof GOVERNANCE_STATUS_FILTERS)[number]['value'];

export default function GovernancePage() {
  const { connected, address, currentNetwork } = useWallet();
  const apiService = useApiService();
  const [status, setStatus] = useState<GovernanceStatusFilter>('all');

  const targetChainId = currentNetwork.chainId;

  const { rawData: governancePageData, isPending: isPageDataPending } =
    useFetchData({
      queryKey: [
        'governance-page',
        currentNetwork.key,
        targetChainId,
        address,
      ],
      queryFn: (params) => apiService.governanceData(params),
      params: {
        chainId: targetChainId,
        address,
      },
      enabled: true,
    });

  const { rawData: governanceProposalsData } = useFetchData({
    queryKey: [
      'governance-proposals',
      currentNetwork.key,
      targetChainId,
      status,
      address,
    ],
    queryFn: (params) => apiService.governanceProposals(params),
    params: {
      chainId: targetChainId,
      status,
      address,
      pageNum: 1,
      pageSize: 50,
    },
    enabled: true,
    keepPreviousResult: false,
  });

  const summary = useMemo(() => {
    return normalizeGovernanceSummary(
      governancePageData?.summary,
      currentNetwork.nativeCurrency.decimals,
    );
  }, [currentNetwork.nativeCurrency.decimals, governancePageData]);

  const apiProposals = useMemo(() => {
    if (governanceProposalsData) {
      return normalizeFlatProposals(governanceProposalsData.proposals);
    }
    return normalizeProposals(
      governancePageData?.recentProposals,
      currentNetwork.nativeCurrency.decimals,
    );
  }, [
    currentNetwork.nativeCurrency.decimals,
    governancePageData,
    governanceProposalsData,
  ]);

  const displayProposals = useMemo(() => {
    return apiProposals;
  }, [apiProposals]);

  const governanceState = useGovernancePageState({
    proposals: displayProposals,
    votingPower: summary.votingPower,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className='space-y-8'>
      <div className='space-y-2'>
        <h1 className='text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-white via-purple-200 to-primary bg-clip-text text-transparent'>
          Governance
        </h1>
        <p className='text-muted-foreground text-sm sm:text-base md:text-lg'>
          Participate in protocol decisions and vote on proposals
        </p>
      </div>

      {/* Voting Power — only when connected */}
      {connected ? (
        <GovernanceVotingPower
          votingPower={summary.votingPower}
          votingPowerSymbol={summary.votingPowerSymbol}
          votedProposalCount={summary.votedProposalCount}
          loading={isPageDataPending}
        />
      ) : (
        <ConnectWalletPrompt
          variant='inline'
          message='Connect your wallet to vote on proposals and participate in governance.'
        />
      )}

      <section className='space-y-4'>
        {/* Create Proposal Button */}
        <div className='flex justify-between items-center'>
          <h2>Governance Proposals</h2>
          {/* {connected && summary.canCreateProposal && (
            <Button className='bg-primary hover:bg-primary/90'>
              Create Proposal
            </Button>
          )} */}
        </div>

        <div className='flex flex-col gap-3 rounded-xl border border-border/50 bg-card/50 p-3 sm:flex-row sm:items-center sm:justify-between'>
          <div
            role='tablist'
            aria-label='Filter proposals by status'
            className='flex max-w-full gap-1 overflow-x-auto rounded-lg bg-muted/50 p-1'>
            {GOVERNANCE_STATUS_FILTERS.map((filter) => (
              <Button
                key={filter.value}
                type='button'
                role='tab'
                size='sm'
                variant={status === filter.value ? 'secondary' : 'ghost'}
                aria-selected={status === filter.value}
                className={
                  status === filter.value
                    ? 'bg-background text-foreground shadow-sm hover:bg-background'
                    : 'text-muted-foreground'
                }
                onClick={() => setStatus(filter.value)}>
                {filter.label}
              </Button>
            ))}
          </div>

        </div>

        {/* Proposals List */}
        <GovernanceProposalsList
          proposals={displayProposals}
          connected={connected}
          onVote={governanceState.openVoteModal}
        />
      </section>

      {/* Transaction Modal */}
      <GovernanceVoteModal
        isOpen={governanceState.isVoteModalOpen}
        onClose={governanceState.closeVoteModal}
        proposal={governanceState.selectedProposal}
        voteType={governanceState.voteType}
        votingPower={summary.votingPower}
        votingPowerSymbol={summary.votingPowerSymbol}
        onConfirm={governanceState.confirmVote}
      />
    </motion.div>
  );
}
