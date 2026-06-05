"use client"

import type { TickerEvent } from '@/lib/types'

interface LiveTickerProps {
  events: TickerEvent[]
}

export default function LiveTicker({ events }: LiveTickerProps) {
  return (
    <div className="bg-[#080810] border-y border-[#1a1a2e] overflow-hidden">
      <div className="animate-ticker flex gap-8 py-2 px-4 whitespace-nowrap">
        {/* Live ticker implementation */}
      </div>
    </div>
  )
}
