'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import type { FinancialsApiResponse } from '@/app/api/ticker/[symbol]/financials/route'

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
  dayHigh: number | null
  dayLow: number | null
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

interface CompanySummaryResponse {
  summary?: string
  whatItIs?: string
  companyDescription?: string
  crisisRelevance?: string
  keyVulnerabilities?: string[]
  transmissionChannels?: string[]
  whatToExploreNext?: string[]
}

type RiskLevel = 'Low' | 'Medium' | 'High'

interface CrisisHeuristics {
  fundingRisk: RiskLevel
  liquidityRisk: RiskLevel
  counterpartyRisk: RiskLevel
  sentimentSensitivity: RiskLevel
  interconnectedness: RiskLevel
  confidenceLevel: RiskLevel
  exposureCategories: string[]
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

function scoreToLevel(score: number): RiskLevel {
  if (score >= 7) return 'High'
  if (score >= 4) return 'Medium'
  return 'Low'
}

function confidenceFromCoverage(totalItems: number): RiskLevel {
  if (totalItems >= 8) return 'High'
  if (totalItems >= 4) return 'Medium'
  return 'Low'
}

function bucketByKeyword(items: string[], mappings: Array<{ label: string; re: RegExp }>): string[] {
  const labels = new Set<string>()
  for (const item of items) {
    for (const mapping of mappings) {
      if (mapping.re.test(item)) labels.add(mapping.label)
    }
  }
  return Array.from(labels)
}

function getCrisisHeuristics(
  data: TickerData,
  vulnerabilities: string[],
  channels: string[],
  nextSteps: string[]
): CrisisHeuristics {
  const fundingScore = (() => {
    let score = 3
    const de = data.debtEquity ?? 0
    const growth = data.revenueGrowth ?? 0
    if (de > 2) score += 4
    else if (de > 1) score += 2
    if (growth < 0) score += 1
    if (/financial|bank|insurance|real estate/i.test(data.sector || '')) score += 1
    return Math.min(10, score)
  })()

  const liquidityScore = (() => {
    let score = 3
    const absMove = Math.abs(data.priceChangePct ?? 0)
    const de = data.debtEquity ?? 0
    if (absMove > 5) score += 2
    if (de > 2) score += 2
    if ((data.marketCap ?? 0) < 10_000) score += 1
    if (/funding|liquidity|refinanc/i.test(vulnerabilities.join(' '))) score += 1
    return Math.min(10, score)
  })()

  const counterpartyScore = (() => {
    let score = 3
    const text = `${vulnerabilities.join(' ')} ${channels.join(' ')}`
    if (/counterparty|interbank|credit|derivative|broker|dealer/i.test(text)) score += 4
    if (/financial|bank|insurance/i.test(data.sector || '')) score += 2
    return Math.min(10, score)
  })()

  const sentimentScore = (() => {
    let score = 3
    const absMove = Math.abs(data.priceChangePct ?? 0)
    if (absMove > 6) score += 4
    else if (absMove > 3) score += 2
    if ((data.marketCap ?? 0) > 250_000) score += 1
    if (/news|sentiment|confidence|volatility/i.test(channels.join(' '))) score += 1
    return Math.min(10, score)
  })()

  const interconnectednessScore = (() => {
    let score = 3
    const text = `${channels.join(' ')} ${nextSteps.join(' ')}`
    if (/contagion|transmission|supply chain|counterparty|system|interconnect/i.test(text)) score += 3
    if ((data.marketCap ?? 0) > 500_000) score += 2
    if (/financial|technology|energy|healthcare/i.test(data.sector || '')) score += 1
    return Math.min(10, score)
  })()

  const exposureMatches = bucketByKeyword(
    [...vulnerabilities, ...channels, ...nextSteps],
    [
      { label: 'Funding liabilities', re: /funding|refinanc|maturity|short-term/i },
      { label: 'Credit exposures', re: /credit|default|counterparty|interbank/i },
      { label: 'Trading assets', re: /trading|mark-to-market|market contagion|asset price/i },
      { label: 'Derivatives', re: /derivative|hedg/i },
      { label: 'Consumer demand', re: /consumer|spending|retail/i },
      { label: 'Enterprise spending', re: /enterprise|business spend|capex/i },
      { label: 'Cloud and infrastructure', re: /cloud|infrastructure|data center/i },
      { label: 'Regulatory sensitivity', re: /regulator|policy|compliance|legal/i },
      { label: 'Global supply chain', re: /supply chain|logistics|geopolit/i },
    ]
  )

  const fallbackBySector = /financial|bank|insurance/i.test(data.sector || '')
    ? ['Funding liabilities', 'Credit exposures', 'Trading assets', 'Derivatives']
    : /technology/i.test(data.sector || '')
      ? ['Enterprise spending', 'Cloud and infrastructure', 'Consumer demand', 'Regulatory sensitivity']
      : ['Consumer demand', 'Global supply chain', 'Regulatory sensitivity']

  const exposureCategories = (exposureMatches.length > 0 ? exposureMatches : fallbackBySector).slice(0, 4)
  const coverage = vulnerabilities.length + channels.length + nextSteps.length

  return {
    fundingRisk: scoreToLevel(fundingScore),
    liquidityRisk: scoreToLevel(liquidityScore),
    counterpartyRisk: scoreToLevel(counterpartyScore),
    sentimentSensitivity: scoreToLevel(sentimentScore),
    interconnectedness: scoreToLevel(interconnectednessScore),
    confidenceLevel: confidenceFromCoverage(coverage),
    exposureCategories,
  }
}

function riskBadgeStyle(level: RiskLevel): React.CSSProperties {
  if (level === 'High') {
    return {
      color: '#ff88a0',
      background: 'rgba(240, 96, 112, 0.14)',
      border: '1px solid rgba(240, 96, 112, 0.36)',
    }
  }
  if (level === 'Medium') {
    return {
      color: '#e4c27a',
      background: 'rgba(212, 180, 117, 0.16)',
      border: '1px solid rgba(212, 180, 117, 0.34)',
    }
  }
  return {
    color: '#78cda1',
    background: 'rgba(61, 214, 140, 0.14)',
    border: '1px solid rgba(61, 214, 140, 0.3)',
  }
}

/* ─── SIDEBAR ─────────────────────────────────────────────────────────────── */

const NAV = [
  { section: 'ANALYSIS',  items: [{ label: 'Overview', href: '/protected' }, { label: 'Research', href: '/protected/research' }, { label: 'Technical' }] },
  { section: 'VALUATION', items: [{ label: 'Valuation', href: '/protected/valuation' }] },
  { section: 'PORTFOLIO', items: [{ label: 'Optimiser', href: '/protected/optimiser' }, { label: 'Tail Risk' }] },
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
        style={{ padding: '0 6px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'center' }}
        onClick={() => router.push('/protected')}
      >
        <img src="/images/graham-logo.png" alt="Graham" style={{ width: 140, height: 140, objectFit: 'contain', filter: 'invert(1) sepia(1) saturate(2) hue-rotate(5deg) brightness(0.85)', display: 'block', margin: '-20px auto -30px' }} />
        <div className="font-display text-gold-gradient" style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1 }}>
          Graham
        </div>
        <div style={{ fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '0.13em', marginTop: 5, textTransform: 'uppercase' }}>
          Long-Term Intelligence
        </div>
      </div>
      <nav style={{ flex: 1, paddingTop: 18, overflowY: 'auto' }}>
        {NAV.map(({ section, items }) => (
          <div key={section} style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.13em', color: 'var(--text-muted)', padding: '0 14px 8px', textTransform: 'uppercase' }}>
              {section}
            </div>
            {items.map(({ label, href }) => {
              const icon =
                label === 'Overview' ? '⬡' : label === 'Research' ? '⊕' : label === 'Technical' ? '△' :
                label === 'Valuation' ? '⊞' :
                label === 'Optimiser' ? '◎' : '◐'
              return (
                <div
                  key={label}
                  className="nav-item"
                  style={href ? { cursor: 'pointer' } : undefined}
                  onClick={href ? () => router.push(href) : undefined}
                >
                  <span style={{ fontSize: 13, opacity: 0.75 }}>{icon}</span>
                  {label}
                </div>
              )
            })}
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

/* ─── PRICE CHART ─────────────────────────────────────────────────────────── */

const PERIODS = ['1W', '1M', '3M', '6M', '1Y'] as const
type Period = typeof PERIODS[number]

interface Candle { t: number; o: number; h: number; l: number; c: number }

function PriceChart({ symbol }: { symbol: string }) {
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
    fetch(`/api/ticker/${symbol}/candles?period=${period}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.candles) { setCandles(d.candles); setPeriodReturn(d.periodReturn) }
        setChartLoading(false)
      })
      .catch(() => setChartLoading(false))
  }, [symbol, period])

  const W = 800, H = 200, PAD = { t: 12, r: 8, b: 28, l: 8 }
  const chartH = H - PAD.t - PAD.b
  const chartW = W - PAD.l - PAD.r
  const up = (periodReturn ?? 0) >= 0

  // Price scale using full high/low range
  const allHighs = candles.map(c => c.h)
  const allLows  = candles.map(c => c.l)
  const priceMin = candles.length ? Math.min(...allLows)  : 0
  const priceMax = candles.length ? Math.max(...allHighs) : 1
  const priceRange = priceMax - priceMin || 1

  function toY(price: number) {
    return PAD.t + (1 - (price - priceMin) / priceRange) * chartH
  }

  const n = candles.length
  const candleW = Math.max(1, Math.min(12, chartW / n - 1))

  // X-axis labels
  const xLabels = n > 4
    ? [0, Math.floor(n / 3), Math.floor(2 * n / 3), n - 1].map(i => ({
        x: PAD.l + (i / (n - 1)) * chartW,
        label: new Date(candles[i].t * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      }))
    : []

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
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Price</span>
          {periodReturn != null && !hc && (
            <span style={{ fontSize: 13, fontWeight: 600, color: up ? '#3DD68C' : '#F06070' }}>
              {up ? '+' : ''}{periodReturn.toFixed(2)}% ({period})
            </span>
          )}
          {hc && chartType === 'candle' && (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
              O <span style={{ color: 'var(--text-primary)' }}>${hc.o.toFixed(2)}</span>
              {'  '}H <span style={{ color: '#3DD68C' }}>${hc.h.toFixed(2)}</span>
              {'  '}L <span style={{ color: '#F06070' }}>${hc.l.toFixed(2)}</span>
              {'  '}C <span style={{ color: hc.c >= hc.o ? '#3DD68C' : '#F06070', fontWeight: 600 }}>${hc.c.toFixed(2)}</span>
              {'  '}<span style={{ color: 'var(--text-muted)' }}>{new Date(hc.t * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </span>
          )}
          {hc && chartType === 'line' && (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>${hc.c.toFixed(2)}</span>
              {'  '}<span style={{ color: 'var(--text-muted)' }}>{new Date(hc.t * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* Chart type toggle */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--bg-elevated)', borderRadius: 7, padding: 3 }}>
            {(['line', 'candle'] as const).map(type => (
              <button key={type} onClick={() => setChartType(type)} style={{
                padding: '4px 10px', borderRadius: 5, fontSize: 11.5, fontWeight: 500,
                border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                background: chartType === type ? 'var(--bg-surface)' : 'transparent',
                color: chartType === type ? 'var(--gold)' : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}>{type === 'line' ? '↗' : '▮'}</button>
            ))}
          </div>
          {/* Period toggle */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--bg-elevated)', borderRadius: 7, padding: 3 }}>
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '4px 10px', borderRadius: 5, fontSize: 11.5, fontWeight: 500,
              border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
              background: period === p ? 'var(--bg-surface)' : 'transparent',
              color: period === p ? 'var(--gold)' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}>{p}</button>
          ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      {chartLoading ? (
        <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 18, height: 18, border: '2px solid var(--border-bright)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : n < 2 ? (
        <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No chart data for this period</span>
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: H, cursor: 'crosshair' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map(f => (
            <line key={f}
              x1={PAD.l} y1={PAD.t + f * chartH}
              x2={W - PAD.r} y2={PAD.t + f * chartH}
              stroke="var(--border)" strokeWidth="1" strokeDasharray="3 4"
            />
          ))}

          {/* Price labels on grid lines */}
          {[0.25, 0.5, 0.75].map(f => {
            const price = priceMax - f * priceRange
            return (
              <text key={f} x={W - PAD.r - 2} y={PAD.t + f * chartH - 3}
                textAnchor="end" fill="var(--text-muted)" fontSize="8.5" fontFamily="'DM Sans', sans-serif">
                ${price.toFixed(0)}
              </text>
            )
          })}

          {/* Chart content */}
          {chartType === 'candle' ? (
            <>
              {candles.map((c, i) => {
                const x = PAD.l + (i / (n - 1)) * chartW
                const isUp = c.c >= c.o
                const color = isUp ? '#3DD68C' : '#F06070'
                const bodyTop    = toY(Math.max(c.o, c.c))
                const bodyBottom = toY(Math.min(c.o, c.c))
                const bodyH = Math.max(1, bodyBottom - bodyTop)
                const isHovered = hoveredIdx === i
                return (
                  <g key={i} opacity={hoveredIdx != null && !isHovered ? 0.5 : 1} style={{ transition: 'opacity 0.1s' }}>
                    <line x1={x} y1={toY(c.h)} x2={x} y2={toY(c.l)} stroke={color} strokeWidth={isHovered ? 1.5 : 1}/>
                    <rect
                      x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH}
                      fill={color} fillOpacity={isUp ? 0.85 : 1}
                      stroke={color} strokeWidth={isHovered ? 1.5 : 0.5}
                      rx={candleW > 4 ? 1 : 0}
                    />
                  </g>
                )
              })}
            </>
          ) : (
            <>
              <defs>
                <linearGradient id={`lineArea-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={up ? '#3DD68C' : '#F06070'} stopOpacity="0.18"/>
                  <stop offset="100%" stopColor={up ? '#3DD68C' : '#F06070'} stopOpacity="0"/>
                </linearGradient>
              </defs>
              <path
                d={candles.map((c, i) => `${i === 0 ? 'M' : 'L'} ${PAD.l + (i / (n - 1)) * chartW} ${toY(c.c)}`).join(' ')
                  + ` L ${PAD.l + chartW} ${PAD.t + chartH} L ${PAD.l} ${PAD.t + chartH} Z`}
                fill={`url(#lineArea-${symbol})`}
              />
              <path
                d={candles.map((c, i) => `${i === 0 ? 'M' : 'L'} ${PAD.l + (i / (n - 1)) * chartW} ${toY(c.c)}`).join(' ')}
                fill="none"
                stroke={up ? '#3DD68C' : '#F06070'}
                strokeWidth="1.5"
              />
              {hoveredIdx != null && (
                <circle
                  cx={PAD.l + (hoveredIdx / (n - 1)) * chartW}
                  cy={toY(candles[hoveredIdx].c)}
                  r="4" fill={up ? '#3DD68C' : '#F06070'}
                  stroke="var(--bg-surface)" strokeWidth="1.5"
                />
              )}
            </>
          )}

          {/* Hover crosshair */}
          {hoveredIdx != null && (
            <line
              x1={PAD.l + (hoveredIdx / (n - 1)) * chartW}
              y1={PAD.t}
              x2={PAD.l + (hoveredIdx / (n - 1)) * chartW}
              y2={H - PAD.b}
              stroke="var(--border-bright)" strokeWidth="1" strokeDasharray="3 3"
            />
          )}

          {/* X-axis labels */}
          {xLabels.map(({ x, label }) => (
            <text key={label} x={x} y={H - 4} textAnchor="middle"
              fill="var(--text-muted)" fontSize="9.5" fontFamily="'DM Sans', sans-serif">
              {label}
            </text>
          ))}
        </svg>
      )}
    </div>
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
  const [tab, setTab] = useState<'overview' | 'financials' | 'news' | 'analysis' | 'thesis'>('overview')
  const [companySummary, setCompanySummary] = useState('')
  const [companyWhatItIs, setCompanyWhatItIs] = useState('')
  const [companyDescription, setCompanyDescription] = useState('')
  const [companyCrisisRelevance, setCompanyCrisisRelevance] = useState('')
  const [companyKeyVulnerabilities, setCompanyKeyVulnerabilities] = useState<string[]>([])
  const [companyTransmissionChannels, setCompanyTransmissionChannels] = useState<string[]>([])
  const [companyWhatToExploreNext, setCompanyWhatToExploreNext] = useState<string[]>([])
  const [summaryLoading, setSummaryLoading] = useState(false)

  // Analysis tab state
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState('')

  // Financials tab state
  const [financials, setFinancials] = useState<FinancialsApiResponse | null>(null)
  const [financialsLoading, setFinancialsLoading] = useState(false)
  const [financialsError, setFinancialsError] = useState('')
  const [stmtTab, setStmtTab] = useState<'income' | 'balance' | 'cashflow'>('income')

  // Thesis tab state
  const [thesis, setThesis] = useState({ bullCase: '', bearCase: '', thesis: '' })
  const [thesisLoading, setThesisLoading] = useState(false)
  const [thesisSaving, setThesisSaving] = useState(false)
  const [thesisSaved, setThesisSaved] = useState(false)

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

  useEffect(() => {
    if (!symbol) return
    setSummaryLoading(true)
    setCompanySummary('')
    setCompanyWhatItIs('')
    setCompanyDescription('')
    setCompanyCrisisRelevance('')
    setCompanyKeyVulnerabilities([])
    setCompanyTransmissionChannels([])
    setCompanyWhatToExploreNext([])
    fetch(`/api/ticker/${symbol}/summary`)
      .then(r => r.ok ? r.json() : null)
      .then((d: CompanySummaryResponse | null) => {
        const summary = d?.summary?.trim() ?? ''
        const whatItIs = d?.whatItIs?.trim() ?? ''
        const description = d?.companyDescription?.trim() ?? ''
        const crisisRelevance = d?.crisisRelevance?.trim() ?? ''
        const keyVulnerabilities = Array.isArray(d?.keyVulnerabilities)
          ? d.keyVulnerabilities.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          : []
        const transmissionChannels = Array.isArray(d?.transmissionChannels)
          ? d.transmissionChannels.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          : []
        const whatToExploreNext = Array.isArray(d?.whatToExploreNext)
          ? d.whatToExploreNext.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          : []

        setCompanySummary(summary)
        setCompanyWhatItIs(whatItIs || summary)
        setCompanyDescription(description)
        setCompanyCrisisRelevance(
          crisisRelevance ||
          'Crisis relevance details are currently limited; review this company with sector-level and balance-sheet context in stressed markets.'
        )
        setCompanyKeyVulnerabilities(keyVulnerabilities)
        setCompanyTransmissionChannels(transmissionChannels)
        setCompanyWhatToExploreNext(whatToExploreNext)
        setSummaryLoading(false)
      })
      .catch(() => setSummaryLoading(false))
  }, [symbol])

  useEffect(() => {
    if (tab !== 'analysis' || analysis || analysisLoading) return
    setAnalysisLoading(true)
    setAnalysisError('')
    fetch(`/api/ticker/${symbol}/analysis`)
      .then(r => {
        if (!r.ok) throw new Error('Analysis unavailable')
        return r.json()
      })
      .then(d => { setAnalysis(d.analysis); setAnalysisLoading(false) })
      .catch(e => { setAnalysisError(e.message); setAnalysisLoading(false) })
  }, [tab, symbol, analysis, analysisLoading])

  useEffect(() => {
    if (tab !== 'financials' || financials || financialsLoading) return
    setFinancialsLoading(true)
    setFinancialsError('')
    fetch(`/api/ticker/${symbol}/financials`)
      .then(r => { if (!r.ok) throw new Error('Financials unavailable'); return r.json() })
      .then(d => { setFinancials(d); setFinancialsLoading(false) })
      .catch(e => { setFinancialsError(e.message); setFinancialsLoading(false) })
  }, [tab, symbol, financials, financialsLoading])

  useEffect(() => {
    if (tab !== 'thesis' || thesisLoading) return
    setThesisLoading(true)
    fetch(`/api/ticker/${symbol}/thesis`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setThesis({ bullCase: d.bullCase ?? '', bearCase: d.bearCase ?? '', thesis: d.thesis ?? '' }) })
      .catch(() => {/* silently ignore */})
      .finally(() => setThesisLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, symbol])

  async function handleSaveThesis() {
    if (thesisSaving) return
    setThesisSaving(true)
    setThesisSaved(false)
    try {
      await fetch(`/api/ticker/${symbol}/thesis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(thesis),
      })
      setThesisSaved(true)
      setTimeout(() => setThesisSaved(false), 2000)
    } catch { /* ignore */ } finally {
      setThesisSaving(false)
    }
  }

  const up = (data?.priceChangePct ?? 0) >= 0
  const heuristics = data
    ? getCrisisHeuristics(
        data,
        companyKeyVulnerabilities,
        companyTransmissionChannels,
        companyWhatToExploreNext
      )
    : null

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
              {(['overview', 'financials', 'news', 'analysis', 'thesis'] as const).map(t => (
                <button
                  key={t}
                  className={`tab${tab === t ? ' active' : ''}`}
                  onClick={() => setTab(t)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", padding: '8px 20px', textTransform: 'capitalize' }}
                >
                  {t === 'analysis' ? '✦ Analysis' : t}
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
              <Skeleton h={220} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {[...Array(4)].map((_, i) => <Skeleton key={i} h={80} />)}
              </div>
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

              {(summaryLoading || companySummary || companyWhatItIs || companyCrisisRelevance) && (
                <div className="card" style={{ padding: '18px 20px' }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                    Quick analysis
                  </div>
                  {summaryLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <Skeleton w="100%" h={12} />
                      <Skeleton w="84%" h={12} />
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 8 }}>
                        {[...Array(3)].map((_, i) => (
                          <div key={i} style={{ border: '1px solid var(--border)', background: 'var(--bg-elevated)', borderRadius: 10, padding: '12px 14px' }}>
                            <Skeleton w="70%" h={10} />
                            <div style={{ height: 8 }} />
                            <Skeleton w="100%" h={10} />
                            <div style={{ height: 6 }} />
                            <Skeleton w="92%" h={10} />
                            <div style={{ height: 6 }} />
                            <Skeleton w="80%" h={10} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          What the company is
                        </div>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
                          {companyWhatItIs || companySummary}
                        </p>
                        <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
                          {companyDescription || companySummary}
                        </p>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Why it matters in a crisis
                        </div>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
                          {companyCrisisRelevance}
                        </p>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                        {[
                          {
                            title: 'Key vulnerabilities',
                            items: companyKeyVulnerabilities.length > 0 ? companyKeyVulnerabilities : [
                              'Cyclical earnings pressure during demand and valuation contractions.',
                              'Liquidity or refinancing pressure if capital markets tighten abruptly.',
                              'Operational and regulatory shocks that can reduce earnings visibility.',
                            ],
                          },
                          {
                            title: 'Transmission channels',
                            items: companyTransmissionChannels.length > 0 ? companyTransmissionChannels : [
                              'Asset repricing can spread stress to credit, funding, and equity markets.',
                              'Counterparty and customer behavior can accelerate liquidity strains.',
                              'Capital allocation shifts can impact lending, investment, and confidence.',
                            ],
                          },
                          {
                            title: 'What to explore next',
                            items: companyWhatToExploreNext.length > 0 ? companyWhatToExploreNext : [
                              'Balance-sheet resilience: leverage, maturities, and liquidity buffers.',
                              'Peer positioning across margins, valuation, and growth durability.',
                              'Downside scenarios under recession, spread widening, and funding stress.',
                            ],
                          },
                        ].map(section => (
                          <div key={section.title} style={{ border: '1px solid var(--border)', background: 'var(--bg-elevated)', borderRadius: 10, padding: '12px 14px' }}>
                            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                              {section.title}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                              {section.items.map((item, idx) => (
                                <div key={`${section.title}-${idx}`} style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                                  {item}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <PriceChart symbol={symbol} />

              {/* Key metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                <MetricCard label="P/E Ratio" value={fmt(data.pe, 1, 'x')} sub="Price / Earnings" />
                <MetricCard label="Market Cap" value={fmtMarketCap(data.marketCap)} sub={data.exchange} />
                <MetricCard
                  label="52-Week Range"
                  value={`$${fmt(data.week52Low ?? data.dayLow, 0)} – $${fmt(data.week52High ?? data.dayHigh, 0)}`}
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
                    { label: 'Day High', value: `$${fmt(data.dayHigh)}` },
                    { label: 'Day Low', value: `$${fmt(data.dayLow)}` },
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

              {heuristics && (
                <div className="card" style={{ padding: '20px 22px' }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
                    Crisis-relevance heuristics
                  </div>
                  {(() => {
                    const riskItems = [
                      { label: 'Funding risk', value: heuristics.fundingRisk },
                      { label: 'Liquidity risk', value: heuristics.liquidityRisk },
                      { label: 'Counterparty risk', value: heuristics.counterpartyRisk },
                      { label: 'Sentiment sensitivity', value: heuristics.sentimentSensitivity },
                      { label: 'Interconnectedness', value: heuristics.interconnectedness },
                      { label: 'Confidence level', value: heuristics.confidenceLevel },
                    ]

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))', gap: 10 }}>
                          {riskItems.slice(0, 4).map((item) => (
                            <div
                              key={item.label}
                              style={{
                                border: '1px solid var(--border)',
                                borderRadius: 10,
                                background: 'var(--bg-elevated)',
                                padding: '11px 12px',
                                minHeight: 76,
                              }}
                            >
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>
                                {item.label}
                              </div>
                              <span
                                style={{
                                  ...riskBadgeStyle(item.value),
                                  display: 'inline-block',
                                  borderRadius: 999,
                                  padding: '4px 11px',
                                  fontSize: 12,
                                  fontWeight: 600,
                                }}
                              >
                                {item.value}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))', gap: 10 }}>
                          {riskItems.slice(4, 6).map((item) => (
                            <div
                              key={item.label}
                              style={{
                                border: '1px solid var(--border)',
                                borderRadius: 10,
                                background: 'var(--bg-elevated)',
                                padding: '11px 12px',
                                minHeight: 76,
                              }}
                            >
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>
                                {item.label}
                              </div>
                              <span
                                style={{
                                  ...riskBadgeStyle(item.value),
                                  display: 'inline-block',
                                  borderRadius: 999,
                                  padding: '4px 11px',
                                  fontSize: 12,
                                  fontWeight: 600,
                                }}
                              >
                                {item.value}
                              </span>
                            </div>
                          ))}

                          <div
                            style={{
                              border: '1px solid var(--border)',
                              borderRadius: 10,
                              background: 'var(--bg-elevated)',
                              padding: '11px 12px',
                              minHeight: 76,
                              gridColumn: '3 / 5',
                            }}
                          >
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>
                              Major exposure categories
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {heuristics.exposureCategories.map((item) => (
                                <span
                                  key={item}
                                  style={{
                                    fontSize: 12,
                                    color: '#9fb6e9',
                                    background: 'rgba(95, 138, 219, 0.12)',
                                    border: '1px solid rgba(95, 138, 219, 0.28)',
                                    borderRadius: 6,
                                    padding: '4px 9px',
                                  }}
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ── FINANCIALS TAB ── */}
          {!loading && !error && data && tab === 'financials' && (
            <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {financialsLoading && (
                <div className="card" style={{ padding: '28px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 20, height: 20, border: '2px solid var(--gold-dim)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>Loading financial statements…</div>
                </div>
              )}

              {!financialsLoading && financialsError && (
                <div className="card" style={{ padding: '28px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: 'var(--red)', marginBottom: 6 }}>Could not load financials</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{financialsError}</div>
                </div>
              )}

              {!financialsLoading && financials && (() => {
                const em = financials.extendedMetrics

                function fmtVal(n: number | null, suffix = ''): string {
                  if (n == null) return '—'
                  return n.toFixed(suffix === '%' ? 1 : 2) + suffix
                }

                function fmtStmt(n: number | null): string {
                  if (n == null) return '—'
                  const abs = Math.abs(n)
                  const sign = n < 0 ? '-' : ''
                  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`
                  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(0)}M`
                  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`
                  return `${sign}$${abs.toFixed(0)}`
                }

                const SECTIONS = [
                  {
                    key: 'Buffett',
                    color: 'var(--gold)',
                    rows: [
                      { label: 'Return on Equity (TTM)', value: fmtVal(em.roeTTM, '%'), good: (em.roeTTM ?? 0) >= 15, bad: (em.roeTTM ?? 0) < 0 },
                      { label: 'Return on Invested Capital', value: fmtVal(em.roicTTM, '%'), good: (em.roicTTM ?? 0) >= 12, bad: (em.roicTTM ?? 0) < 0 },
                      { label: 'Gross Margin (TTM)', value: fmtVal(em.grossMarginTTM, '%'), good: (em.grossMarginTTM ?? 0) >= 40, bad: (em.grossMarginTTM ?? 0) < 20 },
                      { label: 'Net Profit Margin (TTM)', value: fmtVal(em.netMarginTTM, '%'), good: (em.netMarginTTM ?? 0) >= 15, bad: (em.netMarginTTM ?? 0) < 0 },
                      { label: 'Operating Margin (TTM)', value: fmtVal(em.operatingMarginTTM, '%'), good: (em.operatingMarginTTM ?? 0) >= 15, bad: (em.operatingMarginTTM ?? 0) < 0 },
                      { label: 'Revenue Growth (5Y)', value: fmtVal(em.revenueGrowth5Y, '%'), good: (em.revenueGrowth5Y ?? 0) >= 10, bad: (em.revenueGrowth5Y ?? 0) < 0 },
                      { label: 'EPS Growth (5Y)', value: fmtVal(em.epsGrowth5Y, '%'), good: (em.epsGrowth5Y ?? 0) >= 10, bad: (em.epsGrowth5Y ?? 0) < 0 },
                      { label: 'Debt / Equity', value: fmtVal(em.debtEquity, 'x'), good: (em.debtEquity ?? 99) <= 0.5, bad: (em.debtEquity ?? 0) > 1.5 },
                      { label: 'Dividend Yield', value: fmtVal(em.dividendYieldAnnual, '%') },
                      { label: 'Cash Flow per Share', value: fmtVal(em.cashFlowPerShare) },
                    ],
                  },
                  {
                    key: 'Graham',
                    color: '#7eb8f7',
                    rows: [
                      { label: 'P/E (Normalized)', value: fmtVal(em.peNormalized, 'x'), good: (em.peNormalized ?? 99) <= 15, bad: (em.peNormalized ?? 0) > 25 },
                      { label: 'Price / Book', value: fmtVal(em.pb, 'x'), good: (em.pb ?? 99) <= 1.5, bad: (em.pb ?? 0) > 3 },
                      { label: 'Current Ratio', value: fmtVal(em.currentRatio, 'x'), good: (em.currentRatio ?? 0) >= 2, bad: (em.currentRatio ?? 99) < 1 },
                      { label: 'Quick Ratio', value: fmtVal(em.quickRatio, 'x'), good: (em.quickRatio ?? 0) >= 1, bad: (em.quickRatio ?? 99) < 0.5 },
                    ],
                  },
                  {
                    key: 'Lynch',
                    color: '#7bcfa8',
                    rows: [
                      { label: 'PEG Ratio', value: fmtVal(em.pegRatio, 'x'), good: (em.pegRatio ?? 99) < 1, bad: (em.pegRatio ?? 0) > 2 },
                      { label: 'Revenue Growth (TTM YoY)', value: fmtVal(em.revenueGrowthTTM, '%'), good: (em.revenueGrowthTTM ?? 0) >= 10, bad: (em.revenueGrowthTTM ?? 0) < 0 },
                      { label: 'Inventory Turnover', value: fmtVal(em.inventoryTurnover, 'x') },
                    ],
                  },
                  {
                    key: 'Burry',
                    color: '#e07b7b',
                    rows: [
                      { label: 'EV / EBITDA', value: fmtVal(em.evEbitda, 'x'), good: (em.evEbitda ?? 99) <= 10, bad: (em.evEbitda ?? 0) > 20 },
                      { label: 'Price / Free Cash Flow', value: fmtVal(em.priceFCF, 'x'), good: (em.priceFCF ?? 99) <= 15, bad: (em.priceFCF ?? 0) > 30 },
                      { label: 'LT Debt / Capitalization', value: fmtVal(em.ltDebtToCapitalization, '%'), good: (em.ltDebtToCapitalization ?? 99) <= 30, bad: (em.ltDebtToCapitalization ?? 0) > 60 },
                    ],
                  },
                ]

                const stmtDefs: Record<string, { label: string; rows: typeof financials.annualIncome }> = {
                  income: { label: 'Income Statement', rows: financials.annualIncome },
                  balance: { label: 'Balance Sheet', rows: financials.annualBalance },
                  cashflow: { label: 'Cash Flow Statement', rows: financials.annualCashFlow },
                }

                return (
                  <>
                    {/* Extended investor metrics */}
                    <div className="card" style={{ padding: '24px 28px' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20 }}>Long-Term Investor Metrics</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {SECTIONS.map(section => (
                          <div key={section.key}>
                            <div style={{ fontSize: 10.5, color: section.color, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>{section.key}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0 40px' }}>
                              {section.rows.map(r => (
                                <FinRow key={r.label} label={r.label} value={r.value} good={r.good} bad={r.bad} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Financial statements */}
                    <div className="card" style={{ padding: '24px 28px' }}>
                      {/* Sub-tab bar */}
                      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
                        {(['income', 'balance', 'cashflow'] as const).map(t => (
                          <button key={t} type="button" onClick={() => setStmtTab(t)}
                            style={{
                              fontSize: 13, fontWeight: stmtTab === t ? 600 : 400,
                              color: stmtTab === t ? 'var(--gold)' : 'var(--text-muted)',
                              background: 'none', border: 'none', cursor: 'pointer',
                              padding: '0 0 10px', marginRight: 24,
                              borderBottom: stmtTab === t ? '2px solid var(--gold)' : '2px solid transparent',
                              fontFamily: "'DM Sans', sans-serif",
                              transition: 'color 0.15s',
                            }}>
                            {t === 'income' ? 'Income Statement' : t === 'balance' ? 'Balance Sheet' : 'Cash Flow'}
                          </button>
                        ))}
                        {financials.years.length > 0 && (
                          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center', paddingBottom: 10 }}>
                            {financials.years.map(y => (
                              <span key={y} style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>FY{y}</span>
                            ))}
                          </div>
                        )}
                      </div>

                    {/* ── Income Statement: Margins chart ── */}
                    {financials.years.length > 0 && stmtTab === 'income' && (() => {
                      const revRow = financials.annualIncome.find(r => r.concept === 'revenue')
                      const gpRow  = financials.annualIncome.find(r => r.concept === 'grossProfit')
                      const oiRow  = financials.annualIncome.find(r => r.concept === 'operatingIncome')
                      const niRow  = financials.annualIncome.find(r => r.concept === 'netIncome')
                      const margins = financials.years.map((y, i) => {
                        const rev = revRow?.values[i] ?? null
                        const gp  = gpRow?.values[i]  ?? null
                        const oi  = oiRow?.values[i]  ?? null
                        const ni  = niRow?.values[i]  ?? null
                        return {
                          year: y,
                          gross:     rev && gp ? parseFloat((gp / rev * 100).toFixed(1)) : null,
                          operating: rev && oi ? parseFloat((oi / rev * 100).toFixed(1)) : null,
                          net:       rev && ni ? parseFloat((ni / rev * 100).toFixed(1)) : null,
                        }
                      })
                      const hasAny = margins.some(m => m.gross != null || m.operating != null || m.net != null)
                      if (!hasAny) return null
                      const MCOLS = { gross: 'var(--gold)', operating: '#7eb8f7', net: '#7bcfa8' }
                      const allVals = margins.flatMap(m => [m.gross, m.operating, m.net]).filter((v): v is number => v != null)
                      const maxVal = Math.max(...allVals, 1)
                      const minVal = Math.min(...allVals, 0)
                      const range  = maxVal - minVal || 1
                      const chartH = 100; const barW = 11; const groupW = 50; const leftPad = 34
                      return (
                        <div className="card" style={{ padding: '20px 28px 24px', marginBottom: 24 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 18 }}>Profit Margins Over Time</div>
                          <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                            <svg width={leftPad + margins.length * groupW + 10} height={chartH + 28} style={{ flexShrink: 0, overflow: 'visible' }}>
                              {[0, 25, 50, 75, 100].filter(v => v <= maxVal + 8 && v >= minVal - 5).map(pct => {
                                const y = chartH - ((pct - minVal) / range * chartH)
                                return (
                                  <g key={pct}>
                                    <line x1={leftPad - 4} y1={y} x2={leftPad + margins.length * groupW} y2={y} stroke="var(--border)" strokeWidth={0.5} strokeDasharray="3,3" />
                                    <text x={leftPad - 6} y={y + 4} textAnchor="end" fontSize={9} fill="var(--text-muted)">{pct}%</text>
                                  </g>
                                )
                              })}
                              {margins.map((m, gi) => {
                                const x0 = leftPad + gi * groupW + (groupW - 3 * barW - 4) / 2
                                return (
                                  <g key={m.year}>
                                    {m.gross != null && (() => { const h = Math.max(2, (m.gross - minVal) / range * chartH); return <rect x={x0} y={chartH - h} width={barW} height={h} fill={MCOLS.gross} rx={2} opacity={0.85} /> })()}
                                    {m.operating != null && (() => { const h = Math.max(2, (m.operating - minVal) / range * chartH); return <rect x={x0 + barW + 2} y={chartH - h} width={barW} height={h} fill={MCOLS.operating} rx={2} opacity={0.85} /> })()}
                                    {m.net != null && (() => { const h = Math.max(2, (m.net - minVal) / range * chartH); return <rect x={x0 + (barW + 2) * 2} y={chartH - h} width={barW} height={h} fill={MCOLS.net} rx={2} opacity={0.85} /> })()}
                                    <text x={leftPad + gi * groupW + groupW / 2} y={chartH + 16} textAnchor="middle" fontSize={10} fill="var(--text-muted)">FY{m.year}</text>
                                  </g>
                                )
                              })}
                            </svg>
                            <div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>Latest year</div>
                              {([
                                { label: 'Gross Margin',     val: margins[0]?.gross,     color: MCOLS.gross },
                                { label: 'Operating Margin', val: margins[0]?.operating, color: MCOLS.operating },
                                { label: 'Net Margin',       val: margins[0]?.net,       color: MCOLS.net },
                              ] as { label: string; val: number | null | undefined; color: string }[]).map(({ label, val, color }) => (
                                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                  <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block', flexShrink: 0 }} />
                                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, minWidth: 130 }}>{label}</span>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                                    {val != null ? `${val.toFixed(1)}%` : '—'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    })()}

                      {/* Statement table */}
                      {financials.years.length === 0 ? (
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>No annual filing data available.</div>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', paddingBottom: 10, paddingRight: 16 }}>
                                  {stmtDefs[stmtTab].label}
                                </th>
                                {financials.years.map(y => (
                                  <th key={y} style={{ textAlign: 'right', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11, paddingBottom: 10, paddingLeft: 16, fontVariantNumeric: 'tabular-nums' }}>FY{y}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {stmtDefs[stmtTab].rows.map((row, i) => {
                                const hasData = row.values.some(v => v != null)
                                return (
                                  <tr key={row.concept} style={{ borderTop: i === 0 ? '1px solid var(--border)' : '1px solid var(--border-subtle, var(--border))' }}>
                                    <td style={{ padding: '9px 16px 9px 0', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{row.label}</td>
                                    {row.values.map((v, vi) => {
                                      const prev = row.values[vi + 1]
                                      const yoy = v != null && prev != null && prev !== 0 ? (v - prev) / Math.abs(prev) * 100 : null
                                      return (
                                        <td key={vi} style={{ padding: '9px 0 9px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: hasData ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                          <span>{fmtStmt(v)}</span>
                                          {yoy != null && (
                                            <span style={{ fontSize: 10.5, marginLeft: 6, color: yoy >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                              {yoy >= 0 ? '+' : ''}{yoy.toFixed(0)}%
                                            </span>
                                          )}
                                        </td>
                                      )
                                    })}
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )
              })()}

              <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Financial statements from Finnhub annual filings. Segment data from SEC XBRL. Not financial advice.
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

          {/* ── ANALYSIS TAB ── */}
          {!loading && !error && data && tab === 'analysis' && (
            <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Loading */}
              {analysisLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="card" style={{ padding: '28px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 20, height: 20, border: '2px solid var(--gold-dim)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>Analysing {data.name}…</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Reading SEC filing, financial metrics, and recent news</div>
                    </div>
                  </div>
                  {[80, 60, 90].map((w, i) => <Skeleton key={i} w={`${w}%`} h={18} />)}
                </div>
              )}

              {/* Error */}
              {!analysisLoading && analysisError && (
                <div className="card" style={{ padding: '28px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: 'var(--red)', marginBottom: 8 }}>Analysis failed</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{analysisError}</div>
                </div>
              )}

              {/* Analysis content */}
              {!analysisLoading && !analysisError && analysis && (() => {
                const a = analysis as {
                  moat: string; moatReasoning: string
                  bullThesis: string[]; bearThesis: string[]; keyRisks: string[]
                  managementSignals: string; verdict: string; verdictReasoning: string; qualityScore: number
                }
                const verdictColor = a.verdict?.includes('Buy') ? 'var(--green)' : a.verdict?.includes('Sell') ? 'var(--red)' : 'var(--gold)'
                const moatColor = a.moat === 'Wide' ? 'var(--green)' : a.moat === 'Narrow' ? 'var(--gold)' : 'var(--text-muted)'

                return (
                  <>
                    {/* Verdict + Quality header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div className="card" style={{ padding: '22px 24px' }}>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>AI Verdict</div>
                        <div style={{ fontSize: 26, fontWeight: 700, color: verdictColor, marginBottom: 8 }}>{a.verdict}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{a.verdictReasoning}</div>
                      </div>
                      <div className="card" style={{ padding: '22px 24px' }}>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Competitive Moat</div>
                        <div style={{ fontSize: 26, fontWeight: 700, color: moatColor, marginBottom: 8 }}>{a.moat}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{a.moatReasoning}</div>
                      </div>
                    </div>

                    {/* Quality score */}
                    <div className="card" style={{ padding: '20px 24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Business Quality Score</span>
                        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--gold)' }}>{a.qualityScore}<span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}> / 10</span></span>
                      </div>
                      <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 100, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(a.qualityScore / 10) * 100}%`, background: 'linear-gradient(90deg, var(--gold-bright), var(--gold))', borderRadius: 100, transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)' }} />
                      </div>
                    </div>

                    {/* Bull / Bear */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div className="card" style={{ padding: '22px 24px' }}>
                        <div style={{ fontSize: 10.5, color: 'var(--green)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14, fontWeight: 600 }}>▲ Bull Thesis</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {a.bullThesis?.map((pt, i) => (
                            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                              <span style={{ color: 'var(--green)', fontSize: 12, marginTop: 2, flexShrink: 0 }}>✓</span>
                              <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{pt}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="card" style={{ padding: '22px 24px' }}>
                        <div style={{ fontSize: 10.5, color: 'var(--red)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14, fontWeight: 600 }}>▼ Bear Thesis</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {a.bearThesis?.map((pt, i) => (
                            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                              <span style={{ color: 'var(--red)', fontSize: 12, marginTop: 2, flexShrink: 0 }}>✗</span>
                              <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{pt}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Key Risks */}
                    <div className="card" style={{ padding: '22px 24px' }}>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>Key Risks</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {a.keyRisks?.map((r, i) => (
                          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', paddingBottom: 10, borderBottom: i < a.keyRisks.length - 1 ? '1px solid var(--border)' : 'none' }}>
                            <span style={{ color: 'var(--gold-dim)', fontSize: 11, marginTop: 2, flexShrink: 0 }}>⚠</span>
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{r}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Management */}
                    <div className="card" style={{ padding: '22px 24px' }}>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Management & Capital Allocation</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{a.managementSignals}</div>
                    </div>

                    <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        ✦ AI analysis generated by GPT-5.4-mini using SEC filings, financial metrics, and recent news. Not financial advice.
                      </span>
                    </div>
                  </>
                )
              })()}
            </div>
          )}

          {/* ── THESIS TAB ── */}
          {!loading && !error && data && tab === 'thesis' && (
            <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {thesisLoading && (
                <div className="card" style={{ padding: '28px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 20, height: 20, border: '2px solid var(--gold-dim)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>Loading your thesis…</div>
                </div>
              )}

              {!thesisLoading && (
                <>
                  {/* Bull / Bear side by side */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="card" style={{ padding: '22px 24px' }}>
                      <div style={{ fontSize: 10.5, color: 'var(--green)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 12 }}>▲ Bull Case</div>
                      <textarea
                        value={thesis.bullCase}
                        onChange={e => setThesis(prev => ({ ...prev, bullCase: e.target.value }))}
                        placeholder="Why this company will outperform…"
                        style={{
                          width: '100%', minHeight: 160, background: 'var(--bg-elevated)',
                          border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px',
                          color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.6,
                          resize: 'vertical', outline: 'none', fontFamily: "'DM Sans', sans-serif",
                          boxSizing: 'border-box',
                        }}
                        onFocus={e => { e.target.style.borderColor = 'var(--gold-dim)' }}
                        onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                      />
                    </div>
                    <div className="card" style={{ padding: '22px 24px' }}>
                      <div style={{ fontSize: 10.5, color: 'var(--red)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 12 }}>▼ Bear Case</div>
                      <textarea
                        value={thesis.bearCase}
                        onChange={e => setThesis(prev => ({ ...prev, bearCase: e.target.value }))}
                        placeholder="Risks and reasons it could disappoint…"
                        style={{
                          width: '100%', minHeight: 160, background: 'var(--bg-elevated)',
                          border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px',
                          color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.6,
                          resize: 'vertical', outline: 'none', fontFamily: "'DM Sans', sans-serif",
                          boxSizing: 'border-box',
                        }}
                        onFocus={e => { e.target.style.borderColor = 'var(--gold-dim)' }}
                        onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                      />
                    </div>
                  </div>

                  {/* Full thesis */}
                  <div className="card" style={{ padding: '22px 24px' }}>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>My Investment Thesis</div>
                    <textarea
                      value={thesis.thesis}
                      onChange={e => setThesis(prev => ({ ...prev, thesis: e.target.value }))}
                      placeholder={`Write your full investment thesis for ${data.name}…`}
                      style={{
                        width: '100%', minHeight: 200, background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px',
                        color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.6,
                        resize: 'vertical', outline: 'none', fontFamily: "'DM Sans', sans-serif",
                        boxSizing: 'border-box',
                      }}
                      onFocus={e => { e.target.style.borderColor = 'var(--gold-dim)' }}
                      onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                    />
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <a
                      href={`/protected/valuation?symbol=${symbol}&tab=dcf`}
                      style={{ fontSize: 13, color: 'var(--gold)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      Open in Valuation ↗
                    </a>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {thesisSaved && (
                        <span style={{ fontSize: 12, color: 'var(--green)' }}>Saved ✓</span>
                      )}
                      <button
                        type="button"
                        className="btn-gold"
                        onClick={() => void handleSaveThesis()}
                        disabled={thesisSaving}
                        style={{ padding: '8px 24px', fontSize: 13, opacity: thesisSaving ? 0.75 : 1, cursor: thesisSaving ? 'default' : 'pointer' }}
                      >
                        {thesisSaving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </main>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
