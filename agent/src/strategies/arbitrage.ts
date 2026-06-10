import { type OrderParams, type Direction } from '../commitReveal'
import { type PublicClient } from 'viem'
import { CLOB_ABI } from '../abis'

// [FIX A-4] recibe publicClient como parámetro — no crea uno nuevo en cada llamada
export async function getArbitrageParams(
  publicClient: PublicClient
): Promise<OrderParams> {
  const clobAddress = process.env.COMMIT_REVEAL_CLOB_ADDRESS as `0x${string}`

  const openBids = await publicClient.readContract({
    address:      clobAddress,
    abi:          CLOB_ABI,
    functionName: 'getOpenBids'
  }) as bigint[]

  const openAsks = await publicClient.readContract({
    address:      clobAddress,
    abi:          CLOB_ABI,
    functionName: 'getOpenAsks'
  }) as bigint[]

  // [FIX A-8] iterar todos los asks para encontrar el mejor (precio más bajo)
  // openAsks[0] no es necesariamente el mejor — el array puede estar desordenado
  let bestAskId:    bigint | null = null
  let bestAskPrice                = BigInt('999999999999999999999999999999')

  for (const askId of openAsks) {
    const order = await publicClient.readContract({
      address:      clobAddress,
      abi:          CLOB_ABI,
      functionName: 'getOrder',
      args:         [askId]
    }) as any

    if (order.status === 1 && order.price < bestAskPrice) { // status 1 = REVEALED
      bestAskPrice = order.price
      bestAskId    = askId
    }
  }

  // Si hay un ask revelado, poner un BID ligeramente más alto para cruzar el spread
  if (bestAskId !== null) {
    return {
      price:     bestAskPrice + BigInt(10 ** 15), // 0.001 USDC más alto
      amount:    BigInt(1) * BigInt(10 ** 18),
      direction: 0 as Direction                   // BID
    }
  }

  // [FIX A-8] iterar todos los bids para encontrar el mejor (precio más alto)
  let bestBidId:    bigint | null = null
  let bestBidPrice                = BigInt(0)

  for (const bidId of openBids) {
    const order = await publicClient.readContract({
      address:      clobAddress,
      abi:          CLOB_ABI,
      functionName: 'getOrder',
      args:         [bidId]
    }) as any

    if (order.status === 1 && order.price > bestBidPrice) { // status 1 = REVEALED
      bestBidPrice = order.price
      bestBidId    = bidId
    }
  }

  // Si hay un bid revelado, poner un ASK ligeramente más bajo para cruzar
  if (bestBidId !== null) {
    return {
      price:     bestBidPrice - BigInt(10 ** 15), // 0.001 USDC más bajo
      amount:    BigInt(1) * BigInt(10 ** 18),
      direction: 1 as Direction                   // ASK
    }
  }

  // Sin oportunidad de arbitraje — orden neutra
  return {
    price:     BigInt(3000) * BigInt(10 ** 18),
    amount:    BigInt(1) * BigInt(10 ** 18),
    direction: 0 as Direction
  }
}