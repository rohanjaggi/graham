'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  formatDownsidePercent,
  formatPercent,
  formatSignedPercent,
  metricColorForValue,
} from '@/lib/ui/metricFormat'

type DashboardPortfolio = {
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
  updatedAt: string
}

type DashboardPortfolioDetail = DashboardPortfolio & {
  riskFreeRateUsed: number
  stressTestResults: Record<string, { approxReturn?: number; approxDrawdown?: number } | undefined>
  dataWarnings: string[]
}

type DashboardPosition = {
  symbol: string
  weight: number
  sector: string | null
}

type DashboardHolding = DashboardPosition & {
  companyName: string
  pe: number | null
}

function formatPortfolioDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatRiskLabel(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase()
}

function formatObjectiveLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const SLICE_COLORS = ['#C8A96E', '#5B9CF6', '#3DD68C', '#E2A0A0', '#A0B8E2']
const BASE_PORTFOLIO_HISTORY = [220, 228, 224, 235, 241, 238, 252, 261, 255, 268, 274, 271, 283, 291, 288, 301]

type OverviewMockSnapshot = {
  portfolioValueRaw: number
  portfolioValue: string
  portfolioValueSub: string
  totalReturn: string
  totalReturnSub: string
  sharpe: string
  sharpeSub: string
  maxDrawdown: string
  maxDrawdownSub: string
  chartSeries: number[]
}

function formatCurrencyShort(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}m`
  return `$${(value / 1_000).toFixed(1)}k`
}

function formatCsvCell(value: string | number | null) {
  const text = value == null ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function buildOverviewMockSnapshot(portfolio: DashboardPortfolioDetail | null, holdings: DashboardHolding[]): OverviewMockSnapshot {
  if (!portfolio) {
    return {
      portfolioValueRaw: 300_820,
      portfolioValue: '$300,820',
      portfolioValueSub: '+$45.8k all-time',
      totalReturn: '+18.3%',
      totalReturnSub: 'Since inception',
      sharpe: '1.42',
      sharpeSub: 'Risk-adjusted',
      maxDrawdown: formatDownsidePercent(-0.142, 1),
      maxDrawdownSub: "COVID-19 Mar '20",
      chartSeries: BASE_PORTFOLIO_HISTORY,
    }
  }

  const weights = holdings.length > 0 ? holdings : [{ symbol: 'BASE', weight: 1, sector: null, companyName: 'Base', pe: null }]
  const weightedPe = weights.reduce((sum, holding) => sum + (holding.pe ?? 18) * holding.weight, 0)
  const sectorCount = new Set(weights.map((holding) => holding.sector ?? holding.symbol)).size
  const concentrationPenalty = Math.max(weights[0]?.weight ?? 0, 0.18)
  const baseValue = 180_000
    + portfolio.expectedAnnualReturn * 320_000
    + Math.max(portfolio.sharpeRatio, 0.5) * 22_500
    + sectorCount * 6_500
    - concentrationPenalty * 18_000
  const costBasis = baseValue * (1 - Math.max(0.08, portfolio.expectedAnnualReturn * 0.65))
  const pnl = baseValue - costBasis
  const totalReturnPct = pnl / costBasis
  const chartSeries = BASE_PORTFOLIO_HISTORY.map((point, index) => {
    const growthBias = portfolio.expectedAnnualReturn * 220
    const riskSwing = portfolio.expectedAnnualVolatility * 70
    const drawdownBias = Math.abs(portfolio.maxDrawdown) * 45
    const rhythm = Math.sin((index + 1) * 0.85) * riskSwing
    const trend = index * (growthBias / 18)
    return Number((point + growthBias - drawdownBias + rhythm + trend).toFixed(2))
  })

  return {
    portfolioValueRaw: baseValue,
    portfolioValue: formatCurrencyShort(baseValue),
    portfolioValueSub: `${pnl >= 0 ? '+' : '-'}${formatCurrencyShort(Math.abs(pnl))} from cost basis`,
    totalReturn: formatSignedPercent(totalReturnPct, 1),
    totalReturnSub: `${portfolio.investmentHorizonBucket} horizon simulation`,
    sharpe: portfolio.sharpeRatio.toFixed(2),
    sharpeSub: `${formatObjectiveLabel(portfolio.objective)} · blended P/E ${weightedPe.toFixed(1)}x`,
    maxDrawdown: formatDownsidePercent(portfolio.maxDrawdown),
    maxDrawdownSub: `Worst quarter ${formatDownsidePercent(portfolio.worstQuarterReturn)}`,
    chartSeries,
  }
}

type OverviewHoldingRow = DashboardHolding & {
  value: number
  gainPct: number
  moat: 'Wide' | 'Narrow'
  spark: number[]
}

function buildOverviewHoldingRows(holdings: DashboardHolding[], snapshot: OverviewMockSnapshot): OverviewHoldingRow[] {
  return holdings.map((holding, index) => {
    const value = snapshot.portfolioValueRaw * holding.weight
    const peAnchor = holding.pe ?? 18
    const gainPct = Number(((peAnchor / 3.2) + holding.weight * 42 - index * 1.8).toFixed(1))
    const moat: 'Wide' | 'Narrow' = holding.weight >= 0.18 || ['Technology', 'Financials', 'Communication Services'].includes(holding.sector ?? '')
      ? 'Wide'
      : 'Narrow'
    const base = 42 + index * 5 + holding.weight * 80
    const spark = [0, 1, 2, 3, 4, 5, 6].map((step) => {
      const rhythm = Math.sin((step + 1) * 0.9 + index * 0.45) * 4.2
      return Number((base + step * 2.6 + rhythm).toFixed(2))
    })

    return {
      ...holding,
      value,
      gainPct,
      moat,
      spark,
    }
  })
}

function Sparkline({ data, color, W = 74, H = 28 }: { data: number[]; color: string; W?: number; H?: number }) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const pts: [number, number][] = data.map((v, i) => [
    4 + (i / (data.length - 1)) * (W - 8),
    H - 4 - ((v - min) / (max - min || 1)) * (H - 8),
  ])
  const line = pts.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(' ')
  const area = `${line} L ${pts[pts.length - 1][0]} ${H} L ${pts[0][0]} ${H} Z`
  const gradientId = `spark-${color.replace(/[^a-z0-9]/gi, '')}-${W}-${H}`
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.03" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function AreaChart({ data }: { data: number[] }) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const W = 620
  const H = 190
  const padX = 22
  const padTop = 8
  const padBottom = 20
  const usableH = H - padTop - padBottom
  const pts: [number, number][] = data.map((v, i) => [
    padX + (i / (data.length - 1)) * (W - padX * 2),
    padTop + (1 - (v - min) / (max - min || 1)) * usableH,
  ])
  const line = pts
    .map(([x, y], i) => {
      if (i === 0) return `M ${x} ${y}`
      const prev = pts[i - 1]
      const controlX = prev[0] + (x - prev[0]) / 2
      return `C ${controlX} ${prev[1]} ${controlX} ${y} ${x} ${y}`
    })
    .join(' ')
  const areaBaseline = H - padBottom + 3
  const area = `${line} L ${pts[pts.length - 1][0]} ${areaBaseline} L ${pts[0][0]} ${areaBaseline} Z`
  const gridLines = [0.2, 0.5, 0.8].map((ratio) => padTop + usableH * ratio)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H, display: 'block' }}>
      <defs>
        <linearGradient id="area-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C8A96E" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#C8A96E" stopOpacity="0.01" />
        </linearGradient>
        <linearGradient id="line-g" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#E6D1A4" />
          <stop offset="100%" stopColor="#C8A96E" />
        </linearGradient>
      </defs>
      {gridLines.map((y, i) => (
        <line
          key={i}
          x1={padX}
          x2={W - padX}
          y1={y}
          y2={y}
          stroke="rgba(125, 137, 158, 0.16)"
          strokeWidth="1"
          strokeDasharray="4 6"
        />
      ))}
      <path d={area} fill="url(#area-g)" />
      <path d={line} fill="none" stroke="url(#line-g)" strokeWidth="2.6" strokeLinecap="round" className="chart-line" />
      {pts.map(([x, y], i) => {
        if (i !== pts.length - 1) return null
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="6" fill="rgba(200,169,110,0.18)" />
            <circle cx={x} cy={y} r="3.2" fill="#E6D1A4" stroke="#0D1320" strokeWidth="1.2" />
          </g>
        )
      })}
    </svg>
  )
}

function DonutChart({ slices }: { slices: { pct: number }[] }) {
  const R = 66
  const r = 38
  const cx = 90
  const cy = 90
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
      color: SLICE_COLORS[i % SLICE_COLORS.length],
    }
  })

  return (
    <svg width={180} height={180} viewBox="0 0 180 180">
      {arcs.map((arc, i) => (
        <path key={i} d={arc.d} fill={arc.color} opacity={0.88} />
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" fill="#EEE9DF" fontSize="24" fontWeight="600" fontFamily="'Cormorant Garamond', serif">
        {slices.length > 0 ? `${slices.length}` : '0'}
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" fill="#7D899E" fontSize="9.5" letterSpacing="1.2" fontFamily="'DM Sans', sans-serif">
        HOLDINGS
      </text>
    </svg>
  )
}

export default function Dashboard() {
  const [latestPortfolios, setLatestPortfolios] = useState<DashboardPortfolio[]>([])
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null)
  const [selectedPortfolio, setSelectedPortfolio] = useState<DashboardPortfolioDetail | null>(null)
  const [selectedHoldings, setSelectedHoldings] = useState<DashboardHolding[]>([])
  const [loadingSelected, setLoadingSelected] = useState(false)

  useEffect(() => {
    let mounted = true

    async function loadLatestPortfolios() {
      try {
        const res = await fetch('/api/profile/portfolios', { cache: 'no-store' })
        const data = await res.json()
        if (!mounted || !res.ok || !Array.isArray(data?.portfolios)) return

        const nextPortfolios = data.portfolios.slice(0, 3) as DashboardPortfolio[]
        setLatestPortfolios(nextPortfolios)
        setSelectedPortfolioId((current) => current ?? nextPortfolios[0]?.id ?? null)
      } catch {
        if (mounted) setLatestPortfolios([])
      }
    }

    void loadLatestPortfolios()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true

    async function loadSelectedPortfolio() {
      if (!selectedPortfolioId) {
        setSelectedPortfolio(null)
        setSelectedHoldings([])
        return
      }

      setLoadingSelected(true)

      try {
        const detailRes = await fetch(`/api/profile/portfolios/${selectedPortfolioId}`, { cache: 'no-store' })
        const detailData = await detailRes.json()

        if (!mounted || !detailRes.ok || !detailData?.portfolio || !Array.isArray(detailData?.positions)) {
          if (mounted) {
            setSelectedPortfolio(null)
            setSelectedHoldings([])
          }
          return
        }

        const portfolio = detailData.portfolio as DashboardPortfolioDetail
        const holdings = detailData.positions as DashboardHolding[]

        if (!mounted) return
        setSelectedPortfolio(portfolio)
        setSelectedHoldings(holdings)
      } finally {
        if (mounted) setLoadingSelected(false)
      }
    }

    void loadSelectedPortfolio()
    return () => {
      mounted = false
    }
  }, [selectedPortfolioId])

  return (
    <OverviewPanel
      latestPortfolios={latestPortfolios}
      selectedPortfolioId={selectedPortfolioId}
      selectedPortfolio={selectedPortfolio}
      selectedHoldings={selectedHoldings}
      loadingSelected={loadingSelected}
      onSelectPortfolio={setSelectedPortfolioId}
    />
  )
}

function OverviewPanel({
  latestPortfolios,
  selectedPortfolioId,
  selectedPortfolio,
  selectedHoldings,
  loadingSelected,
  onSelectPortfolio,
}: {
  latestPortfolios: DashboardPortfolio[]
  selectedPortfolioId: string | null
  selectedPortfolio: DashboardPortfolioDetail | null
  selectedHoldings: DashboardHolding[]
  loadingSelected: boolean
  onSelectPortfolio: (id: string) => void
}) {
  const overviewSnapshot = buildOverviewMockSnapshot(selectedPortfolio, selectedHoldings)
  const overviewHoldingRows = buildOverviewHoldingRows(selectedHoldings, overviewSnapshot)

  function exportHoldingsCsv() {
    if (overviewHoldingRows.length === 0) return

    const rows = [
      ['Ticker', 'Company', 'Sector', 'Value', 'Gain/Loss', 'P/E', 'Moat'],
      ...overviewHoldingRows.map((holding) => [
        holding.symbol,
        holding.companyName,
        holding.sector ?? '',
        holding.value.toFixed(2),
        `${holding.gainPct.toFixed(1)}%`,
        holding.pe == null ? 'N/M' : `${holding.pe.toFixed(1)}x`,
        holding.moat,
      ]),
    ]

    const csv = rows
      .map((row) => row.map((cell) => formatCsvCell(cell)).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const baseName = selectedPortfolio?.name?.trim() || 'portfolio-overview'
    const safeName = baseName.replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase()

    anchor.href = url
    anchor.download = `${safeName || 'portfolio-overview'}-holdings.csv`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card animate-fade-up d1" style={{ padding: '22px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Latest Saved Portfolios</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6 }}>
              Pick one portfolio and the dashboard below will sync to its holdings and saved metrics.
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
              <div
                key={portfolio.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectPortfolio(portfolio.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelectPortfolio(portfolio.id)
                  }
                }}
                style={{
                  background: 'var(--bg-elevated)',
                  border: portfolio.id === selectedPortfolioId ? '1px solid var(--gold)' : '1px solid var(--border)',
                  boxShadow: portfolio.id === selectedPortfolioId ? '0 0 0 1px rgba(200,169,110,0.18) inset' : 'none',
                  borderRadius: 10,
                  padding: '16px 18px',
                  height: '100%',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div className="font-display" style={{ fontSize: 18, fontWeight: 500 }}>{portfolio.name}</div>
                  {portfolio.id === selectedPortfolioId && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--gold)', background: 'rgba(200,169,110,0.16)', padding: '3px 8px', borderRadius: 999 }}>
                      Selected
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
                  {portfolio.investmentHorizonBucket} horizon · {formatRiskLabel(portfolio.riskTolerance)} risk
                </div>
                <div style={{ display: 'grid', gap: 6, marginTop: 14, fontSize: 12.5 }}>
                    <div style={{ color: metricColorForValue(portfolio.expectedAnnualReturn) }}>Return {formatSignedPercent(portfolio.expectedAnnualReturn)}</div>
                    <div style={{ color: 'var(--text-secondary)' }}>Vol {formatPercent(portfolio.expectedAnnualVolatility)}</div>
                    <div style={{ color: 'var(--text-secondary)' }}>Sharpe {portfolio.sharpeRatio.toFixed(2)}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, gap: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Updated {formatPortfolioDate(portfolio.updatedAt)}
                  </div>
                  <Link href={`/protected/portfolios/${portfolio.id}`} className="btn-ghost" style={{ textDecoration: 'none', fontSize: 11.5, padding: '6px 10px' }}>
                    Open details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {[
            {
              label: 'Portfolio Value',
              value: overviewSnapshot.portfolioValue,
              sub: overviewSnapshot.portfolioValueSub,
              valueColor: 'var(--text-primary)',
              subColor: overviewSnapshot.portfolioValueSub.startsWith('-') ? 'var(--red)' : 'var(--green)',
            },
            {
              label: 'Total Return',
              value: overviewSnapshot.totalReturn,
              sub: overviewSnapshot.totalReturnSub,
              valueColor: selectedPortfolio ? metricColorForValue(selectedPortfolio.expectedAnnualReturn) : 'var(--text-primary)',
              subColor: 'var(--text-muted)',
            },
            {
              label: 'Sharpe Ratio',
              value: overviewSnapshot.sharpe,
              sub: overviewSnapshot.sharpeSub,
              valueColor: 'var(--text-primary)',
              subColor: 'var(--green)',
            },
            {
              label: 'Max Drawdown',
              value: overviewSnapshot.maxDrawdown,
              sub: overviewSnapshot.maxDrawdownSub,
              valueColor: 'var(--red)',
              subColor: 'var(--red)',
            },
          ].map((metric, i) => (
            <div key={i} className={`card animate-fade-up d${i + 1}`} style={{ padding: '20px 22px' }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>{metric.label}</div>
              <div className="font-display" style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.02em', color: metric.valueColor }}>
                {metric.value}
              </div>
              <div style={{ fontSize: 11.5, color: metric.subColor, marginTop: 6 }}>{metric.sub}</div>
            </div>
          ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(320px, 0.65fr)', gap: 16, alignItems: 'stretch' }}>
        <div className="card animate-fade-up d3" style={{ padding: '20px 24px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Portfolio Value</div>
              <div className="font-display" style={{ fontSize: 26, fontWeight: 500, marginTop: 4 }}>{overviewSnapshot.portfolioValue}</div>
              <div style={{ fontSize: 11.5, color: overviewSnapshot.portfolioValueSub.startsWith('-') ? 'var(--red)' : 'var(--green)', marginTop: 3 }}>{overviewSnapshot.portfolioValueSub}</div>
            </div>
            <div className="tab-bar">
              {['1M', '3M', '1Y', 'All'].map((tab) => (
                <span key={tab} className={`tab${tab === '1Y' ? ' active' : ''}`}>{tab}</span>
              ))}
            </div>
          </div>
          <div style={{ padding: '4px 10px 0 4px' }}>
            <AreaChart data={overviewSnapshot.chartSeries} />
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
              gap: 0,
              marginTop: 6,
              padding: '0 22px 0 20px',
              fontSize: 10.5,
              color: 'var(--text-muted)',
            }}
          >
            {['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'].map((month) => (
              <span key={month} style={{ textAlign: 'center' }}>{month}</span>
            ))}
          </div>
        </div>

        <div className="card animate-fade-up d4" style={{ padding: '22px 22px 20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>Allocation</div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 196, marginBottom: 14 }}>
            <DonutChart slices={selectedHoldings.map((holding) => ({ pct: holding.weight * 100 }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto', paddingTop: 6 }}>
            {selectedHoldings.map((holding, i) => (
              <div key={holding.symbol} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: SLICE_COLORS[i % SLICE_COLORS.length], flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{holding.symbol}</span>
                </div>
                <span style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>{formatPercent(holding.weight)}</span>
              </div>
            ))}
            {selectedHoldings.length === 0 && (
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>No holdings to display yet.</div>
            )}
          </div>
        </div>
      </div>

      <div className="card animate-fade-up d5" style={{ padding: '22px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Holdings</div>
          <button
            type="button"
            className="btn-ghost"
            style={{ fontSize: 12 }}
            onClick={exportHoldingsCsv}
            disabled={overviewHoldingRows.length === 0}
          >
            Export CSV
          </button>
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
            {overviewHoldingRows.map((holding) => (
              <tr key={holding.symbol} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '14px 0', fontWeight: 700, color: 'var(--gold)', fontSize: 13, letterSpacing: '0.03em' }}>{holding.symbol}</td>
                <td style={{ fontSize: 13, color: 'var(--text-primary)', paddingRight: 16 }}>{holding.companyName}</td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)', paddingRight: 16 }}>{holding.sector ?? '—'}</td>
                <td style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, paddingRight: 16 }}>{formatCurrencyShort(holding.value)}</td>
                <td style={{ paddingRight: 16 }}>
                  <span className={holding.gainPct >= 0 ? 'badge-up' : 'badge-down'}>
                    {holding.gainPct >= 0 ? '+' : ''}{holding.gainPct.toFixed(1)}%
                  </span>
                </td>
                <td style={{ fontSize: 12.5, color: 'var(--text-secondary)', paddingRight: 16 }}>
                  {holding.pe == null ? 'N/M' : `${holding.pe.toFixed(1)}x`}
                </td>
                <td style={{ paddingRight: 16 }}>
                  <span className={holding.moat === 'Wide' ? 'badge-up' : 'badge-neutral'}>{holding.moat}</span>
                </td>
                <td>
                  <Sparkline data={holding.spark} color={holding.gainPct >= 0 ? 'var(--green)' : 'var(--red)'} />
                </td>
              </tr>
            ))}
            {selectedHoldings.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: '18px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  Select a saved portfolio above to view synced holdings.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
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
            badge: selectedPortfolio ? formatObjectiveLabel(selectedPortfolio.objective) : 'Sharpe-focused',
            badgeColor: 'var(--green)',
            desc: 'Create optimized allocations, save them into your portfolio library, and revisit each portfolio from a dedicated detail page.',
            cta: 'Open portfolios →',
            href: '/protected/portfolios',
          },
          {
            title: 'Tail Risk',
            badge: selectedPortfolio ? `MDD ${formatDownsidePercent(selectedPortfolio.maxDrawdown)}` : 'Stress scenarios',
            badgeColor: 'var(--blue)',
            desc: 'Maximum drawdown analysis, historical stress scenarios, and expected shortfall metrics.',
            cta: 'View tail risk →',
            href: '/protected/tail-risk',
          },
          {
            title: 'Comparables',
            badge: selectedHoldings[0] ? `${selectedHoldings[0].symbol} peers` : 'Peer set',
            badgeColor: 'var(--gold)',
            desc: 'Rapid peer benchmarking across P/E, EV/EBITDA, P/B, ROE, and analyst price targets.',
            cta: 'Open comparables →',
            href: '/protected/valuation?tab=comparables',
          },
          {
            title: 'Qualitative Research',
            badge: selectedHoldings[0] ? `${selectedHoldings[0].symbol} research` : 'Research-ready',
            badgeColor: 'var(--green)',
            desc: 'Company snapshot on ticker search: bull and bear thesis, moat, key risks, and analyst consensus.',
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

