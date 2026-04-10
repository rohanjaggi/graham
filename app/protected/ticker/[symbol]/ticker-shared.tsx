'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatSignedPercent, metricColorForValue } from '@/lib/ui/metricFormat'
import { fmt } from './ticker-utils'

const NAV = [
  { section: 'ANALYSIS', items: [{ label: 'Overview', href: '/protected' }, { label: 'Research', href: '/protected/research' }, { label: 'Technical' }] },
  { section: 'VALUATION', items: [{ label: 'Valuation', href: '/protected/valuation' }] },
  { section: 'PORTFOLIO', items: [{ label: 'Optimiser', href: '/protected/optimiser' }, { label: 'Tail Risk' }] },
]

export function Sidebar() {
  const router = useRouter()
  return (
    <aside style={{ width: 224, minWidth: 224, height: '100vh', background: 'var(--bg-surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '0 14px' }}>
      <div style={{ padding: '0 6px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'center' }} onClick={() => router.push('/protected')}>
        <img src="/images/graham-logo.png" alt="Graham" style={{ width: 140, height: 140, objectFit: 'contain', filter: 'invert(1) sepia(1) saturate(2) hue-rotate(5deg) brightness(0.85)', display: 'block', margin: '-20px auto -30px' }} />
        <div className="font-display text-gold-gradient" style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1 }}>Graham</div>
        <div style={{ fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '0.13em', marginTop: 5, textTransform: 'uppercase' }}>Long-Term Intelligence</div>
      </div>
      <nav style={{ flex: 1, paddingTop: 18, overflowY: 'auto' }}>
        {NAV.map(({ section, items }) => (
          <div key={section} style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.13em', color: 'var(--text-muted)', padding: '0 14px 8px', textTransform: 'uppercase' }}>{section}</div>
            {items.map(({ label, href }) => (
              <div key={label} className="nav-item" style={href ? { cursor: 'pointer' } : undefined} onClick={href ? () => router.push(href) : undefined}>
                <span style={{ fontSize: 13, opacity: 0.75 }}>{label[0]}</span>
                <span>{label}</span>
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
