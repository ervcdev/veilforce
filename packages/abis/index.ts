import CommitRevealCLOBJson  from '../../contracts/out/CommitRevealCLOB.sol/CommitRevealCLOB.json'
import AgentRegistryJson     from '../../contracts/out/AgentRegistry.sol/AgentRegistry.json'
import ReactivityAdapterJson from '../../contracts/out/ReactivityAdapter.sol/ReactivityAdapter.json'
import MockERC20Json         from '../../contracts/out/MockERC20.sol/MockERC20.json'

// ABIs 
export const CLOB_ABI     = CommitRevealCLOBJson.abi  as const
export const REGISTRY_ABI = AgentRegistryJson.abi     as const
export const ADAPTER_ABI  = ReactivityAdapterJson.abi as const
export const ERC20_ABI    = MockERC20Json.abi         as const

// Chain config 
export const SOMNIA_CHAIN = {
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: {
    name:     'STT',
    symbol:   'STT',
    decimals: 18
  },
  rpcUrls: {
    default: {
      http:      ['https://api.infra.testnet.somnia.network/'],
      webSocket: ['wss://api.infra.testnet.somnia.network/ws']
    }
  },
  blockExplorers: {
    default: {
      name: 'Somnia Explorer',
      url:  'https://shannon-explorer.somnia.network'
    }
  }
} as const

// Addresses 
export const ADDRESSES = {
  clob:     process.env.COMMIT_REVEAL_CLOB_ADDRESS  as `0x${string}`,
  registry: process.env.AGENT_REGISTRY_ADDRESS      as `0x${string}`,
  adapter:  process.env.REACTIVITY_ADAPTER_ADDRESS  as `0x${string}`,
  tokenA:   process.env.TOKEN_A_ADDRESS             as `0x${string}`,
  tokenB:   process.env.TOKEN_B_ADDRESS             as `0x${string}`,
} as const