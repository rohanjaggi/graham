'use client'

import Link from 'next/link'
import { BasketBuilder, OptimiserResultCard } from './optimiser-shared'
import { useEffect, useRef, useState } from 'react'
import { formatDownsidePercent, formatPercent, formatSignedPercent, metricColorForValue } from '@/lib/ui/metricFormat'

import type { InvestmentHorizonBucket, RiskTolerance, UniverseFilter, Objective, SearchHit, MetricBlock, BenchmarkComparison, ProfileOptimizeResponse, OptimizeResultView, LegacyOptimizeResponse, OptimizeRequestBody } from './optimiser-types'

const INITIAL_TICKERS = ['GOOGL', 'MSFT', 'META', 'AAPL']
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
  if (tickers.length < 3) return 'Add at least three tickers. For simple mode, four or more works best because the optimizer still enforces a baseline diversification cap.'
  if (tickers.length > 15) return 'Use between 3 and 15 tickers for this portfolio proof of concept.'

  const maxSinglePosition = request.hard_constraints?.max_single_position ?? 0.25
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
      description: 'Prioritises capital preservation and lower drawdown tolerance.',
      universeFilter: 'US_ALL_CAP' as UniverseFilter,
      lookbackYears: 5,
      investmentHorizon: '3-7y' as InvestmentHorizonBucket,
      maxSinglePosition: 0.25,
      maxSectorWeight: undefined,
      riskFreeRate: 0.02,
    }
  }

  if (riskTolerance === 'CONSERVATIVE') {
    return {
      description: 'Balances long-term growth with steadier downside expectations.',
      universeFilter: 'US_ALL_CAP' as UniverseFilter,
      lookbackYears: 5,
      investmentHorizon: '3-7y' as InvestmentHorizonBucket,
      maxSinglePosition: 0.25,
      maxSectorWeight: undefined,
      riskFreeRate: 0.02,
    }
  }

  if (riskTolerance === 'AGGRESSIVE') {
    return {
      description: 'Accepts higher volatility in pursuit of stronger long-term upside.',
      universeFilter: 'US_ALL_CAP' as UniverseFilter,
      lookbackYears: 5,
      investmentHorizon: '3-7y' as InvestmentHorizonBucket,
      maxSinglePosition: 0.25,
      maxSectorWeight: undefined,
      riskFreeRate: 0.02,
    }
  }

  return {
    description: 'Targets a balanced risk-return tradeoff for long-term capital allocation.',
    universeFilter: 'US_ALL_CAP' as UniverseFilter,
    lookbackYears: 5,
    investmentHorizon: '3-7y' as InvestmentHorizonBucket,
    maxSinglePosition: 0.25,
    maxSectorWeight: undefined,
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

  function buildRequest(): OptimizeRequestBody {
    if (!showAdvancedConstraints) {
      return {
        objective,
        simple_mode: true,
        asset_tickers: tickers,
        risk_tolerance: riskTolerance,
      }
    }

    const advancedMaxSector = maxSectorWeight.trim()
    const hardConstraints = {
      max_single_position: parsePercentInput(maxSinglePosition, 25),
      max_sector_weight: advancedMaxSector ? parsePercentInput(maxSectorWeight, 100) : undefined,
    }

    return {
      objective,
      asset_tickers: tickers,
      simple_mode: false,
      lookback_period_years: years,
      investment_horizon_bucket: investmentHorizon,
      risk_tolerance: riskTolerance,
      universe_filter: universeFilter,
      hard_constraints: hardConstraints,
      risk_free_rate: parsePercentInput(riskFreeRate, 20),
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
    setMaxSectorWeight('')
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
  const modeButtonStyle = (active: boolean) => ({
    padding: '8px 14px',
    borderRadius: 999,
    border: active ? '1px solid var(--gold-dim)' : '1px solid var(--border)',
    background: active ? 'rgba(200,169,110,0.12)' : 'transparent',
    color: active ? 'var(--gold)' : 'var(--text-secondary)',
    fontSize: 12.5,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  } as const)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontSize: 10.5, color: 'var(--gold)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>Portfolio</div>
          <h1 className="font-display" style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 8 }}>Portfolio Allocation Optimiser</h1>
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
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Mode</div>
              <div style={{ display: 'inline-flex', gap: 8, padding: 4, borderRadius: 999, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <button type="button" onClick={() => setShowAdvancedConstraints(false)} style={modeButtonStyle(!showAdvancedConstraints)}>Simple</button>
                <button type="button" onClick={() => setShowAdvancedConstraints(true)} style={modeButtonStyle(showAdvancedConstraints)}>Advanced</button>
              </div>
            </div>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Risk tolerance</span>
              <select className="input-dark" value={riskTolerance} onChange={(e) => setRiskTolerance(e.target.value as RiskTolerance)}>
                {RISK_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <div style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-primary)', marginBottom: 4 }}>{showAdvancedConstraints ? 'Advanced mode is on' : 'Simple mode is on'}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {showAdvancedConstraints ? 'You can override horizon, universe, lookback window, and concentration rules manually.' : investorPreset.description}
              </div>
              {!showAdvancedConstraints && (
                <>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 10 }}>
                    In simple mode, just choose your risk tolerance, objective, and stock basket. The backend applies the matching preset for your risk profile automatically.
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--gold)', lineHeight: 1.6, marginTop: 10 }}>Simple mode works best with 4 or more stocks.</div>
                </>
              )}
            </div>
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
            {!showAdvancedConstraints && <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>Advanced mode is optional. Open it only if you want to tune lookback years, horizon, universe, concentration caps, or the risk-free rate yourself.</div>}
            {showAdvancedConstraints && <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>These are optional overrides. If the basket becomes infeasible, widen the max single-position cap or add more tickers.</div>}
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
                <input type="radio" name="objective" checked={objective === option.id} onChange={() => setObjective(option.id)} style={{ marginTop: 3 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{option.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>{option.hint}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <BasketBuilder
          tickers={tickers}
          basketQuery={basketQuery}
          setBasketQuery={setBasketQuery}
          searchResults={searchResults}
          searchOpen={searchOpen}
          searchError={searchError}
          basketSearchRef={basketSearchRef}
          setTickers={setTickers}
          addTicker={addTicker}
          setSearchOpen={setSearchOpen}
        />
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
      {!clientValidationMessage && tickers.length === 3 && !showAdvancedConstraints && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '12px 16px', borderRadius: 8 }}>
          Three-stock baskets can work, but simple mode is more reliable with 4 or more names because of the baseline diversification cap.
        </div>
      )}
      {error && <div style={{ fontSize: 13, color: 'var(--red)', background: 'var(--red-dim)', padding: '12px 16px', borderRadius: 8 }}>{error}</div>}
      {result && (
        <OptimiserResultCard
          result={result}
          selectedObjectiveLabel={selectedObjective?.label ?? objective}
          saveName={saveName}
          setSaveName={setSaveName}
          saveCurrentPortfolio={saveCurrentPortfolio}
          saveLoading={saveLoading}
          saveError={saveError}
          saveMessage={saveMessage}
          savedPortfolioId={savedPortfolioId}
        />
      )}
    </div>
  )
}
