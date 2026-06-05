"use client"

import type { OrderBookData } from '@/lib/types'

interface OrderBookProps {
  data: OrderBookData | null
}

export default function OrderBook({ data }: OrderBookProps) {
  if (!data) return null
  
  return (
    <div className="bg-[#0d0d14] border border-[#1a1a2e] rounded-lg p-4 h-full">
      <h3 className="text-sm text-[#666680] mb-3 uppercase tracking-wider">Order Book</h3>
      {/* Order book implementation */}
    </div>
  )
}
