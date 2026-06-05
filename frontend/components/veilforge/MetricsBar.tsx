"use client"

import type { Metrics } from '@/lib/types'

interface MetricsBarProps {
  metrics: Metrics | null
}

export default function MetricsBar({ metrics }: MetricsBarProps) {
  return (
    <div className="bg-[#0d0d14] border border-[#1a1a2e] rounded-lg px-4 py-2">
      <div className="flex items-center justify-between gap-6 text-sm">
        {/* Metrics bar implementation */}
      </div>
    </div>
  )
}
