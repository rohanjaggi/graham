'use client'

import Link from 'next/link'
import { formatDownsidePercent, formatPercent, formatSignedPercent, metricColorForValue } from '@/lib/ui/metricFormat'
import type { BenchmarkComparison, OptimizeResultView, SearchHit } from './optimiser-types'

export function BasketBuilder({
  tickers,
  basketQuery,
  setBasketQuery,
  searchResults,
  searchOpen,
  searchError,
  basketSearchRef,
  setTickers,
  addTicker,
  setSearchOpen,
}: {
  tickers: string[]
  basketQuery: string
  setBasketQuery: (value: string) => void
  searchResults: SearchHit[]
  searchOpen: boolean
  searchError: string
  basketSearchRef: React.RefObject<HTMLDivElement | null>
  setTickers: React.Dispatch<React.SetStateAction<string[]>>
  addTicker: (symbol: string) => void
  setSearchOpen: (open: boolean) => void
}) {
  return (
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
      <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, marginTop: 12 }}>Use between 3 and 15 stocks. For the smoothest simple-mode experience, start with 4 or more names.</p>
    </div>
  )
}

export function OptimiserResultCard({
  result,
  selectedObjectiveLabel,
  saveName,
  setSaveName,
  saveCurrentPortfolio,
  saveLoading,
  saveError,
  saveMessage,
  savedPortfolioId,
}: {
  result: OptimizeResultView
  selectedObjectiveLabel: string
  saveName: string
  setSaveName: (value: string) => void
  saveCurrentPortfolio: () => Promise<void>
  saveLoading: boolean
  saveError: string
  saveMessage: string
  savedPortfolioId: string | null
}) {
  const totalWeight = result.weights.reduce((sum, row) => sum + row.weight, 0)
  const stressEntries = Object.entries(result.stressTestResults ?? {})

  return (
    <div className="card" style={{ padding: '26px 28px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Recommended allocation</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6 }}>
            Objective: <span style={{ color: 'var(--text-primary)' }}>{selectedObjectiveLabel}</span>
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
          ['Ann. return', formatSignedPercent(result.expectedAnnualReturn)],
          ['Ann. vol', formatPercent(result.expectedAnnualVolatility)],
          ['Sharpe', result.sharpeRatio.toFixed(3)],
          ...(result.sortinoRatio != null ? [['Sortino', result.sortinoRatio.toFixed(3)] as const] : []),
          ['Max drawdown', formatDownsidePercent(result.maxDrawdown)],
          ...(result.canSave ? [
            ['Worst month', formatDownsidePercent(result.worstMonthReturn)] as const,
            ['Worst quarter', formatDownsidePercent(result.worstQuarterReturn)] as const,
          ] : []),
          ['Lookback', `${result.lookbackYears}y`],
          ...(result.observationDays != null ? [['Obs. days', String(result.observationDays)] as const] : []),
          ['Risk-free rate', formatPercent(result.riskFreeRateUsed)],
        ].map(([label, value]) => (
          <div key={label} style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{value}</div>
          </div>
        ))}
      </div>

      {result.dataSource && <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 20, lineHeight: 1.65 }}>{result.dataSource}</p>}

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
                <div style={{ fontSize: 12.5, color: metricColorForValue(scenario.assumed_shock) }}>Shock {formatSignedPercent(scenario.assumed_shock)}</div>
                <div style={{ fontSize: 12.5, color: metricColorForValue(scenario.estimated_portfolio_return) }}>Return {formatSignedPercent(scenario.estimated_portfolio_return)}</div>
                <div style={{ fontSize: 12.5, color: 'var(--red)' }}>Drawdown {formatDownsidePercent(scenario.estimated_drawdown)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.benchmarkComparisons && result.benchmarkComparisons.length > 0 && (
        <BenchmarkComparisonTable comparisons={result.benchmarkComparisons} result={result} />
      )}
    </div>
  )
}

function BenchmarkComparisonTable({ comparisons, result }: { comparisons: BenchmarkComparison[]; result: OptimizeResultView }) {
  return (
    <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Benchmark comparison</div>
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
              <td style={{ textAlign: 'right', padding: '10px 6px', fontVariantNumeric: 'tabular-nums', color: metricColorForValue(result.expectedAnnualReturn) }}>{formatSignedPercent(result.expectedAnnualReturn)}</td>
              <td style={{ textAlign: 'right', padding: '10px 6px', fontVariantNumeric: 'tabular-nums' }}>{(result.expectedAnnualVolatility * 100).toFixed(2)}%</td>
              <td style={{ textAlign: 'right', padding: '10px 6px', fontVariantNumeric: 'tabular-nums' }}>{result.sharpeRatio.toFixed(3)}</td>
              <td style={{ textAlign: 'right', padding: '10px 6px', fontVariantNumeric: 'tabular-nums' }}>{result.sortinoRatio?.toFixed(3) ?? '-'}</td>
              <td style={{ textAlign: 'right', padding: '10px 0 10px 6px', fontVariantNumeric: 'tabular-nums', color: 'var(--red)' }}>{formatDownsidePercent(result.maxDrawdown)}</td>
            </tr>
            {comparisons.map((benchmark) => (
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
  )
}
