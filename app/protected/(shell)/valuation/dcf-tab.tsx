'use client'

import { useEffect, useMemo, useState } from 'react'
import { runDCF, type DCFResult } from '@/lib/dcf'

/* ─── TYPES ──────────────────────────────────────────────────────────────── */

interface DCFApiResponse {
  symbol: string
  name: string
  currentPrice: number | null
  baseFCF: number | null
  sharesOutstanding: number
  netDebt: number
  suggestions: {
    conservative: number
    neutral: number
    bullish: number
    terminalGrowthRate: number
  }
}

type Scenario = 'conservative' | 'neutral' | 'bullish'

interface GrowthRates {
  conservative: number  // stored as percentage e.g. 10 = 10%
  neutral: number
  bullish: number
}

/* ─── HELPERS ────────────────────────────────────────────────────────────── */

function fmtM(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}T`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}B`
  return `$${n.toFixed(0)}M`
}

function fmtPrice(n: number): string {
  return `$${n.toFixed(2)}`
}

function fmtNumberWithCommas(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function pctDiff(intrinsic: number, market: number): number {
  return ((intrinsic - market) / Math.abs(market)) * 100
}

/* ─── NUMBER INPUT ───────────────────────────────────────────────────────── */

function NumInput({
  label,
  value,
  onChange,
  suffix = '',
  min,
  max,
  step = 0.1,
  placeholder = '—',
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  suffix?: string
  min?: number
  max?: number
  step?: number
  placeholder?: string
}) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="number"
          className="input-dark"
          style={{ width: '100%' }}
          value={value ?? ''}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          onChange={e => {
            const v = parseFloat(e.target.value)
            onChange(isNaN(v) ? null : v)
          }}
        />
        {suffix && <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{suffix}</span>}
      </div>
    </div>
  )
}

/* ─── RESULTS PANEL ──────────────────────────────────────────────────────── */

function ResultsPanel({
  result,
  currentPrice,
  validationError,
}: {
  result: DCFResult | null
  currentPrice: number | null
  validationError: string | null
}) {
  if (validationError) {
    return (
      <div className="card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <span style={{ fontSize: 12.5, color: '#F06070' }}>{validationError}</span>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Fill in assumptions to see the valuation.</span>
      </div>
    )
  }

  const diff = currentPrice != null ? pctDiff(result.intrinsicPricePerShare, currentPrice) : null
  const isUndervalued = diff != null && diff > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Year-by-year table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Projected Cash Flows
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Year', 'Projected FCF', 'PV of FCF'].map(h => (
                  <th key={h} style={{ padding: '10px 20px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.yearlyBreakdown.map((row, i) => (
                <tr key={row.year} style={{ borderBottom: i < result.yearlyBreakdown.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '10px 20px', textAlign: 'right', color: 'var(--text-muted)' }}>Y{row.year}</td>
                  <td style={{ padding: '10px 20px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtM(row.fcf)}</td>
                  <td style={{ padding: '10px 20px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--gold)' }}>{fmtM(row.pvFCF)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
        {[
          { label: 'PV of FCFs', value: fmtM(result.pvProjectedFCFs) },
          { label: 'Terminal Value', value: fmtM(result.terminalValue) },
          { label: 'PV of TV', value: fmtM(result.pvTerminalValue) },
          { label: 'Enterprise Value', value: fmtM(result.enterpriseValue) },
        ].map(({ label, value }) => (
          <div key={label} className="card" style={{ padding: '14px 16px', background: 'var(--bg-elevated)' }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Negative equity warning */}
      {result.equityValue < 0 && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(240,96,112,0.1)', border: '1px solid rgba(240,96,112,0.3)', fontSize: 12, color: '#F06070' }}>
          Negative equity — model may not apply to this company at these assumptions.
        </div>
      )}

      {/* Intrinsic value vs market price */}
      <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Intrinsic Value / Share</div>
          <div style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtPrice(result.intrinsicPricePerShare)}</div>
        </div>
        {currentPrice != null && diff != null && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>vs Market Price</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{fmtPrice(currentPrice)}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: isUndervalued ? '#3DD68C' : '#F06070' }}>
              {isUndervalued ? '▲' : '▼'} {Math.abs(diff).toFixed(1)}% {isUndervalued ? 'upside' : 'downside'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── SCENARIO COMPARISON ROW ────────────────────────────────────────────── */

function ScenarioComparison({
  conservative,
  neutral,
  bullish,
  currentPrice,
}: {
  conservative: DCFResult | null
  neutral: DCFResult | null
  bullish: DCFResult | null
  currentPrice: number | null
}) {
  const scenarios: { key: Scenario; label: string; result: DCFResult | null; color: string }[] = [
    { key: 'conservative', label: 'Conservative', result: conservative, color: '#F06070' },
    { key: 'neutral',      label: 'Neutral',      result: neutral,      color: 'var(--gold)' },
    { key: 'bullish',      label: 'Bullish',       result: bullish,      color: '#3DD68C' },
  ]

  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
        Scenario Comparison
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {scenarios.map(({ label, result, color }) => {
          const diff = result && currentPrice != null ? pctDiff(result.intrinsicPricePerShare, currentPrice) : null
          return (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
              {result ? (
                <>
                  <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>
                    {fmtPrice(result.intrinsicPricePerShare)}
                  </div>
                  {diff != null && (
                    <div style={{ fontSize: 12, fontWeight: 500, color: diff >= 0 ? '#3DD68C' : '#F06070' }}>
                      {diff >= 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(1)}%
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>—</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── MAIN COMPONENT ─────────────────────────────────────────────────────── */

export function DCFTab({ symbol, currentPrice: priceFromParent }: { symbol: string; currentPrice: number | null }) {
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [apiData, setApiData] = useState<DCFApiResponse | null>(null)

  // User-editable assumptions (stored as percentages in UI, converted to decimals for math)
  const [baseFCF, setBaseFCF] = useState<number | null>(null)
  const [wacc, setWacc] = useState<number>(10)
  const [years, setYears] = useState<number>(10)
  const [terminalGrowthRate, setTerminalGrowthRate] = useState<number>(2.5)
  const [scenario, setScenario] = useState<Scenario>('neutral')
  const [growthRates, setGrowthRates] = useState<GrowthRates>({ conservative: 5, neutral: 10, bullish: 15 })
  const [baseFcfInput, setBaseFcfInput] = useState('')

  // Fetch API data when symbol changes
  useEffect(() => {
    if (!symbol) return
    setLoading(true)
    setApiError(null)
    setApiData(null)

    fetch(`/api/ticker/${symbol}/dcf`)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((data: DCFApiResponse) => {
        setApiData(data)
        // Pre-fill from API
        if (data.baseFCF != null) {
          setBaseFCF(data.baseFCF)
          setBaseFcfInput(fmtNumberWithCommas(data.baseFCF))
        } else {
          setBaseFcfInput('')
        }
        setGrowthRates({
          conservative: Math.round(data.suggestions.conservative * 1000) / 10,
          neutral:      Math.round(data.suggestions.neutral * 1000) / 10,
          bullish:      Math.round(data.suggestions.bullish * 1000) / 10,
        })
        setTerminalGrowthRate(Math.round(data.suggestions.terminalGrowthRate * 1000) / 10)
      })
      .catch(e => setApiError(typeof e === 'string' ? e : 'Failed to load DCF data'))
      .finally(() => setLoading(false))
  }, [symbol])

  const currentPrice = apiData?.currentPrice ?? priceFromParent

  // Validation
  const validationError: string | null = useMemo(() => {
    if (wacc / 100 <= terminalGrowthRate / 100) return 'WACC must exceed terminal growth rate'
    return null
  }, [wacc, terminalGrowthRate])

  // DCF results — recalculate live whenever any input changes
  const commonArgs = useMemo(() => ({
    baseFCF: baseFCF ?? 0,
    terminalGrowthRate: terminalGrowthRate / 100,
    wacc: wacc / 100,
    years,
    sharesOutstanding: apiData?.sharesOutstanding ?? 0,
    netDebt: apiData?.netDebt ?? 0,
  }), [baseFCF, terminalGrowthRate, wacc, years, apiData])

  const activeResult = useMemo(() => {
    if (baseFCF == null || validationError) return null
    try {
      return runDCF({ ...commonArgs, growthRate: growthRates[scenario] / 100 })
    } catch {
      return null
    }
  }, [commonArgs, growthRates, scenario, baseFCF, validationError])

  const allResults = useMemo(() => {
    if (baseFCF == null || validationError) return { conservative: null, neutral: null, bullish: null }
    try {
      return {
        conservative: runDCF({ ...commonArgs, growthRate: growthRates.conservative / 100 }),
        neutral:      runDCF({ ...commonArgs, growthRate: growthRates.neutral / 100 }),
        bullish:      runDCF({ ...commonArgs, growthRate: growthRates.bullish / 100 }),
      }
    } catch {
      return { conservative: null, neutral: null, bullish: null }
    }
  }, [commonArgs, growthRates, baseFCF, validationError])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 0', color: 'var(--text-muted)', fontSize: 13 }}>
        Loading DCF data…
      </div>
    )
  }

  if (apiError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 0', color: '#F06070', fontSize: 13 }}>
        {apiError}
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, alignItems: 'start' }}>
      {/* ── Left: Assumptions ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="card" style={{ padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Assumptions</div>

          <div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 5 }}>
              Base FCF ($M)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="text"
                className="input-dark"
                style={{ width: '100%' }}
                value={baseFcfInput}
                placeholder="Enter or auto-fetched"
                inputMode="decimal"
                onChange={e => {
                  const raw = e.target.value
                  const cleaned = raw.replace(/[^\d,.\-]/g, '')
                  setBaseFcfInput(cleaned)
                  const parsed = Number(cleaned.replace(/,/g, ''))
                  setBaseFCF(Number.isFinite(parsed) ? parsed : null)
                }}
                onBlur={() => {
                  if (baseFCF == null || !Number.isFinite(baseFCF)) {
                    setBaseFcfInput('')
                    return
                  }
                  setBaseFcfInput(fmtNumberWithCommas(baseFCF))
                }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>M</span>
            </div>
          </div>

          <NumInput
            label="WACC"
            value={wacc}
            onChange={v => {
              if (v != null) setWacc(v)
            }}
            suffix="%"
            min={0.1}
            max={50}
            step={0.1}
          />

          {/* Projection Years slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Projection Years</div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{years}y</span>
            </div>
            <input
              type="range"
              min={5}
              max={15}
              step={1}
              value={years}
              onChange={e => setYears(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--gold)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
              <span>5y</span><span>15y</span>
            </div>
          </div>

          <NumInput
            label="Terminal Growth Rate"
            value={terminalGrowthRate}
            onChange={v => {
              if (v != null) setTerminalGrowthRate(v)
            }}
            suffix="%"
            min={0}
            max={10}
            step={0.1}
          />
        </div>

        {/* Scenario selector + growth rate */}
        <div className="card" style={{ padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>FCF Growth Scenario</div>

          {/* Scenario tabs */}
          <div style={{ display: 'flex', gap: 6 }}>
            {(['conservative', 'neutral', 'bullish'] as Scenario[]).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setScenario(s)}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 600,
                  background: scenario === s ? 'var(--gold)' : 'var(--bg-elevated)',
                  color: scenario === s ? '#000' : 'var(--text-secondary)',
                  textTransform: 'capitalize',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Editable growth rate for selected scenario */}
          <NumInput
            label={`${scenario.charAt(0).toUpperCase() + scenario.slice(1)} Annual Growth`}
            value={growthRates[scenario]}
            onChange={v => {
              if (v != null) setGrowthRates(r => ({ ...r, [scenario]: v }))
            }}
            suffix="%"
            min={-50}
            max={100}
            step={0.5}
          />

          {apiData && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              AI-suggested based on {apiData.name}'s historical growth and sector. Adjust as needed.
            </div>
          )}
        </div>

        {/* Data footnotes */}
        {apiData && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, padding: '0 4px' }}>
            Shares: {apiData.sharesOutstanding.toFixed(1)}M · Net Debt: {fmtM(apiData.netDebt)}
            {apiData.baseFCF == null && (
              <span style={{ color: '#F06070', display: 'block', marginTop: 4 }}>
                FCF not available from Finnhub — please enter manually.
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Right: Results ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ResultsPanel result={activeResult} currentPrice={currentPrice} validationError={validationError} />
        <ScenarioComparison
          conservative={allResults.conservative}
          neutral={allResults.neutral}
          bullish={allResults.bullish}
          currentPrice={currentPrice}
        />
      </div>
    </div>
  )
}
