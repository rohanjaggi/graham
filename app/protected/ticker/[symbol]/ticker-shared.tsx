'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatSignedPercent, metricColorForValue } from '@/lib/ui/metricFormat'
import { fmt } from './ticker-utils'

type NavIconName = 'overview' | 'research' | 'screener' | 'valuation' | 'optimiser' | 'portfolios' | 'tailRisk'

const NAV: { section: string; items: { label: string; href?: string; icon: NavIconName }[] }[] = [
  { section: 'ANALYSIS', items: [{ label: 'Overview', href: '/protected', icon: 'overview' }, { label: 'Research', href: '/protected/research', icon: 'research' }, { label: 'Screener', href: '/protected/qa', icon: 'screener' }] },
  { section: 'VALUATION', items: [{ label: 'Valuation', href: '/protected/valuation', icon: 'valuation' }] },
  { section: 'PORTFOLIO', items: [{ label: 'Optimiser', href: '/protected/optimiser', icon: 'optimiser' }, { label: 'Portfolios', href: '/protected/portfolios', icon: 'portfolios' }, { label: 'Tail Risk', href: '/protected/tail-risk', icon: 'tailRisk' }] },
]

function NavIcon({ name }: { name: NavIconName }) {
  const common = { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', xmlns: 'http://www.w3.org/2000/svg', style: { display: 'block' as const } }
  switch (name) {
    case 'overview':
      return <svg {...common} aria-hidden="true"><path d="M2.5 7.5L8 3L13.5 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 6.8V12.5H6.5V10H9.5V12.5H12V6.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    case 'research':
      return <svg {...common} aria-hidden="true"><rect x="3.5" y="2" width="9" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" /><path d="M5.5 5.5H10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><path d="M5.5 8H10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><path d="M5.5 10.5H8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
    case 'screener':
      return <svg {...common} aria-hidden="true"><path d="M2 3.5H14L9.5 8.5V13L6.5 11.5V8.5L2 3.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    case 'valuation':
      return <svg {...common} aria-hidden="true"><path d="M8 3V13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><path d="M5 3H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><path d="M5 13H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><path d="M3.5 6L5 10H2L3.5 6Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /><path d="M12.5 6L14 10H11L12.5 6Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    case 'optimiser':
      return <svg {...common} aria-hidden="true"><path d="M2.5 5H13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><path d="M2.5 11H13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><circle cx="6" cy="5" r="2" fill="currentColor" /><circle cx="10" cy="11" r="2" fill="currentColor" /></svg>
    case 'portfolios':
      return <svg {...common} aria-hidden="true"><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.2" /><path d="M8 8V2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><path d="M8 8L12.76 10.75" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><path d="M8 8L4.5 12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
    case 'tailRisk':
      return <svg {...common} aria-hidden="true"><path d="M8 2L13.5 4.5V8.5C13.5 11.5 11 13.5 8 14.5C5 13.5 2.5 11.5 2.5 8.5V4.5L8 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /><path d="M8 6.5V9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><circle cx="8" cy="11.5" r="0.75" fill="currentColor" /></svg>
  }
}

export function Sidebar() {
  const router = useRouter()
  return (
    <aside style={{ width: 224, minWidth: 224, height: '100vh', background: 'linear-gradient(180deg, #0B1220 0%, #0E1628 52%, #0A1120 100%)', borderRight: '1px solid rgba(226, 196, 138, 0.08)', display: 'flex', flexDirection: 'column', padding: '0 14px' }}>
      <div style={{ padding: '0 6px 14px', borderBottom: '1px solid rgba(226, 196, 138, 0.08)', cursor: 'pointer', textAlign: 'center' }} onClick={() => router.push('/protected')}>
        <img src="/images/graham-logo.png" alt="Graham" style={{ width: 140, height: 140, objectFit: 'contain', filter: 'invert(1) sepia(1) saturate(1.4) hue-rotate(355deg) brightness(0.9)', display: 'block', margin: '-15px auto -30px' }} />
        <div className="font-display text-gold-gradient" style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1 }}>Graham</div>
        <div style={{ fontSize: 9.5, color: '#74819A', letterSpacing: '0.13em', marginTop: 5, textTransform: 'uppercase' }}>Long-Term Intelligence</div>
      </div>
      <nav style={{ flex: 1, paddingTop: 18, overflowY: 'auto' }}>
        {NAV.map(({ section, items }) => (
          <div key={section} style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.13em', color: '#60708D', padding: '0 14px 8px', textTransform: 'uppercase' }}>{section}</div>
            {items.map(({ label, href, icon }) => (
              <div key={label} className="nav-item" style={href ? { cursor: 'pointer' } : undefined} onClick={href ? () => router.push(href) : undefined}>
                <span style={{ opacity: 0.8, minWidth: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <NavIcon name={icon} />
                </span>
                {label}
              </div>
            ))}
          </div>
        ))}
      </nav>
      <div style={{ padding: '16px 6px', borderTop: '1px solid rgba(226, 196, 138, 0.08)' }}>
        <div style={{ fontSize: 10.5, color: '#6A7790' }}>IS4228 | Spring 2026</div>
        <div style={{ fontSize: 10, color: '#58657D', opacity: 0.72, marginTop: 3 }}>v0.1.0</div>
      </div>
    </aside>
  )
}

export function Skeleton({ w = '100%', h = 16 }: { w?: string | number; h?: number }) {
  return <div style={{ width: w, height: h, borderRadius: 6, background: 'linear-gradient(90deg, var(--bg-elevated) 25%, var(--bg-hover) 50%, var(--bg-elevated) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
}

const PERIODS = ['1W', '1M', '3M', '6M', '1Y'] as const
type Period = typeof PERIODS[number]
interface Candle { t: number; o: number; h: number; l: number; c: number }

export function PriceChart({ symbol }: { symbol: string }) {
  const [period, setPeriod] = useState<Period>('1M')
  const [chartType, setChartType] = useState<'line' | 'candle'>('candle')
  const [candles, setCandles] = useState<Candle[]>([])
  const [periodReturn, setPeriodReturn] = useState<number | null>(null)
  const [chartLoading, setChartLoading] = useState(true)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  useEffect(() => {
    setChartLoading(true)
    setCandles([])
    setHoveredIdx(null)
    fetch(`/api/ticker/${symbol}/candles?period=${period}`).then(r => r.ok ? r.json() : null).then(d => {
      if (d?.candles) { setCandles(d.candles); setPeriodReturn(d.periodReturn) }
      setChartLoading(false)
    }).catch(() => setChartLoading(false))
  }, [symbol, period])

  const W = 800, H = 200, PAD = { t: 12, r: 8, b: 28, l: 8 }
  const chartH = H - PAD.t - PAD.b
  const chartW = W - PAD.l - PAD.r
  const up = (periodReturn ?? 0) >= 0
  const allHighs = candles.map(c => c.h)
  const allLows = candles.map(c => c.l)
  const priceMin = candles.length ? Math.min(...allLows) : 0
  const priceMax = candles.length ? Math.max(...allHighs) : 1
  const priceRange = priceMax - priceMin || 1
  const n = candles.length
  const candleW = Math.max(1, Math.min(12, chartW / n - 1))
  const xLabels = n > 4 ? [0, Math.floor(n / 3), Math.floor(2 * n / 3), n - 1].map(i => ({ x: PAD.l + (i / (n - 1)) * chartW, label: new Date(candles[i].t * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) })) : []

  function toY(price: number) {
    return PAD.t + (1 - (price - priceMin) / priceRange) * chartH
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!n) return
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * W - PAD.l
    const idx = Math.max(0, Math.min(n - 1, Math.round((mx / chartW) * (n - 1))))
    setHoveredIdx(idx)
  }

  const hc = hoveredIdx != null ? candles[hoveredIdx] : null

  return (
    <div className="card" style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Price</span>
          {periodReturn != null && !hc && <span style={{ fontSize: 13, fontWeight: 600, color: metricColorForValue(periodReturn) }}>{formatSignedPercent((periodReturn ?? 0) / 100)} ({period})</span>}
          {hc && <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>${(chartType === 'candle' ? hc.c : hc.c).toFixed(2)} <span style={{ color: 'var(--text-muted)' }}>{new Date(hc.t * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></span>}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 2, background: 'var(--bg-elevated)', borderRadius: 7, padding: 3 }}>
            {(['line', 'candle'] as const).map(type => <button key={type} onClick={() => setChartType(type)} style={{ padding: '4px 10px', borderRadius: 5, fontSize: 11.5, fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", background: chartType === type ? 'var(--bg-surface)' : 'transparent', color: chartType === type ? 'var(--gold)' : 'var(--text-muted)', transition: 'all 0.15s' }}>{type === 'line' ? 'L' : 'C'}</button>)}
          </div>
          <div style={{ display: 'flex', gap: 2, background: 'var(--bg-elevated)', borderRadius: 7, padding: 3 }}>
            {PERIODS.map(p => <button key={p} onClick={() => setPeriod(p)} style={{ padding: '4px 10px', borderRadius: 5, fontSize: 11.5, fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", background: period === p ? 'var(--bg-surface)' : 'transparent', color: period === p ? 'var(--gold)' : 'var(--text-muted)', transition: 'all 0.15s' }}>{p}</button>)}
          </div>
        </div>
      </div>

      {chartLoading ? (
        <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 18, height: 18, border: '2px solid var(--border-bright)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>
      ) : n < 2 ? (
        <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No chart data for this period</span></div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, cursor: 'crosshair' }} onMouseMove={handleMouseMove} onMouseLeave={() => setHoveredIdx(null)}>
          {[0.25, 0.5, 0.75].map(f => <line key={f} x1={PAD.l} y1={PAD.t + f * chartH} x2={W - PAD.r} y2={PAD.t + f * chartH} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 4" />)}
          {chartType === 'candle' ? candles.map((c, i) => {
            const x = PAD.l + (i / (n - 1)) * chartW
            const isUp = c.c >= c.o
            const color = isUp ? '#3DD68C' : '#F06070'
            const bodyTop = toY(Math.max(c.o, c.c))
            const bodyBottom = toY(Math.min(c.o, c.c))
            const bodyH = Math.max(1, bodyBottom - bodyTop)
            const isHovered = hoveredIdx === i
            return <g key={i} opacity={hoveredIdx != null && !isHovered ? 0.5 : 1} style={{ transition: 'opacity 0.1s' }}><line x1={x} y1={toY(c.h)} x2={x} y2={toY(c.l)} stroke={color} strokeWidth={isHovered ? 1.5 : 1} /><rect x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH} fill={color} fillOpacity={isUp ? 0.85 : 1} stroke={color} strokeWidth={isHovered ? 1.5 : 0.5} rx={candleW > 4 ? 1 : 0} /></g>
          }) : (
            <>
              <defs><linearGradient id={`lineArea-${symbol}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={up ? '#3DD68C' : '#F06070'} stopOpacity="0.18" /><stop offset="100%" stopColor={up ? '#3DD68C' : '#F06070'} stopOpacity="0" /></linearGradient></defs>
              <path d={candles.map((c, i) => `${i === 0 ? 'M' : 'L'} ${PAD.l + (i / (n - 1)) * chartW} ${toY(c.c)}`).join(' ') + ` L ${PAD.l + chartW} ${PAD.t + chartH} L ${PAD.l} ${PAD.t + chartH} Z`} fill={`url(#lineArea-${symbol})`} />
              <path d={candles.map((c, i) => `${i === 0 ? 'M' : 'L'} ${PAD.l + (i / (n - 1)) * chartW} ${toY(c.c)}`).join(' ')} fill="none" stroke={up ? '#3DD68C' : '#F06070'} strokeWidth="1.5" />
            </>
          )}
          {hoveredIdx != null && <line x1={PAD.l + (hoveredIdx / (n - 1)) * chartW} y1={PAD.t} x2={PAD.l + (hoveredIdx / (n - 1)) * chartW} y2={H - PAD.b} stroke="var(--border-bright)" strokeWidth="1" strokeDasharray="3 3" />}
          {xLabels.map(({ x, label }) => <text key={label} x={x} y={H - 4} textAnchor="middle" fill="var(--text-muted)" fontSize="9.5" fontFamily="'DM Sans', sans-serif">{label}</text>)}
        </svg>
      )}
    </div>
  )
}

export function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="card" style={{ padding: '18px 20px' }}><div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div><div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>{sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}</div>
}

export function FinRow({ label, value, good, bad }: { label: string; value: string; good?: boolean; bad?: boolean }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 0', borderBottom: '1px solid var(--border)' }}><span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span><span className={good ? 'badge-up' : bad ? 'badge-down' : 'badge-neutral'} style={{ fontSize: 12.5, padding: '3px 10px', borderRadius: 5 }}>{value}</span></div>
}
