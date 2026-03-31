import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

/* ─── TYPES ──────────────────────────────────────────────────────────────── */

interface DCFSuggestions {
  conservative: number   // annual FCF growth rate as decimal
  neutral: number
  bullish: number
  terminalGrowthRate: number
}

interface DCFApiResponse {
  symbol: string
  name: string
  currentPrice: number | null
  baseFCF: number | null          // trailing FCF in $millions, null if unavailable
  sharesOutstanding: number       // in millions
  netDebt: number                 // in millions (0 if data unavailable)
  suggestions: DCFSuggestions
}

/* ─── ROUTE ──────────────────────────────────────────────────────────────── */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params
  const sym = symbol.toUpperCase()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const fKey = process.env.FINNHUB_API_KEY
  if (!fKey) return NextResponse.json({ error: 'Missing FINNHUB_API_KEY' }, { status: 500 })
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 })

  const base = 'https://finnhub.io/api/v1'

  // Fetch Finnhub data in parallel
  const [profileRes, quoteRes, metricsRes] = await Promise.allSettled([
    fetch(`${base}/stock/profile2?symbol=${sym}&token=${fKey}`, { next: { revalidate: 3600 } }).then(r => r.json()),
    fetch(`${base}/quote?symbol=${sym}&token=${fKey}`, { next: { revalidate: 30 } }).then(r => r.json()),
    fetch(`${base}/stock/metric?symbol=${sym}&metric=all&token=${fKey}`, { next: { revalidate: 3600 } }).then(r => r.json()),
  ])

  const profile = profileRes.status === 'fulfilled' ? profileRes.value : {}
  const quote   = quoteRes.status === 'fulfilled' ? quoteRes.value : {}
  const metrics = metricsRes.status === 'fulfilled' ? metricsRes.value?.metric ?? {} : {}

  if (!profile?.name) {
    return NextResponse.json({ error: 'Ticker not found' }, { status: 404 })
  }

  // Extract financials

  // Shares outstanding in millions — prefer direct field, fall back to marketCap / price
  const sharesOutstanding: number =
    profile.shareOutstanding ??
    (profile.marketCapitalization != null && quote.c ? profile.marketCapitalization / quote.c : 0)

  // FCF in millions — try TTM first, then annual, then derive from per-share * shares
  const fcfPerShare: number | null = metrics['cashFlowPerShareTTM'] ?? null
  const baseFCF: number | null =
    metrics['freeCashFlowTTM'] ??
    metrics['freeCashFlowAnnual'] ??
    (fcfPerShare != null && sharesOutstanding > 0 ? fcfPerShare * sharesOutstanding : null)

  // Net debt = total debt - cash. Finnhub free tier often omits these; defaults to 0.
  const totalDebt: number = metrics['totalDebtAnnual'] ?? 0
  const cash: number = metrics['cashAndEquivalentsAnnual'] ?? 0
  const netDebt: number = totalDebt - cash

  const currentPrice: number | null = quote.c ?? null

  // Build context for OpenAI
  const contextBlock = `
COMPANY: ${profile.name} (${sym})
SECTOR: ${profile.finnhubIndustry ?? '—'}
MARKET CAP: ${profile.marketCapitalization ? `$${(profile.marketCapitalization / 1000).toFixed(1)}B` : '—'}
REVENUE GROWTH YOY: ${metrics['revenueGrowthTTMYoy'] != null ? `${metrics['revenueGrowthTTMYoy'].toFixed(1)}%` : '—'}
GROSS MARGIN: ${metrics['grossMarginTTM'] != null ? `${metrics['grossMarginTTM'].toFixed(1)}%` : '—'}
ROE: ${metrics['roeTTM'] != null ? `${metrics['roeTTM'].toFixed(1)}%` : '—'}
P/E: ${metrics['peTTM'] ?? '—'}
DEBT/EQUITY: ${metrics['totalDebt/totalEquityAnnual'] ?? '—'}
`.trim()

  // Get AI suggestions
  let suggestions: DCFSuggestions = { conservative: 0.05, neutral: 0.10, bullish: 0.15, terminalGrowthRate: 0.025 }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-5.4-mini',
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `You are a senior equity research analyst. Given a company's financial profile, suggest reasonable annual FCF growth rates for three investment scenarios over a 5–15 year DCF horizon.

Return a JSON object with exactly this shape:
{
  "conservative": <number>,      // e.g. 0.04 for 4% — assumes headwinds or mean reversion
  "neutral": <number>,           // e.g. 0.10 for 10% — base case, in-line with expectations
  "bullish": <number>,           // e.g. 0.18 for 18% — assumes strong execution
  "terminalGrowthRate": <number> // e.g. 0.025 for 2.5% — long-run nominal GDP growth
}

All values are decimals. Base rates on the company's revenue growth trajectory, sector dynamics, profitability, and competitive position. Terminal rate should be 0.02–0.03 for US equities; slightly higher for high-growth markets.`,
        },
        { role: 'user', content: contextBlock },
      ],
    })

    const raw = completion.choices[0].message.content ?? '{}'
    const parsed = JSON.parse(raw)
    if (
      typeof parsed.conservative === 'number' &&
      typeof parsed.neutral === 'number' &&
      typeof parsed.bullish === 'number' &&
      typeof parsed.terminalGrowthRate === 'number'
    ) {
      suggestions = parsed
    }
  } catch {
    // Fall back to defaults — UI will still work
  }

  const response: DCFApiResponse = {
    symbol: sym,
    name: profile.name,
    currentPrice,
    baseFCF,
    sharesOutstanding,
    netDebt,
    suggestions,
  }

  return NextResponse.json(response)
}
