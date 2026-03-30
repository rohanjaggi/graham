import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 1) return NextResponse.json([])

  const key = process.env.FINNHUB_API_KEY
  if (!key) return NextResponse.json({ error: 'Missing FINNHUB_API_KEY' }, { status: 500 })

  const res = await fetch(
    `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${key}`,
    { next: { revalidate: 60 } }
  )
  const data = await res.json()

  /** Finnhub equity-like types; allow exchange-qualified symbols (e.g. VOD.L, AIR.PA, 7203.T). */
  function isEquityListing(r: { type?: string; symbol?: string }): boolean {
    const sym = (r.symbol ?? '').trim()
    if (!sym) return false
    const t = (r.type ?? '').trim()
    const low = t.toLowerCase()
    if (/etf\b|etp\b|mutual fund|closed-end fund|bond\b|\bcrypto\b|\bcurrency\b|commodity\b/.test(low)) return false
    if (low === 'common stock' || low === 'adr' || low === 'preferred stock') return true
    if (/depositary receipt/i.test(t)) return true
    if (low.includes('stock') && !/\betf\b/.test(low)) return true
    if (/ordinary|equity share/i.test(low)) return true
    return false
  }

  const results = (data.result ?? [])
    .filter((r: { type: string; symbol: string }) => isEquityListing(r))
    .slice(0, 12)
    .map((r: { symbol: string; description: string; type: string }) => ({
      symbol: r.symbol,
      description: r.description,
      type: r.type,
    }))

  return NextResponse.json(results)
}
