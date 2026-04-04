import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

function getOpenAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

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

async function fetchSecBaseFcfMillions(symbol: string): Promise<number | null> {
  try {
    const tickerMap = await fetch('https://www.sec.gov/files/company_tickers.json', {
      headers: { 'User-Agent': 'Graham-App contact@graham.app' },
      next: { revalidate: 86400 },
    }).then(r => (r.ok ? r.json() : null))
    if (!tickerMap || typeof tickerMap !== 'object') return null

    const entry = Object.values(tickerMap as Record<string, { cik_str: number; ticker: string }>)
      .find(e => e?.ticker?.toUpperCase() === symbol.toUpperCase())
    if (!entry) return null

    const cik = String(entry.cik_str).padStart(10, '0')
    const facts = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
      headers: { 'User-Agent': 'Graham-App contact@graham.app' },
      next: { revalidate: 86400 },
    }).then(r => (r.ok ? r.json() : null))
    if (!facts) return null

    const usGaap = facts?.facts?.['us-gaap'] as Record<string, { units?: Record<string, Array<Record<string, unknown>>> }> | undefined
    if (!usGaap) return null

    const getAnnualUsd = (concepts: string[]): number | null => {
      for (const c of concepts) {
        const units = usGaap[c]?.units?.USD
        if (!Array.isArray(units)) continue
        const sorted = units
          .filter(x => x?.fp === 'FY' || x?.form === '10-K')
          .sort((a, b) => (yearFromEndDate(b.end) ?? 0) - (yearFromEndDate(a.end) ?? 0))
        for (const row of sorted) {
          const v = numOrNull(row.val)
          if (v != null) return v
        }
      }
      return null
    }

    const direct = getAnnualUsd(['FreeCashFlow', 'FreeCashFlowToFirm', 'FreeCashFlowToEquity'])
    if (direct != null) return direct / 1_000_000

    const cfo = getAnnualUsd(['NetCashProvidedByUsedInOperatingActivities', 'NetCashFromOperatingActivities'])
    const capex = getAnnualUsd(['PaymentsToAcquirePropertyPlantAndEquipment', 'CapitalExpenditures'])
    if (cfo != null && capex != null) {
      const fcf = capex < 0 ? cfo + capex : cfo - capex
      return fcf / 1_000_000
    }
    return null
  } catch {
    return null
  }
}

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function extractReportedFcfRaw(report: unknown): number | null {
  if (!report || typeof report !== 'object') return null
  const rep = report as Record<string, unknown>
  const rows: Array<Record<string, unknown>> = []

  for (const k of ['cf', 'ic', 'bs']) {
    const arr = rep[k]
    if (!Array.isArray(arr)) continue
    for (const row of arr) if (row && typeof row === 'object') rows.push(row as Record<string, unknown>)
  }

  const pick = (...needles: string[]): number | null => {
    for (const row of rows) {
      const concept = typeof row.concept === 'string' ? row.concept.toLowerCase() : ''
      if (!concept) continue
      if (!needles.some(n => concept.includes(n.toLowerCase()))) continue
      const v = numOrNull(row.value)
      if (v != null) return v
    }
    return null
  }

  const direct = pick('freecashflow', 'freecashflowtofirm', 'freecashflowtoequity')
  if (direct != null) return direct

  const cfo = pick('netcashprovidedbyusedinoperatingactivities', 'netcashfromoperatingactivities')
  const capex = pick('paymentstoacquirepropertyplantandequipment', 'capitalexpenditure', 'capex')
  if (cfo != null && capex != null) {
    const fcf = capex < 0 ? cfo + capex : cfo - capex
    return fcf
  }
  return null
}

function yearFromEndDate(v: unknown): number | null {
  if (typeof v !== 'string' || v.length < 4) return null
  const y = Number(v.slice(0, 4))
  return Number.isFinite(y) ? y : null
}

function normalizeReportedFcfToMillions(raw: number, metricHintMillions: number | null): number {
  const asMillions = raw
  const asDollarsToMillions = raw / 1_000_000
  const candidates = [asMillions, asDollarsToMillions]

  // Use Finnhub metric as anchor when available to choose correct unit scaling.
  if (metricHintMillions != null && Number.isFinite(metricHintMillions) && metricHintMillions > 0) {
    let best = candidates[0]
    let bestErr = Math.abs(candidates[0] - metricHintMillions)
    for (const c of candidates.slice(1)) {
      const err = Math.abs(c - metricHintMillions)
      if (err < bestErr) {
        best = c
        bestErr = err
      }
    }
    return best
  }

  // Fallback heuristic if anchor missing: prefer economically plausible magnitude.
  if (Math.abs(asMillions) > 1_000_000) return asDollarsToMillions
  return asMillions
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
  const [profileRes, quoteRes, metricsRes, financialsRes, secFcfRes] = await Promise.allSettled([
    fetch(`${base}/stock/profile2?symbol=${sym}&token=${fKey}`, { next: { revalidate: 3600 } }).then(r => r.json()),
    fetch(`${base}/quote?symbol=${sym}&token=${fKey}`, { next: { revalidate: 30 } }).then(r => r.json()),
    fetch(`${base}/stock/metric?symbol=${sym}&metric=all&token=${fKey}`, { next: { revalidate: 3600 } }).then(r => r.json()),
    fetch(`${base}/stock/financials-reported?symbol=${sym}&freq=annual&token=${fKey}`, { next: { revalidate: 86400 } }).then(r => r.json()),
    fetchSecBaseFcfMillions(sym),
  ])

  const profile = profileRes.status === 'fulfilled' ? profileRes.value : {}
  const quote   = quoteRes.status === 'fulfilled' ? quoteRes.value : {}
  const metrics = metricsRes.status === 'fulfilled' ? metricsRes.value?.metric ?? {} : {}
  const financials = financialsRes.status === 'fulfilled' ? financialsRes.value : {}
  const secBaseFcf = secFcfRes.status === 'fulfilled' ? secFcfRes.value : null

  if (!profile?.name) {
    return NextResponse.json({ error: 'Ticker not found' }, { status: 404 })
  }

  // Extract financials

  // Shares outstanding in millions — prefer direct field, fall back to marketCap / price
  const sharesOutstanding: number =
    profile.shareOutstanding ??
    (profile.marketCapitalization != null && quote.c ? profile.marketCapitalization / quote.c : 0)

  const metricHintMillions =
    (typeof metrics['freeCashFlowAnnual'] === 'number' ? metrics['freeCashFlowAnnual'] : null) ??
    (typeof metrics['freeCashFlowTTM'] === 'number' ? metrics['freeCashFlowTTM'] : null)

  // FCF in millions — prefer latest reported annual statements, then metric fallbacks.
  const reportedRows = Array.isArray(financials?.data) ? financials.data : []
  const latestReportedFcf = reportedRows
    .map((x: unknown) => x as Record<string, unknown>)
    .sort((a: Record<string, unknown>, b: Record<string, unknown>) => (yearFromEndDate(b.endDate) ?? 0) - (yearFromEndDate(a.endDate) ?? 0))
    .map((row: Record<string, unknown>) => extractReportedFcfRaw(row.report))
    .find((x: number | null): x is number => x != null)

  const fcfPerShare: number | null = metrics['cashFlowPerShareTTM'] ?? null
  const baseFCF: number | null =
    secBaseFcf ??
    (latestReportedFcf != null ? normalizeReportedFcfToMillions(latestReportedFcf, metricHintMillions) : null) ??
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
    const completion = await getOpenAIClient().chat.completions.create({
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
