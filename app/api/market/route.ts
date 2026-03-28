import { NextResponse } from 'next/server'

// ETF proxies for the TopBar indices
const MARKET_SYMBOLS = [
  { sym: 'SPY', label: 'S&P 500' },
  { sym: 'QQQ', label: 'NASDAQ'  },
  { sym: 'TLT', label: '20+Y UST' }, // 20yr treasury bond ETF
]

export async function GET() {
  const key = process.env.FINNHUB_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'Missing FINNHUB_API_KEY' }, { status: 500 })
  }

  const results = await Promise.allSettled(
    MARKET_SYMBOLS.map(({ sym, label }) =>
      fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${key}`, { next: { revalidate: 60 } })
        .then(r => r.json())
        .then(d => ({
          label,
          val: d.c != null ? d.c.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—',
          chg: d.dp != null ? `${d.dp >= 0 ? '+' : ''}${d.dp.toFixed(2)}%` : '—',
          up: (d.dp ?? 0) >= 0,
        }))
    )
  )

  const market = results
    .filter((r): r is PromiseFulfilledResult<{ label: string; val: string; chg: string; up: boolean }> => r.status === 'fulfilled')
    .map(r => r.value)

  return NextResponse.json(market)
}
