import type { 
  CommitRow, 
  RevealRow, 
  TickerEvent, 
  AgentStats, 
  Metrics, 
  OrderBookData,
  OrderBookLevel 
} from './types'

// Agent addresses pool
const AGENTS = [
  '0x7a16ff8270133f063aab6c9977183d9e72835428',
  '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
  '0x876eabf441b2ee5b5b0554fd502a8e0600950cfa',
  '0x9696f59e4d72e237be84ffd425dcad154bf96976',
  '0x0d0707963952f2fba59dd06f2b425ace40b492fe',
  '0x742d35cc6634c0532925a3b844bc9e7595f8ab91',
]

const STRATEGIES: AgentStats['strategy'][] = ['MARKET MAKER', 'ARBITRAGE', 'CONSERVATIVE']

let idCounter = 0
const generateId = () => `${Date.now()}-${++idCounter}`

const shortenAddress = (address: string) => 
  `${address.slice(0, 6)}...${address.slice(-4)}`

const randomInRange = (min: number, max: number) => 
  Math.random() * (max - min) + min

const randomAgent = () => {
  const address = AGENTS[Math.floor(Math.random() * AGENTS.length)]
  return { address, short: shortenAddress(address) }
}

// Generate a random commit
export function generateCommit(): CommitRow {
  const agent = randomAgent()
  return {
    id: generateId(),
    agent: agent.address,
    agentShort: agent.short,
    hash: `0x${Array.from({length: 64}, () => 
      Math.floor(Math.random() * 16).toString(16)).join('')}`,
    block: Math.floor(Date.now() / 12000) + 19000000,
    timestamp: Date.now(),
  }
}

// Generate a random reveal
export function generateReveal(basePrice: number): RevealRow {
  const agent = randomAgent()
  const direction = Math.random() > 0.5 ? 'BID' : 'ASK'
  const priceOffset = direction === 'BID' 
    ? -randomInRange(0.01, 0.5) 
    : randomInRange(0.01, 0.5)
  
  return {
    id: generateId(),
    agent: agent.address,
    agentShort: agent.short,
    direction,
    price: basePrice + priceOffset,
    amount: randomInRange(0.1, 5),
    timestamp: Date.now(),
  }
}

// Generate ticker events
export function generateTickerEvent(type: TickerEvent['type'], basePrice: number): TickerEvent {
  const agent = randomAgent()
  
  const texts: Record<TickerEvent['type'], string> = {
    commit: `COMMIT ${agent.short} → sealed order`,
    reveal: `REVEAL ${agent.short} ${Math.random() > 0.5 ? 'BID' : 'ASK'} @ $${basePrice.toFixed(2)}`,
    match: `MATCH ${randomInRange(0.1, 2).toFixed(3)} ETH @ $${basePrice.toFixed(2)}`,
  }
  
  return {
    id: generateId(),
    type,
    text: texts[type],
    timestamp: Date.now(),
  }
}

// Generate agent stats
export function generateAgentStats(): AgentStats[] {
  return AGENTS.map(address => ({
    address,
    short: shortenAddress(address),
    strategy: STRATEGIES[Math.floor(Math.random() * STRATEGIES.length)],
    spread: randomInRange(0.01, 0.15),
    orders: Math.floor(randomInRange(5, 50)),
    pnl: randomInRange(-500, 2000),
    isGlowing: Math.random() > 0.8,
  }))
}

// Generate metrics
export function generateMetrics(): Metrics {
  return {
    tps: Math.floor(randomInRange(120, 450)),
    matches: Math.floor(randomInRange(800, 2500)),
    volume: randomInRange(50000, 250000),
    activeOrders: Math.floor(randomInRange(150, 800)),
    avgReveal: randomInRange(0.8, 2.5),
  }
}

// Generate order book data
export function generateOrderBook(basePrice: number): OrderBookData {
  const levels = 12
  const bids: OrderBookLevel[] = []
  const asks: OrderBookLevel[] = []
  
  let bidTotal = 0
  let askTotal = 0
  
  for (let i = 0; i < levels; i++) {
    const bidPrice = basePrice - (i + 1) * randomInRange(0.05, 0.15)
    const bidAmount = randomInRange(0.5, 8)
    bidTotal += bidAmount
    bids.push({ price: bidPrice, amount: bidAmount, total: bidTotal })
    
    const askPrice = basePrice + (i + 1) * randomInRange(0.05, 0.15)
    const askAmount = randomInRange(0.5, 8)
    askTotal += askAmount
    asks.push({ price: askPrice, amount: askAmount, total: askTotal })
  }
  
  const spread = asks[0].price - bids[0].price
  const midPrice = (asks[0].price + bids[0].price) / 2
  
  return { bids, asks, spread, midPrice }
}

// Simulate price movement
export function simulatePriceChange(currentPrice: number): number {
  const change = (Math.random() - 0.5) * 2 // -1 to 1
  const volatility = 0.002 // 0.2% max change per tick
  return currentPrice * (1 + change * volatility)
}
