import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'

const CURATED_TICKERS = [
  { symbol: 'AAPL', description: 'Apple Inc. — consumer devices and services platform' },
  { symbol: 'MSFT', description: 'Microsoft Corp. — enterprise software and cloud platform' },
  { symbol: 'GOOGL', description: 'Alphabet Inc. Class A — search, ads, and cloud' },
  { symbol: 'GOOG', description: 'Alphabet Inc. Class C — search, ads, and cloud' },
  { symbol: 'AMZN', description: 'Amazon.com, Inc. — e-commerce and cloud infrastructure' },
  { symbol: 'NVDA', description: 'NVIDIA Corp. — accelerated computing and AI chips' },
  { symbol: 'META', description: 'Meta Platforms, Inc. — social platforms and digital ads' },
  { symbol: 'TSLA', description: 'Tesla, Inc. — electric vehicles and energy systems' },
  { symbol: 'JPM', description: 'JPMorgan Chase & Co. — US money-center bank' },
  { symbol: 'GS', description: 'Goldman Sachs Group, Inc. — investment bank' },
  { symbol: 'AIG', description: 'American International Group, Inc. — insurer' },
  { symbol: 'BAC', description: 'Bank of America Corp. — diversified bank' },
  { symbol: 'C', description: 'Citigroup Inc. — global bank' },
  { symbol: 'MS', description: 'Morgan Stanley — investment bank and wealth manager' },
  { symbol: 'BLK', description: 'BlackRock, Inc. — asset manager' },
  { symbol: 'WFC', description: 'Wells Fargo & Co. — commercial bank' },
  { symbol: 'XLF', description: 'Financial Select Sector SPDR Fund — financial sector ETF' },
  { symbol: 'SPY', description: 'SPDR S&P 500 ETF Trust — broad-market ETF' },
]

type SearchItem = { symbol: string; description: string }
type SearchMode = 'autocomplete' | 'intent'

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  const prev = new Array(b.length + 1)
  const curr = new Array(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      )
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j]
  }

  return prev[b.length]
}

function scoreLocalMatch(query: string, item: SearchItem): number {
  const normalizedQuery = query.trim().toUpperCase()
  const symbol = item.symbol.toUpperCase()
  const description = item.description.toUpperCase()

  if (symbol === normalizedQuery) return 100
  if (symbol.startsWith(normalizedQuery)) return 80
  if (description.startsWith(normalizedQuery)) return 70
  if (description.includes(normalizedQuery)) return 55

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean)
  const hits = tokens.filter((token) => symbol.includes(token) || description.includes(token)).length
  if (hits > 0) return hits * 12

  // Typo-tolerant symbol matching (e.g., APPL -> AAPL).
  const compactQuery = normalizedQuery.replace(/[^A-Z0-9]/g, '')
  const compactSymbol = symbol.replace(/[^A-Z0-9]/g, '')
  if (compactQuery.length >= 2 && compactSymbol.length >= 2) {
    const distance = levenshtein(compactQuery, compactSymbol)
    if (distance === 1) return 46
    if (distance === 2 && compactQuery.length >= 4) return 30
  }

  // A light fuzzy fallback so typo-like queries still surface close symbols.
  if (symbol.includes(normalizedQuery.slice(0, Math.max(1, normalizedQuery.length - 1)))) return 6
  return 0
}

function extractJsonArray(raw: string): SearchItem[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    const start = raw.indexOf('[')
    const end = raw.lastIndexOf(']')
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(raw.slice(start, end + 1))
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }
    return []
  }
}

function normalizeSearchItems(items: SearchItem[]): SearchItem[] {
  return items
    .filter((item): item is SearchItem => typeof item?.symbol === 'string' && typeof item?.description === 'string')
    .map((item) => ({
      symbol: item.symbol.toUpperCase().trim(),
      description: item.description.trim(),
    }))
    .filter((item) => item.symbol.length > 0)
}

async function fetchYahooMatches(query: string): Promise<SearchItem[]> {
  try {
    const response = await fetch(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=12&newsCount=0`, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'graham-search/1.0',
      },
    })

    if (!response.ok) return []
    const data = (await response.json()) as {
      quotes?: Array<{ symbol?: string; shortname?: string; longname?: string; exchDisp?: string; quoteType?: string }>
    }

    const quotes = Array.isArray(data?.quotes) ? data.quotes : []
    return quotes
      .filter((quote) => typeof quote?.symbol === 'string' && quote.symbol.trim().length > 0)
      .filter((quote) => !quote.quoteType || ['EQUITY', 'ETF', 'MUTUALFUND'].includes(String(quote.quoteType).toUpperCase()))
      .map((quote) => {
        const symbol = quote.symbol!.toUpperCase().trim()
        const name = quote.shortname || quote.longname || 'Publicly listed security'
        const exchange = quote.exchDisp ? ` — ${quote.exchDisp}` : ''
        return { symbol, description: `${name}${exchange}` }
      })
  } catch {
    return []
  }
}

function rankAndDedup(query: string, ...groups: SearchItem[][]): SearchItem[] {
  const all = groups.flat()
  const unique = all.filter((item, index, arr) => arr.findIndex((other) => other.symbol === item.symbol) === index)
  return unique
    .map((item) => ({ item, score: scoreLocalMatch(query, item) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item)
}

function mergeAndDedup(...groups: SearchItem[][]): SearchItem[] {
  const seen = new Set<string>()
  const merged: SearchItem[] = []

  for (const group of groups) {
    for (const item of group) {
      if (!seen.has(item.symbol)) {
        seen.add(item.symbol)
        merged.push(item)
      }
    }
  }

  return merged
}

async function fetchAiMatches(query: string, mode: SearchMode, apiKey: string): Promise<SearchItem[]> {
  const openai = new OpenAI({ apiKey })
  const response = await openai.responses.create({
    model: process.env.OPENAI_QA_MODEL ?? 'gpt-4.1-mini',
    instructions: mode === 'intent'
      ? 'Act like a finance research discovery engine. Return a JSON array only. Each item must have `symbol` and `description`, ranked best first for public stocks or ETFs relevant to the user intent.'
      : 'Act like a Google-style finance autocomplete. Return a JSON array only. Each item must have `symbol` and `description`, ranked best match first for a listed stock or ETF relevant to the user query.',
    input: mode === 'intent'
      ? `User research prompt: "${query}". Return up to 10 public stocks or ETFs that are relevant to this idea or theme. Prefer liquid, recognizable securities. Keep descriptions short, concrete, and beginner-friendly.`
      : `User search: "${query}". Find up to 8 likely public-market ticker matches. Support plain-English searches like "largest US bank", "JPMorgan", or "financial sector ETF". Keep descriptions short and beginner-friendly, and rank the most likely ticker first.`,
    temperature: 0,
    tools: [{ type: 'web_search_preview', search_context_size: 'low' }],
  } as never)

  return normalizeSearchItems(
    extractJsonArray((response as unknown as { output_text?: string }).output_text ?? '[]')
  )
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()
  const mode = request.nextUrl.searchParams.get('mode') === 'intent' ? 'intent' : 'autocomplete'
  if (!q || q.length < 1) return NextResponse.json([])

  const localMatches = CURATED_TICKERS
    .map((item) => ({ item, score: scoreLocalMatch(q, item) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item)

  const yahooMatches = await fetchYahooMatches(q)
  const rankedWithYahoo = rankAndDedup(q, localMatches, yahooMatches)

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(rankedWithYahoo.slice(0, mode === 'intent' ? 10 : 12))
  }

  try {
    if (mode === 'intent') {
      const aiMatches = await fetchAiMatches(q, mode, apiKey)
      const merged = mergeAndDedup(aiMatches, yahooMatches, localMatches)
      return NextResponse.json(merged.slice(0, 10))
    }

    if (rankedWithYahoo.length >= 5) {
      return NextResponse.json(rankedWithYahoo.slice(0, 12))
    }

    const aiMatches = await fetchAiMatches(q, mode, apiKey)
    const ranked = rankAndDedup(q, rankedWithYahoo, aiMatches)
    return NextResponse.json(ranked.slice(0, 12))
  } catch {
    return NextResponse.json(rankedWithYahoo.slice(0, mode === 'intent' ? 10 : 12))
  }
}
