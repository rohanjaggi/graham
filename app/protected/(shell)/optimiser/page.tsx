'use client'

import { useState } from 'react'

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
  lookbackYears?: number
  dataSource?: string
  benchmarkComparisons?: { symbol: string; name: string; metrics: MetricBlock }[]
  comparisonNote?: string
  error?: string
}

export default function OptimiserPage() {
  const [input, setInput] = useState('')
  const [tickers, setTickers] = useState<string[]>(['GOOGL', 'MSFT', 'META'])
  const [objective, setObjective] = useState('max_sharpe')
  const [years, setYears] = useState(5)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<OptimizeResponse | null>(null)

  function normalizeSymbol(raw: string): string | null {
    const s = raw.trim().toUpperCase().replace(/\s+/g, '')
    if (!s || !/^[A-Z0-9.\-]+$/.test(s) || s.length > 12) return null
    return s
  }

  function addTicker() {
    const sym = normalizeSymbol(input)
    setError('')
    if (!sym) return
    if (tickers.includes(sym)) {
      setInput('')
      return
    }
    setTickers([...tickers, sym])
    setInput('')
  }

  function removeTicker(sym: string) {
    setTickers(tickers.filter(t => t !== sym))
    setError('')
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
        body: JSON.stringify({ symbols: tickers, objective, years }),
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
          Mean–variance optimiser
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.65, maxWidth: 640 }}>
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14, minHeight: 36 }}>
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
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            className="input-dark"
            placeholder="Ticker e.g. BRK.B, GOOGL…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addTicker() }}
            style={{ flex: 1, minWidth: 200 }}
          />
          <button type="button" className="btn-ghost" onClick={addTicker} style={{ padding: '10px 18px' }}>
            Add
          </button>
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
      </div>

      <div>
        <button
          type="button"
          className="btn-gold"
          disabled={loading || tickers.length < 2}
          onClick={runOptimize}
          style={{ padding: '12px 28px', fontSize: 14, opacity: loading || tickers.length < 2 ? 0.6 : 1 }}
        >
          {loading ? 'Running optimisation…' : 'Compute allocation'}
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
