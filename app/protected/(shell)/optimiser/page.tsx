'use client'

import { useEffect, useRef, useState } from 'react'

const OBJECTIVES: { id: string; label: string; hint: string }[] = [
  { id: 'max_sharpe', label: 'Maximise Sharpe ratio', hint: 'Risk adjusted return vs volatility (excess return / σ), annualised.' },
  { id: 'max_sortino', label: 'Maximise Sortino ratio', hint: 'Like Sharpe, but only penalises downside volatility.' },
  { id: 'max_return', label: 'Maximise expected return', hint: 'Long-only optimum puts 100% in the historically highest-mean asset.' },
  { id: 'min_volatility', label: 'Minimise volatility', hint: 'Minimum-variance portfolio on the sample covariance matrix.' },
  { id: 'min_max_drawdown', label: 'Minimise max drawdown', hint: 'Heuristic search to reduce worst peak-to-trough loss on historical paths.' },
]

type MetricBlock = {
  annualizedReturnPct: number
  annualizedVolatilityPct: number
  sharpe: number
  sortino: number
  maxDrawdownPct: number
}

type OptimizeResponse = {
  weights: { symbol: string; weight: number }[]
  objective: string
  metrics: MetricBlock
  sample: { tradingDays: number; rfAnnualPct: number }
  minWeightPct?: number
  lookbackYears?: number
  dataSource?: string
  benchmarkComparisons?: { symbol: string; name: string; metrics: MetricBlock }[]
  comparisonNote?: string
  error?: string
}

type SearchHit = { symbol: string; description: string }

const INITIAL_TICKERS = ['GOOGL', 'MSFT', 'META']

export default function OptimiserPage() {
  const [tickers, setTickers] = useState<string[]>(() => [...INITIAL_TICKERS])
  const [basketQuery, setBasketQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchHit[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const basketSearchRef = useRef<HTMLDivElement>(null)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [objective, setObjective] = useState('max_sharpe')
  const [minOnePercentEach, setMinOnePercentEach] = useState(false)
  const [years, setYears] = useState(5)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<OptimizeResponse | null>(null)

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (basketSearchRef.current && !basketSearchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  useEffect(() => {
    setSearchError('')
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    const q = basketQuery.trim()
    if (q.length < 1) {
      setSearchResults([])
      setSearchLoading(false)
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
        if (Array.isArray(data)) {
          setSearchResults(data)
          setSearchOpen(data.length > 0)
        } else {
          setSearchResults([])
          setSearchOpen(false)
        }
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

  function addTickerFromSearch(symbol: string) {
    setError('')
    const sym = symbol.toUpperCase()
    if (tickers.includes(sym)) {
      setBasketQuery('')
      setSearchResults([])
      setSearchOpen(false)
      return
    }
    setTickers(t => [...t, sym])
    setBasketQuery('')
    setSearchResults([])
    setSearchOpen(false)
  }

  function removeTicker(sym: string) {
    setTickers(tickers.filter(t => t !== sym))
    setError('')
  }

  function resetOptimiser() {
    setTickers([...INITIAL_TICKERS])
    setBasketQuery('')
    setSearchResults([])
    setSearchOpen(false)
    setSearchError('')
    setObjective('max_sharpe')
    setMinOnePercentEach(false)
    setYears(5)
    setError('')
    setResult(null)
    setLoading(false)
  }

  async function runOptimize() {
    setError('')
    setResult(null)
    if (tickers.length < 2) {
      setError('Add at least two tickers.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/portfolio/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: tickers, objective, years, minOnePercentEach }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Optimisation failed.')
        return
      }
      setResult(data)
    } catch {
      setError('Network error.')
    } finally {
      setLoading(false)
    }
  }

  const sumPct = result?.weights.reduce((a, w) => a + w.weight * 100, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 920, fontFamily: "'DM Sans', sans-serif" }}>
      <div>
        <div style={{ fontSize: 10.5, color: 'var(--gold)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>Portfolio</div>
        <h1 className="font-display" style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 8 }}>
          Portfolio Allocation Optimiser
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.65, maxWidth: 1000 }}>
          Add the stocks you care about, set how far back you want to look (<strong style={{ color: 'var(--text-secondary)' }}>1–5 years</strong>), and pick what you’d like to optimise for, such as Sharpe, Sortino, return, volatility, or drawdowns.
          Graham studies <strong style={{ color: 'var(--text-secondary)' }}>daily price history</strong> over that window and suggests <strong style={{ color: 'var(--gold)' }}>how much to allocate to each holding</strong> so the weights add up to <strong style={{ color: 'var(--gold)' }}>100%</strong> (long-only: no betting against stocks).
          For Sharpe and Sortino we use a <strong style={{ color: 'var(--text-secondary)' }}>4%</strong> annual risk-free rate.
        </p>
      </div>

      <div className="card" style={{ padding: '24px 26px' }}>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Lookback period</div>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.55 }}>
          Historical sample ends today and runs backward (calendar years). Benchmarks use the same window.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 16 }}>
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Shorter window</span>
          <span className="font-display" style={{ fontSize: 22, fontWeight: 500, color: 'var(--gold)', letterSpacing: '-0.02em' }}>
            {years} {years === 1 ? 'year' : 'years'}
          </span>
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Longer window</span>
        </div>
        <input
          type="range"
          className="lookback-slider"
          min={1}
          max={5}
          step={1}
          value={years}
          onChange={e => setYears(Number(e.target.value))}
          aria-label="Lookback period in years"
          style={{
            width: '100%',
            display: 'block',
            accentColor: 'var(--gold)',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingLeft: 2, paddingRight: 2 }}>
          {([1, 2, 3, 4, 5] as const).map(y => (
            <span key={y} style={{ fontSize: 11, color: years === y ? 'var(--gold)' : 'var(--text-muted)', fontWeight: years === y ? 600 : 400 }}>
              {y}Y
            </span>
          ))}
        </div>
        <style>{`
          .lookback-slider {
            -webkit-appearance: none;
            appearance: none;
            height: 6px;
            border-radius: 100px;
            background: var(--bg-elevated);
            border: 1px solid var(--border);
          }
          .lookback-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--gold-bright), var(--gold));
            cursor: pointer;
            box-shadow: 0 2px 10px rgba(200, 169, 110, 0.35);
            border: 2px solid var(--bg-surface);
          }
          .lookback-slider::-moz-range-thumb {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--gold-bright), var(--gold));
            cursor: pointer;
            border: 2px solid var(--bg-surface);
            box-shadow: 0 2px 10px rgba(200, 169, 110, 0.35);
          }
          .lookback-slider::-moz-range-track {
            height: 6px;
            border-radius: 100px;
            background: var(--bg-elevated);
          }
        `}</style>
      </div>

      <div className="card" style={{ padding: '24px 26px' }}>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Basket</div>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.55 }}>
          Search by ticker or company name, then choose a match from the list. Only symbols returned by the search can be added, so each name is checked against live market data.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, minHeight: tickers.length ? undefined : 8 }}>
          {tickers.map(sym => (
            <button
              key={sym}
              type="button"
              onClick={() => removeTicker(sym)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '7px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                border: '1px solid var(--gold-dim)', background: 'rgba(200,169,110,0.12)', color: 'var(--gold)',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {sym}
              <span style={{ opacity: 0.7, fontSize: 15 }}>×</span>
            </button>
          ))}
        </div>
        <div ref={basketSearchRef} style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: searchLoading ? 'var(--gold)' : 'var(--text-muted)', fontSize: 14, pointerEvents: 'none' }}>
            ⌕
          </span>
          <input
            className="input-dark"
            placeholder="Search ticker or company to add…"
            value={basketQuery}
            onChange={e => setBasketQuery(e.target.value)}
            onFocus={() => { if (searchResults.length > 0 && !searchError) setSearchOpen(true) }}
            onKeyDown={e => { if (e.key === 'Escape') { setSearchOpen(false); setBasketQuery('') } }}
            autoComplete="off"
            aria-expanded={searchOpen}
            aria-controls="basket-search-listbox"
            aria-haspopup="listbox"
            style={{ paddingLeft: 36, width: '100%', boxSizing: 'border-box' }}
          />
          {searchOpen && (searchResults.length > 0 || searchError) && (
            <div
              id="basket-search-listbox"
              role="listbox"
              style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50,
                background: 'var(--bg-surface)', border: '1px solid var(--border-bright)',
                borderRadius: 10, overflow: 'hidden', maxHeight: 280, overflowY: 'auto',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              }}
            >
              {searchError ? (
                <div style={{ padding: '14px 16px', fontSize: 12.5, color: 'var(--red)' }}>{searchError}</div>
              ) : (
                searchResults.map((r, i) => {
                  const inBasket = tickers.includes(r.symbol)
                  return (
                    <button
                      key={`${r.symbol}-${i}`}
                      type="button"
                      role="option"
                      disabled={inBasket}
                      onClick={() => !inBasket && addTickerFromSearch(r.symbol)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 16px', background: 'none', border: 'none', cursor: inBasket ? 'default' : 'pointer',
                        borderBottom: i < searchResults.length - 1 ? '1px solid var(--border)' : 'none',
                        fontFamily: "'DM Sans', sans-serif",
                        textAlign: 'left',
                        opacity: inBasket ? 0.45 : 1,
                      }}
                      onMouseEnter={e => { if (!inBasket) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-elevated)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)', minWidth: 56 }}>{r.symbol}</span>
                      <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', flex: 1, paddingLeft: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.description}
                      </span>
                      {inBasket ? (
                        <span style={{ fontSize: 10.5, color: 'var(--text-muted)', marginLeft: 8 }}>In basket</span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>Add</span>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          )}
          {!searchLoading && basketQuery.trim().length > 0 && searchResults.length === 0 && !searchError && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>No equity listings matched. Try another spelling, exchange code, or symbol.</div>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: '24px 26px' }}>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Objective</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {OBJECTIVES.map(o => (
            <label
              key={o.id}
              style={{
                display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer',
                padding: '12px 14px', borderRadius: 10,
                border: objective === o.id ? '1px solid var(--gold-dim)' : '1px solid var(--border)',
                background: objective === o.id ? 'rgba(200,169,110,0.08)' : 'var(--bg-elevated)',
              }}
            >
              <input
                type="radio"
                name="obj"
                checked={objective === o.id}
                onChange={() => setObjective(o.id)}
                style={{ marginTop: 3 }}
              />
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{o.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>{o.hint}</div>
              </div>
            </label>
          ))}
        </div>
        <label
          style={{
            display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer',
            marginTop: 16, padding: '12px 14px', borderRadius: 10,
            border: minOnePercentEach ? '1px solid var(--gold-dim)' : '1px solid var(--border)',
            background: minOnePercentEach ? 'rgba(200,169,110,0.08)' : 'var(--bg-elevated)',
          }}
        >
          <input
            type="checkbox"
            checked={minOnePercentEach}
            onChange={e => setMinOnePercentEach(e.target.checked)}
            style={{ marginTop: 3 }}
          />
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Require all stocks to be in basket</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
              Gives each ticker at least 1% so none are optimised away to zero (long-only; weights still sum to 100%). Not possible with more than 100 names.
            </div>
          </div>
        </label>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          className="btn-gold"
          disabled={loading || tickers.length < 2}
          onClick={runOptimize}
          style={{ padding: '12px 28px', fontSize: 14, opacity: loading || tickers.length < 2 ? 0.6 : 1 }}
        >
          {loading ? 'Running optimisation…' : 'Compute allocation'}
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={resetOptimiser}
          style={{ padding: '12px 24px', fontSize: 14 }}
        >
          Reset
        </button>
      </div>

      {error && (
        <div style={{ fontSize: 13, color: 'var(--red)', background: 'var(--red-dim)', padding: '12px 16px', borderRadius: 8 }}>
          {error}
        </div>
      )}

      {result && (
        <div className="card animate-fade-up d1" style={{ padding: '26px 28px' }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 18 }}>Recommended allocation</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', padding: '0 8px 10px 0' }}>Symbol</th>
                <th style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', padding: '0 0 10px 0' }}>Weight</th>
              </tr>
            </thead>
            <tbody>
              {result.weights.map(row => (
                <tr key={row.symbol} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 8px 12px 0', fontWeight: 600, color: 'var(--gold)', fontSize: 14 }}>{row.symbol}</td>
                  <td style={{ textAlign: 'right', padding: '12px 0', fontVariantNumeric: 'tabular-nums' }}>{(row.weight * 100).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
            Weights sum to <strong style={{ color: 'var(--text-primary)' }}>{sumPct != null ? sumPct.toFixed(2) : '—'}%</strong> (rounded to 4 decimals; last bucket adjusted so total = 100%).
            {typeof result.minWeightPct === 'number' && (
              <span style={{ display: 'block', marginTop: 8 }}>
                Floor applied: each holding at least <strong style={{ color: 'var(--text-primary)' }}>{result.minWeightPct.toFixed(0)}%</strong> before display rounding.
              </span>
            )}
          </div>

          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Implied sample metrics (historical)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
            {[
              { k: 'Ann. return', v: `${result.metrics.annualizedReturnPct.toFixed(2)}%` },
              { k: 'Ann. vol', v: `${result.metrics.annualizedVolatilityPct.toFixed(2)}%` },
              { k: 'Sharpe', v: result.metrics.sharpe.toFixed(3) },
              { k: 'Sortino', v: result.metrics.sortino.toFixed(3) },
              { k: 'Max drawdown', v: `${result.metrics.maxDrawdownPct.toFixed(2)}%` },
              { k: 'Lookback', v: `${result.lookbackYears ?? years}y` },
              { k: 'Obs. days', v: String(result.sample.tradingDays) },
            ].map(x => (
              <div key={x.k} style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{x.k}</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{x.v}</div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 20, lineHeight: 1.65 }}>
            {result.dataSource ?? 'Historical prices'} · R<sub>f</sub> = {result.sample.rfAnnualPct.toFixed(1)}% p.a. for Sharpe/Sortino.
            Past performance does not guarantee future results. Not investment advice.
          </p>

          {result.benchmarkComparisons && result.benchmarkComparisons.length > 0 && (
            <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                vs major benchmark ETFs
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 16 }}>
                {result.comparisonNote ??
                  'Each benchmark is shown as 100% in that ETF over the same aligned daily return window as your basket.'}
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 520 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '8px 10px 10px 0', color: 'var(--text-muted)', fontWeight: 500 }}>Portfolio / ETF</th>
                      <th style={{ textAlign: 'right', padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>Ann. return</th>
                      <th style={{ textAlign: 'right', padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>Ann. vol</th>
                      <th style={{ textAlign: 'right', padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 500 }}>Sharpe</th>
                      <th style={{ textAlign: 'right', padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 500 }}>Sortino</th>
                      <th style={{ textAlign: 'right', padding: '8px 0 8px 6px', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>Max DD</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(200,169,110,0.06)' }}>
                      <td style={{ padding: '10px 10px 10px 0', fontWeight: 600, color: 'var(--gold)' }}>Your optimised basket</td>
                      <td style={{ textAlign: 'right', padding: '10px 6px', fontVariantNumeric: 'tabular-nums' }}>{result.metrics.annualizedReturnPct.toFixed(2)}%</td>
                      <td style={{ textAlign: 'right', padding: '10px 6px', fontVariantNumeric: 'tabular-nums' }}>{result.metrics.annualizedVolatilityPct.toFixed(2)}%</td>
                      <td style={{ textAlign: 'right', padding: '10px 6px', fontVariantNumeric: 'tabular-nums' }}>{result.metrics.sharpe.toFixed(3)}</td>
                      <td style={{ textAlign: 'right', padding: '10px 6px', fontVariantNumeric: 'tabular-nums' }}>{result.metrics.sortino.toFixed(3)}</td>
                      <td style={{ textAlign: 'right', padding: '10px 0 10px 6px', fontVariantNumeric: 'tabular-nums' }}>{result.metrics.maxDrawdownPct.toFixed(2)}%</td>
                    </tr>
                    {result.benchmarkComparisons.map(b => (
                      <tr key={b.symbol} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 10px 10px 0' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{b.symbol}</span>
                          <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 11 }}>{b.name}</span>
                        </td>
                        <td style={{ textAlign: 'right', padding: '10px 6px', fontVariantNumeric: 'tabular-nums' }}>{b.metrics.annualizedReturnPct.toFixed(2)}%</td>
                        <td style={{ textAlign: 'right', padding: '10px 6px', fontVariantNumeric: 'tabular-nums' }}>{b.metrics.annualizedVolatilityPct.toFixed(2)}%</td>
                        <td style={{ textAlign: 'right', padding: '10px 6px', fontVariantNumeric: 'tabular-nums' }}>{b.metrics.sharpe.toFixed(3)}</td>
                        <td style={{ textAlign: 'right', padding: '10px 6px', fontVariantNumeric: 'tabular-nums' }}>{b.metrics.sortino.toFixed(3)}</td>
                        <td style={{ textAlign: 'right', padding: '10px 0 10px 6px', fontVariantNumeric: 'tabular-nums' }}>{b.metrics.maxDrawdownPct.toFixed(2)}%</td>
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
