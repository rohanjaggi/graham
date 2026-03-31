import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { toYahooSymbol } from '@/lib/portfolio/yahoo'

const SUMMARY_CACHE_TTL_MS = 6 * 60 * 60 * 1000

interface QuickAnalysis {
  summary: string
  whatItIs: string
  companyDescription: string
  crisisRelevance: string
  keyVulnerabilities: string[]
  transmissionChannels: string[]
  whatToExploreNext: string[]
}

declare global {
  var __grahamCompanySummaryCache: Map<string, { data: QuickAnalysis; expiresAt: number }> | undefined
}

const summaryCache = globalThis.__grahamCompanySummaryCache ?? new Map<string, { data: QuickAnalysis; expiresAt: number }>()
globalThis.__grahamCompanySummaryCache = summaryCache

function getOpenAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

function parseYahooSummary(payload: unknown): string | null {
  const result = (payload as { quoteSummary?: { result?: Array<{ assetProfile?: { longBusinessSummary?: string } }> } })
    ?.quoteSummary?.result?.[0]?.assetProfile?.longBusinessSummary

  if (typeof result !== 'string') return null
  const trimmed = result.replace(/\s+/g, ' ').trim()
  return trimmed.length > 0 ? trimmed : null
}

function fallbackSummary(name: string, symbol: string, sector: string | null, yahooSummary: string | null): QuickAnalysis {
  const sectorText = sector && sector !== '—' ? ` in the ${sector} sector` : ''
  const whatItIs = `${name} (${symbol}) is a listed company${sectorText}.`
  const companyDescription = yahooSummary
    ? (yahooSummary.length > 700 ? `${yahooSummary.slice(0, 697)}...` : yahooSummary)
    : `${name} (${symbol}) is a listed company${sectorText}. A concise business description is currently unavailable from upstream sources, so treat this as a high-level placeholder pending richer company profile data.`

  const crisisRelevance = sector && sector !== '—'
    ? `${name} can matter during crises because ${sector.toLowerCase()} businesses often influence system stability, consumer confidence, and liquidity conditions.`
    : `${name} can matter during crises because large listed companies can affect market sentiment, supply chains, and portfolio risk.`

  return {
    summary: `${whatItIs} ${crisisRelevance}`,
    whatItIs,
    companyDescription,
    crisisRelevance,
    keyVulnerabilities: [
      `Earnings volatility from cyclical demand and market sentiment around ${symbol}.`,
      'Balance-sheet and liquidity pressure if funding costs rise quickly.',
      'Operational or regulatory shocks that can compress margins or volumes.',
    ],
    transmissionChannels: [
      'Asset repricing can transmit stress through equity, credit, and funding markets.',
      'Counterparty and customer behavior can amplify liquidity pressure during drawdowns.',
      'Capital allocation constraints may tighten lending, investment, or buyback activity.',
    ],
    whatToExploreNext: [
      'Review leverage, maturity profile, and refinancing needs over the next 24 months.',
      'Compare valuation and profitability trends versus close peers and sector benchmarks.',
      'Stress-test downside scenarios using revenue sensitivity and margin compression cases.',
    ],
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params
  const sym = symbol.toUpperCase()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cacheKey = sym
  const cached = summaryCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ symbol: sym, ...cached.data, source: 'cache' })
  }

  const finnhubKey = process.env.FINNHUB_API_KEY
  if (!finnhubKey) return NextResponse.json({ error: 'Missing FINNHUB_API_KEY' }, { status: 500 })

  const [profile, yahooSummary] = await Promise.all([
    fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${sym}&token=${finnhubKey}`, { next: { revalidate: 3600 } })
      .then(r => r.ok ? r.json() : null)
      .catch(() => null),
    fetch(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(toYahooSymbol(sym))}?modules=assetProfile`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Graham/1.0)' },
      next: { revalidate: 3600 },
    })
      .then(r => r.ok ? r.json() : null)
      .then(parseYahooSummary)
      .catch(() => null),
  ])

  if (!profile?.name) {
    return NextResponse.json({ error: 'Ticker not found' }, { status: 404 })
  }

  const name = profile.name as string
  const sector = (profile.finnhubIndustry as string | undefined) ?? null

  let analysis = fallbackSummary(name, sym, sector, yahooSummary)
  let source: 'openai' | 'yahoo' | 'fallback' = yahooSummary ? 'yahoo' : 'fallback'

  if (process.env.OPENAI_API_KEY) {
    try {
      const context = [
        `Company: ${name} (${sym})`,
        `Sector: ${sector ?? 'Unknown'}`,
        yahooSummary ? `Business description source text: ${yahooSummary.slice(0, 2600)}` : 'Business description source text: unavailable',
      ].join('\n')

      const completion = await getOpenAIClient().chat.completions.create({
        model: 'gpt-5.4-mini',
        response_format: { type: 'json_object' },
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: 'You write concise investor-facing company explainers. Return strict JSON with shape {"summary":"...","whatItIs":"...","companyDescription":"...","crisisRelevance":"...","keyVulnerabilities":["..."],"transmissionChannels":["..."],"whatToExploreNext":["..."]}. Keep summary/whatItIs/crisisRelevance each <= 45 words. companyDescription should be 70-120 words and explain core business model, key segments/geographies, and primary revenue drivers. Each list must contain exactly 3 bullets, each <= 16 words, plain English, factual, no hype, and no investment recommendation. whatItIs should explain what the company does in one line. crisisRelevance should explain why it matters in a crisis context. The 3 lists should be company-specific and crisis-relevant. If context is limited, explicitly acknowledge uncertainty.',
          },
          { role: 'user', content: context },
        ],
      })

      const raw = completion.choices[0]?.message?.content ?? '{}'
      const parsed = JSON.parse(raw) as {
        summary?: unknown
        whatItIs?: unknown
        companyDescription?: unknown
        crisisRelevance?: unknown
        keyVulnerabilities?: unknown
        transmissionChannels?: unknown
        whatToExploreNext?: unknown
      }
      const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : ''
      const whatItIs = typeof parsed.whatItIs === 'string' ? parsed.whatItIs.trim() : ''
      const companyDescription = typeof parsed.companyDescription === 'string' ? parsed.companyDescription.trim() : ''
      const crisisRelevance = typeof parsed.crisisRelevance === 'string' ? parsed.crisisRelevance.trim() : ''
      const keyVulnerabilities = Array.isArray(parsed.keyVulnerabilities)
        ? parsed.keyVulnerabilities.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean).slice(0, 3)
        : []
      const transmissionChannels = Array.isArray(parsed.transmissionChannels)
        ? parsed.transmissionChannels.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean).slice(0, 3)
        : []
      const whatToExploreNext = Array.isArray(parsed.whatToExploreNext)
        ? parsed.whatToExploreNext.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean).slice(0, 3)
        : []

      if (summary || whatItIs || companyDescription || crisisRelevance || keyVulnerabilities.length || transmissionChannels.length || whatToExploreNext.length) {
        analysis = {
          summary: summary || `${whatItIs} ${crisisRelevance}`.trim() || analysis.summary,
          whatItIs: whatItIs || analysis.whatItIs,
          companyDescription: companyDescription || analysis.companyDescription,
          crisisRelevance: crisisRelevance || analysis.crisisRelevance,
          keyVulnerabilities: keyVulnerabilities.length === 3 ? keyVulnerabilities : analysis.keyVulnerabilities,
          transmissionChannels: transmissionChannels.length === 3 ? transmissionChannels : analysis.transmissionChannels,
          whatToExploreNext: whatToExploreNext.length === 3 ? whatToExploreNext : analysis.whatToExploreNext,
        }
        source = 'openai'
      }
    } catch {
      // Keep fallback summary if OpenAI request fails.
    }
  }

  summaryCache.set(cacheKey, {
    data: analysis,
    expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS,
  })

  return NextResponse.json({
    symbol: sym,
    name,
    ...analysis,
    source,
  })
}
