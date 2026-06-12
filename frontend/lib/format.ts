import { formatUnits } from 'viem'

export function formatAddress(address: string): string {
  if (!address || address.length < 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function formatPrice(price: bigint): string {
  return parseFloat(formatUnits(price, 18)).toFixed(2)
}

export function formatAmount(amount: bigint): string {
  return parseFloat(formatUnits(amount, 18)).toFixed(3)
}

export function formatHash(hash: string): string {
  const stripped = hash.startsWith('0x') ? hash.slice(2) : hash
  if (stripped.length < 10) return stripped
  return `${stripped.slice(0, 6)}...${stripped.slice(-4)}`
}
