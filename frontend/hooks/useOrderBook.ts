'use client'

import { useState, useEffect, useRef } from 'react'
import { wsClient } from '../lib/viem'

// ─── Event types ──────────────────────────────────────────────────────────────

export interface CommitEvent {
  orderId:     bigint
  agent:       string
  commitment:  string
  blockNumber: bigint
}

export interface RevealEvent {
  orderId:     bigint
  agent:       string
  price:       bigint
  amount:      bigint
  direction:   number  // 0 = BID, 1 = ASK
  blockNumber: bigint
}

export interface MatchEvent {
  bidId:    bigint
  askId:    bigint
  price:    bigint
  amount:   bigint
  fee:      bigint
  bidAgent: string
  askAgent: string
}

// ─── ABI (events only) ────────────────────────────────────────────────────────

const CLOB_ABI = [
  {
    name: 'OrderCommitted',
    type: 'event',
    inputs: [
      { name: 'orderId',     type: 'uint256', indexed: true  },
      { name: 'agent',       type: 'address', indexed: true  },
      { name: 'commitment',  type: 'bytes32', indexed: false },
      { name: 'blockNumber', type: 'uint256', indexed: false },
    ],
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
      { name: 'blockNumber', type: 'uint256', indexed: false },
    ],
  },
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
      { name: 'askAgent', type: 'address', indexed: false },
    ],
  },
] as const

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOrderBook() {
  const clobAddress = process.env.NEXT_PUBLIC_CLOB_ADDRESS as `0x${string}` | undefined

  const [commits,     setCommits]     = useState<CommitEvent[]>([])
  const [reveals,     setReveals]     = useState<RevealEvent[]>([])
  const [matches,     setMatches]     = useState<MatchEvent[]>([])
  const [blockNumber, setBlockNumber] = useState<bigint>(BigInt(0))
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [isLive,      setIsLive]      = useState(false)

  const cleanupRef = useRef<Array<() => void>>([])

  useEffect(() => {
    // Guard: contract address required
    if (!clobAddress) {
      setLoading(false)
      setIsLive(false)
      return
    }

    const cleanups: Array<() => void> = []

    try {
      // 1. Watch block number
      const unwatchBlock = wsClient.watchBlockNumber({
        onBlockNumber: (n) => {
          setBlockNumber(n)
          setLoading(false)
          setIsLive(true)
          setError(null)
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'WebSocket error')
          setIsLive(false)
        },
      })
      cleanups.push(unwatchBlock)

      // 2. Watch OrderCommitted
      const unwatchCommits = wsClient.watchContractEvent({
        address: clobAddress,
        abi: CLOB_ABI,
        eventName: 'OrderCommitted',
        onLogs: (logs) => {
          setCommits((prev) => {
            const next = [...prev]
            for (const log of logs) {
              const { orderId, agent, commitment, blockNumber: bn } = log.args as {
                orderId: bigint; agent: string; commitment: string; blockNumber: bigint
              }
              next.unshift({ orderId, agent, commitment, blockNumber: bn })
            }
            return next.slice(0, 10)
          })
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'OrderCommitted watch error')
        },
      })
      cleanups.push(unwatchCommits)

      // 3. Watch OrderRevealed
      const unwatchReveals = wsClient.watchContractEvent({
        address: clobAddress,
        abi: CLOB_ABI,
        eventName: 'OrderRevealed',
        onLogs: (logs) => {
          setReveals((prev) => {
            const next = [...prev]
            for (const log of logs) {
              const { orderId, agent, price, amount, direction, blockNumber: bn } = log.args as {
                orderId: bigint; agent: string; price: bigint; amount: bigint;
                direction: number; blockNumber: bigint
              }
              next.unshift({ orderId, agent, price, amount, direction, blockNumber: bn })
            }
            return next.slice(0, 10)
          })
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'OrderRevealed watch error')
        },
      })
      cleanups.push(unwatchReveals)

      // 4. Watch OrderMatched
      const unwatchMatches = wsClient.watchContractEvent({
        address: clobAddress,
        abi: CLOB_ABI,
        eventName: 'OrderMatched',
        onLogs: (logs) => {
          setMatches((prev) => {
            const next = [...prev]
            for (const log of logs) {
              const { bidId, askId, price, amount, fee, bidAgent, askAgent } = log.args as {
                bidId: bigint; askId: bigint; price: bigint; amount: bigint;
                fee: bigint; bidAgent: string; askAgent: string
              }
              next.unshift({ bidId, askId, price, amount, fee, bidAgent, askAgent })
            }
            return next.slice(0, 20)
          })
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'OrderMatched watch error')
        },
      })
      cleanups.push(unwatchMatches)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect WebSocket')
      setIsLive(false)
      setLoading(false)
    }

    cleanupRef.current = cleanups
    return () => {
      for (const fn of cleanupRef.current) fn()
      cleanupRef.current = []
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clobAddress])

  return { commits, reveals, matches, blockNumber, loading, error, isLive }
}
