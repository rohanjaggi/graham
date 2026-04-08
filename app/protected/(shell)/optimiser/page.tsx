'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

type InvestmentHorizonBucket = '<3y' | '3-7y' | '>7y'
type RiskTolerance = 'DEFENSIVE' | 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'
type UniverseFilter = 'US_LARGE_CAP' | 'US_ALL_CAP'
type Objective = 'max_sharpe' | 'max_sortino' | 'max_return' | 'min_volatility' | 'min_max_drawdown'

type SearchHit = { symbol: string; description: string }
type MetricBlock = {
  annualizedReturnPct: number
  annualizedVolatilityPct: number
  sharpe: number
  sortino: number
  maxDrawdownPct: number
}
type BenchmarkComparison = { symbol: string; name: string; metrics: MetricBlock }

type ProfileOptimizeResponse = {
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

type OptimizeResultView = {
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

type LegacyOptimizeResponse = {
  weights: { symbol: string; weight: number }[]
  objective: Objective
  metrics: MetricBlock
  sample: { tradingDays: number; rfAnnualPct: number }
  lookbackYears?: number
  dataSource?: string
  benchmarkComparisons?: BenchmarkComparison[]
  comparisonNote?: string
}

type OptimizeRequestBody = {
  objective?: Objective
  asset_tickers: string[]
  lookback_period_years: number
  investment_horizon_bucket: InvestmentHorizonBucket
  risk_tolerance: RiskTolerance
  universe_filter: UniverseFilter
  hard_constraints?: {
    max_single_position?: number
    max_sector_weight?: number
  }
  risk_free_rate?: number
}

const INITIAL_TICKERS = ['GOOGL', 'MSFT', 'META']
const HORIZON_OPTIONS: { value: InvestmentHorizonBucket; label: string }[] = [
  { value: '<3y', label: 'Under 3 years' },
  { value: '3-7y', label: '3 to 7 years' },
  { value: '>7y', label: 'Over 7 years' },
]
const RISK_OPTIONS: RiskTolerance[] = ['DEFENSIVE', 'CONSERVATIVE', 'MODERATE', 'AGGRESSIVE']
const UNIVERSE_OPTIONS: UniverseFilter[] = ['US_LARGE_CAP', 'US_ALL_CAP']
const OBJECTIVE_OPTIONS: { id: Objective; label: string; hint: string; profileAware: boolean }[] = [
  { id: 'max_sharpe', label: 'Maximise Sharpe ratio', hint: 'Best fit for the saved portfolio flow with your investor-profile constraints.', profileAware: true },
  { id: 'max_sortino', label: 'Maximise Sortino ratio', hint: 'Optimises excess return while only penalising downside volatility.', profileAware: false },
  { id: 'max_return', label: 'Maximise expected return', hint: 'Historically return-seeking allocation with no diversification preference.', profileAware: false },
  { id: 'min_volatility', label: 'Minimise volatility', hint: 'Looks for the lowest-variance basket over the chosen return window.', profileAware: false },
  { id: 'min_max_drawdown', label: 'Minimise max drawdown', hint: 'Heuristic search to reduce the worst historical peak-to-trough loss.', profileAware: false },
]

function normalizeOptimizeResponse(payload: ProfileOptimizeResponse, years: number): OptimizeResultView {
  return {
    weights: Object.entries(payload.optimal_weights)
      .map(([symbol, weight]) => ({ symbol, weight }))
      .sort((a, b) => b.weight - a.weight),
    objective: 'max_sharpe',
    expectedAnnualReturn: payload.expected_annual_return,
    expectedAnnualVolatility: payload.expected_annual_volatility,
    sharpeRatio: payload.sharpe_ratio,
    maxDrawdown: payload.max_drawdown,
    worstMonthReturn: payload.worst_month_return,
    worstQuarterReturn: payload.worst_quarter_return,
    stressTestResults: payload.stress_test_results,
    riskFreeRateUsed: payload.risk_free_rate_used,
    dataWarnings: payload.data_warnings ?? [],
    lookbackYears: years,
    canSave: true,
  }
}

function normalizeLegacyOptimizeResponse(payload: LegacyOptimizeResponse, years: number): OptimizeResultView {
  return {
    weights: payload.weights,
    objective: payload.objective,
    expectedAnnualReturn: payload.metrics.annualizedReturnPct / 100,
    expectedAnnualVolatility: payload.metrics.annualizedVolatilityPct / 100,
    sharpeRatio: payload.metrics.sharpe,
    maxDrawdown: payload.metrics.maxDrawdownPct / 100,
    worstMonthReturn: 0,
    worstQuarterReturn: 0,
    stressTestResults: {},
    riskFreeRateUsed: payload.sample.rfAnnualPct / 100,
    dataWarnings: [],
    lookbackYears: payload.lookbackYears ?? years,
    sortinoRatio: payload.metrics.sortino,
    observationDays: payload.sample.tradingDays,
    benchmarkComparisons: payload.benchmarkComparisons,
    comparisonNote: payload.comparisonNote,
    dataSource: payload.dataSource,
    canSave: true,
  }
}

function toPersistedResult(result: OptimizeResultView): ProfileOptimizeResponse {
  return {
    optimal_weights: Object.fromEntries(result.weights.map(({ symbol, weight }) => [symbol, weight])),
    expected_annual_return: result.expectedAnnualReturn,
    expected_annual_volatility: result.expectedAnnualVolatility,
    sharpe_ratio: result.sharpeRatio,
    max_drawdown: result.maxDrawdown,
    worst_month_return: result.worstMonthReturn,
    worst_quarter_return: result.worstQuarterReturn,
    stress_test_results: result.stressTestResults,
    risk_free_rate_used: result.riskFreeRateUsed,
    data_warnings: result.dataWarnings,
  }
}

function formatPct(value: number | undefined) {
  if (value == null || Number.isNaN(value)) return '—'
  return `${(value * 100).toFixed(2)}%`
}


function parsePercentInput(raw: string, maxPercent: number) {
  return Math.min(maxPercent, Math.max(0, Number(raw) || 0)) / 100
}

function getClientValidationMessage(tickers: string[], request: OptimizeRequestBody): string | null {
  if (tickers.length < 3) return 'Add at least three tickers.'
  if (tickers.length > 15) return 'Use between 3 and 15 tickers for this portfolio proof of concept.'

  const maxSinglePosition = request.hard_constraints?.max_single_position ?? 0.3
  if (maxSinglePosition <= 0) return 'Max single position must be greater than 0%.'

  const feasibilityBuffer = 1e-9
  if ((tickers.length * maxSinglePosition) + feasibilityBuffer < 1) {
    const minTickersRequired = Math.ceil(1 / maxSinglePosition)
    const missingTickers = minTickersRequired - tickers.length
    return `With a ${(maxSinglePosition * 100).toFixed(0)}% max single-position cap, you need at least ${minTickersRequired} tickers to stay fully invested. Add ${missingTickers} more ${missingTickers == 1 ? 'ticker' : 'tickers'} or raise the cap.`
  }

  return null
}

function getInvestorPreset(riskTolerance: RiskTolerance) {
  if (riskTolerance === 'DEFENSIVE') {
    return {
      description: 'Most protective profile with the tightest concentration limits and a broad US universe.',
      universeFilter: 'US_ALL_CAP' as UniverseFilter,
      lookbackYears: 5,
      investmentHorizon: '3-7y' as InvestmentHorizonBucket,
      maxSinglePosition: 0.15,
      maxSectorWeight: 0.25,
      riskFreeRate: 0.02,
    }
  }

  if (riskTolerance === 'CONSERVATIVE') {
    return {
      description: 'Diversified, steadier profile with tighter concentration guardrails and a broad US universe.',
      universeFilter: 'US_ALL_CAP' as UniverseFilter,
      lookbackYears: 5,
      investmentHorizon: '3-7y' as InvestmentHorizonBucket,
      maxSinglePosition: 0.2,
      maxSectorWeight: 0.3,
      riskFreeRate: 0.02,
    }
  }

  if (riskTolerance === 'AGGRESSIVE') {
    return {
      description: 'Higher-risk profile with a focused large-cap universe and looser concentration limits.',
      universeFilter: 'US_LARGE_CAP' as UniverseFilter,
      lookbackYears: 3,
      investmentHorizon: '>7y' as InvestmentHorizonBucket,
      maxSinglePosition: 0.3,
      maxSectorWeight: 0.5,
      riskFreeRate: 0.02,
    }
  }

  return {
    description: 'Balanced long-term profile using broad US equities and middle-of-the-road diversification defaults.',
    universeFilter: 'US_ALL_CAP' as UniverseFilter,
    lookbackYears: 5,
    investmentHorizon: '3-7y' as InvestmentHorizonBucket,
    maxSinglePosition: 0.25,
    maxSectorWeight: 0.4,
    riskFreeRate: 0.02,
  }
}

export default function OptimiserPage() {
  const [tickers, setTickers] = useState<string[]>(() => [...INITIAL_TICKERS])
  const [basketQuery, setBasketQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchHit[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const basketSearchRef = useRef<HTMLDivElement>(null)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [years, setYears] = useState(5)
  const [objective, setObjective] = useState<Objective>('max_sharpe')
  const [investmentHorizon, setInvestmentHorizon] = useState<InvestmentHorizonBucket>('3-7y')
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>('MODERATE')
  const [universeFilter, setUniverseFilter] = useState<UniverseFilter>('US_ALL_CAP')
  const [maxSinglePosition, setMaxSinglePosition] = useState('25')
  const [maxSectorWeight, setMaxSectorWeight] = useState('40')
  const [riskFreeRate, setRiskFreeRate] = useState('2')
  const [showAdvancedConstraints, setShowAdvancedConstraints] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<OptimizeResultView | null>(null)
  const [saveName, setSaveName] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)
  const [savedPortfolioId, setSavedPortfolioId] = useState<string | null>(null)
  const investorPreset = getInvestorPreset(riskTolerance)

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (basketSearchRef.current && !basketSearchRef.current.contains(e.target as Node)) setSearchOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    const q = basketQuery.trim()
    if (!q) {
      setSearchResults([])
      setSearchOpen(false)
      setSearchError('')
      return
    }
    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch(`/api/ticker/search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        if (!res.ok) {
          setSearchResults([])
          setSearchError(typeof data?.error === 'string' ? data.error : 'Search unavailable.')
          setSearchOpen(true)
          return
        }
        setSearchResults(Array.isArray(data) ? data : [])
        setSearchOpen(Array.isArray(data) && data.length > 0)
      } catch {
        setSearchResults([])
        setSearchError('Search failed.')
        setSearchOpen(true)
      } finally {
        setSearchLoading(false)
      }
    }, 280)
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [basketQuery])

  useEffect(() => {
    if (showAdvancedConstraints) return
    setUniverseFilter(investorPreset.universeFilter)
    setInvestmentHorizon(investorPreset.investmentHorizon)
    setYears(investorPreset.lookbackYears)
    setMaxSinglePosition(String(investorPreset.maxSinglePosition * 100))
    setMaxSectorWeight(String(investorPreset.maxSectorWeight * 100))
    setRiskFreeRate(String(investorPreset.riskFreeRate * 100))
  }, [investorPreset, showAdvancedConstraints])

  function buildRequest(): OptimizeRequestBody {
    const hardConstraints = showAdvancedConstraints
      ? {
          max_single_position: parsePercentInput(maxSinglePosition, 30),
          max_sector_weight: parsePercentInput(maxSectorWeight, 100),
        }
      : {
          max_single_position: investorPreset.maxSinglePosition,
          max_sector_weight: investorPreset.maxSectorWeight,
        }

    return {
      objective,
      asset_tickers: tickers,
      lookback_period_years: years,
      investment_horizon_bucket: investmentHorizon,
      risk_tolerance: riskTolerance,
      universe_filter: universeFilter,
      hard_constraints: hardConstraints,
      risk_free_rate: showAdvancedConstraints ? parsePercentInput(riskFreeRate, 20) : investorPreset.riskFreeRate,
    }
  }

  function addTicker(symbol: string) {
    const next = symbol.toUpperCase()
    if (tickers.includes(next)) return
    if (tickers.length >= 15) {
      setError('Use between 3 and 15 tickers for this portfolio proof of concept.')
      return
    }
    setTickers((current) => [...current, next])
    setBasketQuery('')
    setSearchResults([])
    setSearchOpen(false)
  }

  function resetOptimiser() {
    setTickers([...INITIAL_TICKERS])
    setBasketQuery('')
    setSearchResults([])
    setSearchOpen(false)
    setSearchError('')
    setYears(5)
    setObjective('max_sharpe')
    setInvestmentHorizon('3-7y')
    setRiskTolerance('MODERATE')
    setUniverseFilter('US_ALL_CAP')
    setMaxSinglePosition('25')
    setMaxSectorWeight('40')
    setRiskFreeRate('2')
    setShowAdvancedConstraints(false)
    setError('')
    setResult(null)
    setSaveError('')
    setSaveMessage('')
    setSaveName('')
    setSavedPortfolioId(null)
  }

  async function runOptimize() {
    setError('')
    setSaveError('')
    setSaveMessage('')
    setSavedPortfolioId(null)
    setResult(null)
    const request = buildRequest()
    const validationMessage = getClientValidationMessage(tickers, request)
    if (validationMessage) {
      setError(validationMessage)
      return
    }
    setLoading(true)
    try {
      const isProfileMode = objective === 'max_sharpe'
      const body = isProfileMode
        ? request
        : {
            symbols: tickers,
            objective,
            years,
            rfAnnual: request.risk_free_rate,
          }

      const res = await fetch('/api/portfolio/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? 'Optimisation failed.')
        return
      }
      const normalized = isProfileMode
        ? normalizeOptimizeResponse(data, years)
        : normalizeLegacyOptimizeResponse(data, years)
      setResult(normalized)
      if (isProfileMode && !saveName.trim()) setSaveName(`Optimized basket ${new Date().toLocaleDateString()}`)
    } catch {
      setError('Network error.')
    } finally {
      setLoading(false)
    }
  }

  async function saveCurrentPortfolio() {
    if (!result) {
      setSaveError('Run an optimisation first.')
      return
    }
    if (!saveName.trim()) {
      setSaveError('Give this optimized portfolio a name before saving.')
      return
    }
    setSaveLoading(true)
    setSaveError('')
    setSaveMessage('')
    try {
      const res = await fetch('/api/profile/portfolios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: saveName.trim(), optimizeRequest: buildRequest(), optimizeResult: toPersistedResult(result) }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveError(data?.error ?? 'Unable to save portfolio.')
        return
      }
      setSavedPortfolioId(typeof data?.id === 'string' ? data.id : null)
      setSaveMessage('Portfolio saved to your profile.')
    } catch {
      setSaveError('Unable to save portfolio.')
    } finally {
      setSaveLoading(false)
    }
  }

  const requestPreview = buildRequest()
  const clientValidationMessage = getClientValidationMessage(tickers, requestPreview)
  const selectedObjective = OBJECTIVE_OPTIONS.find((option) => option.id === objective)
  const totalWeight = result?.weights.reduce((sum, row) => sum + row.weight, 0) ?? 0
  const stressEntries = Object.entries(result?.stressTestResults ?? {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 980, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontSize: 10.5, color: 'var(--gold)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>Portfolio</div>
          <h1 className="font-display text-gold-gradient" style={{ fontSize: 42, fontWeight: 500, lineHeight: 1.05, marginBottom: 8 }}>Portfolio Allocation Optimiser</h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.65, maxWidth: 880 }}>
            Build a long-term basket, define your investor profile, and generate a disciplined Sharpe-maximizing allocation. Saved portfolios now live in a dedicated library so this page stays focused on creation.
          </p>
        </div>
        <Link href="/protected/portfolios" className="btn-ghost" style={{ padding: '12px 18px', textDecoration: 'none' }}>Open portfolios</Link>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        <div className="card" style={{ padding: '24px 26px' }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Investor profile</div>
          <div style={{ display: 'grid', gap: 14 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Risk tolerance</span>
              <select className="input-dark" value={riskTolerance} onChange={(e) => setRiskTolerance(e.target.value as RiskTolerance)}>
                {RISK_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <div style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-primary)', marginBottom: 4 }}>
                Simple mode is on
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {investorPreset.description}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                <span style={{ fontSize: 11.5, color: 'var(--gold)', padding: '5px 8px', borderRadius: 999, background: 'rgba(200,169,110,0.1)', border: '1px solid var(--gold-dim)' }}>
                  {universeFilter.replace(/_/g, ' ')}
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--gold)', padding: '5px 8px', borderRadius: 999, background: 'rgba(200,169,110,0.1)', border: '1px solid var(--gold-dim)' }}>
                  {years} year lookback
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--gold)', padding: '5px 8px', borderRadius: 999, background: 'rgba(200,169,110,0.1)', border: '1px solid var(--gold-dim)' }}>
                  {investmentHorizon}
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--gold)', padding: '5px 8px', borderRadius: 999, background: 'rgba(200,169,110,0.1)', border: '1px solid var(--gold-dim)' }}>
                  {(investorPreset.maxSinglePosition * 100).toFixed(0)}% max single
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--gold)', padding: '5px 8px', borderRadius: 999, background: 'rgba(200,169,110,0.1)', border: '1px solid var(--gold-dim)' }}>
                  {(investorPreset.maxSectorWeight * 100).toFixed(0)}% max sector
                </span>
              </div>
            </div>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setShowAdvancedConstraints((current) => !current)}
              style={{ justifySelf: 'start', padding: '10px 16px', fontSize: 12.5 }}
            >
              {showAdvancedConstraints ? 'Hide advanced constraints' : 'Show advanced constraints'}
            </button>
            {showAdvancedConstraints && (
              <div style={{ display: 'grid', gap: 12, padding: '14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Investment horizon</span>
                  <select className="input-dark" value={investmentHorizon} onChange={(e) => setInvestmentHorizon(e.target.value as InvestmentHorizonBucket)}>
                    {HORIZON_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Universe</span>
                  <select className="input-dark" value={universeFilter} onChange={(e) => setUniverseFilter(e.target.value as UniverseFilter)}>
                    {UNIVERSE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Lookback years</span>
                  <input type="range" min={1} max={5} step={1} value={years} onChange={(e) => setYears(Number(e.target.value))} />
                  <span style={{ fontSize: 12.5, color: 'var(--gold)' }}>{years} year{years === 1 ? '' : 's'}</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Max single %</span>
                    <input className="input-dark" value={maxSinglePosition} onChange={(e) => setMaxSinglePosition(e.target.value)} />
                  </label>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Max sector %</span>
                    <input className="input-dark" value={maxSectorWeight} onChange={(e) => setMaxSectorWeight(e.target.value)} />
                  </label>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Risk-free %</span>
                    <input className="input-dark" value={riskFreeRate} onChange={(e) => setRiskFreeRate(e.target.value)} />
                  </label>
                </div>
              </div>
            )}
            {!showAdvancedConstraints && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Advanced mode lets you override the default 30% max single-position cap, add a sector cap, and tune the lookback inputs.
              </div>
            )}
            {!showAdvancedConstraints && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                We still enforce long-only, fully invested portfolios underneath, but the page starts with a simpler profile-first setup.
              </div>
            )}
            {showAdvancedConstraints && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                These are optional overrides. If the basket becomes infeasible, widen the max single-position cap or add more tickers.
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: '24px 26px' }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Objective</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {OBJECTIVE_OPTIONS.map((option) => (
              <label
                key={option.id}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: objective === option.id ? '1px solid var(--gold-dim)' : '1px solid var(--border)',
                  background: objective === option.id ? 'rgba(200,169,110,0.08)' : 'var(--bg-elevated)',
                }}
              >
                <input
                  type="radio"
                  name="objective"
                  checked={objective === option.id}
                  onChange={() => setObjective(option.id)}
                  style={{ marginTop: 3 }}
                />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{option.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>{option.hint}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: '24px 26px' }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Basket</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {tickers.map((symbol) => (
              <button key={symbol} type="button" onClick={() => setTickers((current) => current.filter((ticker) => ticker !== symbol))} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', border: '1px solid var(--gold-dim)', background: 'rgba(200,169,110,0.12)', color: 'var(--gold)' }}>
                {symbol}
                <span style={{ opacity: 0.7, fontSize: 15 }}>x</span>
              </button>
            ))}
          </div>
          <div ref={basketSearchRef} style={{ position: 'relative' }}>
            <input className="input-dark" placeholder="Search ticker or company to add..." value={basketQuery} onChange={(e) => setBasketQuery(e.target.value)} onFocus={() => searchResults.length > 0 && setSearchOpen(true)} />
            {searchOpen && (searchResults.length > 0 || searchError) && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50, background: 'var(--bg-surface)', border: '1px solid var(--border-bright)', borderRadius: 10, overflow: 'hidden', maxHeight: 280, overflowY: 'auto' }}>
                {searchError ? <div style={{ padding: '14px 16px', fontSize: 12.5, color: 'var(--red)' }}>{searchError}</div> : searchResults.map((hit, index) => (
                  <button key={`${hit.symbol}-${index}`} type="button" onClick={() => addTicker(hit.symbol)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: index < searchResults.length - 1 ? '1px solid var(--border)' : 'none', textAlign: 'left' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)', minWidth: 56 }}>{hit.symbol}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', flex: 1, paddingLeft: 12 }}>{hit.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, marginTop: 12 }}>Use between 3 and 15 stocks. The backend validates the universe and enforces long-only, fully invested allocations.</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <button type="button" className="btn-gold" disabled={loading || Boolean(clientValidationMessage)} onClick={() => void runOptimize()} style={{ padding: '12px 28px', fontSize: 14, opacity: loading || clientValidationMessage ? 0.6 : 1 }}>
          {loading ? 'Running optimisation...' : 'Compute allocation'}
        </button>
        <button type="button" className="btn-ghost" onClick={resetOptimiser} style={{ padding: '12px 24px', fontSize: 14 }}>Reset</button>
      </div>

      {clientValidationMessage && !error && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '12px 16px', borderRadius: 8 }}>
          {clientValidationMessage}
        </div>
      )}
      {error && <div style={{ fontSize: 13, color: 'var(--red)', background: 'var(--red-dim)', padding: '12px 16px', borderRadius: 8 }}>{error}</div>}
      {result && (
        <div className="card" style={{ padding: '26px 28px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Recommended allocation</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6 }}>
                Objective: <span style={{ color: 'var(--text-primary)' }}>{selectedObjective?.label ?? objective}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <input className="input-dark" placeholder="Save name" value={saveName} onChange={(e) => setSaveName(e.target.value)} style={{ minWidth: 220 }} />
              <button type="button" className="btn-gold" onClick={() => void saveCurrentPortfolio()} disabled={saveLoading} style={{ padding: '10px 18px', fontSize: 13, opacity: saveLoading ? 0.7 : 1 }}>
                {saveLoading ? 'Saving...' : 'Save to profile'}
              </button>
            </div>
          </div>
          {saveError && <div style={{ fontSize: 12.5, color: 'var(--red)', marginBottom: 12 }}>{saveError}</div>}
          {saveMessage && (
            <div style={{ fontSize: 12.5, color: 'var(--gold)', marginBottom: 12 }}>
              {saveMessage}{' '}
              {savedPortfolioId && <Link href={`/protected/portfolios/${savedPortfolioId}`} style={{ color: 'inherit' }}>Open portfolio</Link>}
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', padding: '0 8px 10px 0' }}>Symbol</th>
                <th style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', padding: '0 0 10px 0' }}>Weight</th>
              </tr>
            </thead>
            <tbody>
              {result.weights.map((row) => (
                <tr key={row.symbol} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 8px 12px 0', fontWeight: 600, color: 'var(--gold)', fontSize: 14 }}>{row.symbol}</td>
                  <td style={{ textAlign: 'right', padding: '12px 0', fontVariantNumeric: 'tabular-nums' }}>{(row.weight * 100).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>Weights sum to <strong style={{ color: 'var(--text-primary)' }}>{(totalWeight * 100).toFixed(2)}%</strong>.</div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
            {[
              ['Ann. return', formatPct(result.expectedAnnualReturn)],
              ['Ann. vol', formatPct(result.expectedAnnualVolatility)],
              ['Sharpe', result.sharpeRatio.toFixed(3)],
              ...(result.sortinoRatio != null ? [['Sortino', result.sortinoRatio.toFixed(3)] as const] : []),
              ['Max drawdown', formatPct(result.maxDrawdown)],
              ...(result.canSave ? [
                ['Worst month', formatPct(result.worstMonthReturn)] as const,
                ['Worst quarter', formatPct(result.worstQuarterReturn)] as const,
              ] : []),
              ['Lookback', `${result.lookbackYears}y`],
              ...(result.observationDays != null ? [['Obs. days', String(result.observationDays)] as const] : []),
              ['Risk-free rate', formatPct(result.riskFreeRateUsed)],
            ].map(([label, value]) => (
              <div key={label} style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{value}</div>
              </div>
            ))}
          </div>

          {result.dataSource && (
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 20, lineHeight: 1.65 }}>
              {result.dataSource}
            </p>
          )}

          {result.dataWarnings.length > 0 && (
            <div style={{ marginTop: 20, padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Data warnings</div>
              {result.dataWarnings.map((warning) => <div key={warning} style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{warning}</div>)}
            </div>
          )}

          {stressEntries.length > 0 && (
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Stress tests</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {stressEntries.map(([name, scenario]) => (
                  <div key={name} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1.2fr) repeat(3, minmax(120px, 1fr))', gap: 12, padding: '12px 14px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{name.replace(/_/g, ' ')}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Shock {formatPct(scenario.assumed_shock)}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Return {formatPct(scenario.estimated_portfolio_return)}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Drawdown {formatPct(scenario.estimated_drawdown)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.benchmarkComparisons && result.benchmarkComparisons.length > 0 && (
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                Benchmark comparison
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 16 }}>
                {result.comparisonNote ?? 'Each benchmark is shown as 100% in that ETF over the same aligned return window as your basket.'}
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 520 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '8px 10px 10px 0', color: 'var(--text-muted)', fontWeight: 500 }}>Portfolio / ETF</th>
                      <th style={{ textAlign: 'right', padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 500 }}>Ann. return</th>
                      <th style={{ textAlign: 'right', padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 500 }}>Ann. vol</th>
                      <th style={{ textAlign: 'right', padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 500 }}>Sharpe</th>
                      <th style={{ textAlign: 'right', padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 500 }}>Sortino</th>
                      <th style={{ textAlign: 'right', padding: '8px 0 8px 6px', color: 'var(--text-muted)', fontWeight: 500 }}>Max DD</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(200,169,110,0.06)' }}>
                      <td style={{ padding: '10px 10px 10px 0', fontWeight: 600, color: 'var(--gold)' }}>Your optimised basket</td>
                      <td style={{ textAlign: 'right', padding: '10px 6px', fontVariantNumeric: 'tabular-nums' }}>{(result.expectedAnnualReturn * 100).toFixed(2)}%</td>
                      <td style={{ textAlign: 'right', padding: '10px 6px', fontVariantNumeric: 'tabular-nums' }}>{(result.expectedAnnualVolatility * 100).toFixed(2)}%</td>
                      <td style={{ textAlign: 'right', padding: '10px 6px', fontVariantNumeric: 'tabular-nums' }}>{result.sharpeRatio.toFixed(3)}</td>
                      <td style={{ textAlign: 'right', padding: '10px 6px', fontVariantNumeric: 'tabular-nums' }}>{result.sortinoRatio?.toFixed(3) ?? '—'}</td>
                      <td style={{ textAlign: 'right', padding: '10px 0 10px 6px', fontVariantNumeric: 'tabular-nums' }}>{(result.maxDrawdown * 100).toFixed(2)}%</td>
                    </tr>
                    {result.benchmarkComparisons.map((benchmark) => (
                      <tr key={benchmark.symbol} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 10px 10px 0' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{benchmark.symbol}</span>
                          <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 11 }}>{benchmark.name}</span>
                        </td>
                        <td style={{ textAlign: 'right', padding: '10px 6px', fontVariantNumeric: 'tabular-nums' }}>{benchmark.metrics.annualizedReturnPct.toFixed(2)}%</td>
                        <td style={{ textAlign: 'right', padding: '10px 6px', fontVariantNumeric: 'tabular-nums' }}>{benchmark.metrics.annualizedVolatilityPct.toFixed(2)}%</td>
                        <td style={{ textAlign: 'right', padding: '10px 6px', fontVariantNumeric: 'tabular-nums' }}>{benchmark.metrics.sharpe.toFixed(3)}</td>
                        <td style={{ textAlign: 'right', padding: '10px 6px', fontVariantNumeric: 'tabular-nums' }}>{benchmark.metrics.sortino.toFixed(3)}</td>
                        <td style={{ textAlign: 'right', padding: '10px 0 10px 6px', fontVariantNumeric: 'tabular-nums' }}>{benchmark.metrics.maxDrawdownPct.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
