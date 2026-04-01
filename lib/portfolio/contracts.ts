export type InvestmentHorizonBucket = '<3y' | '3–7y' | '>7y'
export type RiskTolerance = 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'
export type UniverseFilter = 'US_LARGE_CAP' | 'US_ALL_CAP'

export interface HardConstraints {
  max_single_position?: number // e.g. 0.25
  max_sector_weight?: number   // e.g. 0.40
}

export interface ProfileOptimizeContext {
  symbols: string[]               // from buildReturnMatrix
  R: number[][]                   // T x n daily returns
  tradingDays: number             // days covered
  rfAnnual: number                // e.g. 0.02
  requestedSymbols: string[]      // original list, for sanity checks
  years: number
  investmentHorizon: InvestmentHorizonBucket
  riskTolerance: RiskTolerance
  universeFilter: UniverseFilter
  hardConstraints?: HardConstraints
  dataWarnings: string[]
}

export interface StressScenarioResult {
  assumed_shock: number          // e.g. -0.30
  estimated_portfolio_return: number
  estimated_drawdown: number
}

export interface StressTestResults {
  equity_crash_30: StressScenarioResult
  equity_crash_50: StressScenarioResult
}

export interface PortfolioProfileOptimizeResponse {
  optimal_weights: Record<string, number>
  expected_annual_return: number
  expected_annual_volatility: number
  sharpe_ratio: number
  max_drawdown: number
  worst_month_return: number
  worst_quarter_return: number
  stress_test_results: StressTestResults
  risk_free_rate_used: number
  data_warnings?: string[]
}