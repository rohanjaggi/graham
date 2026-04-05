import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

type PortfolioRow = Record<string, unknown>

const OptimizeRequestSchema = z.object({
  objective: z.enum(['max_sharpe', 'max_sortino', 'max_return', 'min_volatility', 'min_max_drawdown']).optional(),
  asset_tickers: z.array(z.string()).min(3).max(15),
  lookback_period_years: z.number().int().min(1).max(5).optional(),
  investment_horizon_bucket: z.string().optional(),
  risk_tolerance: z.string().optional(),
  universe_filter: z.string().optional(),
  hard_constraints: z.object({
    max_single_position: z.number().min(0).max(0.3).optional(),
    max_sector_weight: z.number().min(0).max(1).optional(),
  }).optional(),
  risk_free_rate: z.number().min(0).max(0.2).optional(),
}).passthrough().optional()

const OptimizeResultSchema = z.object({
  optimal_weights: z.record(z.string(), z.number()),
  expected_annual_return: z.number(),
  expected_annual_volatility: z.number(),
  sharpe_ratio: z.number(),
  max_drawdown: z.number(),
  worst_month_return: z.number(),
  worst_quarter_return: z.number(),
  stress_test_results: z.record(z.string(), z.any()),
  risk_free_rate_used: z.number(),
  data_warnings: z.array(z.string()).optional(),
})

const CreateBodySchema = z.object({
  name: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
  optimizeRequest: OptimizeRequestSchema,
  optimizeResult: OptimizeResultSchema,
})

function normalizeHorizonBucket(value: string | undefined): '<3y' | '3-7y' | '>7y' {
  const normalized = (value ?? '3-7y').replaceAll(/â€“|–/g, '-').trim()
  if (normalized === '<3y' || normalized === '3-7y' || normalized === '>7y') return normalized
  return '3-7y'
}

async function fetchSectorBySymbol(symbols: string[]): Promise<Record<string, string | null>> {
  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) return {}

  const entries = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const response = await fetch(
          `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`,
          { next: { revalidate: 3600 } }
        )
        if (!response.ok) return [symbol, null] as const

        const profile = await response.json()
        const sector = typeof profile?.finnhubIndustry === 'string' && profile.finnhubIndustry.trim()
          ? profile.finnhubIndustry.trim()
          : null

        return [symbol, sector] as const
      } catch {
        return [symbol, null] as const
      }
    })
  )

  return Object.fromEntries(entries)
}

export async function GET() {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('user_portfolios')
    .select('*')
    .eq('user_id', authData.user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching portfolios', error)
    return NextResponse.json({ error: 'Failed to fetch portfolios' }, { status: 500 })
  }

  const portfolios = ((data ?? []) as PortfolioRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    objective: row.objective,
    investmentHorizonBucket: row.investment_horizon_bucket,
    riskTolerance: row.risk_tolerance,
    universeFilter: row.universe_filter,
    lookbackPeriodYears: Number(row.lookback_period_years),
    expectedAnnualReturn: Number(row.expected_annual_return),
    expectedAnnualVolatility: Number(row.expected_annual_volatility),
    sharpeRatio: Number(row.sharpe_ratio),
    maxDrawdown: Number(row.max_drawdown),
    worstMonthReturn: Number(row.worst_month_return),
    worstQuarterReturn: Number(row.worst_quarter_return),
    riskFreeRateUsed: Number(row.risk_free_rate_used),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))

  return NextResponse.json({ portfolios })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = CreateBodySchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Invalid request body'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const { name, notes, optimizeRequest, optimizeResult } = parsed.data
  const weightsEntries = Object.entries(optimizeResult.optimal_weights)
  if (!weightsEntries.length) {
    return NextResponse.json({ error: 'optimal_weights is empty' }, { status: 400 })
  }

  const weightSum = weightsEntries.reduce((sum, [, weight]) => sum + weight, 0)
  if (!Number.isFinite(weightSum) || weightSum <= 0) {
    return NextResponse.json({ error: 'Invalid weight vector' }, { status: 400 })
  }

  const normalizedWeights = weightsEntries.map(([symbol, weight]) => ({
    symbol,
    weight: weight / weightSum,
  }))
  const sectorBySymbol = await fetchSectorBySymbol(normalizedWeights.map((entry) => entry.symbol))

  const insertPayload = {
    user_id: authData.user.id,
    name,
    notes: notes ?? null,
    objective: optimizeRequest?.objective ?? 'max_sharpe',
    investment_horizon_bucket: normalizeHorizonBucket(optimizeRequest?.investment_horizon_bucket),
    risk_tolerance: optimizeRequest?.risk_tolerance ?? 'MODERATE',
    universe_filter: optimizeRequest?.universe_filter ?? 'US_LARGE_CAP',
    lookback_period_years: optimizeRequest?.lookback_period_years ?? 5,
    expected_annual_return: optimizeResult.expected_annual_return,
    expected_annual_volatility: optimizeResult.expected_annual_volatility,
    sharpe_ratio: optimizeResult.sharpe_ratio,
    max_drawdown: optimizeResult.max_drawdown,
    worst_month_return: optimizeResult.worst_month_return,
    worst_quarter_return: optimizeResult.worst_quarter_return,
    risk_free_rate_used: optimizeResult.risk_free_rate_used,
    stress_test_results: optimizeResult.stress_test_results,
    data_warnings: optimizeResult.data_warnings ?? [],
    optimize_request: optimizeRequest ?? null,
  }

  const { data: inserted, error } = await supabase
    .from('user_portfolios')
    .insert(insertPayload)
    .select('id')
    .single()

  if (error || !inserted) {
    console.error('Error inserting portfolio', error)
    return NextResponse.json(
      { error: error?.message ?? 'Failed to save portfolio' },
      { status: 500 }
    )
  }

  const positionsPayload = normalizedWeights.map(({ symbol, weight }) => ({
    portfolio_id: inserted.id,
    symbol,
    weight,
    sector: sectorBySymbol[symbol] ?? null,
  }))

  const { error: positionsError } = await supabase
    .from('user_portfolio_positions')
    .insert(positionsPayload)

  if (positionsError) {
    console.error('Error inserting portfolio positions', positionsError)
    await supabase.from('user_portfolios').delete().eq('id', inserted.id)
    return NextResponse.json(
      { error: positionsError.message || 'Failed to save portfolio positions' },
      { status: 500 }
    )
  }

  return NextResponse.json({ id: inserted.id }, { status: 201 })
}
