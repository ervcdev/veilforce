// [FIX A-9] OrderMatched reordenado — alineado con fix M-1 del contrato
// [FIX A-5] REGISTRY_ABI actualizado con activeOrders y tipos uint64
export const CLOB_ABI = [
  {
    name: 'commitOrder',
    type: 'function',
    inputs: [{ name: 'commitment', type: 'bytes32' }],
    outputs: [{ name: 'orderId', type: 'uint256' }],
    stateMutability: 'nonpayable'
  },
  {
    name: 'revealOrder',
    type: 'function',
    inputs: [
      { name: 'orderId',   type: 'uint256' },
      { name: 'price',     type: 'uint256' },
      { name: 'amount',    type: 'uint256' },
      { name: 'direction', type: 'uint8'   },
      { name: 'salt',      type: 'bytes32' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    name: 'matchOrders',
    type: 'function',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    name: 'orderCount',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    name: 'getOrder',
    type: 'function',
    inputs: [{ name: 'orderId', type: 'uint256' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'agent',       type: 'address' },
        { name: 'commitment',  type: 'bytes32' },
        { name: 'price',       type: 'uint256' },
        { name: 'amount',      type: 'uint256' },
        { name: 'direction',   type: 'uint8'   },
        { name: 'status',      type: 'uint8'   },
        { name: 'commitBlock', type: 'uint256' },
        { name: 'revealBlock', type: 'uint256' }
      ]
    }],
    stateMutability: 'view'
  },
  {
    name: 'getOpenBids',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'view'
  },
  {
    name: 'getOpenAsks',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'view'
  },
  {
    name: 'OrderCommitted',
    type: 'event',
    inputs: [
      { name: 'orderId',     type: 'uint256', indexed: true  },
      { name: 'agent',       type: 'address', indexed: true  },
      { name: 'commitment',  type: 'bytes32', indexed: false },
      { name: 'blockNumber', type: 'uint256', indexed: false }
    ]
  },
  {
    name: 'OrderRevealed',
    type: 'event',
    inputs: [
      { name: 'orderId',     type: 'uint256', indexed: true  },
      { name: 'agent',       type: 'address', indexed: true  },
      { name: 'price',       type: 'uint256', indexed: false },
      { name: 'amount',      type: 'uint256', indexed: false },
      { name: 'direction',   type: 'uint8',   indexed: false },
      { name: 'blockNumber', type: 'uint256', indexed: false }
    ]
  },
  // [FIX A-9] reordenado — alineado con fix M-1 del contrato
  {
    name: 'OrderMatched',
    type: 'event',
    inputs: [
      { name: 'bidId',    type: 'uint256', indexed: true  },
      { name: 'askId',    type: 'uint256', indexed: true  },
      { name: 'price',    type: 'uint256', indexed: false },
      { name: 'amount',   type: 'uint256', indexed: false },
      { name: 'fee',      type: 'uint256', indexed: false },
      { name: 'bidAgent', type: 'address', indexed: false },
      { name: 'askAgent', type: 'address', indexed: false }
    ]
  }
] as const

export const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount',  type: 'uint256' }
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable'
  },
  {
    name: 'allowance',
    type: 'function',
    inputs: [
      { name: 'owner',   type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view'
  }
] as const

// [FIX A-5] REGISTRY_ABI actualizado:
// - activeOrders agregado
// - tipos uint64 para registeredAt, slashCount, ordersExecuted
export const REGISTRY_ABI = [
  {
    name: 'registerAgent',
    type: 'function',
    inputs: [],
    outputs: [],
    stateMutability: 'payable'
  },
  {
    name: 'isRegistered',
    type: 'function',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view'
  },
  // [FIX A-5] tipos uint64 para campos empaquetados — alineado con fix H-1
  {
    name: 'getAgent',
    type: 'function',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'registeredAt',   type: 'uint64'  },
        { name: 'slashCount',     type: 'uint64'  },
        { name: 'ordersExecuted', type: 'uint64'  },
        { name: 'registered',     type: 'bool'    },
        { name: 'collateral',     type: 'uint256' },
        { name: 'totalVolume',    type: 'uint256' },
        { name: 'feesEarned',     type: 'uint256' }
      ]
    }],
    stateMutability: 'view'
  },
  // [FIX A-5] activeOrders agregado
  {
    name: 'activeOrders',
    type: 'function',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view'
  }
] as const