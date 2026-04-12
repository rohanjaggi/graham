import { NextRequest, NextResponse } from 'next/server'
import { fetchMergedCompanySnapshot } from '@/lib/market/companySnapshot'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params
  const sym = symbol.toUpperCase()
  const key = process.env.FINNHUB_API_KEY
  if (!key) return NextResponse.json({ error: 'Missing FINNHUB_API_KEY' }, { status: 500 })

  const base = 'https://finnhub.io/api/v1'
  const today = new Date()
  const from = new Date(today)
  from.setDate(today.getDate() - 30)
  const toStr = today.toISOString().split('T')[0]
  const fromStr = from.toISOString().split('T')[0]

  const [snapshot, news] = await Promise.all([
    fetchMergedCompanySnapshot(sym, key),
    fetch(`${base}/company-news?symbol=${sym}&from=${fromStr}&to=${toStr}&token=${key}`, { next: { revalidate: 900 } })
      .then((response) => (response.ok ? response.json() : []))
      .then((payload) => (Array.isArray(payload) ? payload.slice(0, 12) : []))
      .catch(() => []),
  ])

  if (!snapshot) {
    return NextResponse.json({ error: 'Ticker not found' }, { status: 404 })
  }

  const metrics = snapshot.metrics

  return NextResponse.json({
    symbol: sym,
    name: snapshot.name,
    exchange: snapshot.exchange ?? '—',
    sector: snapshot.sector ?? '—',
    country: snapshot.country ?? '—',
    website: snapshot.website,
    logo: snapshot.logo,
    marketCap: snapshot.marketCap,
    description: null,

    price: snapshot.price,
    priceChange: snapshot.priceChange,
    priceChangePct: snapshot.priceChangePct,
    dayHigh: snapshot.dayHigh,
    dayLow: snapshot.dayLow,
    open: snapshot.open,
    prevClose: snapshot.prevClose,

    pe: metrics['peNormalizedAnnual'] ?? metrics['peTTM'] ?? metrics['peBasicExclExtraTTM'] ?? null,
    peNormalized: metrics['peNormalizedAnnual'] ?? null,
    peTtm: metrics['peTTM'] ?? metrics['peBasicExclExtraTTM'] ?? null,
    pb: metrics['pbAnnual'] ?? metrics['pbQuarterly'] ?? null,
    evEbitda: metrics['evEbitdaTTM'] ?? null,
    roe: metrics['roeTTM'] ?? null,
    debtEquity: metrics['totalDebt/totalEquityAnnual'] ?? null,
    revenueGrowth: metrics['revenueGrowthTTMYoy'] ?? null,
    grossMargin: metrics['grossMarginTTM'] ?? null,
    dividendYield: metrics['dividendYieldIndicatedAnnual'] ?? null,
    week52High: metrics['52WeekHigh'] ?? null,
    week52Low: metrics['52WeekLow'] ?? null,

    news,
    dataWarnings: snapshot.dataWarnings,
  })
}
