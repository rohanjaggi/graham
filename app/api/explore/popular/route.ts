import { NextResponse } from 'next/server'

type CuratedStock = {
  symbol: string
  name: string
  aliases: string[]
}

type PopularStock = {
  symbol: string
  name: string
  mentions: number
  price: number | null
  changePct: number | null
}

const CURATED_STOCKS: CuratedStock[] = [
  { symbol: 'NVDA', name: 'NVIDIA Corp.', aliases: ['NVIDIA', 'NVDA'] },
  { symbol: 'MSFT', name: 'Microsoft Corp.', aliases: ['MICROSOFT', 'MSFT'] },
  { symbol: 'AAPL', name: 'Apple Inc.', aliases: ['APPLE', 'AAPL'] },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', aliases: ['AMAZON', 'AMZN'] },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', aliases: ['ALPHABET', 'GOOGLE', 'GOOGL'] },
  { symbol: 'META', name: 'Meta Platforms, Inc.', aliases: ['META', 'META PLATFORMS', 'FACEBOOK'] },
  { symbol: 'TSLA', name: 'Tesla, Inc.', aliases: ['TESLA', 'TSLA'] },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', aliases: ['JPMORGAN', 'JP MORGAN', 'JPM'] },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway Inc. Class B', aliases: ['BERKSHIRE', 'BRK.B', 'BRK B'] },
  { symbol: 'LLY', name: 'Eli Lilly and Co.', aliases: ['ELI LILLY', 'LILLY', 'LLY'] },
  { symbol: 'AVGO', name: 'Broadcom Inc.', aliases: ['BROADCOM', 'AVGO'] },
  { symbol: 'NFLX', name: 'Netflix, Inc.', aliases: ['NETFLIX', 'NFLX'] },
  { symbol: 'AMD', name: 'Advanced Micro Devices, Inc.', aliases: ['AMD', 'ADVANCED MICRO DEVICES'] },
  { symbol: 'V', name: 'Visa Inc.', aliases: ['VISA', 'NYSE: V', ' V '] },
  { symbol: 'WMT', name: 'Walmart Inc.', aliases: ['WALMART', 'WMT'] },
]

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function countMentions(text: string, aliases: string[]): number {
  let mentions = 0

  for (const alias of aliases) {
    const normalized = alias.toUpperCase().trim()
    if (!normalized) continue

    const regex = normalized.includes(' ')
      ? new RegExp(escapeRegex(normalized), 'g')
      : new RegExp(`\\b${escapeRegex(normalized)}\\b`, 'g')

    if (regex.test(text)) mentions += 1
  }

  return mentions
}

async function fetchQuotes(key: string, stocks: CuratedStock[]): Promise<PopularStock[]> {
  const results = await Promise.all(
    stocks.map(async (stock) => {
      try {
        const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(stock.symbol)}&token=${key}`, {
          next: { revalidate: 300 },
        })

        if (!response.ok) {
          return {
            symbol: stock.symbol,
            name: stock.name,
            mentions: 0,
            price: null,
            changePct: null,
          }
        }

        const quote = await response.json() as { c?: number; dp?: number }
        return {
          symbol: stock.symbol,
          name: stock.name,
          mentions: 0,
          price: typeof quote.c === 'number' ? quote.c : null,
          changePct: typeof quote.dp === 'number' ? quote.dp : null,
        }
      } catch {
        return {
          symbol: stock.symbol,
          name: stock.name,
          mentions: 0,
          price: null,
          changePct: null,
        }
      }
    })
  )

  return results
}

export async function GET() {
  const key = process.env.FINNHUB_API_KEY

  if (!key) {
    return NextResponse.json({
      source: 'fallback-watchlist',
      popular: CURATED_STOCKS.slice(0, 10).map((stock) => ({
        symbol: stock.symbol,
        name: stock.name,
        mentions: 0,
        price: null,
        changePct: null,
      })),
      error: 'Missing FINNHUB_API_KEY. Showing fallback watchlist.',
    })
  }

  try {
    const newsResponse = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${key}`, {
      next: { revalidate: 300 },
    })

    if (!newsResponse.ok) {
      throw new Error('Failed to fetch market news')
    }

    const news = await newsResponse.json() as Array<{ headline?: string; summary?: string }>
    const mentions = new Map<string, number>()

    for (const stock of CURATED_STOCKS) {
      mentions.set(stock.symbol, 0)
    }

    for (const item of Array.isArray(news) ? news.slice(0, 60) : []) {
      const text = `${item?.headline ?? ''} ${item?.summary ?? ''}`.toUpperCase()
      if (!text.trim()) continue

      for (const stock of CURATED_STOCKS) {
        const score = countMentions(text, stock.aliases)
        if (score > 0) {
          mentions.set(stock.symbol, (mentions.get(stock.symbol) ?? 0) + score)
        }
      }
    }

    const ranked = [...CURATED_STOCKS]
      .sort((a, b) => {
        const mentionDiff = (mentions.get(b.symbol) ?? 0) - (mentions.get(a.symbol) ?? 0)
        if (mentionDiff !== 0) return mentionDiff
        return CURATED_STOCKS.findIndex((item) => item.symbol === a.symbol) - CURATED_STOCKS.findIndex((item) => item.symbol === b.symbol)
      })
      .slice(0, 10)

    const quotes = await fetchQuotes(key, ranked)
    const popular = quotes.map((stock) => ({
      ...stock,
      mentions: mentions.get(stock.symbol) ?? 0,
    }))

    return NextResponse.json({
      source: 'finnhub-news-mentions',
      date: new Date().toISOString(),
      popular,
    })
  } catch {
    const fallback = await fetchQuotes(key, CURATED_STOCKS.slice(0, 10))

    return NextResponse.json({
      source: 'fallback-watchlist',
      date: new Date().toISOString(),
      popular: fallback,
    })
  }
}
