import { NextRequest, NextResponse } from 'next/server'
import { BENCHMARK_ETFS } from '@/lib/portfolio/benchmarks'
import {
  buildReturnMatrix,
  clampLookbackYears,
  fetchAdjCloseSeries,
  minObservationsForLookback,
  toYahooSymbol,
} from '@/lib/portfolio/yahoo'
import { type Objective, metricsForDailyReturns, runOptimize } from '@/lib/portfolio/optimizer'

const OBJECTIVES: Objective[] = [
  'max_sharpe',
  'max_sortino',
  'max_return',
  'min_volatility',
  'min_max_drawdown',
]

type AdjSeries = Awaited<ReturnType<typeof fetchAdjCloseSeries>>

export async function POST(request: NextRequest) {
  let body: { symbols?: string[]; objective?: string; rfAnnual?: number; years?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const raw = body.symbols
  if (!Array.isArray(raw) || raw.length < 2) {
    return NextResponse.json({ error: 'Provide at least two distinct tickers.' }, { status: 400 })
  }

  const seen = new Set<string>()
  const symbols = raw
    .map(s => String(s).trim().toUpperCase())
    .filter(s => {
      if (!/^[A-Z0-9.\-]+$/.test(s) || s.length > 12) return false
      if (seen.has(s)) return false
      seen.add(s)
      return true
    })

  if (symbols.length < 2) {
    return NextResponse.json({ error: 'Need at least two valid unique tickers.' }, { status: 400 })
  }

  if (symbols.length > 48) {
    return NextResponse.json({ error: 'Maximum 48 tickers per basket.' }, { status: 400 })
  }

  const objective = (body.objective ?? 'max_sharpe') as Objective
  if (!OBJECTIVES.includes(objective)) {
    return NextResponse.json({ error: 'Invalid objective.' }, { status: 400 })
  }

  const rfAnnual = typeof body.rfAnnual === 'number' && body.rfAnnual >= 0 && body.rfAnnual < 0.2 ? body.rfAnnual : 0.04

  const years = clampLookbackYears(typeof body.years === 'number' ? body.years : 5)
  const { minPriceRows } = minObservationsForLookback(years)

  const benchSymbols = BENCHMARK_ETFS.map(b => b.symbol).filter(b => !symbols.includes(b))
  const fetchOrder = [...symbols, ...benchSymbols]

  const fetched = new Map<string, AdjSeries>()
  const errors: string[] = []

  await Promise.all(
    fetchOrder.map(async sym => {
      try {
        const series = await fetchAdjCloseSeries(sym, years)
        if (series.length < minPriceRows) errors.push(`${sym}: insufficient history`)
        else fetched.set(sym, series)
      } catch {
        errors.push(`${sym}: fetch failed`)
      }
    })
  )

  const seriesBySymbol = new Map<string, AdjSeries>()
  for (const sym of fetchOrder) {
    const s = fetched.get(sym)
    if (s) seriesBySymbol.set(sym, s)
  }

  for (const sym of symbols) {
    if (!seriesBySymbol.has(sym)) {
      return NextResponse.json(
        { error: `Could not load history for ${sym}.`, details: errors },
        { status: 422 }
      )
    }
  }

  if (seriesBySymbol.size < 2) {
    return NextResponse.json(
      { error: 'Could not load enough overlapping history for at least two symbols.', details: errors },
      { status: 422 }
    )
  }

  const aligned = buildReturnMatrix(seriesBySymbol, years)
  if (!aligned) {
    return NextResponse.json(
      {
        error: `Could not align return series (need enough overlapping trading days for a ${years}-year window).`,
        details: errors,
      },
      { status: 422 }
    )
  }

  const { symbols: colSyms, R } = aligned

  const userCols = symbols.map(s => colSyms.indexOf(s))
  if (userCols.some(j => j < 0)) {
    return NextResponse.json({ error: 'Basket symbols missing from aligned matrix.' }, { status: 422 })
  }
  const R_only = R.map(row => userCols.map(j => row[j]))

  const result = runOptimize(R_only, symbols, objective, rfAnnual)

  const benchmarkComparisons = BENCHMARK_ETFS.map(({ symbol: sym, name }) => {
    const j = colSyms.indexOf(sym)
    if (j < 0) return null
    const rp = R.map(row => row[j])
    return {
      symbol: sym,
      name,
      metrics: metricsForDailyReturns(rp, rfAnnual),
    }
  }).filter((x): x is NonNullable<typeof x> => x != null)

  return NextResponse.json({
    ...result,
    benchmarkComparisons,
    lookbackYears: years,
    dataSource: `Yahoo Finance (adjusted daily closes, last ${years} year${years === 1 ? '' : 's'})`,
    yahooSymbols: colSyms.map(toYahooSymbol),
    comparisonNote:
      'Benchmark metrics use the same calendar-aligned daily return window as your basket (100% in each ETF).',
  })
}
