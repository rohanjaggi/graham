'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const DEFAULT_SYMBOL = 'AAPL'
const TICKER_PATTERN = /^[A-Z][A-Z0-9.-]{0,9}$/

type SearchResult = {
  symbol: string
  description: string
}

async function tickerExists(symbol: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/ticker/${encodeURIComponent(symbol)}`)
    return response.ok
  } catch {
    return false
  }
}

async function resolveSymbol(rawTicker: string): Promise<string> {
  const trimmed = rawTicker.trim()
  if (!trimmed) return DEFAULT_SYMBOL

  const uppercase = trimmed.toUpperCase()
  const ranked = await fetch(`/api/ticker/search?q=${encodeURIComponent(trimmed)}`)
    .then((response) => response.ok ? response.json() : [])
    .then((data) => Array.isArray(data) ? data : [])
    .catch(() => [])

  const normalized = ranked.filter((item): item is SearchResult => {
    return typeof item?.symbol === 'string' && typeof item?.description === 'string'
  })

  const exact = normalized.find((item) => item.symbol.toUpperCase() === uppercase)
  if (exact) return exact.symbol.toUpperCase()

  if (TICKER_PATTERN.test(uppercase) && await tickerExists(uppercase)) {
    return uppercase
  }

  return normalized[0]?.symbol?.toUpperCase() ?? DEFAULT_SYMBOL
}

export default function ResearchPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawTicker = searchParams.get('ticker')?.trim() ?? ''

  useEffect(() => {
    let cancelled = false
    void resolveSymbol(rawTicker).then((symbol) => {
      if (cancelled) return
      router.replace(`/protected/ticker/${encodeURIComponent(symbol)}`)
    })

    return () => {
      cancelled = true
    }
  }, [router, rawTicker])

  return null
}
