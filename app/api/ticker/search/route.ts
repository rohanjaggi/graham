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

  // Filter to US equities and common stocks only, return first 8
  const results = (data.result ?? [])
    .filter((r: { type: string; symbol: string }) =>
      r.type === 'Common Stock' && !r.symbol.includes('.')
    )
    .slice(0, 8)
    .map((r: { symbol: string; description: string; type: string }) => ({
      symbol: r.symbol,
      description: r.description,
      type: r.type,
    }))

  return NextResponse.json(results)
}
