import { NextResponse } from 'next/server'

type FinnhubNewsItem = {
  related?: string
}

type PopularStock = {
  symbol: string
  name: string
  mentions: number
  price: number | null
  changePct: number | null
}

const FALLBACK_SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'JPM', 'XOM']
const SYMBOL_PATTERN = /^[A-Z][A-Z0-9.-]{0,9}$/

function parseRelatedSymbols(news: FinnhubNewsItem[]): Map<string, number> {
  const counts = new Map<string, number>()

  for (const item of news) {
    const related = item?.related
    if (!related) continue

    for (const raw of related.split(',')) {
      const symbol = raw.trim().toUpperCase()
      if (!SYMBOL_PATTERN.test(symbol)) continue
      if (symbol.length > 6) continue
      counts.set(symbol, (counts.get(symbol) ?? 0) + 1)
    }
  }

  return counts
}

async function fetchStockSnapshot(symbol: string, key: string, mentions: number): Promise<PopularStock> {
  const [quoteRaw, profileRaw] = await Promise.all([
    fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`, { next: { revalidate: 900 } }).then((r) => r.json()).catch(() => ({})),
    fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${key}`, { next: { revalidate: 3600 } }).then((r) => r.json()).catch(() => ({})),
  ])

  const name = typeof profileRaw?.name === 'string' && profileRaw.name.trim() ? profileRaw.name.trim() : symbol
  const price = typeof quoteRaw?.c === 'number' ? quoteRaw.c : null
  const changePct = typeof quoteRaw?.dp === 'number' ? quoteRaw.dp : null

  return { symbol, name, mentions, price, changePct }
}

export async function GET() {
  const key = process.env.FINNHUB_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'Missing FINNHUB_API_KEY' }, { status: 500 })
  }

  try {
    const news = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${key}`, { next: { revalidate: 900 } })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => (Array.isArray(d) ? (d as FinnhubNewsItem[]) : []))

    const mentionCounts = parseRelatedSymbols(news)
    const rankedByMentions = [...mentionCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)

    const symbols = rankedByMentions.length > 0
      ? rankedByMentions.map(([symbol]) => symbol)
      : FALLBACK_SYMBOLS

    const mentionLookup = new Map(rankedByMentions)
    const snapshots = await Promise.all(
      symbols.map((symbol) => fetchStockSnapshot(symbol, key, mentionLookup.get(symbol) ?? 0))
    )

    const popular = snapshots
      .filter((item) => item.price !== null || item.mentions > 0)
      .sort((a, b) => {
        if (b.mentions !== a.mentions) return b.mentions - a.mentions
        return (Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0))
      })

    return NextResponse.json({
      source: 'finnhub-news-mentions',
      date: new Date().toISOString(),
      popular,
    })
  } catch {
    const fallback = FALLBACK_SYMBOLS.map((symbol, index) => ({
      symbol,
      name: symbol,
      mentions: Math.max(0, 8 - index),
      price: null,
      changePct: null,
    }))
    return NextResponse.json({
      source: 'fallback',
      date: new Date().toISOString(),
      popular: fallback,
    })
  }
}
