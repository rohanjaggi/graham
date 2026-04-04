'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type PopularStock = {
  symbol: string
  name: string
  mentions: number
  price: number | null
  changePct: number | null
}

type PopularResponse = {
  source?: string
  date?: string
  popular?: PopularStock[]
  error?: string
}

function formatPrice(price: number | null): string {
  if (price === null || Number.isNaN(price)) return '—'
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatMove(changePct: number | null): string {
  if (changePct === null || Number.isNaN(changePct)) return '—'
  return `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`
}

export default function ExplorePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [source, setSource] = useState('')
  const [popular, setPopular] = useState<PopularStock[]>([])

  useEffect(() => {
    let active = true

    async function loadPopular() {
      setLoading(true)
      setError('')
      try {
        const response = await fetch('/api/explore/popular')
        const data = await response.json() as PopularResponse

        if (!response.ok) {
          setError(data.error || 'Could not load popular stocks right now.')
          return
        }

        if (!Array.isArray(data.popular)) {
          setError('Popular stocks feed is unavailable right now.')
          return
        }

        if (!active) return
        setPopular(data.popular)
        setSource(data.source ?? '')
      } catch {
        if (!active) return
        setError('Popular stocks feed is unavailable right now.')
      } finally {
        if (!active) return
        setLoading(false)
      }
    }

    void loadPopular()
    return () => {
      active = false
    }
  }, [])

  const subtitle = useMemo(() => {
    if (source === 'finnhub-news-mentions') {
      return 'Ranked by symbol mention frequency in today\'s Finnhub market news stream.'
    }
    return 'Showing a fallback watchlist while live popularity data is unavailable.'
  }, [source])

  return (
    <div className="animate-fade-up d1" style={{ maxWidth: 1120, margin: '4.5vh auto 0', padding: '0 16px 28px' }}>
      <section className="card" style={{ padding: '22px 22px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--gold-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
              Explore
            </div>
            <h1 className="font-display text-gold-gradient" style={{ margin: '6px 0 0', fontSize: 42, fontWeight: 500, lineHeight: 1.05 }}>
              Popular Stocks Today
            </h1>
            <p style={{ marginTop: 10, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 860 }}>
              {subtitle}
            </p>
          </div>

          <Link href="/protected/research" className="btn-ghost" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            ← Back to Research
          </Link>
        </div>

        {loading && (
          <div className="card-elevated" style={{ marginTop: 16, minHeight: 180, display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}>
            Loading popular stocks...
          </div>
        )}

        {!loading && error && (
          <div className="card-elevated" style={{ marginTop: 16, minHeight: 180, display: 'grid', placeItems: 'center', color: 'var(--red)', padding: 18, textAlign: 'center' }}>
            {error}
          </div>
        )}

        {!loading && !error && (
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {popular.map((stock) => {
              const up = (stock.changePct ?? 0) >= 0
              return (
                <article key={stock.symbol} className="card-elevated" style={{ padding: '12px 12px 11px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 11.5, letterSpacing: '0.08em', color: 'var(--gold)', fontWeight: 700 }}>
                        {stock.symbol}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {stock.name}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {formatPrice(stock.price)}
                    </div>
                    <div style={{ fontSize: 12.5, color: up ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>
                      {formatMove(stock.changePct)}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-gold"
                    style={{ marginTop: 10, width: '100%', padding: '8px 10px' }}
                    onClick={() => router.push(`/protected/qa?ticker=${encodeURIComponent(stock.symbol)}`)}
                  >
                    Analyze {stock.symbol}
                  </button>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
