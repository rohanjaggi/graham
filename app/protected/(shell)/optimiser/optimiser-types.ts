export type InvestmentHorizonBucket = '<3y' | '3-7y' | '>7y'
export type RiskTolerance = 'DEFENSIVE' | 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'
export type UniverseFilter = 'US_LARGE_CAP' | 'US_ALL_CAP'
export type Objective = 'max_sharpe' | 'max_sortino' | 'max_return' | 'min_volatility' | 'min_max_drawdown'

export type SearchHit = { symbol: string; description: string }

export type MetricBlock = {
  annualizedReturnPct: number
  annualizedVolatilityPct: number
  sharpe: number
  sortino: number
  maxDrawdownPct: number
}

export type BenchmarkComparison = { symbol: string; name: string; metrics: MetricBlock }

export type ProfileOptimizeResponse = {
  optimal_weights: Record<string, number>
  expected_annual_return: number
  expected_annual_volatility: number
  sharpe_ratio: number
  max_drawdown: number
  worst_month_return: number
  worst_quarter_return: number
  stress_test_results: Record<string, { assumed_shock: number; estimated_portfolio_return: number; estimated_drawdown: number }>
  risk_free_rate_used: number
  data_warnings?: string[]
}

export type OptimizeResultView = {
  weights: { symbol: string; weight: number }[]
  objective: Objective
  expectedAnnualReturn: number
  expectedAnnualVolatility: number
  sharpeRatio: number
  maxDrawdown: number
  worstMonthReturn: number
  worstQuarterReturn: number
  stressTestResults: ProfileOptimizeResponse['stress_test_results']
  riskFreeRateUsed: number
  dataWarnings: string[]
  lookbackYears: number
  sortinoRatio?: number
  observationDays?: number
  benchmarkComparisons?: BenchmarkComparison[]
  comparisonNote?: string
  dataSource?: string
  canSave: boolean
}

export type LegacyOptimizeResponse = {
  weights: { symbol: string; weight: number }[]
  objective: Objective
  metrics: MetricBlock
  sample: { tradingDays: number; rfAnnualPct: number }
  lookbackYears?: number
  dataSource?: string
  benchmarkComparisons?: BenchmarkComparison[]
  comparisonNote?: string
}

export type OptimizeRequestBody = {
  objective?: Objective
  simple_mode?: boolean
  asset_tickers: string[]
  lookback_period_years?: number
  investment_horizon_bucket?: InvestmentHorizonBucket
  risk_tolerance: RiskTolerance
  universe_filter?: UniverseFilter
  hard_constraints?: {
    max_single_position?: number
    max_sector_weight?: number
  }
  risk_free_rate?: number
}
