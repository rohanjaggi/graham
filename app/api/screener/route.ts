import { NextRequest, NextResponse } from 'next/server'
import { UNIVERSE } from '@/lib/screener/universe'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

export type ScreenerRow = {
  symbol: string
  name: string
  sector: string
  industry: string
  price: number | null
  marketCap: number | null
  pe: number | null
  pb: number | null
  evEbitda: number | null
  roe: number | null
  roic: number | null
  grossMargin: number | null
  operatingMargin: number | null
  netMargin: number | null
  debtEquity: number | null
  currentRatio: number | null
  revenueGrowth: number | null
  epsGrowth: number | null
  dividendYield: number | null
  beta: number | null
  week52High: number | null
  week52Low: number | null
  pctFrom52wHigh: number | null
  pctFrom52wLow: number | null
  ytdReturn: number | null
  sharesChangeYoy: number | null
}

export type ScreenerFilters = {
  peMax?: number
  pbMax?: number
  roeMin?: number
  roicMin?: number
  grossMarginMin?: number
  operatingMarginMin?: number
  netMarginMin?: number
  debtEquityMax?: number
  currentRatioMin?: number
  revenueGrowthMin?: number
  epsGrowthMin?: number
  dividendYieldMin?: number
  marketCapMinB?: number
  ytdReturnMin?: number
  pctFrom52wHighMax?: number
  pctFrom52wLowMin?: number
  betaMax?: number
  avgVolumeMin?: number
  sharesDeclineYoy?: boolean
  sector?: string
  offset?: number
}

const FINNHUB_KEY = process.env.FINNHUB_API_KEY!
const BASE = 'https://finnhub.io/api/v1'

// In-memory cache â€” survives across requests on same server instance
let rowsCache: { rows: ScreenerRow[]; fetchedAt: number } | null = null
const CACHE_TTL_MS = 60 * 60 * 1000

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

async function fetchSymbol(symbol: string): Promise<ScreenerRow | null> {
  try {
    const [metricRes, quoteRes, profileRes] = await Promise.allSettled([
      fetch(`${BASE}/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_KEY}`, { next: { revalidate: 3600 } }).then(r => r.ok ? r.json() : null),
      fetch(`${BASE}/quote?symbol=${symbol}&token=${FINNHUB_KEY}`, { next: { revalidate: 300 } }).then(r => r.ok ? r.json() : null),
      fetch(`${BASE}/stock/profile2?symbol=${symbol}&token=${FINNHUB_KEY}`, { next: { revalidate: 3600 } }).then(r => r.ok ? r.json() : null),
    ])

    const m = metricRes.status === 'fulfilled' ? metricRes.value?.metric ?? null : null
    const q = quoteRes.status === 'fulfilled' ? quoteRes.value : null
    const p = profileRes.status === 'fulfilled' ? profileRes.value : null

    if (!m && !q) return null

    const price = numOrNull(q?.c)
    const week52High = numOrNull(m?.['52WeekHigh'])
    const week52Low = numOrNull(m?.['52WeekLow'])
    const marketCapRaw = numOrNull(p?.marketCapitalization ?? m?.marketCapitalization)

    return {
      symbol,
      name: p?.name ?? symbol,
      sector: p?.finnhubIndustry ?? '--',
      industry: p?.finnhubIndustry ?? '--',
      price,
      marketCap: marketCapRaw != null ? marketCapRaw * 1e6 : null,
      pe: numOrNull(m?.peNormalizedAnnual ?? m?.peTTM),
      pb: numOrNull(m?.pbAnnual ?? m?.pbQuarterly),
      evEbitda: numOrNull(m?.evEbitdaTTM),
      roe: numOrNull(m?.roeTTM),
      roic: numOrNull(m?.roicTTM),
      grossMargin: numOrNull(m?.grossMarginTTM),
      operatingMargin: numOrNull(m?.operatingMarginTTM),
      netMargin: numOrNull(m?.netProfitMarginTTM),
      debtEquity: numOrNull(m?.['totalDebt/totalEquityAnnual']),
      currentRatio: numOrNull(m?.currentRatioAnnual),
      revenueGrowth: numOrNull(m?.revenueGrowthTTMYoy),
      epsGrowth: numOrNull(m?.epsGrowthTTMYoy ?? m?.epsBasicExclExtraItemsGrowthTTMYoy),
      dividendYield: numOrNull(m?.dividendYieldIndicatedAnnual),
      beta: numOrNull(m?.beta),
      week52High,
      week52Low,
      pctFrom52wHigh: price != null && week52High != null && week52High > 0
        ? parseFloat(((price - week52High) / week52High * 100).toFixed(2)) : null,
      pctFrom52wLow: price != null && week52Low != null && week52Low > 0
        ? parseFloat(((price - week52Low) / week52Low * 100).toFixed(2)) : null,
      ytdReturn: null,
      sharesChangeYoy: null,
    }
  } catch {
    return null
  }
}

async function warmCache(): Promise<void> {
  const symbols = [...new Set(UNIVERSE)]
  const rows: ScreenerRow[] = []
  const BATCH = 10
  const DELAY = 1500

  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH)
    const results = await Promise.allSettled(batch.map(fetchSymbol))
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value != null) rows.push(r.value)
    }
    if (i + BATCH < symbols.length) await new Promise(r => setTimeout(r, DELAY))
  }

  console.log(`[screener] warmed: ${rows.length} / ${symbols.length} symbols`)
  if (rows.length > 0) rowsCache = { rows, fetchedAt: Date.now() }
}

function passes(f: ScreenerFilters, r: ScreenerRow): boolean {
  const atLeast = (val: number | null, min: number | undefined) => min == null || val == null || val >= min
  const atMost  = (val: number | null, max: number | undefined) => max == null || val == null || val <= max

  if (!atLeast(r.roe,            f.roeMin))            return false
  if (!atLeast(r.roic,           f.roicMin))           return false
  if (!atLeast(r.grossMargin,    f.grossMarginMin))    return false
  if (!atLeast(r.operatingMargin,f.operatingMarginMin))return false
  if (!atLeast(r.netMargin,      f.netMarginMin))      return false
  if (!atLeast(r.revenueGrowth,  f.revenueGrowthMin))  return false
  if (!atLeast(r.epsGrowth,      f.epsGrowthMin))      return false
  if (!atLeast(r.dividendYield,  f.dividendYieldMin))  return false
  if (!atLeast(r.currentRatio,   f.currentRatioMin))   return false
  if (!atLeast(r.ytdReturn,      f.ytdReturnMin))      return false
  if (!atLeast(r.pctFrom52wLow,  f.pctFrom52wLowMin))  return false
  if (!atMost(r.pe,              f.peMax))             return false
  if (!atMost(r.pb,              f.pbMax))             return false
  if (!atMost(r.debtEquity,      f.debtEquityMax))     return false
  if (!atMost(r.beta,            f.betaMax))           return false
  if (!atMost(r.pctFrom52wHigh,  f.pctFrom52wHighMax)) return false
  if (f.marketCapMinB != null && r.marketCap != null && r.marketCap < f.marketCapMinB * 1e9) return false
  if (f.sharesDeclineYoy && r.sharesChangeYoy != null && r.sharesChangeYoy > 0) return false
  if (f.sector && r.sector !== '--' && r.sector !== f.sector) return false
  return true
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let filters: ScreenerFilters = {}
  try { filters = (await req.json()) as ScreenerFilters } catch { /* empty */ }

  const now = Date.now()
  if (!rowsCache || now - rowsCache.fetchedAt > CACHE_TTL_MS) {
    await warmCache()
  }

  const allRows = rowsCache?.rows ?? []
  const filtered = allRows
    .filter(r => passes(filters, r))
    .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))

  const offset = Math.max(0, filters.offset ?? 0)
  return NextResponse.json({ rows: filtered.slice(offset, offset + 100), total: filtered.length, offset })
}


