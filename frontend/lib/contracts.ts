import { createPublicClient, webSocket, http, fallback, formatUnits } from 'viem'
import { somniaTestnet } from './chain'
import { CLOB_ABI, REGISTRY_ABI } from './abis'

const wsUrl =
  process.env.NEXT_PUBLIC_SOMNIA_WS_URL ||
  'wss://api.infra.testnet.somnia.network/ws'
const httpUrl =
  process.env.NEXT_PUBLIC_SOMNIA_RPC_URL ||
  'https://dream-rpc.somnia.network'

// WebSocket first; HTTP fallback when WS is unavailable
export const publicClient = createPublicClient({
  chain: somniaTestnet,
  transport: fallback([webSocket(wsUrl), http(httpUrl)]),
})

// Contract addresses from environment — undefined when not configured
export const ADDRESSES = {
  clob:     process.env.NEXT_PUBLIC_CLOB_ADDRESS      as `0x${string}` | undefined,
  registry: process.env.NEXT_PUBLIC_REGISTRY_ADDRESS  as `0x${string}` | undefined,
  tokenA:   process.env.NEXT_PUBLIC_TOKEN_A_ADDRESS   as `0x${string}` | undefined,
  tokenB:   process.env.NEXT_PUBLIC_TOKEN_B_ADDRESS   as `0x${string}` | undefined,
}

// Types matching the contract events
export interface CommitEvent {
  id: string
  orderId: string
  agent: string
  agentShort: string
  hash: string
  block: number
  timestamp: number
}

export interface RevealEvent {
  id: string
  orderId: string
  agent: string
  agentShort: string
  direction: 'BID' | 'ASK'
  price: string // formatted USDC
  amount: string // formatted WETH
  timestamp: number
}

export interface MatchEvent {
  id: string
  bidId: string
  askId: string
  price: string
  amount: string
  fee: string
  bidAgent: string
  askAgent: string
  timestamp: number
}

// Helper to shorten addresses: 0x1234...5678
export function shortAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

// Helper to format bigint price (18 decimals) to readable string
export function formatPrice(raw: bigint): string {
  return parseFloat(formatUnits(raw, 18)).toFixed(2)
}

// Helper to format bigint amount (18 decimals) to readable string
export function formatAmount(raw: bigint): string {
  return parseFloat(formatUnits(raw, 18)).toFixed(4)
}

// Watch OrderCommitted events — calls onCommit for each new event
export function watchCommits(onCommit: (event: CommitEvent) => void): () => void {
  if (!ADDRESSES.clob) return () => {}

  const unwatch = publicClient.watchContractEvent({
    address: ADDRESSES.clob,
    abi: CLOB_ABI,
    eventName: 'OrderCommitted',
    onLogs: (logs) => {
      logs.forEach((log) => {
        const args = log.args as any
        onCommit({
          id: `commit-${args.orderId}-${Date.now()}`,
          orderId: args.orderId?.toString() || '0',
          agent: args.agent || '',
          agentShort: shortAddress(args.agent || ''),
          hash: args.commitment
            ? `${args.commitment.slice(2, 10)}...${args.commitment.slice(-4)}`
            : '...',
          block: Number(args.blockNumber || 0),
          timestamp: Date.now(),
        })
      })
    },
  })

  return unwatch
}

// Watch OrderRevealed events
export function watchReveals(onReveal: (event: RevealEvent) => void): () => void {
  if (!ADDRESSES.clob) return () => {}

  const unwatch = publicClient.watchContractEvent({
    address: ADDRESSES.clob,
    abi: CLOB_ABI,
    eventName: 'OrderRevealed',
    onLogs: (logs) => {
      logs.forEach((log) => {
        const args = log.args as any
        onReveal({
          id: `reveal-${args.orderId}-${Date.now()}`,
          orderId: args.orderId?.toString() || '0',
          agent: args.agent || '',
          agentShort: shortAddress(args.agent || ''),
          direction: args.direction === 0 ? 'BID' : 'ASK',
          price: formatPrice(args.price || BigInt(0)),
          amount: formatAmount(args.amount || BigInt(0)),
          timestamp: Date.now(),
        })
      })
    },
  })

  return unwatch
}

// Watch OrderMatched events
export function watchMatches(onMatch: (event: MatchEvent) => void): () => void {
  if (!ADDRESSES.clob) return () => {}

  const unwatch = publicClient.watchContractEvent({
    address: ADDRESSES.clob,
    abi: CLOB_ABI,
    eventName: 'OrderMatched',
    onLogs: (logs) => {
      logs.forEach((log) => {
        const args = log.args as any
        onMatch({
          id: `match-${args.bidId}-${args.askId}-${Date.now()}`,
          bidId: args.bidId?.toString() || '0',
          askId: args.askId?.toString() || '0',
          price: formatPrice(args.price || BigInt(0)),
          amount: formatAmount(args.amount || BigInt(0)),
          fee: formatAmount(args.fee || BigInt(0)),
          bidAgent: shortAddress(args.bidAgent || ''),
          askAgent: shortAddress(args.askAgent || ''),
          timestamp: Date.now(),
        })
      })
    },
  })

  return unwatch
}

// Read current block number
export async function getCurrentBlock(): Promise<number> {
  try {
    const block = await publicClient.getBlockNumber()
    return Number(block)
  } catch {
    return 0
  }
}

// Read all registered agents stats from registry
export async function getAgentStats(agentAddress: `0x${string}`) {
  if (!ADDRESSES.registry) return null
  try {
    const data = (await publicClient.readContract({
      address: ADDRESSES.registry,
      abi: REGISTRY_ABI,
      functionName: 'getAgent',
      args: [agentAddress],
    })) as any
    return {
      registered: data.registered,
      collateral: formatAmount(data.collateral),
      ordersExecuted: Number(data.ordersExecuted),
      totalVolume: formatPrice(data.totalVolume),
      feesEarned: formatAmount(data.feesEarned),
      slashCount: Number(data.slashCount),
    }
  } catch {
    return null
  }
}
