'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type StressScenario = { assumed_shock: number; estimated_portfolio_return: number; estimated_drawdown: number }
type PortfolioDetail = {
  portfolio: {
    id: string
    name: string
    objective: string
    investmentHorizonBucket: string
    riskTolerance: string
    universeFilter: string
    lookbackPeriodYears: number
    expectedAnnualReturn: number
    expectedAnnualVolatility: number
    sharpeRatio: number
    maxDrawdown: number
    worstMonthReturn: number
    worstQuarterReturn: number
    riskFreeRateUsed: number
    stressTestResults?: Record<string, StressScenario>
    dataWarnings?: string[]
    notes?: string | null
    optimizeRequest?: { asset_tickers?: string[] } | null
    createdAt?: string
    updatedAt?: string
  }
  positions: { symbol: string; weight: number; sector: string | null }[]
}

function formatPct(value: number | undefined) {
  if (value == null || Number.isNaN(value)) return '—'
  return `${(value * 100).toFixed(2)}%`
}

function formatDate(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatObjective(value: string) {
  return value.replace(/_/g, ' ')
}

export default function PortfolioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [portfolioId, setPortfolioId] = useState('')
  const [detail, setDetail] = useState<PortfolioDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draftName, setDraftName] = useState('')
  const [draftNotes, setDraftNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')

  useEffect(() => {
    void params.then(({ id }) => {
      setPortfolioId(id)
      return loadPortfolio(id)
    })
  }, [params])

  async function loadPortfolio(id: string) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/profile/portfolios/${id}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'Unable to load portfolio.')
        return
      }
      setDetail(data)
      setDraftName(data.portfolio?.name ?? '')
      setDraftNotes(data.portfolio?.notes ?? '')
    } catch {
      setError('Unable to load portfolio.')
    } finally {
      setLoading(false)
    }
  }
  async function saveMetadata() {
    if (!portfolioId) return
    setSaving(true)
    setActionError('')
    setActionMessage('')
    try {
      const res = await fetch(`/api/profile/portfolios/${portfolioId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draftName.trim(),
          notes: draftNotes.trim() ? draftNotes.trim() : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setActionError(typeof data?.error === 'string' ? data.error : 'Unable to save changes.')
        return
      }
      setActionMessage('Portfolio details updated.')
      await loadPortfolio(portfolioId)
    } catch {
      setActionError('Unable to save changes.')
    } finally {
      setSaving(false)
    }
  }

  async function deletePortfolio() {
    if (!portfolioId) return
    const confirmed = window.confirm('Delete this portfolio? This cannot be undone.')
    if (!confirmed) return

    setDeleting(true)
    setActionError('')
    try {
      const res = await fetch(`/api/profile/portfolios/${portfolioId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) {
        setActionError(typeof data?.error === 'string' ? data.error : 'Unable to delete portfolio.')
        return
      }
      window.location.href = '/protected/portfolios'
    } catch {
      setActionError('Unable to delete portfolio.')
    } finally {
      setDeleting(false)
    }
  }

  const stressEntries = Object.entries(detail?.portfolio.stressTestResults ?? {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1040, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontSize: 10.5, color: 'var(--gold)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>Portfolio</div>
          <h1 className="font-display" style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 8 }}>{detail?.portfolio.name ?? 'Portfolio detail'}</h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.65, maxWidth: 860 }}>
            Review the saved allocation, stress diagnostics, and update the notes and metadata attached to this profile portfolio.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/protected/portfolios" className="btn-ghost" style={{ padding: '12px 18px', textDecoration: 'none' }}>Back to portfolios</Link>
          {portfolioId && <Link href="/protected/optimiser" className="btn-gold" style={{ padding: '12px 18px', textDecoration: 'none' }}>Create new portfolio</Link>}
        </div>
      </div>

      {error && <div style={{ fontSize: 13, color: 'var(--red)', background: 'var(--red-dim)', padding: '12px 16px', borderRadius: 8 }}>{error}</div>}
      {actionError && <div style={{ fontSize: 13, color: 'var(--red)', background: 'var(--red-dim)', padding: '12px 16px', borderRadius: 8 }}>{actionError}</div>}
      {actionMessage && <div style={{ fontSize: 13, color: 'var(--gold)', background: 'rgba(200,169,110,0.12)', padding: '12px 16px', borderRadius: 8 }}>{actionMessage}</div>}
      {loading ? (
        <div className="card" style={{ padding: '24px 26px', color: 'var(--text-muted)' }}>Loading portfolio...</div>
      ) : detail ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
            {[
              ['Expected return', formatPct(detail.portfolio.expectedAnnualReturn)],
              ['Expected vol', formatPct(detail.portfolio.expectedAnnualVolatility)],
              ['Sharpe', detail.portfolio.sharpeRatio.toFixed(3)],
              ['Max drawdown', formatPct(detail.portfolio.maxDrawdown)],
              ['Worst month', formatPct(detail.portfolio.worstMonthReturn)],
              ['Worst quarter', formatPct(detail.portfolio.worstQuarterReturn)],
              ['Risk-free rate', formatPct(detail.portfolio.riskFreeRateUsed)],
              ['Lookback', `${detail.portfolio.lookbackPeriodYears}y`],
            ].map(([label, value]) => (
              <div key={label} className="card" style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)', gap: 20 }}>
            <div className="card" style={{ padding: '22px 24px' }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Holdings</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', padding: '0 8px 10px 0' }}>Symbol</th>
                    <th style={{ textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', padding: '0 8px 10px 0' }}>Sector</th>
                    <th style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', padding: '0 0 10px 0' }}>Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.positions.map((position) => (
                    <tr key={position.symbol} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 8px 12px 0', fontWeight: 600, color: 'var(--gold)' }}>{position.symbol}</td>
                      <td style={{ padding: '12px 8px 12px 0', color: 'var(--text-muted)' }}>{position.sector ?? '—'}</td>
                      <td style={{ textAlign: 'right', padding: '12px 0', fontVariantNumeric: 'tabular-nums' }}>{(position.weight * 100).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'grid', gap: 20 }}>
              <div className="card" style={{ padding: '22px 24px' }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Manage</div>
                <div style={{ display: 'grid', gap: 12 }}>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Portfolio name</span>
                    <input className="input-dark" value={draftName} onChange={e => setDraftName(e.target.value)} />
                  </label>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Notes / thesis</span>
                    <textarea className="input-dark" value={draftNotes} onChange={e => setDraftNotes(e.target.value)} rows={6} style={{ resize: 'vertical' }} />
                  </label>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button type="button" className="btn-gold" onClick={() => void saveMetadata()} disabled={saving} style={{ padding: '10px 16px' }}>
                      {saving ? 'Saving...' : 'Save changes'}
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => void deletePortfolio()} disabled={deleting} style={{ padding: '10px 16px', color: 'var(--red)' }}>
                      {deleting ? 'Deleting...' : 'Delete portfolio'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="card" style={{ padding: '22px 24px' }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Profile</div>
                <div style={{ display: 'grid', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                  <div>Objective: {formatObjective(detail.portfolio.objective)}</div>
                  <div>Horizon: {detail.portfolio.investmentHorizonBucket}</div>
                  <div>Risk tolerance: {detail.portfolio.riskTolerance}</div>
                  <div>Universe: {detail.portfolio.universeFilter}</div>
                  <div>Created: {formatDate(detail.portfolio.createdAt)}</div>
                  <div>Updated: {formatDate(detail.portfolio.updatedAt)}</div>
                </div>
              </div>

              {detail.portfolio.dataWarnings && detail.portfolio.dataWarnings.length > 0 && (
                <div className="card" style={{ padding: '22px 24px' }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Warnings</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {detail.portfolio.dataWarnings.map((warning) => <div key={warning} style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{warning}</div>)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {stressEntries.length > 0 && (
            <div className="card" style={{ padding: '22px 24px' }}>
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
        </>
      ) : null}
    </div>
  )
}
