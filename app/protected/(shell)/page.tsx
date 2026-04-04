'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type DashboardPortfolio = {
  id: string
  name: string
  investmentHorizonBucket: string
  riskTolerance: string
  expectedAnnualReturn: number
  expectedAnnualVolatility: number
  sharpeRatio: number
  updatedAt: string
}

function formatPortfolioPct(value: number) {
  return `${(value * 100).toFixed(2)}%`
}

function formatPortfolioDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function Sparkline({ data, color, W = 80, H = 30 }: { data: number[]; color: string; W?: number; H?: number }) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const pts: [number, number][] = data.map((v, i) => [
    4 + (i / (data.length - 1)) * (W - 8),
    H - 4 - ((v - min) / (max - min || 1)) * (H - 8),
  ])
  const line = pts.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(' ')
  const area = `${line} L ${pts[pts.length - 1][0]} ${H} L ${pts[0][0]} ${H} Z`
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <linearGradient id={`sp-${color.slice(4, 7)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sp-${color.slice(4, 7)})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const PORTFOLIO_HISTORY = [220, 228, 224, 235, 241, 238, 252, 261, 255, 268, 274, 271, 283, 291, 288, 301]

function AreaChart() {
  const data = PORTFOLIO_HISTORY
  const min = Math.min(...data)
  const max = Math.max(...data)
  const W = 560
  const H = 110
  const pts: [number, number][] = data.map((v, i) => [
    6 + (i / (data.length - 1)) * (W - 12),
    6 + (1 - (v - min) / (max - min)) * (H - 12),
  ])
  const line = pts
    .map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `C ${x - 18} ${pts[i - 1][1]} ${x - 18} ${y} ${x} ${y}`))
    .join(' ')
  const area = `${line} L ${pts[pts.length - 1][0]} ${H} L ${pts[0][0]} ${H} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
      <defs>
        <linearGradient id="area-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C8A96E" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#C8A96E" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#area-g)" />
      <path d={line} fill="none" stroke="#C8A96E" strokeWidth="2" strokeLinecap="round" className="chart-line" />
    </svg>
  )
}

const SLICE_COLORS = ['#C8A96E', '#5B9CF6', '#3DD68C', '#E2A0A0', '#A0B8E2']

function DonutChart({ slices }: { slices: { pct: number }[] }) {
  const R = 50
  const r = 30
  const cx = 68
  const cy = 68
  let angle = -Math.PI / 2
  const arcs = slices.map((slice, i) => {
    const sweep = (slice.pct / 100) * Math.PI * 2 * 0.96
    const x1 = cx + R * Math.cos(angle)
    const y1 = cy + R * Math.sin(angle)
    angle += sweep
    const x2 = cx + R * Math.cos(angle)
    const y2 = cy + R * Math.sin(angle)
    const ix1 = cx + r * Math.cos(angle - sweep)
    const iy1 = cy + r * Math.sin(angle - sweep)
    const ix2 = cx + r * Math.cos(angle)
    const iy2 = cy + r * Math.sin(angle)
    const largeArc = sweep > Math.PI ? 1 : 0
    angle += 0.04
    return {
      d: `M ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${r} ${r} 0 ${largeArc} 0 ${ix1} ${iy1} Z`,
      color: SLICE_COLORS[i],
    }
  })

  return (
    <svg width={136} height={136} viewBox="0 0 136 136">
      {arcs.map((arc, i) => (
        <path key={i} d={arc.d} fill={arc.color} opacity={0.88} />
      ))}
      <text x={cx} y={cy - 5} textAnchor="middle" fill="#EEE9DF" fontSize="14" fontWeight="600" fontFamily="'Cormorant Garamond', serif">
        $301k
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#7D899E" fontSize="8.5" fontFamily="'DM Sans', sans-serif">
        TOTAL AUM
      </text>
    </svg>
  )
}

const HOLDINGS = [
  { ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology', weight: 28, value: 84240, gain: 18.4, moat: 'Wide', pe: 28.4, spark: [180, 190, 185, 200, 195, 208, 213] },
  { ticker: 'MSFT', name: 'Microsoft Corp.', sector: 'Technology', weight: 22, value: 66180, gain: 24.1, moat: 'Wide', pe: 35.2, spark: [340, 355, 348, 370, 390, 410, 415] },
  { ticker: 'BRK.B', name: 'Berkshire Hathaway', sector: 'Financials', weight: 18, value: 54144, gain: 9.2, moat: 'Wide', pe: 21.1, spark: [380, 375, 385, 390, 398, 405, 408] },
  { ticker: 'GOOGL', name: 'Alphabet Inc.', sector: 'Comm. Services', weight: 17, value: 51136, gain: 31.7, moat: 'Wide', pe: 24.8, spark: [130, 138, 142, 155, 160, 168, 171] },
  { ticker: 'JPM', name: 'JPMorgan Chase', sector: 'Financials', weight: 15, value: 45120, gain: 12.5, moat: 'Narrow', pe: 12.3, spark: [210, 218, 225, 230, 228, 235, 233] },
]

export default function Dashboard() {
  const [latestPortfolios, setLatestPortfolios] = useState<DashboardPortfolio[]>([])

  useEffect(() => {
    let mounted = true

    async function loadLatestPortfolios() {
      try {
        const res = await fetch('/api/profile/portfolios', { cache: 'no-store' })
        const data = await res.json()
        if (!mounted || !res.ok || !Array.isArray(data?.portfolios)) return
        setLatestPortfolios(data.portfolios.slice(0, 3))
      } catch {
        if (mounted) setLatestPortfolios([])
      }
    }

    void loadLatestPortfolios()
    return () => {
      mounted = false
    }
  }, [])

  return <OverviewPanel latestPortfolios={latestPortfolios} />
}

function OverviewPanel({ latestPortfolios }: { latestPortfolios: DashboardPortfolio[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card animate-fade-up d1" style={{ padding: '22px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Latest Saved Portfolios</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6 }}>
              Your most recent optimized portfolios, ready to review or update.
            </div>
          </div>
          <Link href="/protected/portfolios" className="btn-ghost" style={{ textDecoration: 'none', fontSize: 12 }}>
            View All
          </Link>
        </div>

        {latestPortfolios.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
            <div>
              <div className="font-display" style={{ fontSize: 18 }}>No saved portfolios yet</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
                Save your first optimized allocation to start building a portfolio history.
              </div>
            </div>
            <Link href="/protected/optimiser" className="btn-gold" style={{ textDecoration: 'none', fontSize: 12 }}>
              Create One
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {latestPortfolios.map((portfolio) => (
              <Link key={portfolio.id} href={`/protected/portfolios/${portfolio.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', height: '100%' }}>
                  <div className="font-display" style={{ fontSize: 18, fontWeight: 500 }}>{portfolio.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
                    {portfolio.investmentHorizonBucket} horizon · {portfolio.riskTolerance.toLowerCase()} risk
                  </div>
                  <div style={{ display: 'grid', gap: 6, marginTop: 14, fontSize: 12.5 }}>
                    <div style={{ color: 'var(--text-secondary)' }}>Return {formatPortfolioPct(portfolio.expectedAnnualReturn)}</div>
                    <div style={{ color: 'var(--text-secondary)' }}>Vol {formatPortfolioPct(portfolio.expectedAnnualVolatility)}</div>
                    <div style={{ color: 'var(--text-secondary)' }}>Sharpe {portfolio.sharpeRatio.toFixed(2)}</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 14 }}>
                    Updated {formatPortfolioDate(portfolio.updatedAt)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          { label: 'Portfolio Value', value: '$300,820', sub: '+$45.8k all-time', pos: true },
          { label: 'Total Return', value: '+18.3%', sub: 'Since inception', pos: true },
          { label: 'Sharpe Ratio', value: '1.42', sub: 'Risk-adjusted', pos: true },
          { label: 'Max Drawdown', value: '-14.2%', sub: "COVID-19 Mar '20", pos: false },
        ].map((metric, i) => (
          <div key={i} className={`card animate-fade-up d${i + 1}`} style={{ padding: '20px 22px' }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>{metric.label}</div>
            <div className="font-display" style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.02em', color: metric.pos ? 'var(--text-primary)' : 'var(--red)' }}>
              {metric.value}
            </div>
            <div style={{ fontSize: 11.5, color: metric.pos ? 'var(--green)' : 'var(--red)', marginTop: 6 }}>{metric.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
        <div className="card animate-fade-up d3" style={{ padding: '22px 24px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Portfolio Value</div>
              <div className="font-display" style={{ fontSize: 26, fontWeight: 500, marginTop: 4 }}>$300,820</div>
              <div style={{ fontSize: 11.5, color: 'var(--green)', marginTop: 3 }}>? $80,820 from cost basis</div>
            </div>
            <div className="tab-bar">
              {['1M', '3M', '1Y', 'All'].map((tab) => (
                <span key={tab} className={`tab${tab === '1Y' ? ' active' : ''}`}>{tab}</span>
              ))}
            </div>
          </div>
          <AreaChart />
          <div style={{ display: 'flex', gap: 24, marginTop: 10, fontSize: 10.5, color: 'var(--text-muted)' }}>
            {['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'].map((month) => (
              <span key={month}>{month}</span>
            ))}
          </div>
        </div>

        <div className="card animate-fade-up d4" style={{ padding: '22px' }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 18 }}>Allocation</div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <DonutChart slices={HOLDINGS.map((holding) => ({ pct: holding.weight }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {HOLDINGS.map((holding, i) => (
              <div key={holding.ticker} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: SLICE_COLORS[i], flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{holding.ticker}</span>
                </div>
                <span style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>{holding.weight}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card animate-fade-up d5" style={{ padding: '22px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Holdings</div>
          <button className="btn-ghost" style={{ fontSize: 12 }}>Export CSV</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Ticker', 'Company', 'Sector', 'Value', 'Gain/Loss', 'P/E', 'Moat', '1W Trend'].map((heading) => (
                <th key={heading} style={{ textAlign: 'left', fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 500, padding: '0 0 12px', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOLDINGS.map((holding) => (
              <tr key={holding.ticker} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '14px 0', fontWeight: 700, color: 'var(--gold)', fontSize: 13, letterSpacing: '0.03em' }}>{holding.ticker}</td>
                <td style={{ fontSize: 13, color: 'var(--text-primary)', paddingRight: 16 }}>{holding.name}</td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)', paddingRight: 16 }}>{holding.sector}</td>
                <td style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, paddingRight: 16 }}>${(holding.value / 1000).toFixed(1)}k</td>
                <td style={{ paddingRight: 16 }}>
                  <span className={holding.gain > 0 ? 'badge-up' : 'badge-down'}>
                    {holding.gain > 0 ? '+' : ''}{holding.gain}%
                  </span>
                </td>
                <td style={{ fontSize: 12.5, color: 'var(--text-secondary)', paddingRight: 16 }}>{holding.pe}x</td>
                <td style={{ paddingRight: 16 }}>
                  <span className={holding.moat === 'Wide' ? 'badge-up' : 'badge-neutral'}>{holding.moat}</span>
                </td>
                <td>
                  <Sparkline data={holding.spark} color={holding.gain > 0 ? 'var(--green)' : 'var(--red)'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {[
          {
            title: 'DCF Valuation',
            badge: 'AAPL · -30% upside',
            badgeColor: 'var(--red)',
            desc: 'Intrinsic value estimate via discounted free cash flow with adjustable WACC, growth, and terminal assumptions.',
            cta: 'Open valuation →',
            href: '/protected/valuation',
          },
          {
            title: 'Portfolio Optimiser',
            badge: 'Sharpe 1.42',
            badgeColor: 'var(--green)',
            desc: 'Create optimized allocations, save them into your portfolio library, and revisit each portfolio from a dedicated detail page.',
            cta: 'Open portfolios →',
            href: '/protected/portfolios',
          },
          {
            title: 'Tail Risk',
            badge: 'VaR 95% · -1.8%/d',
            badgeColor: 'var(--blue)',
            desc: 'Maximum drawdown analysis, historical stress scenarios (COVID, GFC), and expected shortfall metrics.',
            cta: 'View tail risk →',
            href: '/protected/tail-risk',
          },
          {
            title: 'Comparables',
            badge: '5 peers · Tech',
            badgeColor: 'var(--gold)',
            desc: 'Rapid peer benchmarking across P/E, EV/EBITDA, P/B, ROE, and analyst price targets.',
            cta: 'Open comparables →',
            href: '/protected/valuation?tab=comparables',
          },
          {
            title: 'Qualitative Research',
            badge: 'Wide Moat · Buy',
            badgeColor: 'var(--green)',
            desc: 'Company snapshot on ticker search: bull/bear thesis, competitive moat, key risks, and analyst consensus.',
            cta: 'Open research →',
            href: '/protected/research',
          },
          {
            title: 'Technical Analysis',
            badge: 'Coming soon',
            badgeColor: 'var(--text-muted)',
            desc: 'This module is still in roadmap status, so it is shown as planned instead of linking to a dead-end page.',
            cta: 'Planned module',
            href: '',
          },
        ].map((cardData, i) => {
          const card = (
            <div
              className={`card animate-fade-up d${(i % 4) + 1}`}
              style={{
                padding: '22px 24px',
                cursor: cardData.href ? 'pointer' : 'default',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                minHeight: 176,
                border: cardData.href ? '1px solid var(--border)' : '1px dashed var(--border)',
                opacity: cardData.href ? 1 : 0.7,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="font-display" style={{ fontSize: 18, fontWeight: 500 }}>{cardData.title}</div>
                <span style={{ fontSize: 10, fontWeight: 600, color: cardData.badgeColor, background: `${cardData.badgeColor}18`, padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
                  {cardData.badge}
                </span>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.65 }}>{cardData.desc}</p>
              <div style={{ fontSize: 12.5, color: 'var(--gold)', marginTop: 4, fontWeight: 500 }}>{cardData.cta}</div>
            </div>
          )

          if (cardData.href) {
            return (
              <Link key={i} href={cardData.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                {card}
              </Link>
            )
          }

          return <div key={i}>{card}</div>
        })}
      </div>
    </div>
  )
}
