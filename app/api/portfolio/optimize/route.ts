import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { BENCHMARK_ETFS } from '@/lib/portfolio/benchmarks'
import {
  buildReturnMatrix,
  clampLookbackYears,
  fetchAdjCloseSeries,
  minObservationsForLookback,
  toYahooSymbol,
} from '@/lib/portfolio/yahoo'
import { type Objective, metricsForDailyReturns, runOptimize } from '@/lib/portfolio/optimizer'
import { runProfileOptimize } from '@/lib/portfolio/profileOptimizer'
import { validateUniverseMembership } from '@/lib/portfolio/universe'

const OBJECTIVES: Objective[] = [
  'max_sharpe',
  'max_sortino',
  'max_return',
  'min_volatility',
  'min_max_drawdown',
]

const SYMBOL_PATTERN = /^[A-Z0-9.\-]+$/

function normalizeHorizonBucket(value: unknown): '<3y' | '3-7y' | '>7y' | null {
  if (typeof value !== 'string') return null
  const normalized = value.replace(/â€“|–/g, '-').trim()
  if (normalized === '<3y' || normalized === '3-7y' || normalized === '>7y') return normalized
  return null
}

const HardConstraintsSchema = z.object({
  max_single_position: z.number().min(0).max(0.3).optional(),
  max_sector_weight: z.number().min(0).max(1).optional(),
}).optional()

const LegacyOptimizeBodySchema = z.object({
  symbols: z.array(z.string()).min(2).max(48),
  objective: z.enum(OBJECTIVES).optional(),
  rfAnnual: z.number().min(0).max(0.2).optional(),
  years: z.number().int().min(1).max(5).optional(),
  minOnePercentEach: z.union([z.boolean(), z.string()]).optional(),
})

const ProfileOptimizeBodySchema = z.object({
  asset_tickers: z.array(z.string().min(1)).min(3).max(15),
  lookback_period_years: z.number().int().min(1).max(5).default(5),
  investment_horizon_bucket: z.string(),
  risk_tolerance: z.enum(['DEFENSIVE', 'CONSERVATIVE', 'MODERATE', 'AGGRESSIVE']),
  universe_filter: z.enum(['US_LARGE_CAP', 'US_ALL_CAP']),
  hard_constraints: HardConstraintsSchema,
  risk_free_rate: z.number().min(0).max(0.2).optional(),
})

type AdjSeries = Awaited<ReturnType<typeof fetchAdjCloseSeries>>

function normalizeSymbols(rawSymbols: string[]): string[] {
  const seen = new Set<string>()
  return rawSymbols
    .map((symbol) => String(symbol).trim().toUpperCase())
    .filter((symbol) => {
      if (!SYMBOL_PATTERN.test(symbol) || symbol.length > 20) return false
      if (seen.has(symbol)) return false
      seen.add(symbol)
      return true
    })
}

async function fetchAlignedMatrix(symbols: string[], years: number, includeBenchmarks: boolean) {
  const { minPriceRows } = minObservationsForLookback(years)
  const fetchOrder = includeBenchmarks
    ? [...symbols, ...BENCHMARK_ETFS.map((benchmark) => benchmark.symbol).filter((symbol) => !symbols.includes(symbol))]
    : [...symbols]

  const fetched = new Map<string, AdjSeries>()
  const errors: string[] = []

  await Promise.all(
    fetchOrder.map(async (symbol) => {
      try {
        const series = await fetchAdjCloseSeries(symbol, years)
        if (series.length < minPriceRows) {
          errors.push(`${symbol}: insufficient history`)
          return
        }
        fetched.set(symbol, series)
      } catch {
        errors.push(`${symbol}: fetch failed`)
      }
    })
  )

  for (const symbol of symbols) {
    if (!fetched.has(symbol)) {
      return {
        error: NextResponse.json(
          { error: `Could not load history for ${symbol}.`, details: errors },
          { status: 422 }
        ),
      }
    }
  }

  const aligned = buildReturnMatrix(fetched, years)
  if (!aligned) {
    return {
      error: NextResponse.json(
        {
          error: `Could not align return series (need enough overlapping trading days for a ${years}-year window).`,
          details: errors,
        },
        { status: 422 }
      ),
    }
  }

  return { aligned, errors }
}

async function fetchSectorBySymbol(symbols: string[], apiKey: string): Promise<Record<string, string | null>> {
  const sectorEntries = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const profile = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${apiKey}`, {
          next: { revalidate: 3600 },
        }).then((response) => response.ok ? response.json() : null)

        return [symbol, typeof profile?.finnhubIndustry === 'string' ? profile.finnhubIndustry : null] as const
      } catch {
        return [symbol, null] as const
      }
    })
  )

  return Object.fromEntries(sectorEntries)
}

async function handleLegacyOptimize(body: z.infer<typeof LegacyOptimizeBodySchema>) {
  const symbols = normalizeSymbols(body.symbols)
  if (symbols.length < 2) {
    return NextResponse.json({ error: 'Need at least two valid unique tickers.' }, { status: 400 })
  }

  const minOnePercentEach = body.minOnePercentEach === true || body.minOnePercentEach === 'true'
  const objective = body.objective ?? 'max_sharpe'
  const rfAnnual = body.rfAnnual ?? 0.04
  const years = clampLookbackYears(body.years ?? 5)

  const matrixResult = await fetchAlignedMatrix(symbols, years, true)
  if ('error' in matrixResult) return matrixResult.error

  const { aligned } = matrixResult
  const userCols = symbols.map((symbol) => aligned.symbols.indexOf(symbol))
  const returnsOnly = aligned.R.map((row) => userCols.map((columnIndex) => row[columnIndex]))

  let result: ReturnType<typeof runOptimize>
  try {
    result = runOptimize(returnsOnly, symbols, objective, rfAnnual, minOnePercentEach ? 0.01 : 0)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'MIN_WEIGHT_INFEASIBLE') {
      return NextResponse.json(
        { error: 'Cannot give every holding at least 1% with this basket size. Remove some tickers or turn this option off.' },
        { status: 422 }
      )
    }
    return NextResponse.json({ error: 'Optimisation failed.' }, { status: 500 })
  }

  const benchmarkComparisons = BENCHMARK_ETFS.map(({ symbol, name }) => {
    const columnIndex = aligned.symbols.indexOf(symbol)
    if (columnIndex < 0) return null
    const returns = aligned.R.map((row) => row[columnIndex])
    return {
      symbol,
      name,
      metrics: metricsForDailyReturns(returns, rfAnnual),
    }
  }).filter((entry): entry is NonNullable<typeof entry> => entry != null)

  return NextResponse.json({
    ...result,
    benchmarkComparisons,
    lookbackYears: years,
    dataSource: `Yahoo Finance (adjusted daily closes, last ${years} year${years === 1 ? '' : 's'})`,
    yahooSymbols: aligned.symbols.map(toYahooSymbol),
    comparisonNote: 'Benchmark metrics use the same calendar-aligned daily return window as your basket (100% in each ETF).',
  })
}

async function handleProfileOptimize(body: z.infer<typeof ProfileOptimizeBodySchema>) {
  const investmentHorizonBucket = normalizeHorizonBucket(body.investment_horizon_bucket)
  if (!investmentHorizonBucket) {
    return NextResponse.json({ error: 'Invalid investment_horizon_bucket.' }, { status: 400 })
  }

  const symbols = normalizeSymbols(body.asset_tickers)
  if (symbols.length < 3) {
    return NextResponse.json({ error: 'Provide at least three valid unique tickers.' }, { status: 400 })
  }

  const universeCheck = await validateUniverseMembership(symbols, body.universe_filter)
  if (!universeCheck.ok) {
    return NextResponse.json(
      {
        error: `The selected universe excludes: ${universeCheck.outside.join(', ')}.`,
        outside: universeCheck.outside,
      },
      { status: 422 }
    )
  }

  const years = clampLookbackYears(body.lookback_period_years)
  const rfAnnual = body.risk_free_rate ?? 0.02
  const dataWarnings: string[] = []
  const finnhubApiKey = process.env.FINNHUB_API_KEY

  if (!finnhubApiKey && body.hard_constraints?.max_sector_weight != null) {
    return NextResponse.json({ error: 'FINNHUB_API_KEY is required for sector-cap validation.' }, { status: 500 })
  }

  const matrixResult = await fetchAlignedMatrix(symbols, years, false)
  if ('error' in matrixResult) return matrixResult.error

  const { aligned } = matrixResult
  const sectorBySymbol = finnhubApiKey ? await fetchSectorBySymbol(symbols, finnhubApiKey) : {}

  try {
    const result = await runProfileOptimize({
      symbols,
      R: aligned.R,
      timestamps: aligned.timestamps,
      tradingDays: aligned.tradingDays,
      rfAnnual,
      requestedSymbols: symbols,
      years,
      investmentHorizon: investmentHorizonBucket as never,
      riskTolerance: body.risk_tolerance,
      universeFilter: body.universe_filter,
      hardConstraints: body.hard_constraints,
      dataWarnings,
      sectorBySymbol,
    })

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Profile optimisation failed.'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const profileParsed = ProfileOptimizeBodySchema.safeParse(body)
  if (profileParsed.success) {
    return handleProfileOptimize(profileParsed.data)
  }

  const legacyParsed = LegacyOptimizeBodySchema.safeParse(body)
  if (legacyParsed.success) {
    return handleLegacyOptimize(legacyParsed.data)
  }

  return NextResponse.json({ error: 'Request body does not match a supported optimizer schema.' }, { status: 400 })
}
