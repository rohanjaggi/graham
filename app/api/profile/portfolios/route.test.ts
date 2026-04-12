import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const createClientMock = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

import { GET as getPortfolios, POST as createPortfolio } from './route'
import { GET as getPortfolioById } from './[id]/route'

function buildJsonRequest(body: unknown) {
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as NextRequest
}

describe('portfolio persistence routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('persists normalized positions and profile metadata when saving a portfolio', async () => {
    let insertedPortfolioPayload: Record<string, unknown> | undefined
    let insertedPositionsPayload: Record<string, unknown>[] | undefined

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      },
      from: vi.fn((table: string) => {
        if (table === 'user_portfolios') {
          return {
            insert(payload: Record<string, unknown>) {
              insertedPortfolioPayload = payload
              return {
                select() {
                  return {
                    single: vi.fn().mockResolvedValue({ data: { id: 'portfolio-1' }, error: null }),
                  }
                },
              }
            },
            delete() {
              return { eq: vi.fn().mockResolvedValue({ error: null }) }
            },
          }
        }

        if (table === 'user_portfolio_positions') {
          return {
            insert(payload: Record<string, unknown>[]) {
              insertedPositionsPayload = payload
              return Promise.resolve({ error: null })
            },
          }
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createClientMock.mockResolvedValue(supabase)

    const response = await createPortfolio(buildJsonRequest({
      name: 'Core compounders',
      optimizeRequest: {
        asset_tickers: ['AAA', 'BBB', 'CCC'],
        lookback_period_years: 5,
        investment_horizon_bucket: '3-7y',
        risk_tolerance: 'MODERATE',
        universe_filter: 'US_LARGE_CAP',
        hard_constraints: {
          max_single_position: 0.25,
          max_sector_weight: 0.4,
        },
        risk_free_rate: 0.02,
      },
      optimizeResult: {
        optimal_weights: { AAA: 0.5, BBB: 0.3, CCC: 0.2 },
        expected_annual_return: 0.12,
        expected_annual_volatility: 0.18,
        sharpe_ratio: 0.56,
        max_drawdown: -0.22,
        worst_month_return: -0.09,
        worst_quarter_return: -0.14,
        stress_test_results: {
          equity_crash_30: { assumed_shock: -0.3, estimated_portfolio_return: -0.27, estimated_drawdown: -0.3 },
        },
        risk_free_rate_used: 0.02,
        data_warnings: ['Applied covariance shrinkage with alpha=0.40.'],
      },
    }))

    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload).toEqual({ id: 'portfolio-1' })
    expect(insertedPortfolioPayload).toMatchObject({
      user_id: 'user-1',
      name: 'Core compounders',
      objective: 'max_sharpe',
      investment_horizon_bucket: '3-7y',
      risk_tolerance: 'MODERATE',
      universe_filter: 'US_LARGE_CAP',
      lookback_period_years: 5,
      stress_test_results: {
        equity_crash_30: { assumed_shock: -0.3, estimated_portfolio_return: -0.27, estimated_drawdown: -0.3 },
      },
      data_warnings: ['Applied covariance shrinkage with alpha=0.40.'],
    })
    expect(insertedPositionsPayload).toEqual([
      {
        portfolio_id: 'portfolio-1',
        symbol: 'AAA',
        weight: 0.5,
        sector: null,
        industry: null,
        company_name: null,
        pe_snapshot: null,
        market_value_snapshot: null,
      },
      {
        portfolio_id: 'portfolio-1',
        symbol: 'BBB',
        weight: 0.3,
        sector: null,
        industry: null,
        company_name: null,
        pe_snapshot: null,
        market_value_snapshot: null,
      },
      {
        portfolio_id: 'portfolio-1',
        symbol: 'CCC',
        weight: 0.2,
        sector: null,
        industry: null,
        company_name: null,
        pe_snapshot: null,
        market_value_snapshot: null,
      },
    ])
  })

  it('maps saved portfolio detail into the expected API shape', async () => {
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      },
      from: vi.fn((table: string) => {
        if (table === 'user_portfolios') {
          return {
            select() {
              return {
                eq() {
                  return {
                    single: vi.fn().mockResolvedValue({
                      data: {
                        id: 'portfolio-1',
                        name: 'Core compounders',
                        objective: 'max_sharpe',
                        investment_horizon_bucket: '3-7y',
                        risk_tolerance: 'MODERATE',
                        universe_filter: 'US_LARGE_CAP',
                        lookback_period_years: 5,
                        expected_annual_return: 0.12,
                        expected_annual_volatility: 0.18,
                        sharpe_ratio: 0.56,
                        max_drawdown: -0.22,
                        worst_month_return: -0.09,
                        worst_quarter_return: -0.14,
                        risk_free_rate_used: 0.02,
                        stress_test_results: { equity_crash_30: { assumed_shock: -0.3, estimated_portfolio_return: -0.27, estimated_drawdown: -0.3 } },
                        data_warnings: ['warning-1'],
                        optimize_request: { asset_tickers: ['AAA', 'BBB', 'CCC'] },
                        notes: 'Long-term basket',
                        created_at: '2026-04-02T00:00:00Z',
                        updated_at: '2026-04-02T01:00:00Z',
                      },
                      error: null,
                    }),
                  }
                },
              }
            },
          }
        }

        if (table === 'user_portfolio_positions') {
          return {
            select() {
              return {
                eq() {
                  return {
                    order: vi.fn().mockResolvedValue({
                      data: [
                        { symbol: 'AAA', weight: 0.5, sector: 'Tech', industry: 'Software', company_name: 'Alpha Apps', pe_snapshot: 22.4, market_value_snapshot: null },
                        { symbol: 'BBB', weight: 0.3, sector: 'Health', industry: 'Biotech', company_name: 'Beta Bio', pe_snapshot: null, market_value_snapshot: null },
                      ],
                      error: null,
                    }),
                  }
                },
              }
            },
          }
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createClientMock.mockResolvedValue(supabase)

    const response = await getPortfolioById({} as NextRequest, { params: Promise.resolve({ id: 'portfolio-1' }) })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      portfolio: {
        id: 'portfolio-1',
        name: 'Core compounders',
        investmentHorizonBucket: '3-7y',
        riskTolerance: 'MODERATE',
        universeFilter: 'US_LARGE_CAP',
        lookbackPeriodYears: 5,
        expectedAnnualReturn: 0.12,
        stressTestResults: { equity_crash_30: { assumed_shock: -0.3, estimated_portfolio_return: -0.27, estimated_drawdown: -0.3 } },
        dataWarnings: ['warning-1'],
      },
      positions: [
        { symbol: 'AAA', weight: 0.5, sector: 'Tech', industry: 'Software', companyName: 'Alpha Apps', pe: 22.4, marketValueSnapshot: null },
        { symbol: 'BBB', weight: 0.3, sector: 'Health', industry: 'Biotech', companyName: 'Beta Bio', pe: null, marketValueSnapshot: null },
      ],
    })
  })

  it('returns 401 for unauthenticated portfolio list requests', async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    })

    const response = await getPortfolios()
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({ error: 'Not authenticated' })
  })
})
