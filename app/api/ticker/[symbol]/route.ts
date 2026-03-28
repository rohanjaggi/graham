import { NextRequest, NextResponse } from 'next/server'

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
  from.setDate(today.getDate() - 7)
  const toStr = today.toISOString().split('T')[0]
  const fromStr = from.toISOString().split('T')[0]

  const [profileRes, quoteRes, metricsRes, newsRes] = await Promise.allSettled([
    fetch(`${base}/stock/profile2?symbol=${sym}&token=${key}`, { next: { revalidate: 3600 } }).then(r => r.json()),
    fetch(`${base}/quote?symbol=${sym}&token=${key}`, { next: { revalidate: 30 } }).then(r => r.json()),
    fetch(`${base}/stock/metric?symbol=${sym}&metric=all&token=${key}`, { next: { revalidate: 3600 } }).then(r => r.json()),
    fetch(`${base}/company-news?symbol=${sym}&from=${fromStr}&to=${toStr}&token=${key}`, { next: { revalidate: 900 } }).then(r => r.json()),
  ])

  const profile = profileRes.status === 'fulfilled' ? profileRes.value : {}
  const quote   = quoteRes.status   === 'fulfilled' ? quoteRes.value   : {}
  const metrics = metricsRes.status === 'fulfilled' ? metricsRes.value?.metric ?? {} : {}
  const news    = newsRes.status    === 'fulfilled' && Array.isArray(newsRes.value)
    ? newsRes.value.slice(0, 5)
    : []

  if (!profile?.name) {
    return NextResponse.json({ error: 'Ticker not found' }, { status: 404 })
  }

  return NextResponse.json({
    symbol: sym,
    name: profile.name ?? sym,
    exchange: profile.exchange ?? '—',
    sector: profile.finnhubIndustry ?? '—',
    country: profile.country ?? '—',
    website: profile.weburl ?? null,
    logo: profile.logo ?? null,
    marketCap: profile.marketCapitalization ?? null, // in millions
    description: null, // Finnhub free tier doesn't include description

    price: quote.c ?? null,
    priceChange: quote.d ?? null,
    priceChangePct: quote.dp ?? null,
    dayHigh: quote.h ?? null,
    dayLow: quote.l ?? null,
    open: quote.o ?? null,
    prevClose: quote.pc ?? null,

    pe: metrics['peNormalizedAnnual'] ?? metrics['peTTM'] ?? null,
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
  })
}
