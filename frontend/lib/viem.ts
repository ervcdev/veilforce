import { createPublicClient, defineChain, http, webSocket } from 'viem'

export const somniaTestnet = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://api.infra.testnet.somnia.network/'],
      webSocket: ['wss://api.infra.testnet.somnia.network/ws'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Somnia Explorer',
      url: 'https://shannon-explorer.somnia.network',
    },
  },
})

/** HTTP public client — for one-off reads and polling */
export const publicClient = createPublicClient({
  chain: somniaTestnet,
  transport: http(
    process.env.NEXT_PUBLIC_SOMNIA_RPC_URL ??
      'https://api.infra.testnet.somnia.network/',
  ),
})

/** WebSocket public client — for real-time event watching */
export const wsClient = createPublicClient({
  chain: somniaTestnet,
  transport: webSocket(
    process.env.NEXT_PUBLIC_SOMNIA_WS_URL ??
      'wss://api.infra.testnet.somnia.network/ws',
    { reconnect: { attempts: 3, delay: 1000 } },
  ),
})
