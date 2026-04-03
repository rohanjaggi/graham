'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

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

function formatPct(value: number) {
  return `${(value * 100).toFixed(2)}%`
}

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1040, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontSize: 10.5, color: 'var(--gold)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>Portfolio</div>
          <h1 className="font-display" style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 8 }}>Saved Portfolios</h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.65, maxWidth: 820 }}>
            Browse every portfolio you have saved, compare the headline risk and return profile, and open any portfolio for a deeper review.
          </p>
        </div>
        <Link href="/protected/optimiser" className="btn-gold" style={{ padding: '12px 18px', textDecoration: 'none' }}>Create portfolio</Link>
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
          {portfolios.map((portfolio) => (
            <Link key={portfolio.id} href={`/protected/portfolios/${portfolio.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card" style={{ padding: '20px 22px', display: 'grid', gap: 14, cursor: 'pointer' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16 }}>
                  <div>
                    <div className="font-display" style={{ fontSize: 22, fontWeight: 500 }}>{portfolio.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                      {formatObjective(portfolio.objective)} · {portfolio.investmentHorizonBucket} horizon · {portfolio.riskTolerance.toLowerCase()} risk · {portfolio.universeFilter} · updated {formatDate(portfolio.updatedAt)}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--gold)', alignSelf: 'center' }}>Open details ?</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                  {[
                    ['Expected return', formatPct(portfolio.expectedAnnualReturn)],
                    ['Expected vol', formatPct(portfolio.expectedAnnualVolatility)],
                    ['Sharpe', portfolio.sharpeRatio.toFixed(2)],
                    ['Max drawdown', formatPct(portfolio.maxDrawdown)],
                    ['Lookback', `${portfolio.lookbackPeriodYears}y`],
                  ].map(([label, value]) => (
                    <div key={label} style={{ padding: '10px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{value}</div>
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
