'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  watchCommits,
  watchReveals,
  watchMatches,
  getCurrentBlock,
  type CommitEvent,
  type RevealEvent,
  type MatchEvent,
} from '../lib/contracts'

const MAX_ROWS = 5 // max rows visible in each table
const MAX_TICKER = 20 // max events in ticker

export interface TickerItem {
  id: string
  type: 'commit' | 'reveal' | 'match'
  text: string
  timestamp: number
}

export interface LiveMetrics {
  totalMatches: number
  totalVolume: number // in USDC
  activeOrders: number
  blockNumber: number
}

export function useVeilForge() {
  const [commits, setCommits] = useState<CommitEvent[]>([])
  const [reveals, setReveals] = useState<RevealEvent[]>([])
  const [ticker, setTicker] = useState<TickerItem[]>([])
  const [metrics, setMetrics] = useState<LiveMetrics>({
    totalMatches: 0,
    totalVolume: 0,
    activeOrders: 0,
    blockNumber: 0,
  })
  const [isConnected, setIsConnected] = useState(false)

  // Add to ticker helper
  const addTicker = useCallback((item: TickerItem) => {
    setTicker((prev) => [item, ...prev].slice(0, MAX_TICKER))
  }, [])

  // Handle new commit
  const handleCommit = useCallback(
    (event: CommitEvent) => {
      setCommits((prev) => [event, ...prev].slice(0, MAX_ROWS))
      setMetrics((prev) => ({ ...prev, activeOrders: prev.activeOrders + 1 }))
      addTicker({
        id: `t-${event.id}`,
        type: 'commit',
        text: `Agent ${event.agentShort} committed · ${event.hash}`,
        timestamp: event.timestamp,
      })
    },
    [addTicker]
  )

  // Handle new reveal
  const handleReveal = useCallback(
    (event: RevealEvent) => {
      setReveals((prev) => [event, ...prev].slice(0, MAX_ROWS))
      // Remove from commits when revealed
      setCommits((prev) => prev.filter((c) => c.orderId !== event.orderId))
      addTicker({
        id: `t-${event.id}`,
        type: 'reveal',
        text: `${event.agentShort} revealed ${event.direction} ${event.amount} WETH @ ${event.price} USDC`,
        timestamp: event.timestamp,
      })
    },
    [addTicker]
  )

  // Handle new match
  const handleMatch = useCallback(
    (event: MatchEvent) => {
      // Remove matched orders from reveals
      setReveals((prev) =>
        prev.filter((r) => r.orderId !== event.bidId && r.orderId !== event.askId)
      )
      setMetrics((prev) => ({
        ...prev,
        totalMatches: prev.totalMatches + 1,
        totalVolume: prev.totalVolume + parseFloat(event.price),
        activeOrders: Math.max(0, prev.activeOrders - 2),
      }))
      addTicker({
        id: `t-${event.id}`,
        type: 'match',
        text: `⚡ MATCH ${event.bidAgent} ↔ ${event.askAgent} — ${event.amount} WETH @ ${event.price} USDC`,
        timestamp: event.timestamp,
      })
    },
    [addTicker]
  )

  // Block number polling — marks connected when chain responds
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_CLOB_ADDRESS) {
      setIsConnected(false)
      return
    }

    let cancelled = false

    const poll = async () => {
      const block = await getCurrentBlock()
      if (cancelled) return
      if (block > 0) {
        setMetrics((prev) => ({ ...prev, blockNumber: block }))
        setIsConnected(true)
      }
    }

    poll()
    const interval = setInterval(poll, 1000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  // WebSocket event subscriptions
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_CLOB_ADDRESS) return () => {}
    const unwatchCommits = watchCommits(handleCommit)
    const unwatchReveals = watchReveals(handleReveal)
    const unwatchMatches = watchMatches(handleMatch)

    return () => {
      unwatchCommits()
      unwatchReveals()
      unwatchMatches()
    }
  }, [handleCommit, handleReveal, handleMatch])

  return {
    commits,
    reveals,
    ticker,
    metrics,
    isConnected,
  }
}
