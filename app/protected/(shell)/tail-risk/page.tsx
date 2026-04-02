'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

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
  worstMonthReturn: number
  worstQuarterReturn: number
  updatedAt: string
}

type StressScenario = {
  assumed_shock: number
  estimated_portfolio_return: number
  estimated_drawdown: number
}

type PortfolioDetail = {
  portfolio: SavedPortfolioSummary & {
    riskFreeRateUsed: number
    stressTestResults?: Record<string, StressScenario>
    dataWarnings?: string[]
    notes?: string | null
  }
  positions: { symbol: string; weight: number; sector: string | null }[]
}

type PortfolioRadarSource = SavedPortfolioSummary & {
  stressTestResults?: Record<string, StressScenario>
}

type RadarMetric = {
  label: string
  score: number
  rawLabel: string
}

function formatPct(value: number | undefined) {
  if (value == null || Number.isNaN(value)) return '-'
  return `${(value * 100).toFixed(2)}%`
}

function formatObjective(value: string) {
  return value.replace(/_/g, ' ')
}

function formatScenarioName(value: string) {
  return value.replace(/_/g, ' ')
}

function getRiskLabel(maxDrawdown: number) {
  if (maxDrawdown <= -0.35) return { label: 'High tail risk', color: 'var(--red)' }
  if (maxDrawdown <= -0.2) return { label: 'Moderate tail risk', color: 'var(--gold)' }
  return { label: 'Lower tail risk', color: 'var(--green)' }
}

function clampRiskScore(value: number) {
  return Math.max(0.08, Math.min(1, value))
}

function buildRadarPath(metrics: RadarMetric[], radius: number, center: number) {
  const points = metrics.map((metric, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / metrics.length
    const scaledRadius = radius * clampRiskScore(metric.score)
    const x = center + Math.cos(angle) * scaledRadius
    const y = center + Math.sin(angle) * scaledRadius
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  return points.join(' ')
}

function buildGuidePath(level: number, count: number, radius: number, center: number) {
  const points = Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / count
    const x = center + Math.cos(angle) * radius * level
    const y = center + Math.sin(angle) * radius * level
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  return points.join(' ')
}

function buildRadarAxes(count: number, radius: number, center: number) {
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / count
    return {
      x2: center + Math.cos(angle) * radius,
      y2: center + Math.sin(angle) * radius,
      labelX: center + Math.cos(angle) * (radius + 22),
      labelY: center + Math.sin(angle) * (radius + 22),
    }
  })
}

function getWorstStressDrawdown(stressResults?: Record<string, StressScenario>) {
  return Math.min(
    0,
    ...Object.values(stressResults ?? {}).map((scenario) => scenario.estimated_drawdown)
  )
}

function getRiskRadarMetrics(
  portfolio: PortfolioRadarSource | undefined,
  sectorWeights: { sector: string; weight: number }[]
): RadarMetric[] {
  const concentration = sectorWeights[0]?.weight ?? 0
  const stressDrawdown = getWorstStressDrawdown(portfolio?.stressTestResults)

  return [
    {
      label: 'Max DD',
      score: clampRiskScore(Math.abs(portfolio?.maxDrawdown ?? 0) / 0.5),
      rawLabel: formatPct(portfolio?.maxDrawdown),
    },
    {
      label: 'Worst Month',
      score: clampRiskScore(Math.abs(portfolio?.worstMonthReturn ?? 0) / 0.25),
      rawLabel: formatPct(portfolio?.worstMonthReturn),
    },
    {
      label: 'Worst Quarter',
      score: clampRiskScore(Math.abs(portfolio?.worstQuarterReturn ?? 0) / 0.35),
      rawLabel: formatPct(portfolio?.worstQuarterReturn),
    },
    {
      label: 'Volatility',
      score: clampRiskScore((portfolio?.expectedAnnualVolatility ?? 0) / 0.45),
      rawLabel: formatPct(portfolio?.expectedAnnualVolatility),
    },
    {
      label: 'Sector Peak',
      score: clampRiskScore(concentration / 0.6),
      rawLabel: formatPct(concentration),
    },
    {
      label: 'Stress DD',
      score: clampRiskScore(Math.abs(stressDrawdown) / 0.6),
      rawLabel: formatPct(stressDrawdown),
    },
  ]
}

function RiskRadarCard({ metrics }: { metrics: RadarMetric[] }) {
  const size = 280
  const center = size / 2
  const radius = 92
  const polygon = buildRadarPath(metrics, radius, center)
  const axes = buildRadarAxes(metrics.length, radius, center)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(240px, 320px) minmax(0, 1fr)',
        gap: 18,
        alignItems: 'center',
      }}
    >
      <svg width="100%" viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: 320 }}>
        <defs>
          <radialGradient id="tail-risk-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(200,169,110,0.4)" />
            <stop offset="100%" stopColor="rgba(200,169,110,0.02)" />
          </radialGradient>
          <linearGradient id="tail-risk-polygon" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(200,169,110,0.95)" />
            <stop offset="100%" stopColor="rgba(255,122,96,0.7)" />
          </linearGradient>
        </defs>
        <circle cx={center} cy={center} r={118} fill="url(#tail-risk-glow)" />
        {[0.35, 0.65, 1].map((level) => (
          <polygon
            key={level}
            points={buildGuidePath(level, metrics.length, radius, center)}
            fill="none"
            stroke="rgba(232,224,209,0.12)"
            strokeWidth="1"
          />
        ))}
        {axes.map((axis, index) => (
          <g key={`${metrics[index].label}-${index}`}>
            <line
              x1={center}
              y1={center}
              x2={axis.x2}
              y2={axis.y2}
              stroke="rgba(232,224,209,0.12)"
              strokeWidth="1"
            />
            <text
              x={axis.labelX}
              y={axis.labelY}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="rgba(154,146,132,0.95)"
              fontSize="10"
              letterSpacing="0.5"
              style={{ textTransform: 'uppercase' }}
            >
              {metrics[index].label}
            </text>
          </g>
        ))}
        <polygon
          points={polygon}
          fill="rgba(200,169,110,0.18)"
          stroke="url(#tail-risk-polygon)"
          strokeWidth="2.5"
        />
        {polygon.split(' ').map((point, index) => {
          const [x, y] = point.split(',').map(Number)
          return (
            <circle
              key={`${point}-${index}`}
              cx={x}
              cy={y}
              r="4"
              fill="#0A0C12"
              stroke="rgba(226,196,130,0.95)"
              strokeWidth="2"
            />
          )
        })}
      </svg>

      <div style={{ display: 'grid', gap: 10 }}>
        {metrics.map((metric) => (
          <div key={metric.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 6 }}>
              <span>{metric.label}</span>
              <span style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{metric.rawLabel}</span>
            </div>
            <div style={{ width: '100%', height: 8, borderRadius: 999, background: 'var(--bg-elevated)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.round(clampRiskScore(metric.score) * 100)}%`,
                  height: '100%',
                  background: metric.score > 0.7
                    ? 'linear-gradient(90deg, var(--red), #ff9478)'
                    : 'linear-gradient(90deg, var(--gold), var(--gold-bright))',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TailRiskPage() {
  const [portfolios, setPortfolios] = useState<SavedPortfolioSummary[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState<PortfolioDetail | null>(null)
  const [listLoading, setListLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void loadPortfolios()
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }

    void loadPortfolioDetail(selectedId)
  }, [selectedId])

  const rankedPortfolios = useMemo(() => {
    return [...portfolios].sort((a, b) => a.maxDrawdown - b.maxDrawdown)
  }, [portfolios])

  const sectorExposures = useMemo(() => {
    const aggregate = new Map<string, number>()
    for (const position of detail?.positions ?? []) {
      const sector = position.sector || 'Unknown'
      aggregate.set(sector, (aggregate.get(sector) ?? 0) + position.weight)
    }

    return Array.from(aggregate.entries())
      .map(([sector, weight]) => ({ sector, weight }))
      .sort((a, b) => b.weight - a.weight)
  }, [detail])

  async function loadPortfolios() {
    setListLoading(true)
    setError('')

    try {
      const response = await fetch('/api/profile/portfolios', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'Unable to load saved portfolios.')
        return
      }

      const loaded = Array.isArray(data?.portfolios) ? data.portfolios : []
      setPortfolios(loaded)
      setSelectedId((current) => current || loaded[0]?.id || '')
    } catch {
      setError('Unable to load saved portfolios.')
    } finally {
      setListLoading(false)
    }
  }

  async function loadPortfolioDetail(id: string) {
    setDetailLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/profile/portfolios/${id}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'Unable to load portfolio tail-risk details.')
        return
      }

      setDetail(data)
    } catch {
      setError('Unable to load portfolio tail-risk details.')
    } finally {
      setDetailLoading(false)
    }
  }

  const selectedPortfolio = detail?.portfolio ?? rankedPortfolios.find((portfolio) => portfolio.id === selectedId)
  const stressEntries = Object.entries(detail?.portfolio.stressTestResults ?? {})
  const drawdownLabel = getRiskLabel(selectedPortfolio?.maxDrawdown ?? 0)
  const radarMetrics = useMemo(
    () => getRiskRadarMetrics(detail?.portfolio ?? selectedPortfolio, sectorExposures),
    [detail?.portfolio, selectedPortfolio, sectorExposures]
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1180, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontSize: 10.5, color: 'var(--gold)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>
            Portfolio Risk
          </div>
          <h1 className="font-display" style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 8 }}>
            Tail Risk Review
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.65, maxWidth: 860 }}>
            Compare saved portfolios by downside metrics, inspect stress scenarios, and review sector concentration for the selected allocation.
          </p>
        </div>
        <Link href="/protected/optimiser" className="btn-gold" style={{ padding: '12px 18px', textDecoration: 'none' }}>
          Create portfolio
        </Link>
      </div>

      {error && (
        <div style={{ fontSize: 13, color: 'var(--red)', background: 'var(--red-dim)', padding: '12px 16px', borderRadius: 8 }}>
          {error}
        </div>
      )}

      {listLoading ? (
        <div className="card" style={{ padding: '24px 26px', color: 'var(--text-muted)' }}>
          Loading tail-risk dashboard...
        </div>
      ) : portfolios.length === 0 ? (
        <div className="card" style={{ padding: '24px 26px' }}>
          <div className="font-display" style={{ fontSize: 22, marginBottom: 8 }}>No saved portfolios yet</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 18 }}>
            Save portfolios from the optimiser first, then this tab will rank them by drawdown and stress sensitivity.
          </p>
          <Link href="/protected/optimiser" className="btn-gold" style={{ padding: '10px 16px', textDecoration: 'none' }}>
            Go to optimiser
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 0.8fr) minmax(0, 1.2fr)', gap: 20, alignItems: 'start' }}>
          <div className="card" style={{ padding: '20px 22px', display: 'grid', gap: 14 }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Portfolios ranked by max drawdown
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {rankedPortfolios.map((portfolio) => {
                const risk = getRiskLabel(portfolio.maxDrawdown)
                const active = portfolio.id === selectedId

                return (
                  <button
                    key={portfolio.id}
                    type="button"
                    onClick={() => setSelectedId(portfolio.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      cursor: 'pointer',
                      borderRadius: 12,
                      border: active ? '1px solid var(--gold-dim)' : '1px solid var(--border)',
                      background: active ? 'rgba(200,169,110,0.08)' : 'var(--bg-elevated)',
                      padding: '14px 16px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div className="font-display" style={{ fontSize: 20, fontWeight: 500, color: 'var(--text-primary)' }}>
                        {portfolio.name}
                      </div>
                      <div style={{ fontSize: 12, color: risk.color, whiteSpace: 'nowrap' }}>
                        {formatPct(portfolio.maxDrawdown)}
                      </div>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--text-muted)' }}>
                      {formatObjective(portfolio.objective)} · {portfolio.riskTolerance.toLowerCase()} risk · {portfolio.lookbackPeriodYears}y lookback
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11.5, color: risk.color }}>
                      {risk.label}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 20 }}>
            <div className="card" style={{ padding: '22px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                    Selected portfolio
                  </div>
                  <div className="font-display" style={{ fontSize: 26, fontWeight: 500 }}>
                    {selectedPortfolio?.name ?? 'Portfolio'}
                  </div>
                </div>
                {selectedPortfolio?.id && (
                  <Link
                    href={`/protected/portfolios/${selectedPortfolio.id}`}
                    className="btn-ghost"
                    style={{ padding: '10px 14px', textDecoration: 'none' }}
                  >
                    Open portfolio details
                  </Link>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 18 }}>
                {[
                  ['Max drawdown', formatPct(selectedPortfolio?.maxDrawdown), drawdownLabel.color],
                  ['Worst month', formatPct(selectedPortfolio?.worstMonthReturn), 'var(--red)'],
                  ['Worst quarter', formatPct(selectedPortfolio?.worstQuarterReturn), 'var(--red)'],
                  ['Expected vol', formatPct(selectedPortfolio?.expectedAnnualVolatility), 'var(--text-primary)'],
                  ['Expected return', formatPct(selectedPortfolio?.expectedAnnualReturn), 'var(--green)'],
                  ['Sharpe', selectedPortfolio?.sharpeRatio?.toFixed(3) ?? '-', 'var(--gold)'],
                ].map(([label, value, color]) => (
                  <div
                    key={label}
                    style={{
                      background: 'var(--bg-elevated)',
                      borderRadius: 10,
                      padding: '12px 14px',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding: '22px 24px' }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>
                Risk radar
              </div>
              {detailLoading ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Building risk radar...</div>
              ) : (
                <RiskRadarCard metrics={radarMetrics} />
              )}
            </div>

            <div className="card" style={{ padding: '22px 24px' }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>
                Stress scenarios
              </div>
              {detailLoading ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading stress tests...</div>
              ) : stressEntries.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  No stress-test scenarios stored for this portfolio yet.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {stressEntries.map(([name, scenario]) => (
                    <div
                      key={name}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(160px, 1.2fr) repeat(3, minmax(100px, 1fr))',
                        gap: 12,
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>
                        {formatScenarioName(name)}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                        Shock {formatPct(scenario.assumed_shock)}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                        Return {formatPct(scenario.estimated_portfolio_return)}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                        Drawdown {formatPct(scenario.estimated_drawdown)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card" style={{ padding: '22px 24px' }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>
                Sector concentration
              </div>
              {detailLoading ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading sector exposures...</div>
              ) : sectorExposures.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  No sector exposure data available for this portfolio yet.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {sectorExposures.map(({ sector, weight }) => (
                    <div key={sector}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 6 }}>
                        <span>{sector}</span>
                        <span>{formatPct(weight)}</span>
                      </div>
                      <div style={{ width: '100%', height: 9, borderRadius: 999, background: 'var(--bg-elevated)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(0, weight * 100))}%`,
                            height: '100%',
                            background: weight > 0.4
                              ? 'linear-gradient(90deg, var(--red), #ff9f8a)'
                              : 'linear-gradient(90deg, var(--gold), var(--gold-bright))',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
