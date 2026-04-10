import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { fetchMergedCompanySnapshot } from '@/lib/market/companySnapshot'

type PortfolioRow = Record<string, unknown>
type PositionRow = Record<string, unknown>
type PositionMetadata = { companyName: string | null; pe: number | null; sector: string | null }

const PatchBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  notes: z.string().max(2000).nullable().optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

const POSITION_METADATA_TTL_MS = 30 * 60 * 1000
const positionMetadataCache = new Map<string, { expiresAt: number; value: PositionMetadata }>()

async function fetchSectorBySymbol(symbols: string[]): Promise<Record<string, string | null>> {
  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey || symbols.length === 0) return {}

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

async function fetchPositionMetadata(symbols: string[]): Promise<Record<string, PositionMetadata>> {
  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey || symbols.length === 0) return {}

  const now = Date.now()
  const cachedEntries: Array<readonly [string, PositionMetadata]> = []
  const missingSymbols: string[] = []

  for (const symbol of symbols) {
    const cached = positionMetadataCache.get(symbol)
    if (cached && cached.expiresAt > now) {
      cachedEntries.push([symbol, cached.value] as const)
    } else {
      missingSymbols.push(symbol)
    }
  }

  const entries = await Promise.all(
    missingSymbols.map(async (symbol) => {
      try {
        const snapshot = await fetchMergedCompanySnapshot(symbol, apiKey)
        const pe =
          typeof snapshot?.metrics?.peNormalizedAnnual === 'number' ? snapshot.metrics.peNormalizedAnnual
          : typeof snapshot?.metrics?.peTTM === 'number' ? snapshot.metrics.peTTM
          : typeof snapshot?.metrics?.peBasicExclExtraTTM === 'number' ? snapshot.metrics.peBasicExclExtraTTM
          : null

        const value = {
          companyName: snapshot?.name ?? null,
          pe,
          sector: snapshot?.sector ?? null,
        }
        positionMetadataCache.set(symbol, { expiresAt: now + POSITION_METADATA_TTL_MS, value })
        return [
          symbol,
          value,
        ] as const
      } catch {
        const value = { companyName: null, pe: null, sector: null }
        positionMetadataCache.set(symbol, { expiresAt: now + 5 * 60 * 1000, value })
        return [symbol, value] as const
      }
    })
  )

  return Object.fromEntries([...cachedEntries, ...entries])
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params

  const { data: portfolio, error: portfolioError } = await supabase
    .from('user_portfolios')
    .select('*')
    .eq('id', id)
    .single()

  if (portfolioError || !portfolio) {
    return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 })
  }

  const { data: positions, error: positionsError } = await supabase
    .from('user_portfolio_positions')
    .select('*')
    .eq('portfolio_id', id)
    .order('weight', { ascending: false })

  if (positionsError) {
    console.error('Error fetching positions', positionsError)
    return NextResponse.json({ error: 'Failed to fetch positions' }, { status: 500 })
  }

  const portfolioRow = portfolio as PortfolioRow
  const positionRows = (positions ?? []) as PositionRow[]
  const symbols = positionRows
    .map((position) => (typeof position.symbol === 'string' ? position.symbol : null))
    .filter((symbol): symbol is string => Boolean(symbol))

  const missingSectorSymbols = positionRows
    .filter((position) => position.sector == null && typeof position.symbol === 'string')
    .map((position) => String(position.symbol))

  if (missingSectorSymbols.length > 0) {
    const sectors = await fetchSectorBySymbol(missingSectorSymbols)
    await Promise.all(
      missingSectorSymbols.map(async (symbol) => {
        const sector = sectors[symbol] ?? null
        if (!sector) return

        await supabase
          .from('user_portfolio_positions')
          .update({ sector })
          .eq('portfolio_id', id)
          .eq('symbol', symbol)
      })
    )

    for (const position of positionRows) {
      if (typeof position.symbol === 'string' && position.sector == null) {
        position.sector = sectors[position.symbol] ?? null
      }
    }
  }

  const metadataBySymbol = await fetchPositionMetadata(symbols)

  return NextResponse.json({
    portfolio: {
      id: portfolioRow.id,
      name: portfolioRow.name,
      objective: portfolioRow.objective,
      investmentHorizonBucket: portfolioRow.investment_horizon_bucket,
      riskTolerance: portfolioRow.risk_tolerance,
      universeFilter: portfolioRow.universe_filter,
      lookbackPeriodYears: Number(portfolioRow.lookback_period_years),
      expectedAnnualReturn: Number(portfolioRow.expected_annual_return),
      expectedAnnualVolatility: Number(portfolioRow.expected_annual_volatility),
      sharpeRatio: Number(portfolioRow.sharpe_ratio),
      maxDrawdown: Number(portfolioRow.max_drawdown),
      worstMonthReturn: Number(portfolioRow.worst_month_return),
      worstQuarterReturn: Number(portfolioRow.worst_quarter_return),
      riskFreeRateUsed: Number(portfolioRow.risk_free_rate_used),
      stressTestResults: portfolioRow.stress_test_results ?? {},
      dataWarnings: Array.isArray(portfolioRow.data_warnings) ? portfolioRow.data_warnings : [],
      optimizeRequest: portfolioRow.optimize_request ?? null,
      notes: portfolioRow.notes,
      createdAt: portfolioRow.created_at,
      updatedAt: portfolioRow.updated_at,
    },
    positions: positionRows.map((position) => {
      const symbol = String(position.symbol)
      const metadata = metadataBySymbol[symbol]
      return {
        symbol,
        weight: Number(position.weight),
        sector: position.sector ?? metadata?.sector ?? null,
        companyName: metadata?.companyName ?? symbol,
        pe: metadata?.pe ?? null,
      }
    }),
  })
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const { error } = await supabase.from('user_portfolios').delete().eq('id', id)

  if (error) {
    console.error('Error deleting portfolio', error)
    return NextResponse.json({ error: 'Failed to delete portfolio' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
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

  const parsed = PatchBodySchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Invalid body'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (parsed.data.name !== undefined) updates.name = parsed.data.name
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { id } = await params
  const { error } = await supabase.from('user_portfolios').update(updates).eq('id', id)

  if (error) {
    console.error('Error updating portfolio', error)
    return NextResponse.json({ error: 'Failed to update portfolio' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
