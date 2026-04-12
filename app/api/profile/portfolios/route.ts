import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  normalizeHorizonBucket,
  SIMPLE_MODE_PRESETS,
  type RiskTolerance,
} from '@/lib/portfolio/simpleMode'
import { fetchMergedCompanySnapshot } from '@/lib/market/companySnapshot'
import { createClient } from '@/lib/supabase/server'

type PortfolioRow = Record<string, unknown>

const PORTFOLIO_LIST_CACHE_TTL_MS = 30 * 1000

type PortfolioListResponse = {
  portfolios: Array<{
    id: unknown
    name: unknown
    objective: unknown
    investmentHorizonBucket: unknown
    riskTolerance: unknown
    universeFilter: unknown
    lookbackPeriodYears: number
    expectedAnnualReturn: number
    expectedAnnualVolatility: number
    sharpeRatio: number
    maxDrawdown: number
    worstMonthReturn: number
    worstQuarterReturn: number
    riskFreeRateUsed: number
    createdAt: unknown
    updatedAt: unknown
  }>
}

declare global {
  var __grahamPortfolioListCache: Map<string, { data: PortfolioListResponse; expiresAt: number }> | undefined
}

const portfolioListCache = globalThis.__grahamPortfolioListCache ?? new Map<string, { data: PortfolioListResponse; expiresAt: number }>()
globalThis.__grahamPortfolioListCache = portfolioListCache

const OptimizeRequestSchema = z.object({
  objective: z.enum(['max_sharpe', 'max_sortino', 'max_return', 'min_volatility', 'min_max_drawdown']).optional(),
  simple_mode: z.boolean().optional(),
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

type PositionSnapshot = {
  companyName: string | null
  industry: string | null
  sector: string | null
  pe: number | null
  marketValue: number | null
}

function derivePeFromSnapshot(snapshot: Awaited<ReturnType<typeof fetchMergedCompanySnapshot>>): number | null {
  return typeof snapshot?.metrics?.peNormalizedAnnual === 'number' ? snapshot.metrics.peNormalizedAnnual
    : typeof snapshot?.metrics?.peTTM === 'number' ? snapshot.metrics.peTTM
    : typeof snapshot?.metrics?.peBasicExclExtraTTM === 'number' ? snapshot.metrics.peBasicExclExtraTTM
    : null
}

async function fetchPositionSnapshots(symbols: string[]): Promise<Record<string, PositionSnapshot>> {
  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) return {}

  const entries = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const snapshot = await fetchMergedCompanySnapshot(symbol, apiKey)
        return [
          symbol,
          {
            companyName: snapshot?.name ?? null,
            industry: snapshot?.industry ?? null,
            sector: snapshot?.sector ?? null,
            pe: derivePeFromSnapshot(snapshot),
            marketValue: null,
          },
        ] as const
      } catch {
        return [
          symbol,
          { companyName: null, industry: null, sector: null, pe: null, marketValue: null },
        ] as const
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

  const cacheKey = authData.user.id
  const cached = portfolioListCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data)
  }

  const { data, error } = await supabase
    .from('user_portfolios')
    .select('*')
    .eq('user_id', authData.user.id)
    .order('updated_at', { ascending: false })

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

  const response = { portfolios }
  portfolioListCache.set(cacheKey, {
    data: response,
    expiresAt: Date.now() + PORTFOLIO_LIST_CACHE_TTL_MS,
  })

  return NextResponse.json(response)
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
  const snapshotsBySymbol = await fetchPositionSnapshots(normalizedWeights.map((entry) => entry.symbol))
  const riskTolerance = (optimizeRequest?.risk_tolerance ?? 'MODERATE') as RiskTolerance
  const simplePreset = optimizeRequest?.simple_mode === true ? SIMPLE_MODE_PRESETS[riskTolerance] : null

  const insertPayload = {
    user_id: authData.user.id,
    name,
    notes: notes ?? null,
    objective: optimizeRequest?.objective ?? 'max_sharpe',
    investment_horizon_bucket: normalizeHorizonBucket(
      optimizeRequest?.investment_horizon_bucket ?? simplePreset?.investment_horizon_bucket ?? '3-7y'
    ) ?? '3-7y',
    risk_tolerance: riskTolerance,
    universe_filter: optimizeRequest?.universe_filter ?? simplePreset?.universe_filter ?? 'US_ALL_CAP',
    lookback_period_years: optimizeRequest?.lookback_period_years ?? simplePreset?.lookback_period_years ?? 5,
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
    sector: snapshotsBySymbol[symbol]?.sector ?? null,
    industry: snapshotsBySymbol[symbol]?.industry ?? null,
    company_name: snapshotsBySymbol[symbol]?.companyName ?? null,
    pe_snapshot: snapshotsBySymbol[symbol]?.pe ?? null,
    market_value_snapshot: snapshotsBySymbol[symbol]?.marketValue ?? null,
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

  portfolioListCache.delete(authData.user.id)

  return NextResponse.json({ id: inserted.id }, { status: 201 })
}

