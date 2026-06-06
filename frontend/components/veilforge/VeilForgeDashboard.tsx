"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { Shield } from 'lucide-react'

// Types
interface CommitRow {
  id: string
  agent: string
  agentShort: string
  hash: string
  hashShort: string
  block: number
  timestamp: number
  isNew: boolean
}

interface RevealRow {
  id: string
  agent: string
  agentShort: string
  direction: 'BID' | 'ASK'
  price: number
  amount: number
  timestamp: number
  isNew: boolean
  matching?: boolean
}

interface TickerEvent {
  id: string
  type: 'commit' | 'reveal' | 'match'
  text: string
  timestamp: number
}

interface Metrics {
  tps: number
  matches: number
  volume: number
  activeOrders: number
  avgReveal: number
}

interface BestRate {
  agentAddress: string
  agentShort: string
  spread: number
  wethOutput: number
}

// Agents
const AGENTS = [
  { address: '0x1234567890abcdef5678', short: '0x1234...5678', strategy: 'MARKET MAKER' as const },
  { address: '0x8765432109abcdef4321', short: '0x8765...4321', strategy: 'ARBITRAGE' as const },
  { address: '0xABCDEF0123456789EF01', short: '0xABCD...EF01', strategy: 'CONSERVATIVE' as const },
]

// Helpers
const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
const randomHex = (len: number) => Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('')
const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min

export default function VeilForgeDashboard() {
  // State
  const [commits, setCommits] = useState<CommitRow[]>([])
  const [reveals, setReveals] = useState<RevealRow[]>([])
  const [ticker, setTicker] = useState<TickerEvent[]>([])
  const [metrics, setMetrics] = useState<Metrics>({
    tps: 247,
    matches: 1842,
    volume: 127543,
    activeOrders: 342,
    avgReveal: 1.24,
  })
  const [blockNumber, setBlockNumber] = useState(19847523)
  const blockNumberRef = useRef(19847523)
  const matchedIdsRef = useRef<Set<string>>(new Set())
  const [glowingAgent, setGlowingAgent] = useState<string | null>(null)
  const [bestRate, setBestRate] = useState<BestRate>({
    agentAddress: AGENTS[0].address,
    agentShort: AGENTS[0].short,
    spread: 0.25,
    wethOutput: 0.3342,
  })
  const [inputAmount, setInputAmount] = useState('1000')
  const [flashingMetric, setFlashingMetric] = useState<string | null>(null)
  const [agentStats, setAgentStats] = useState([
    { ...AGENTS[0], spread: 0.12, orders: 47, pnl: 1247.50, activity: 75, lastAction: 'BID 1.20 WETH @ 3002' },
    { ...AGENTS[1], spread: 0.08, orders: 31, pnl: 892.30, activity: 45, lastAction: 'ASK 0.85 WETH @ 2998' },
    { ...AGENTS[2], spread: 0.18, orders: 18, pnl: 234.80, activity: 25, lastAction: 'BID 0.40 WETH @ 2995' },
  ])

  // Block number increment
  useEffect(() => {
    const interval = setInterval(() => {
      setBlockNumber(prev => {
        const newVal = prev + 1
        blockNumberRef.current = newVal
        return newVal
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Best rate update
  useEffect(() => {
    const interval = setInterval(() => {
      const agent = AGENTS[Math.floor(Math.random() * AGENTS.length)]
      const amount = parseFloat(inputAmount) || 1000
      setBestRate({
        agentAddress: agent.address,
        agentShort: agent.short,
        spread: randomInRange(0.15, 0.35),
        wethOutput: amount / randomInRange(2995, 3005),
      })
    }, 2000)
    return () => clearInterval(interval)
  }, [inputAmount])

  // Flash metric helper
  const flashMetric = useCallback((metricName: string) => {
    setFlashingMetric(metricName)
    setTimeout(() => setFlashingMetric(null), 200)
  }, [])

  // Main simulation cycle
  useEffect(() => {
    const interval = setInterval(() => {
      // Pick random agent
      const agent = AGENTS[Math.floor(Math.random() * AGENTS.length)]
      const hash = `${randomHex(8)}...${randomHex(4)}`
      
      // Create commit
      const newCommit: CommitRow = {
        id: generateId(),
        agent: agent.address,
        agentShort: agent.short,
        hash: `0x${randomHex(64)}`,
        hashShort: hash,
        block: blockNumberRef.current,
        timestamp: Date.now(),
        isNew: true,
      }
      
      setCommits(prev => {
        const updated = [newCommit, ...prev.map(c => ({ ...c, isNew: false }))]
        return updated.slice(0, 5)
      })
      
      // Add ticker event
      setTicker(prev => {
        const event: TickerEvent = {
          id: generateId(),
          type: 'commit',
          text: `Agent ${agent.short} committed · ${hash}`,
          timestamp: Date.now(),
        }
        return [event, ...prev].slice(0, 20)
      })
      
      // Trigger glow
      setGlowingAgent(agent.address)
      setTimeout(() => setGlowingAgent(null), 600)
      
      // Update agent stats + last action for the glowing agent
      const actionDir = Math.random() < 0.5 ? 'BID' : 'ASK'
      const actionAmount = randomInRange(0.4, 1.8).toFixed(2)
      const actionPrice = randomInRange(2992, 3008).toFixed(0)
      const newLastAction = `${actionDir} ${actionAmount} WETH @ ${actionPrice}`
      setAgentStats(prev => prev.map(a => 
        a.address === agent.address 
          ? { ...a, orders: a.orders + 1, activity: Math.min(100, a.activity + 5), lastAction: newLastAction }
          : { ...a, activity: Math.max(10, a.activity - 2) }
      ))
      
      // Schedule reveal after 2500ms
      setTimeout(() => {
        // Roughly 50/50 BID/ASK
        const direction: 'BID' | 'ASK' = Math.random() < 0.5 ? 'BID' : 'ASK'
        // BIDs cluster slightly higher, ASKs slightly lower so they cross often
        const price = direction === 'BID'
          ? randomInRange(2998, 3008)
          : randomInRange(2992, 3002)
        const amount = randomInRange(0.5, 2)

        const newReveal: RevealRow = {
          id: generateId(),
          agent: agent.address,
          agentShort: agent.short,
          direction,
          price,
          amount,
          timestamp: Date.now(),
          isNew: true,
        }

        // Add reveal ticker event
        setTicker(prev => {
          const event: TickerEvent = {
            id: generateId(),
            type: 'reveal',
            text: `${agent.short} revealed ${direction} ${amount.toFixed(2)} WETH @ ${price.toFixed(0)} USDC`,
            timestamp: Date.now(),
          }
          return [event, ...prev].slice(0, 20)
        })

        // Active orders go UP on each reveal
        setMetrics(prev => {
          flashMetric('activeOrders')
          flashMetric('tps')
          return {
            ...prev,
            activeOrders: prev.activeOrders + 1,
            tps: Math.floor(randomInRange(340, 420)),
          }
        })

        // Insert reveal, then look for a crossing counterparty already on the book
        setReveals(prev => {
          const withNew = [newReveal, ...prev.map(r => ({ ...r, isNew: false }))]

          // Find an opposing order that crosses: BID price >= ASK price
          const counterparty = withNew.find(r => {
            if (r.id === newReveal.id) return false
            if (matchedIdsRef.current.has(r.id)) return false
            if (r.direction === newReveal.direction) return false
            const bid = newReveal.direction === 'BID' ? newReveal : r
            const ask = newReveal.direction === 'ASK' ? newReveal : r
            return bid.price >= ask.price
          })

          if (counterparty) {
            const bid = newReveal.direction === 'BID' ? newReveal : counterparty
            const ask = newReveal.direction === 'ASK' ? newReveal : counterparty
            const fillAmount = Math.min(bid.amount, ask.amount)
            const fillPrice = (bid.price + ask.price) / 2

            // Mark both as matched so we don't double-match
            matchedIdsRef.current.add(newReveal.id)
            matchedIdsRef.current.add(counterparty.id)

            // Emit MATCH ticker event
            setTicker(t => {
              const event: TickerEvent = {
                id: generateId(),
                type: 'match',
                text: `MATCH ${bid.agentShort} ↔ ${ask.agentShort} — ${fillAmount.toFixed(2)} WETH @ ${fillPrice.toFixed(0)} USDC`,
                timestamp: Date.now(),
              }
              return [event, ...t].slice(0, 20)
            })

            // Matches +1, volume up, active orders down by 2 (both filled)
            setMetrics(m => {
              flashMetric('matches')
              flashMetric('volume')
              flashMetric('activeOrders')
              return {
                ...m,
                matches: m.matches + 1,
                volume: m.volume + fillAmount * fillPrice,
                activeOrders: Math.max(0, m.activeOrders - 2),
                tps: Math.floor(randomInRange(340, 420)),
                avgReveal: parseFloat(randomInRange(0.9, 1.6).toFixed(2)),
              }
            })

            // Flash both matched rows in cyan, then remove them shortly after
            const flagged = withNew.map(r =>
              r.id === newReveal.id || r.id === counterparty.id
                ? { ...r, matching: true }
                : r
            )

            setTimeout(() => {
              setReveals(curr => curr.filter(r => r.id !== newReveal.id && r.id !== counterparty.id))
              matchedIdsRef.current.delete(newReveal.id)
              matchedIdsRef.current.delete(counterparty.id)
            }, 600)

            return flagged.slice(0, 6)
          }

          return withNew.slice(0, 6)
        })
      }, 2500)
    }, 1500)
    
    return () => clearInterval(interval)
  }, [flashMetric])

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');
        .font-mono-jetbrains { font-family: 'JetBrains Mono', monospace; }
        @keyframes ticker {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .animate-ticker { animation: ticker 25s linear infinite; }
        .animate-ticker:hover { animation-play-state: paused; }
        @keyframes row-enter {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .row-enter { animation: row-enter 300ms ease-out forwards; }
        .flash-white { color: white !important; transition: color 200ms; }
        @keyframes match-flash {
          0%, 100% { background: rgba(0, 212, 255, 0.35); }
          50% { background: rgba(0, 212, 255, 0.7); }
        }
        .row-matching { animation: match-flash 300ms ease-in-out 2; }
      `}</style>
      
      <div className="h-screen w-full flex flex-col overflow-hidden" style={{ background: '#0a0a0f', minWidth: '1280px' }}>
        {/* TOP BAR */}
        <div className="h-12 flex items-center justify-between px-4" style={{ background: '#080810', borderBottom: '1px solid #1a1a2e' }}>
          <div className="font-mono-jetbrains font-bold text-xl" style={{ color: '#00d4ff' }}>VEILFORGE</div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm" style={{ color: '#666680' }}>SOMNIA TESTNET</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono-jetbrains text-xs text-white">BLOCK #{blockNumber.toLocaleString()}</span>
            <span style={{ color: '#1a1a2e' }}>|</span>
            <span className="text-xs" style={{ color: '#00d4ff' }}>3 AGENTS ACTIVE</span>
          </div>
        </div>
        
        {/* METRICS BAR */}
        <div className="h-[72px] flex gap-3 p-3" style={{ background: '#0a0a0f' }}>
          {[
            { key: 'tps', label: 'TPS', value: metrics.tps.toLocaleString() },
            { key: 'matches', label: 'MATCHES', value: metrics.matches.toLocaleString() },
            { key: 'volume', label: 'VOLUME (USDC)', value: `$${metrics.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
            { key: 'activeOrders', label: 'ACTIVE ORDERS', value: metrics.activeOrders.toLocaleString() },
            { key: 'avgReveal', label: 'AVG REVEAL (ms)', value: metrics.avgReveal.toFixed(2) },
          ].map(metric => (
            <div 
              key={metric.key} 
              className="flex-1 rounded p-3"
              style={{ background: '#0d0d14', border: '1px solid #1a1a2e' }}
            >
              <div className="text-xs uppercase" style={{ color: '#666680' }}>{metric.label}</div>
              <div 
                className={`font-mono-jetbrains text-lg font-bold mt-1 transition-colors duration-200 ${flashingMetric === metric.key ? 'flash-white' : ''}`}
                style={{ color: flashingMetric === metric.key ? 'white' : '#00d4ff' }}
              >
                {metric.value}
              </div>
            </div>
          ))}
        </div>
        
        {/* THREE PANELS */}
        <div className="flex-1 flex gap-3 px-3 pb-0 overflow-hidden">
          {/* LEFT PANEL - ORDERBOOK */}
          <div className="w-[40%] flex flex-col gap-3">
            {/* COMMITS */}
            <div className="flex-1 flex flex-col overflow-hidden rounded" style={{ background: '#0d0d14', border: '1px solid #1a1a2e' }}>
              <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: '#1a1a2e' }}>
                <span className="text-xs uppercase tracking-widest" style={{ color: '#666680' }}>COMMITS</span>
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#1a1a2e', color: '#00d4ff' }}>{commits.length}</span>
              </div>
              <div className="flex-1 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: '#111118' }}>
                      <th className="text-left p-2 font-normal" style={{ color: '#666680' }}>AGENT</th>
                      <th className="text-left p-2 font-normal" style={{ color: '#666680' }}>HASH</th>
                      <th className="text-left p-2 font-normal" style={{ color: '#666680' }}>BLOCK</th>
                      <th className="text-left p-2 font-normal" style={{ color: '#666680' }}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commits.map(commit => (
                      <tr 
                        key={commit.id} 
                        className={commit.isNew ? 'row-enter' : ''}
                        style={{ background: '#111118', borderBottom: '1px solid #1a1a2e' }}
                      >
                        <td className="p-2 font-mono-jetbrains" style={{ color: '#666680' }}>{commit.agentShort}</td>
                        <td className="p-2 font-mono-jetbrains" style={{ color: '#00d4ff' }}>{commit.hashShort}</td>
                        <td className="p-2 font-mono-jetbrains text-white">{commit.block}</td>
                        <td className="p-2">
                          <span className="px-1 rounded text-xs" style={{ background: '#1a1a2e', color: '#666680' }}>PENDING</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* REVEALS */}
            <div className="flex-1 flex flex-col overflow-hidden rounded" style={{ background: '#0d0d14', border: '1px solid #1a1a2e' }}>
              <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: '#1a1a2e' }}>
                <span className="text-xs uppercase tracking-widest" style={{ color: '#666680' }}>REVEALS</span>
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#1a1a2e', color: '#00d4ff' }}>{reveals.length}</span>
              </div>
              <div className="flex-1 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: '#111118' }}>
                      <th className="text-left p-2 font-normal" style={{ color: '#666680' }}>AGENT</th>
                      <th className="text-left p-2 font-normal" style={{ color: '#666680' }}>DIR</th>
                      <th className="text-left p-2 font-normal" style={{ color: '#666680' }}>PRICE</th>
                      <th className="text-left p-2 font-normal" style={{ color: '#666680' }}>AMOUNT</th>
                      <th className="text-left p-2 font-normal" style={{ color: '#666680' }}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reveals.map(reveal => (
                      <tr 
                        key={reveal.id}
                        className={`${reveal.isNew ? 'row-enter' : ''} ${reveal.matching ? 'row-matching' : ''}`}
                        style={{ 
                          background: '#111118', 
                          borderBottom: '1px solid #1a1a2e',
                          borderLeft: `2px solid ${reveal.matching ? '#00d4ff' : reveal.direction === 'BID' ? '#00ff88' : '#ff4466'}`,
                        }}
                      >
                        <td className="p-2 font-mono-jetbrains" style={{ color: '#666680' }}>{reveal.agentShort}</td>
                        <td className="p-2">
                          <span 
                            className="px-1 rounded text-xs"
                            style={{ 
                              background: reveal.direction === 'BID' ? '#003322' : '#330011',
                              color: reveal.direction === 'BID' ? '#00ff88' : '#ff4466',
                            }}
                          >
                            {reveal.direction}
                          </span>
                        </td>
                        <td className="p-2 font-mono-jetbrains text-white">{reveal.price.toFixed(2)} USDC</td>
                        <td className="p-2 font-mono-jetbrains" style={{ color: '#666680' }}>{reveal.amount.toFixed(2)} WETH</td>
                        <td className="p-2">
                          <span className="px-1 rounded text-xs" style={{ background: '#001a22', color: '#00d4ff' }}>REVEALED</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          {/* CENTER PANEL - SWAP */}
          <div className="w-[30%]">
            <div 
              className="h-full rounded-lg p-6 flex flex-col"
              style={{ background: '#0d0d14', border: '1px solid rgba(0, 212, 255, 0.3)' }}
            >
              <div className="text-xs uppercase tracking-widest font-bold" style={{ color: '#00d4ff' }}>BEST AVAILABLE RATE</div>
              <div className="text-xs mt-1" style={{ color: '#666680' }}>Protected by commit-reveal cryptography</div>
              
              <div className="mt-6">
                <label className="text-xs" style={{ color: '#666680' }}>YOU PAY</label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    value={inputAmount}
                    onChange={(e) => setInputAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-3 rounded font-mono-jetbrains text-xl text-white outline-none"
                    style={{ background: '#111118', border: '1px solid #1a1a2e' }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#666680' }}>USDC</span>
                </div>
              </div>
              
              <div className="mt-4">
                <label className="text-xs" style={{ color: '#666680' }}>YOU RECEIVE</label>
                <div 
                  className="relative mt-1 p-3 rounded font-mono-jetbrains text-xl text-white"
                  style={{ background: '#0a0a0f', border: '1px solid #1a1a2e' }}
                >
                  {bestRate.wethOutput.toFixed(6)}
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#666680' }}>WETH</span>
                </div>
              </div>
              
              <div className="mt-2 font-mono-jetbrains text-xs" style={{ color: '#666680' }}>
                via Agent-{bestRate.agentShort} | spread: {bestRate.spread.toFixed(2)}%
              </div>
              
              <button 
                className="w-full mt-4 py-3 font-bold rounded-lg text-sm uppercase tracking-widest transition-colors cursor-pointer"
                style={{ background: '#00d4ff', color: '#0a0a0f' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#00b8d9'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#00d4ff'}
              >
                SWAP NOW
              </button>
              
              <div className="mt-3 text-xs text-center" style={{ color: '#666680' }}>
                No frontrunning possible — orders are cryptographically hidden until execution
              </div>
              
              <div className="mt-2 flex justify-center">
                <span 
                  className="inline-flex items-center gap-1 text-xs rounded-full px-3 py-1"
                  style={{ background: '#001a22', color: '#00ff88' }}
                >
                  <Shield size={12} />
                  MEV PROTECTED
                </span>
              </div>
            </div>
          </div>
          
          {/* RIGHT PANEL - AGENT HEATMAP */}
          <div className="w-[30%] flex flex-col">
            <div className="text-xs uppercase tracking-widest mb-3" style={{ color: '#666680' }}>AGENT COMPETITION</div>
            <div className="flex flex-col gap-4 flex-1">
              {agentStats.map(agent => (
                <div 
                  key={agent.address}
                  className="rounded-lg p-4 transition-shadow duration-300"
                  style={{ 
                    background: '#0d0d14', 
                    border: '1px solid #1a1a2e',
                    boxShadow: glowingAgent === agent.address 
                      ? '0 0 0 1px #00d4ff, 0 0 12px rgba(0, 212, 255, 0.2)' 
                      : 'none',
                  }}
                >
                  <div className="flex items-center">
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ 
                        background: agent.strategy === 'MARKET MAKER' ? '#00ff88' : '#ffaa00',
                      }}
                    />
                    <span className="font-mono-jetbrains text-xs text-white ml-2">{agent.short}</span>
                    <span 
                      className="ml-auto text-xs px-2 py-0.5 rounded font-medium"
                      style={{
                        background: agent.strategy === 'MARKET MAKER' ? 'rgb(30, 58, 138)' : agent.strategy === 'ARBITRAGE' ? 'rgb(124, 45, 18)' : 'rgb(88, 28, 135)',
                        color: agent.strategy === 'MARKET MAKER' ? 'rgb(147, 197, 253)' : agent.strategy === 'ARBITRAGE' ? 'rgb(253, 186, 116)' : 'rgb(216, 180, 254)',
                      }}
                    >
                      {agent.strategy}
                    </span>
                  </div>
                  
                  <div className="flex gap-4 mt-2">
                    <div>
                      <span className="text-xs" style={{ color: '#666680' }}>SPREAD</span>
                      <span className="font-mono-jetbrains text-xs text-white ml-1">{agent.spread.toFixed(2)}%</span>
                    </div>
                    <div>
                      <span className="text-xs" style={{ color: '#666680' }}>ORDERS</span>
                      <span className="font-mono-jetbrains text-xs text-white ml-1">{agent.orders}</span>
                    </div>
                    <div>
                      <span className="text-xs" style={{ color: '#666680' }}>P&L</span>
                      <span
                        className="font-mono-jetbrains text-xs ml-1"
                        style={{ color: agent.strategy === 'MARKET MAKER' ? '#00ff88' : agent.pnl < 500 ? '#ffaa00' : '#00ff88' }}
                      >
                        +${agent.pnl.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-2 h-2 rounded-full" style={{ background: '#1a1a2e' }}>
                    <div 
                      className="h-full rounded-full transition-all duration-300"
                      style={{ background: '#00d4ff', width: `${agent.activity}%` }}
                    />
                  </div>

                  <div className="font-mono-jetbrains text-xs mt-2" style={{ color: '#666680' }}>
                    LAST ACTION: {agent.lastAction}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* BOTTOM TICKER */}
        <div 
          className="h-11 flex items-center"
          style={{ background: '#080810', borderTop: '1px solid #1a1a2e' }}
        >
          <div 
            className="px-4 h-full flex items-center text-xs uppercase font-bold"
            style={{ color: '#00d4ff', borderRight: '1px solid #1a1a2e' }}
          >
            LIVE FEED
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="animate-ticker flex gap-8 whitespace-nowrap">
              {[...ticker, ...ticker].map((event, i) => (
                event.type === 'match' ? (
                  <span
                    key={`${event.id}-${i}`}
                    className="text-xs px-3 py-0.5 rounded-full font-medium"
                    style={{ background: '#00d4ff', color: '#0a0a0f' }}
                  >
                    {event.text}
                  </span>
                ) : (
                  <span
                    key={`${event.id}-${i}`}
                    className="text-xs"
                    style={{ color: event.type === 'commit' ? '#666680' : 'white' }}
                  >
                    {event.text}
                  </span>
                )
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
