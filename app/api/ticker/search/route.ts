import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'

const CURATED_TICKERS = [
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

function scoreLocalMatch(query: string, item: { symbol: string; description: string }): number {
  const normalizedQuery = query.trim().toUpperCase()
  const symbol = item.symbol.toUpperCase()
  const description = item.description.toUpperCase()

  if (symbol === normalizedQuery) return 100
  if (symbol.startsWith(normalizedQuery)) return 80
  if (description.startsWith(normalizedQuery)) return 70
  if (description.includes(normalizedQuery)) return 55

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean)
  const hits = tokens.filter((token) => symbol.includes(token) || description.includes(token)).length
  return hits > 0 ? hits * 12 : 0
}

function extractJsonArray(raw: string): Array<{ symbol: string; description: string }> {
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

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 1) return NextResponse.json([])

  const localMatches = CURATED_TICKERS
    .map((item) => ({ item, score: scoreLocalMatch(q, item) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item)

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || localMatches.length >= 5) {
    return NextResponse.json(localMatches.slice(0, 12))
  }

  try {
    const openai = new OpenAI({ apiKey })
    const response = await openai.responses.create({
      model: process.env.OPENAI_QA_MODEL ?? 'gpt-4.1-mini',
      instructions: 'Act like a Google-style finance autocomplete. Return a JSON array only. Each item must have `symbol` and `description`, ranked best match first for a listed stock or ETF relevant to the user query.',
      input: `User search: "${q}". Find up to 8 likely public-market ticker matches. Support plain-English searches like "largest US bank", "JPMorgan", or "financial sector ETF". Keep descriptions short and beginner-friendly, and rank the most likely ticker first.`,
      temperature: 0,
      tools: [{ type: 'web_search_preview', search_context_size: 'low' }],
    } as never)

    const aiMatches = extractJsonArray((response as unknown as { output_text?: string }).output_text ?? '{}')
      .filter((item): item is { symbol: string; description: string } => typeof item?.symbol === 'string' && typeof item?.description === 'string')
      .map((item) => ({ symbol: item.symbol.toUpperCase().trim(), description: item.description.trim() }))
      .filter((item) => item.symbol.length > 0)

    const deduped = [...localMatches, ...aiMatches].filter(
      (item, index, array) => array.findIndex((candidate) => candidate.symbol === item.symbol) === index
    )

    return NextResponse.json(deduped.slice(0, 12))
  } catch {
    return NextResponse.json(localMatches.slice(0, 12))
  }
}
