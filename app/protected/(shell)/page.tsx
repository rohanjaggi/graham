'use client'

import Link from 'next/link'

export default function Dashboard() {
  return <OverviewPanel />
}

/* ─── SPARKLINE ────────────────────────────────────────────────────────────── */

function Sparkline({ data, color, W = 80, H = 30 }: { data: number[]; color: string; W?: number; H?: number }) {
  const min = Math.min(...data), max = Math.max(...data)
  const pts: [number, number][] = data.map((v, i) => [
    4 + (i / (data.length - 1)) * (W - 8),
    (H - 4) - ((v - min) / (max - min || 1)) * (H - 8),
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

/* ─── AREA CHART ───────────────────────────────────────────────────────────── */

const PORTFOLIO_HISTORY = [220, 228, 224, 235, 241, 238, 252, 261, 255, 268, 274, 271, 283, 291, 288, 301]

function AreaChart() {
  const data = PORTFOLIO_HISTORY
  const min = Math.min(...data), max = Math.max(...data)
  const W = 560, H = 110
  const pts: [number, number][] = data.map((v, i) => [
    6 + (i / (data.length - 1)) * (W - 12),
    6 + (1 - (v - min) / (max - min)) * (H - 12),
  ])
  const line = pts.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `C ${x - 18} ${pts[i-1][1]} ${x - 18} ${y} ${x} ${y}`)).join(' ')
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

/* ─── DONUT CHART ─────────────────────────────────────────────────────────── */

const SLICE_COLORS = ['#C8A96E', '#5B9CF6', '#3DD68C', '#E2A0A0', '#A0B8E2']

function DonutChart({ slices }: { slices: { pct: number }[] }) {
  const R = 50, r = 30, cx = 68, cy = 68
  let angle = -Math.PI / 2
  const arcs = slices.map((s, i) => {
    const sweep = (s.pct / 100) * Math.PI * 2 * 0.96
    const x1 = cx + R * Math.cos(angle), y1 = cy + R * Math.sin(angle)
    angle += sweep
    const x2 = cx + R * Math.cos(angle), y2 = cy + R * Math.sin(angle)
    const ix1 = cx + r * Math.cos(angle - sweep), iy1 = cy + r * Math.sin(angle - sweep)
    const ix2 = cx + r * Math.cos(angle), iy2 = cy + r * Math.sin(angle)
    const lg = sweep > Math.PI ? 1 : 0
    angle += 0.04
    return { d: `M ${x1} ${y1} A ${R} ${R} 0 ${lg} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${r} ${r} 0 ${lg} 0 ${ix1} ${iy1} Z`, color: SLICE_COLORS[i] }
  })
  return (
    <svg width={136} height={136} viewBox="0 0 136 136">
      {arcs.map((a, i) => <path key={i} d={a.d} fill={a.color} opacity={0.88} />)}
      <text x={cx} y={cy - 5} textAnchor="middle" fill="#EEE9DF" fontSize="14" fontWeight="600" fontFamily="'Cormorant Garamond', serif">$301k</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#7D899E" fontSize="8.5" fontFamily="'DM Sans', sans-serif">TOTAL AUM</text>
    </svg>
  )
}

/* ─── OVERVIEW PANEL ──────────────────────────────────────────────────────── */

const HOLDINGS = [
  { ticker: 'AAPL',  name: 'Apple Inc.',         sector: 'Technology',     weight: 28, value: 84240,  gain: +18.4, moat: 'Wide',   pe: 28.4, spark: [180,190,185,200,195,208,213] },
  { ticker: 'MSFT',  name: 'Microsoft Corp.',    sector: 'Technology',     weight: 22, value: 66180,  gain: +24.1, moat: 'Wide',   pe: 35.2, spark: [340,355,348,370,390,410,415] },
  { ticker: 'BRK.B', name: 'Berkshire Hathaway', sector: 'Financials',     weight: 18, value: 54144,  gain: +9.2,  moat: 'Wide',   pe: 21.1, spark: [380,375,385,390,398,405,408] },
  { ticker: 'GOOGL', name: 'Alphabet Inc.',      sector: 'Comm. Services', weight: 17, value: 51136,  gain: +31.7, moat: 'Wide',   pe: 24.8, spark: [130,138,142,155,160,168,171] },
  { ticker: 'JPM',   name: 'JPMorgan Chase',     sector: 'Financials',     weight: 15, value: 45120,  gain: +12.5, moat: 'Narrow', pe: 12.3, spark: [210,218,225,230,228,235,233] },
]

function OverviewPanel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Hero metrics ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          { label: 'Portfolio Value',  value: '$300,820',  sub: '+$45.8k all-time', pos: true },
          { label: 'Total Return',     value: '+18.3%',    sub: 'Since inception',  pos: true },
          { label: 'Sharpe Ratio',     value: '1.42',      sub: 'Risk-adjusted',    pos: true },
          { label: 'Max Drawdown',     value: '−14.2%',    sub: "COVID-19 Mar'20",  pos: false },
        ].map((m, i) => (
          <div key={i} className={`card animate-fade-up d${i + 1}`} style={{ padding: '20px 22px' }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>{m.label}</div>
            <div className="font-display" style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.02em', color: m.pos ? 'var(--text-primary)' : 'var(--red)' }}>{m.value}</div>
            <div style={{ fontSize: 11.5, color: m.pos ? 'var(--green)' : 'var(--red)', marginTop: 6 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Portfolio chart + allocation ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>

        {/* Area chart */}
        <div className="card animate-fade-up d3" style={{ padding: '22px 24px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Portfolio Value</div>
              <div className="font-display" style={{ fontSize: 26, fontWeight: 500, marginTop: 4 }}>$300,820</div>
              <div style={{ fontSize: 11.5, color: 'var(--green)', marginTop: 3 }}>↑ $80,820 from cost basis</div>
            </div>
            <div className="tab-bar">
              {['1M', '3M', '1Y', 'All'].map(t => (
                <span key={t} className={`tab${t === '1Y' ? ' active' : ''}`}>{t}</span>
              ))}
            </div>
          </div>
          <AreaChart />
          <div style={{ display: 'flex', gap: 24, marginTop: 10, fontSize: 10.5, color: 'var(--text-muted)' }}>
            {['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'].map(m => (
              <span key={m}>{m}</span>
            ))}
          </div>
        </div>

        {/* Allocation donut */}
        <div className="card animate-fade-up d4" style={{ padding: '22px' }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 18 }}>Allocation</div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <DonutChart slices={HOLDINGS.map(h => ({ pct: h.weight }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {HOLDINGS.map((h, i) => (
              <div key={h.ticker} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: SLICE_COLORS[i], flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{h.ticker}</span>
                </div>
                <span style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>{h.weight}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Holdings table ── */}
      <div className="card animate-fade-up d5" style={{ padding: '22px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Holdings</div>
          <button className="btn-ghost" style={{ fontSize: 12 }}>Export CSV</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Ticker', 'Company', 'Sector', 'Value', 'Gain/Loss', 'P/E', 'Moat', '1W Trend'].map(h => (
                <th key={h} style={{ textAlign: 'left', fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 500, padding: '0 0 12px', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOLDINGS.map(h => (
              <tr key={h.ticker} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '14px 0', fontWeight: 700, color: 'var(--gold)', fontSize: 13, letterSpacing: '0.03em' }}>{h.ticker}</td>
                <td style={{ fontSize: 13, color: 'var(--text-primary)', paddingRight: 16 }}>{h.name}</td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)', paddingRight: 16 }}>{h.sector}</td>
                <td style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, paddingRight: 16 }}>${(h.value / 1000).toFixed(1)}k</td>
                <td style={{ paddingRight: 16 }}>
                  <span className={h.gain > 0 ? 'badge-up' : 'badge-down'}>
                    {h.gain > 0 ? '+' : ''}{h.gain}%
                  </span>
                </td>
                <td style={{ fontSize: 12.5, color: 'var(--text-secondary)', paddingRight: 16 }}>{h.pe}x</td>
                <td style={{ paddingRight: 16 }}>
                  <span className={h.moat === 'Wide' ? 'badge-up' : 'badge-neutral'}>{h.moat}</span>
                </td>
                <td>
                  <Sparkline data={h.spark} color={h.gain > 0 ? 'var(--green)' : 'var(--red)'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Module cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {[
          {
            title: 'DCF Valuation',
            badge: 'AAPL · −30% upside',
            badgeColor: 'var(--red)',
            desc: 'Intrinsic value estimate via discounted free cash flow with adjustable WACC, growth, and terminal assumptions.',
            cta: 'Open Model →',
          },
          {
            title: 'Portfolio Optimiser',
            badge: 'Sharpe 1.42',
            badgeColor: 'var(--green)',
            desc: 'Mean-variance optimisation across your holdings. Adjust risk tolerance to trace the efficient frontier.',
            cta: 'Optimise →',
          },
          {
            title: 'Tail Risk',
            badge: 'VaR 95% · −1.8%/d',
            badgeColor: 'var(--blue)',
            desc: 'Maximum drawdown analysis, historical stress scenarios (COVID, GFC), and expected shortfall metrics.',
            cta: 'View Risk →',
          },
          {
            title: 'Comparables',
            badge: '5 peers · Tech',
            badgeColor: 'var(--gold)',
            desc: 'Rapid peer benchmarking across P/E, EV/EBITDA, P/B, ROE, and analyst price targets.',
            cta: 'Compare →',
          },
          {
            title: 'Qualitative Research',
            badge: 'Wide Moat · Buy',
            badgeColor: 'var(--green)',
            desc: 'Company snapshot on ticker search: bull/bear thesis, competitive moat, key risks, and analyst consensus.',
            cta: 'Research →',
          },
          {
            title: 'Technical Analysis',
            badge: 'Bullish · RSI 58',
            badgeColor: 'var(--green)',
            desc: 'Customisable overlays — MA20/50/200, Bollinger Bands, RSI, MACD — with signal summary.',
            cta: 'Analyse →',
          },
        ].map((c, i) => {
          const card = (
            <div className={`card animate-fade-up d${(i % 4) + 1}`} style={{ padding: '22px 24px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="font-display" style={{ fontSize: 18, fontWeight: 500 }}>{c.title}</div>
                <span style={{ fontSize: 10, fontWeight: 600, color: c.badgeColor, background: `${c.badgeColor}18`, padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
                  {c.badge}
                </span>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.65 }}>{c.desc}</p>
              <div style={{ fontSize: 12.5, color: 'var(--gold)', marginTop: 4, fontWeight: 500 }}>{c.cta}</div>
            </div>
          )
          if (c.title === 'Portfolio Optimiser') {
            return (
              <Link key={i} href="/protected/optimiser" style={{ textDecoration: 'none', color: 'inherit' }}>
                {card}
              </Link>
            )
          }
          if (c.title === 'Qualitative Research') {
            return (
              <Link key={i} href="/protected/qa" style={{ textDecoration: 'none', color: 'inherit' }}>
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
