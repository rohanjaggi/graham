import { NextRequest, NextResponse } from 'next/server'

// Yahoo Finance range/interval mapping — no API key required
const PERIOD_MAP: Record<string, { range: string; interval: string }> = {
  '1W': { range: '5d',  interval: '30m' },
  '1M': { range: '1mo', interval: '1d'  },
  '3M': { range: '3mo', interval: '1d'  },
  '6M': { range: '6mo', interval: '1d'  },
  '1Y': { range: '1y',  interval: '1d'  },
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params
  const sym = symbol.toUpperCase()
  const period = request.nextUrl.searchParams.get('period') ?? '1M'
  const { range, interval } = PERIOD_MAP[period] ?? PERIOD_MAP['1M']

  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=${interval}&range=${range}`,
    {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 3600 },
    }
  )

  if (!res.ok) return NextResponse.json({ error: 'Failed to fetch chart data' }, { status: 502 })

  const json = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result) return NextResponse.json({ error: 'No chart data' }, { status: 404 })

  const timestamps: number[] = result.timestamp ?? []
  const quote = result.indicators?.quote?.[0] ?? {}
  const closes: (number | null)[] = quote.close ?? []

  // Filter out entries with any null OHLCV field (market closures / incomplete data)
  const candles = timestamps
    .map((t, i) => ({ t, c: closes[i], o: quote.open?.[i], h: quote.high?.[i], l: quote.low?.[i], v: quote.volume?.[i] }))
    .filter(c => c.c != null && c.o != null && c.h != null && c.l != null && c.v != null) as { t: number; c: number; o: number; h: number; l: number; v: number }[]

  if (candles.length < 2) return NextResponse.json({ error: 'Insufficient data' }, { status: 404 })

  const first = candles[0].c
  const last  = candles[candles.length - 1].c
  const periodReturn = ((last - first) / first) * 100

  return NextResponse.json({ symbol: sym, period, candles, periodReturn })
}
