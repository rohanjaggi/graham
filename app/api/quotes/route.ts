import { NextResponse } from 'next/server'

const SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'BRK.B', 'JPM', 'V', 'JNJ', 'MA', 'WMT', 'DIS']
const QUOTES_CACHE_TTL_MS = 30 * 1000

type QuoteItem = {
  sym: string
  price: string
  chg: string
  up: boolean
}

declare global {
  var __grahamQuotesCache: { data: QuoteItem[]; expiresAt: number } | undefined
}

export async function GET() {
  const key = process.env.FINNHUB_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'Missing FINNHUB_API_KEY' }, { status: 500 })
  }

  const cached = globalThis.__grahamQuotesCache
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data)
  }

  const results = await Promise.allSettled(
    SYMBOLS.map((sym) =>
      fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${key}`, { next: { revalidate: 30 } })
        .then((response) => response.json())
        .then((payload) => ({
          sym,
          price: payload.c?.toFixed(2) ?? '--',
          chg: payload.dp != null ? `${payload.dp >= 0 ? '+' : ''}${payload.dp.toFixed(2)}%` : '--',
          up: (payload.dp ?? 0) >= 0,
        }))
    )
  )

  const quotes = results
    .filter((result): result is PromiseFulfilledResult<QuoteItem> => result.status === 'fulfilled')
    .map((result) => result.value)

  globalThis.__grahamQuotesCache = {
    data: quotes,
    expiresAt: Date.now() + QUOTES_CACHE_TTL_MS,
  }

  return NextResponse.json(quotes)
}
