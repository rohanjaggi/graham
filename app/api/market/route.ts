import { NextResponse } from 'next/server'

const MARKET_SYMBOLS = [
  { sym: 'SPY', label: 'S&P 500' },
  { sym: 'QQQ', label: 'NASDAQ' },
  { sym: 'TLT', label: '20+Y UST' },
]

const MARKET_CACHE_TTL_MS = 60 * 1000

type MarketItem = {
  label: string
  val: string
  chg: string
  up: boolean
}

declare global {
  var __grahamMarketCache: { data: MarketItem[]; expiresAt: number } | undefined
}

export async function GET() {
  const key = process.env.FINNHUB_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'Missing FINNHUB_API_KEY' }, { status: 500 })
  }

  const cached = globalThis.__grahamMarketCache
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data)
  }

  const results = await Promise.allSettled(
    MARKET_SYMBOLS.map(({ sym, label }) =>
      fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${key}`, { next: { revalidate: 60 } })
        .then((response) => response.json())
        .then((payload) => ({
          label,
          val: payload.c != null ? payload.c.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--',
          chg: payload.dp != null ? `${payload.dp >= 0 ? '+' : ''}${payload.dp.toFixed(2)}%` : '--',
          up: (payload.dp ?? 0) >= 0,
        }))
    )
  )

  const market = results
    .filter((result): result is PromiseFulfilledResult<MarketItem> => result.status === 'fulfilled')
    .map((result) => result.value)

  globalThis.__grahamMarketCache = {
    data: market,
    expiresAt: Date.now() + MARKET_CACHE_TTL_MS,
  }

  return NextResponse.json(market)
}
