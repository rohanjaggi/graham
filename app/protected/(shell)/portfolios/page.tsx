'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { formatDownsidePercent, formatPercent, formatSignedPercent, metricColorForValue } from '@/lib/ui/metricFormat'

type SavedPortfolioSummary = {
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
  updatedAt: string
}

type PortfolioSortOption =
  | 'updated_desc'
  | 'return_desc'
  | 'vol_asc'
  | 'sharpe_desc'
  | 'drawdown_asc'

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatObjective(value: string) {
  return value.replace(/_/g, ' ')
}

export default function PortfoliosPage() {
  const [portfolios, setPortfolios] = useState<SavedPortfolioSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortBy, setSortBy] = useState<PortfolioSortOption>('updated_desc')

  useEffect(() => {
    void loadPortfolios()
  }, [])

  async function loadPortfolios() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/profile/portfolios', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'Unable to load portfolios.')
        return
      }
      setPortfolios(Array.isArray(data?.portfolios) ? data.portfolios : [])
    } catch {
      setError('Unable to load portfolios.')
    } finally {
      setLoading(false)
    }
  }

  const sortedPortfolios = [...portfolios].sort((a, b) => {
    switch (sortBy) {
      case 'return_desc':
        return b.expectedAnnualReturn - a.expectedAnnualReturn
      case 'vol_asc':
        return a.expectedAnnualVolatility - b.expectedAnnualVolatility
      case 'sharpe_desc':
        return b.sharpeRatio - a.sharpeRatio
      case 'drawdown_asc':
        return Math.abs(a.maxDrawdown) - Math.abs(b.maxDrawdown)
      case 'updated_desc':
      default:
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontSize: 10.5, color: 'var(--gold)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>Portfolio</div>
          <h1 className="font-display text-gold-gradient" style={{ fontSize: 42, fontWeight: 500, lineHeight: 1.05, marginBottom: 8 }}>Saved Portfolios</h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.65, maxWidth: 820 }}>
            Browse every portfolio you have saved, compare the headline risk and return profile, and open any portfolio for a deeper review.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Sort by</span>
            <select
              className="input-dark"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as PortfolioSortOption)}
              style={{ minWidth: 210, paddingRight: 36 }}
            >
              <option value="updated_desc">Most recent</option>
              <option value="return_desc">Highest expected return</option>
              <option value="vol_asc">Lowest volatility</option>
              <option value="sharpe_desc">Highest Sharpe</option>
              <option value="drawdown_asc">Lowest max drawdown</option>
            </select>
          </label>
          <Link href="/protected/optimiser" className="btn-gold" style={{ padding: '12px 18px', textDecoration: 'none' }}>Create portfolio</Link>
        </div>
      </div>

      {error && <div style={{ fontSize: 13, color: 'var(--red)', background: 'var(--red-dim)', padding: '12px 16px', borderRadius: 8 }}>{error}</div>}

      {loading ? (
        <div className="card" style={{ padding: '24px 26px', color: 'var(--text-muted)' }}>Loading portfolios...</div>
      ) : portfolios.length === 0 ? (
        <div className="card" style={{ padding: '24px 26px' }}>
          <div className="font-display" style={{ fontSize: 22, marginBottom: 8 }}>No saved portfolios yet</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 18 }}>
            Your optimized allocations will show up here after you save them from the optimiser.
          </p>
          <Link href="/protected/optimiser" className="btn-gold" style={{ padding: '10px 16px', textDecoration: 'none' }}>Go to optimiser</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {sortedPortfolios.map((portfolio) => (
            <Link key={portfolio.id} href={`/protected/portfolios/${portfolio.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card" style={{ padding: '20px 22px', display: 'grid', gap: 14, cursor: 'pointer' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16 }}>
                  <div>
                    <div className="font-display" style={{ fontSize: 22, fontWeight: 500 }}>{portfolio.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                      {formatObjective(portfolio.objective)} | {portfolio.investmentHorizonBucket} horizon | {portfolio.riskTolerance.toLowerCase()} risk | {portfolio.universeFilter} | updated {formatDate(portfolio.updatedAt)}
                    </div>
                  </div>
                  <div
                    style={{
                      alignSelf: 'center',
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: '1px solid var(--gold-dim)',
                      background: 'rgba(200,169,110,0.10)',
                      color: 'var(--gold)',
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: '0.03em',
                      minWidth: 118,
                      textAlign: 'center',
                    }}
                  >
                    Open details
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                  {[
                    ['Expected return', formatSignedPercent(portfolio.expectedAnnualReturn), metricColorForValue(portfolio.expectedAnnualReturn)],
                    ['Expected vol', formatPercent(portfolio.expectedAnnualVolatility), 'var(--text-primary)'],
                    ['Sharpe', portfolio.sharpeRatio.toFixed(2), 'var(--gold)'],
                    ['Max drawdown', formatDownsidePercent(portfolio.maxDrawdown), 'var(--red)'],
                    ['Lookback', `${portfolio.lookbackPeriodYears}y`, 'var(--text-primary)'],
                  ].map(([label, value, color]) => (
                    <div key={label} style={{ padding: '10px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: typeof color === 'string' ? color : 'var(--text-primary)' }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
