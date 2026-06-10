import { createPublicClient, http, webSocket } from 'viem'
import { somniaTestnet } from './chain'

export { somniaTestnet }

/** HTTP public client — for one-off reads and polling */
export const publicClient = createPublicClient({
  chain: somniaTestnet,
  transport: http('https://api.infra.testnet.somnia.network/'),
})

/** WebSocket public client — for real-time event watching */
export const wsClient = createPublicClient({
  chain: somniaTestnet,
  transport: webSocket('wss://api.infra.testnet.somnia.network/ws', {
    reconnect: { attempts: 3, delay: 1000 },
  }),
})
