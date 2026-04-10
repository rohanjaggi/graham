export type RiskTolerance = 'DEFENSIVE' | 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'
export type UniverseFilter = 'US_LARGE_CAP' | 'US_ALL_CAP'
export type HorizonBucket = '<3y' | '3-7y' | '>7y'

export const SIMPLE_MODE_PRESETS: Record<RiskTolerance, {
  lookback_period_years: number
  investment_horizon_bucket: HorizonBucket
  universe_filter: UniverseFilter
  risk_free_rate: number
}> = {
  DEFENSIVE: {
    lookback_period_years: 5,
    investment_horizon_bucket: '3-7y',
    universe_filter: 'US_ALL_CAP',
    risk_free_rate: 0.02,
  },
  CONSERVATIVE: {
    lookback_period_years: 5,
    investment_horizon_bucket: '3-7y',
    universe_filter: 'US_ALL_CAP',
    risk_free_rate: 0.02,
  },
  MODERATE: {
    lookback_period_years: 5,
    investment_horizon_bucket: '3-7y',
    universe_filter: 'US_ALL_CAP',
    risk_free_rate: 0.02,
  },
  AGGRESSIVE: {
    lookback_period_years: 5,
    investment_horizon_bucket: '>7y',
    universe_filter: 'US_ALL_CAP',
    risk_free_rate: 0.02,
  },
}

export function normalizeHorizonBucket(value: unknown): HorizonBucket | null {
  if (typeof value !== 'string') return null
  const normalized = value.replace(/\u2013|\u2014/g, '-').trim()
  if (normalized === '<3y' || normalized === '3-7y' || normalized === '>7y') return normalized
  return null
}
