'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

/* ─── TYPES ──────────────────────────────────────────────────────────────── */

interface TickerData {
  symbol: string
  name: string
  exchange: string
  sector: string
  country: string
  website: string | null
  logo: string | null
  marketCap: number | null
  price: number | null
  priceChange: number | null
  priceChangePct: number | null
  high52: number | null
  low52: number | null
  open: number | null
  prevClose: number | null
  pe: number | null
  pb: number | null
  evEbitda: number | null
  roe: number | null
  debtEquity: number | null
  revenueGrowth: number | null
  grossMargin: number | null
  dividendYield: number | null
  week52High: number | null
  week52Low: number | null
  news: { headline: string; source: string; datetime: number; url: string; summary: string }[]
}

/* ─── HELPERS ─────────────────────────────────────────────────────────────── */

function fmt(n: number | null, decimals = 2, suffix = ''): string {
  if (n == null) return '—'
  return n.toFixed(decimals) + suffix
}

function fmtMarketCap(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}T`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}B`
  return `$${n.toFixed(0)}M`
}

function fmtDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/* ─── SIDEBAR ─────────────────────────────────────────────────────────────── */

const NAV = [
  { section: 'ANALYSIS',  items: [{ label: 'Overview' }, { label: 'Research' }, { label: 'Technical' }] },
  { section: 'VALUATION', items: [{ label: 'DCF Model' }, { label: 'Comparables' }] },
  { section: 'PORTFOLIO', items: [{ label: 'Optimiser' }, { label: 'Tail Risk' }] },
]

function Sidebar() {
  const router = useRouter()
  return (
    <aside style={{
      width: 224, minWidth: 224, height: '100vh',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      padding: '0 14px',
    }}>
      <div
        style={{ padding: '26px 6px 22px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
        onClick={() => router.push('/protected')}
      >
        <div className="font-display text-gold-gradient" style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1 }}>
          Graham
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.13em', marginTop: 6, textTransform: 'uppercase' }}>
          Long-Term Intelligence
        </div>
      </div>
      <nav style={{ flex: 1, paddingTop: 18, overflowY: 'auto' }}>
        {NAV.map(({ section, items }) => (
          <div key={section} style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.13em', color: 'var(--text-muted)', padding: '0 14px 8px', textTransform: 'uppercase' }}>
              {section}
            </div>
            {items.map(({ label }) => (
              <div key={label} className="nav-item">
                <span style={{ fontSize: 13, opacity: 0.75 }}>
                  {label === 'Overview' ? '⬡' : label === 'Research' ? '⊕' : label === 'Technical' ? '△' :
                   label === 'DCF Model' ? '⊞' : label === 'Comparables' ? '≋' :
                   label === 'Optimiser' ? '◎' : '◐'}
                </span>
                {label}
              </div>
            ))}
          </div>
        ))}
      </nav>
      <div style={{ padding: '16px 6px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>IS4228 · Spring 2025</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.5, marginTop: 3 }}>v0.1.0 · live data</div>
      </div>
    </aside>
  )
}

/* ─── SKELETON ────────────────────────────────────────────────────────────── */

function Skeleton({ w = '100%', h = 16 }: { w?: string | number; h?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 6,
      background: 'linear-gradient(90deg, var(--bg-elevated) 25%, var(--bg-hover) 50%, var(--bg-elevated) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

/* ─── METRIC CARD ─────────────────────────────────────────────────────────── */

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

/* ─── FINANCIALS ROW ──────────────────────────────────────────────────────── */

function FinRow({ label, value, good, bad }: { label: string; value: string; good?: boolean; bad?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
      <span className={good ? 'badge-up' : bad ? 'badge-down' : 'badge-neutral'} style={{ fontSize: 12.5, padding: '3px 10px', borderRadius: 5 }}>
        {value}
      </span>
    </div>
  )
}

/* ─── MAIN PAGE ───────────────────────────────────────────────────────────── */

export default function TickerPage() {
  const router = useRouter()
  const params = useParams()
  const symbol = (params?.symbol as string ?? '').toUpperCase()

  const [data, setData] = useState<TickerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'overview' | 'financials' | 'news'>('overview')

  useEffect(() => {
    if (!symbol) return
    setLoading(true)
    setError('')
    fetch(`/api/ticker/${symbol}`)
      .then(r => {
        if (!r.ok) throw new Error('Ticker not found')
        return r.json()
      })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [symbol])

  const up = (data?.priceChangePct ?? 0) >= 0

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>

      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-base)' }}>

        {/* ── Header ── */}
        <header style={{ padding: '28px 36px 0', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
          <button
            className="btn-ghost"
            onClick={() => router.back()}
            style={{ fontSize: 12, padding: '6px 14px', marginBottom: 20, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            ← Back
          </button>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              <Skeleton w={240} h={32} />
              <Skeleton w={160} h={16} />
            </div>
          ) : error ? (
            <div style={{ marginBottom: 24 }}>
              <div className="font-display" style={{ fontSize: 28, color: 'var(--text-primary)', marginBottom: 6 }}>Ticker not found</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>"{symbol}" didn't return any results. Check the symbol and try again.</div>
            </div>
          ) : data && (
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {data.logo && (
                  <img src={data.logo} alt={data.name} style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'contain', background: 'var(--bg-elevated)', padding: 4 }} />
                )}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span className="font-display" style={{ fontSize: 30, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1 }}>{data.name}</span>
                    <span style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, letterSpacing: '0.05em' }}>{data.symbol}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="badge-neutral" style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4 }}>{data.exchange}</span>
                    <span className="badge-neutral" style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4 }}>{data.sector}</span>
                    {data.website && (
                      <a href={data.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--text-muted)', textDecoration: 'none' }}>
                        ↗ website
                      </a>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 36, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                  ${fmt(data.price)}
                </div>
                <div style={{ fontSize: 14, color: up ? 'var(--green)' : 'var(--red)', marginTop: 6, fontWeight: 500 }}>
                  {up ? '+' : ''}{fmt(data.priceChange)} ({up ? '+' : ''}{fmt(data.priceChangePct)}%)
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Mkt Cap {fmtMarketCap(data.marketCap)}
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          {!loading && !error && (
            <div className="tab-bar" style={{ display: 'inline-flex', marginBottom: -1 }}>
              {(['overview', 'financials', 'news'] as const).map(t => (
                <button
                  key={t}
                  className={`tab${tab === t ? ' active' : ''}`}
                  onClick={() => setTab(t)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", padding: '8px 20px', textTransform: 'capitalize' }}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </header>

        {/* ── Body ── */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '32px 36px' }}>

          {/* Loading skeleton */}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {[...Array(4)].map((_, i) => <Skeleton key={i} h={80} />)}
              </div>
              <Skeleton h={120} />
              <Skeleton h={200} />
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="card" style={{ padding: '40px', textAlign: 'center', maxWidth: 480, margin: '60px auto' }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>⚠</div>
              <div style={{ fontSize: 16, color: 'var(--text-primary)', marginBottom: 8 }}>Could not load data</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>{error}</div>
              <button className="btn-ghost" onClick={() => router.back()} style={{ padding: '10px 24px' }}>← Go back</button>
            </div>
          )}

          {/* ── OVERVIEW TAB ── */}
          {!loading && !error && data && tab === 'overview' && (
            <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Key metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                <MetricCard label="P/E Ratio" value={fmt(data.pe, 1, 'x')} sub="Price / Earnings" />
                <MetricCard label="Market Cap" value={fmtMarketCap(data.marketCap)} sub={data.exchange} />
                <MetricCard
                  label="52-Week Range"
                  value={`$${fmt(data.week52Low ?? data.low52, 0)} – $${fmt(data.week52High ?? data.high52, 0)}`}
                  sub="Low / High"
                />
                <MetricCard
                  label="Dividend Yield"
                  value={data.dividendYield ? `${fmt(data.dividendYield, 2)}%` : 'None'}
                  sub="Indicated annual"
                />
              </div>

              {/* Price detail card */}
              <div className="card" style={{ padding: '24px 28px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>Price Detail</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                  {[
                    { label: 'Open', value: `$${fmt(data.open)}` },
                    { label: 'Prev Close', value: `$${fmt(data.prevClose)}` },
                    { label: 'Day High', value: `$${fmt(data.high52)}` },
                    { label: 'Day Low', value: `$${fmt(data.low52)}` },
                    { label: '52W High', value: `$${fmt(data.week52High)}` },
                    { label: '52W Low', value: `$${fmt(data.week52Low)}` },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick stats */}
              <div className="card" style={{ padding: '24px 28px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>Fundamental Summary</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0 40px' }}>
                  <FinRow label="P/E (Normalised)" value={fmt(data.pe, 1, 'x')} />
                  <FinRow label="EV / EBITDA" value={fmt(data.evEbitda, 1, 'x')} />
                  <FinRow label="Price / Book" value={fmt(data.pb, 2, 'x')} />
                  <FinRow label="Return on Equity" value={fmt(data.roe, 1, '%')} good={(data.roe ?? 0) > 15} bad={(data.roe ?? 0) < 0} />
                  <FinRow label="Revenue Growth (YoY)" value={fmt(data.revenueGrowth, 1, '%')} good={(data.revenueGrowth ?? 0) > 10} bad={(data.revenueGrowth ?? 0) < 0} />
                  <FinRow label="Gross Margin" value={fmt(data.grossMargin, 1, '%')} good={(data.grossMargin ?? 0) > 40} bad={(data.grossMargin ?? 0) < 10} />
                  <FinRow label="Debt / Equity" value={fmt(data.debtEquity, 2, 'x')} good={(data.debtEquity ?? 99) < 0.5} bad={(data.debtEquity ?? 0) > 2} />
                  <FinRow label="Dividend Yield" value={data.dividendYield ? `${fmt(data.dividendYield, 2)}%` : '—'} />
                </div>
              </div>
            </div>
          )}

          {/* ── FINANCIALS TAB ── */}
          {!loading && !error && data && tab === 'financials' && (
            <div className="animate-fade-up">
              <div className="card" style={{ padding: '28px 32px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Key Ratios & Metrics</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>Trailing twelve months unless noted</div>
                <FinRow label="P/E Ratio (Normalised)" value={fmt(data.pe, 1, 'x')} />
                <FinRow label="P/E Ratio (TTM)" value={fmt(data.pe, 1, 'x')} />
                <FinRow label="Price / Book" value={fmt(data.pb, 2, 'x')} />
                <FinRow label="EV / EBITDA" value={fmt(data.evEbitda, 1, 'x')} />
                <FinRow label="Return on Equity (TTM)" value={fmt(data.roe, 1, '%')} good={(data.roe ?? 0) > 15} bad={(data.roe ?? 0) < 0} />
                <FinRow label="Revenue Growth YoY" value={fmt(data.revenueGrowth, 1, '%')} good={(data.revenueGrowth ?? 0) > 10} bad={(data.revenueGrowth ?? 0) < 0} />
                <FinRow label="Gross Margin (TTM)" value={fmt(data.grossMargin, 1, '%')} good={(data.grossMargin ?? 0) > 40} bad={(data.grossMargin ?? 0) < 10} />
                <FinRow label="Debt / Equity (Annual)" value={fmt(data.debtEquity, 2, 'x')} good={(data.debtEquity ?? 99) < 0.5} bad={(data.debtEquity ?? 0) > 2} />
                <FinRow label="Dividend Yield (Indicated)" value={data.dividendYield ? `${fmt(data.dividendYield, 2)}%` : 'None'} />
                <FinRow label="Market Capitalisation" value={fmtMarketCap(data.marketCap)} />
              </div>

              <div style={{ marginTop: 16, padding: '14px 18px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Data sourced from Finnhub. Green = healthy, red = potential concern, grey = neutral. Not financial advice.
                </span>
              </div>
            </div>
          )}

          {/* ── NEWS TAB ── */}
          {!loading && !error && data && tab === 'news' && (
            <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data.news.length === 0 ? (
                <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No recent news found for {symbol}.</div>
                </div>
              ) : data.news.map((item, i) => (
                <a
                  key={i}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none' }}
                >
                  <div className="card" style={{ padding: '20px 24px', cursor: 'pointer', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold-dim)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.5 }}>
                          {item.headline}
                        </div>
                        {item.summary && (
                          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 10,
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {item.summary}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 500 }}>{item.source}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtDate(item.datetime)}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: 16, color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }}>↗</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
