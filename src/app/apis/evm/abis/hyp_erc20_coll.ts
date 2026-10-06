export const HypERC20Coll_ABI = [
  {
    inputs: [],
    name: 'MIN_INVESTMENT_HOLD_TIME',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'PACKAGE_VERSION',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint32',
        name: 'domain',
        type: 'uint32',
      },
      {
        internalType: 'contract ValueTransferBridge',
        name: 'bridge',
        type: 'address',
      },
    ],
    name: 'addBridge',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'rebalancer',
        type: 'address',
      },
    ],
    name: 'addRebalancer',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint32',
        name: 'domain',
        type: 'uint32',
      },
    ],
    name: 'allowedBridges',
    outputs: [
      {
        internalType: 'address[]',
        name: '',
        type: 'address[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'allowedRebalancers',
    outputs: [
      {
        internalType: 'address[]',
        name: '',
        type: 'address[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint32',
        name: 'routerDomain',
        type: 'uint32',
      },
    ],
    name: 'allowedRecipient',
    outputs: [
      {
        internalType: 'bytes32',
        name: 'recipient',
        type: 'bytes32',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'contract IERC20',
        name: 'token',
        type: 'address',
      },
      {
        internalType: 'contract ValueTransferBridge',
        name: 'bridge',
        type: 'address',
      },
    ],
    name: 'approveTokenForBridge',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_account',
        type: 'address',
      },
    ],
    name: 'balanceOf',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint32',
        name: 'destinationDomain',
        type: 'uint32',
      },
    ],
    name: 'destinationGas',
    outputs: [
      {
        internalType: 'uint256',
        name: 'gasLimit',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'domains',
    outputs: [
      {
        internalType: 'uint32[]',
        name: '',
        type: 'uint32[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint32',
        name: '_domain',
        type: 'uint32',
      },
      {
        internalType: 'bytes32',
        name: '_router',
        type: 'bytes32',
      },
    ],
    name: 'enrollRemoteRouter',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint32[]',
        name: '_domains',
        type: 'uint32[]',
      },
      {
        internalType: 'bytes32[]',
        name: '_addresses',
        type: 'bytes32[]',
      },
    ],
    name: 'enrollRemoteRouters',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint32',
        name: '_origin',
        type: 'uint32',
      },
      {
        internalType: 'bytes32',
        name: '_sender',
        type: 'bytes32',
      },
      {
        internalType: 'bytes',
        name: '_message',
        type: 'bytes',
      },
    ],
    name: 'handle',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'hook',
    outputs: [
      {
        internalType: 'contract IPostDispatchHook',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_hook',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_interchainSecurityModule',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_owner',
        type: 'address',
      },
    ],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'interchainSecurityModule',
    outputs: [
      {
        internalType: 'contract IInterchainSecurityModule',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32',
      },
    ],
    name: 'investments',
    outputs: [
      {
        internalType: 'bytes32',
        name: 'investmentId',
        type: 'bytes32',
      },
      {
        internalType: 'bytes32',
        name: 'recipient',
        type: 'bytes32',
      },
      {
        internalType: 'bytes32',
        name: 'beneficiary',
        type: 'bytes32',
      },
      {
        internalType: 'uint256',
        name: 'localAmount',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'remoteAmount',
        type: 'uint256',
      },
      {
        internalType: 'uint64',
        name: 'timestamp',
        type: 'uint64',
      },
      {
        internalType: 'bool',
        name: 'active',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'localDomain',
    outputs: [
      {
        internalType: 'uint32',
        name: '',
        type: 'uint32',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'mailbox',
    outputs: [
      {
        internalType: 'contract IMailbox',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'minInvestmentAmount',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint32',
        name: '_destinationDomain',
        type: 'uint32',
      },
    ],
    name: 'quoteGasPayment',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint32',
        name: '_destinationDomain',
        type: 'uint32',
      },
      {
        internalType: 'bytes32',
        name: '_recipient',
        type: 'bytes32',
      },
      {
        internalType: 'uint256',
        name: '_amount',
        type: 'uint256',
      },
    ],
    name: 'quoteTransferRemote',
    outputs: [
      {
        components: [
          {
            internalType: 'address',
            name: 'token',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
        ],
        internalType: 'struct Quote[]',
        name: 'quotes',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint32',
        name: 'domain',
        type: 'uint32',
      },
      {
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
      {
        internalType: 'contract ValueTransferBridge',
        name: 'bridge',
        type: 'address',
      },
    ],
    name: 'rebalance',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint32',
        name: 'domain',
        type: 'uint32',
      },
      {
        internalType: 'contract ValueTransferBridge',
        name: 'bridge',
        type: 'address',
      },
    ],
    name: 'removeBridge',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'rebalancer',
        type: 'address',
      },
    ],
    name: 'removeRebalancer',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint32',
        name: 'domain',
        type: 'uint32',
      },
    ],
    name: 'removeRecipient',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint32',
        name: '_destination',
        type: 'uint32',
      },
      {
        internalType: 'bytes32',
        name: '_recipient',
        type: 'bytes32',
      },
      {
        internalType: 'bytes32',
        name: '_beneficiary',
        type: 'bytes32',
      },
    ],
    name: 'resolveInvestment',
    outputs: [
      {
        internalType: 'bytes32',
        name: 'messageId',
        type: 'bytes32',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint32',
        name: '_domain',
        type: 'uint32',
      },
    ],
    name: 'routers',
    outputs: [
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'scale',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint32',
        name: 'domain',
        type: 'uint32',
      },
      {
        internalType: 'uint256',
        name: 'gas',
        type: 'uint256',
      },
    ],
    name: 'setDestinationGas',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: 'uint32',
            name: 'domain',
            type: 'uint32',
          },
          {
            internalType: 'uint256',
            name: 'gas',
            type: 'uint256',
          },
        ],
        internalType: 'struct GasRouter.GasRouterConfig[]',
        name: 'gasConfigs',
        type: 'tuple[]',
      },
    ],
    name: 'setDestinationGas',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_hook',
        type: 'address',
      },
    ],
    name: 'setHook',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_module',
        type: 'address',
      },
    ],
    name: 'setInterchainSecurityModule',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_newMinAmount',
        type: 'uint256',
      },
    ],
    name: 'setMinInvestmentAmount',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint32',
        name: 'domain',
        type: 'uint32',
      },
      {
        internalType: 'bytes32',
        name: 'recipient',
        type: 'bytes32',
      },
    ],
    name: 'setRecipient',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'newOwner',
        type: 'address',
      },
    ],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint32',
        name: '_destination',
        type: 'uint32',
      },
      {
        internalType: 'bytes32',
        name: '_recipient',
        type: 'bytes32',
      },
      {
        internalType: 'bytes32',
        name: '_beneficiary',
        type: 'bytes32',
      },
      {
        internalType: 'uint256',
        name: '_amountOrId',
        type: 'uint256',
      },
    ],
    name: 'transferRemote',
    outputs: [
      {
        internalType: 'bytes32',
        name: 'messageId',
        type: 'bytes32',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint32',
        name: '_domain',
        type: 'uint32',
      },
    ],
    name: 'unenrollRemoteRouter',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint32[]',
        name: '_domains',
        type: 'uint32[]',
      },
    ],
    name: 'unenrollRemoteRouters',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'wrappedToken',
    outputs: [
      {
        internalType: 'contract IERC20',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export default HypERC20Coll_ABI;
