import { NextResponse } from 'next/server'

const SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'BRK.B', 'JPM', 'V', 'JNJ', 'MA', 'WMT', 'DIS']

export async function GET() {
  const key = process.env.FINNHUB_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'Missing FINNHUB_API_KEY' }, { status: 500 })
  }

  const results = await Promise.allSettled(
    SYMBOLS.map(sym =>
      fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${key}`, { next: { revalidate: 30 } })
        .then(r => r.json())
        .then(d => ({
          sym,
          price: d.c?.toFixed(2) ?? '—',
          chg: d.dp != null ? `${d.dp >= 0 ? '+' : ''}${d.dp.toFixed(2)}%` : '—',
          up: (d.dp ?? 0) >= 0,
        }))
    )
  )

  const quotes = results
    .filter((r): r is PromiseFulfilledResult<{ sym: string; price: string; chg: string; up: boolean }> => r.status === 'fulfilled')
    .map(r => r.value)

  return NextResponse.json(quotes)
}
