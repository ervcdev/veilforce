export interface CommitRow {
  id: string
  agent: string
  agentShort: string
  hash: string
  block: number
  timestamp: number
}

export interface RevealRow {
  id: string
  agent: string
  agentShort: string
  direction: 'BID' | 'ASK'
  price: number
  amount: number
  timestamp: number
}

export interface TickerEvent {
  id: string
  type: 'commit' | 'reveal' | 'match'
  text: string
  timestamp: number
}

export interface AgentStats {
  address: string
  short: string
  strategy: 'MARKET MAKER' | 'ARBITRAGE' | 'CONSERVATIVE'
  spread: number
  orders: number
  pnl: number
  isGlowing: boolean
}

export interface Metrics {
  tps: number
  matches: number
  volume: number
  activeOrders: number
  avgReveal: number
}

export interface OrderBookLevel {
  price: number
  amount: number
  total: number
}

export interface OrderBookData {
  bids: OrderBookLevel[]
  asks: OrderBookLevel[]
  spread: number
  midPrice: number
}
