import {
  OPENHIVE_GOVERNANCE_PARAMETERS,
  OPENHIVE_VALIDATOR_CONSTRAINTS,
} from './openhive-parameters';

const blockGasLimit =
  OPENHIVE_GOVERNANCE_PARAMETERS.BLOCK_GAS_LIMIT.toLocaleString();
const parameterAuthority = OPENHIVE_GOVERNANCE_PARAMETERS.PARAMETER_AUTHORITY;
const validatorLimits = OPENHIVE_VALIDATOR_CONSTRAINTS;

export const proposals = [
  {
    id: 1,
    title: `Set Block Gas Limit to ${blockGasLimit}`,
    description: `Proposal to set the HiveX block gas limit to ${blockGasLimit} as the current network operating parameter.`,
    status: "active",
    votesFor: 45680,
    votesAgainst: 12340,
    totalVotes: 58020,
    endDate: "2026-03-25",
    author: "0x1234...5678",
    category: "Network Upgrade",
  },
  {
    id: 2,
    title: "Confirm Genesis-Controlled Proposal Parameters",
    description: `Confirm that minimum voting count, voting duration, exchange rate, and proposal cancellation parameters are controlled by the ${parameterAuthority}.`,
    status: "active",
    votesFor: 78900,
    votesAgainst: 23100,
    totalVotes: 102000,
    endDate: "2026-03-22",
    author: "0x5678...9abc",
    category: "Treasury",
  },
  {
    id: 3,
    title: "Implement EIP-4844 Compatibility",
    description:
      "Add support for EIP-4844 proto-danksharding to reduce transaction costs and improve scalability.",
    status: "passed",
    votesFor: 125000,
    votesAgainst: 15000,
    totalVotes: 140000,
    endDate: "2026-03-10",
    author: "0x9abc...def0",
    category: "Technical",
  },
  {
    id: 4,
    title: "Update Validator Investment Limits",
    description: `Adopt a ${validatorLimits.NODE_SELF_STAKE_AMOUNT.toLocaleString()} node self-stake, ${validatorLimits.INVESTOR_MIN_AMOUNT.toLocaleString()} investor minimum, ${validatorLimits.EFFECTIVE_NODE_INVESTMENT_THRESHOLD.toLocaleString()} effective-node threshold, ${validatorLimits.NODE_INVESTMENT_CAP.toLocaleString()} per-node cap, and ${validatorLimits.NODE_INVESTOR_COUNT_CAP.toLocaleString()} investor cap.`,
    status: "rejected",
    votesFor: 34000,
    votesAgainst: 89000,
    totalVotes: 123000,
    endDate: "2026-03-05",
    author: "0xdef0...1234",
    category: "Governance",
  },
];
