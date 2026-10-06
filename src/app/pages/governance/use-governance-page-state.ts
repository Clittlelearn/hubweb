import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useFeedback } from '@/app/providers/feedback-provider';
import { restoreFormattedAmount } from '@/app/lib/format';
import { scheduleTransactionDataRefresh } from '@/app/lib/transaction-refresh';
import { VOTE_ADDRESS } from '@/app/constants/addresses';
import {
  normalizeOpenHiveError,
  useOpenHiveSdk,
} from '@/app/hooks/use-openhive-sdk';
import type { NormalizedProposal } from './utils';

type VoteType = 'for' | 'against';

function getVotingPowerNumber(votingPower: string) {
  const value = Number(restoreFormattedAmount(votingPower || '0'));
  return Number.isFinite(value) ? value : 0;
}

function getVoteValue(type: VoteType) {
  return type === 'for' ? '1' : '0';
}

interface UseGovernancePageStateOptions {
  proposals: NormalizedProposal[];
  votingPower: string;
}

export function useGovernancePageState({
  proposals,
  votingPower,
}: UseGovernancePageStateOptions) {
  const { address, connected, currentNetwork, getOpenHiveSdk } =
    useOpenHiveSdk();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useFeedback();
  const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(
    null,
  );
  const [voteType, setVoteType] = useState<VoteType | null>(null);

  const selectedProposal = useMemo(() => {
    if (!selectedProposalId) {
      return null;
    }

    return (
      proposals.find((proposal) => proposal.id === selectedProposalId) ?? null
    );
  }, [proposals, selectedProposalId]);

  const hasVotingPower = useMemo(() => {
    return getVotingPowerNumber(votingPower) > 0;
  }, [votingPower]);

  const openVoteModal = (proposalId: string, type: VoteType) => {
    const proposal = proposals.find((item) => item.id === proposalId) ?? null;

    if (!connected) {
      showError('Wallet required', 'Connect your wallet before voting.');
      return;
    }

    if (!hasVotingPower) {
      showError(
        'No voting power',
        'You need locked OHI voting power before you can vote.',
      );
      return;
    }

    if (!proposal || proposal.status !== 'active' || !proposal.canVote) {
      showError(
        'Vote unavailable',
        'This proposal is not currently available for your wallet.',
      );
      return;
    }

    if (proposal.userHasVoted) {
      showError(
        'Already voted',
        'This wallet has already voted on this proposal.',
      );
      return;
    }

    setSelectedProposalId(proposal.id);
    setVoteType(type);
    setIsVoteModalOpen(true);
  };

  const closeVoteModal = () => {
    setIsVoteModalOpen(false);
    setSelectedProposalId(null);
    setVoteType(null);
  };

  const confirmVote = async () => {
    try {
      if (!selectedProposal || !voteType) {
        throw new Error('Select a proposal and vote side first.');
      }

      if (!hasVotingPower) {
        throw new Error('You do not have voting power for governance votes.');
      }

      if (selectedProposal.status !== 'active' || !selectedProposal.canVote) {
        throw new Error('This proposal is not currently votable.');
      }

      if (selectedProposal.userHasVoted) {
        throw new Error('This wallet has already voted on this proposal.');
      }

      const voteHash = selectedProposal.proposalTxHash || selectedProposal.id;

      if (!voteHash) {
        throw new Error('Proposal vote hash is missing.');
      }

      const openhiveSdk = await getOpenHiveSdk();
      const gasAssetType = currentNetwork.nativeCurrency.symbol;
      const response = await openhiveSdk.vote(
        {
          gas_asset: {
            addr: address,
            asset_type: gasAssetType,
          },
          sponsor_gas: false,
          vote: getVoteValue(voteType),
          vote_hash: voteHash,
        },
        VOTE_ADDRESS,
        address,
      );

      // The backend/indexer may lag briefly behind the submitted transaction.
      scheduleTransactionDataRefresh(queryClient);
      showSuccess(
        'Vote submitted',
        `Your vote ${voteType === 'for' ? 'for' : 'against'} the proposal was submitted.`,
      );

      return response.hash;
    } catch (error) {
      const handledError = normalizeOpenHiveError(error);
      showError('Vote failed', handledError.message);
      throw handledError;
    }
  };

  return {
    closeVoteModal,
    confirmVote,
    hasVotingPower,
    isVoteModalOpen,
    openVoteModal,
    selectedProposal,
    voteType,
  };
}
