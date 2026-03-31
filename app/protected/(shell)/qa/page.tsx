'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { QaResponse, RiskLevel } from '@/lib/qa/contracts'

type SearchResult = { symbol: string; description: string }

const SAMPLE_TICKERS = ['JPM', 'GS', 'AIG', 'BAC', 'C', 'XLF', 'SPY']
const TICKER_PATTERN = /^[A-Z][A-Z0-9.-]{0,9}$/

function Skeleton({ w = '100%', h = 14 }: { w?: string | number; h?: number }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 5,
        background: 'linear-gradient(90deg, var(--bg-elevated) 25%, var(--bg-hover) 50%, var(--bg-elevated) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s infinite',
      }}
    />
  )
}

function TickerSearch({
  value,
  onChange,
  onSelect,
  onSubmit,
}: {
  value: string
  onChange: (value: string) => void
  onSelect: (value: string) => void
  onSubmit: (value: string) => void
}) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setQuery(value)
  }, [value])

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  function handleChange(next: string) {
    setQuery(next)
    onChange(next)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!next.trim()) {
      setResults([])
      setOpen(false)
      setSearching(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/ticker/search?q=${encodeURIComponent(next)}`)
        if (!res.ok) throw new Error('Search unavailable')
        const data = await res.json()
        setResults(Array.isArray(data) ? data : [])
        setOpen(Array.isArray(data) && data.length > 0)
      } catch {
        setResults([])
        setOpen(false)
      } finally {
        setSearching(false)
      }
    }, 280)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: searching ? 'var(--gold)' : 'var(--text-muted)', fontSize: 15, pointerEvents: 'none' }}>⌕</span>
      <input
        className="input-dark"
        style={{ paddingLeft: 36, width: '100%' }}
        value={query}
        placeholder="Search like Google: ticker, company, or plain-English phrase…"
        autoComplete="off"
        onChange={(event) => handleChange(event.target.value)}
        onFocus={() => { if (results.length > 0) setOpen(true) }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            setOpen(false)
            onSubmit(query)
          }
          if (event.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {open && results.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 40,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-bright)',
            borderRadius: 10,
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          }}
        >
          {results.map((item, index) => (
            <button
              key={`${item.symbol}-${index}`}
              type="button"
              onClick={() => {
                setQuery(item.symbol)
                onChange(item.symbol)
                onSelect(item.symbol)
                setOpen(false)
              }}
              style={{
                width: '100%',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                padding: '10px 14px',
                borderBottom: index < results.length - 1 ? '1px solid var(--border)' : 'none',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ minWidth: 52, fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>{item.symbol}</span>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</span>
                {index === 0 && (
                  <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--gold)', background: 'rgba(200,169,110,0.12)', padding: '3px 7px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                    Best match
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function MetricTile({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="card-elevated" style={{ padding: '12px 14px' }}>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: value ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: 500 }}>
        {value ?? 'Not available'}
      </div>
    </div>
  )
}

type TrendPeriod = '1M' | '3M' | '1Y'
type CandlePoint = { t: number; c: number }

function PriceTrendCard({ symbol }: { symbol: string }) {
  const [period, setPeriod] = useState<TrendPeriod>('3M')
  const [points, setPoints] = useState<CandlePoint[]>([])
  const [periodReturn, setPeriodReturn] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadTrend() {
      setLoading(true)
      try {
        const response = await fetch(`/api/ticker/${symbol}/candles?period=${period}`)
        const payload = response.ok ? await response.json() : null

        if (!active) return

        if (Array.isArray(payload?.candles)) {
          setPoints(payload.candles
            .filter((item: { t?: unknown; c?: unknown }) => typeof item?.t === 'number' && typeof item?.c === 'number')
            .map((item: { t: number; c: number }) => ({ t: item.t, c: item.c })))
          setPeriodReturn(typeof payload?.periodReturn === 'number' ? payload.periodReturn : null)
        } else {
          setPoints([])
          setPeriodReturn(null)
        }
      } catch {
        if (!active) return
        setPoints([])
        setPeriodReturn(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadTrend()
    return () => {
      active = false
    }
  }, [period, symbol])

  const closes = points.map((point) => point.c)
  const min = closes.length ? Math.min(...closes) : 0
  const max = closes.length ? Math.max(...closes) : 1
  const range = max - min || 1
  const W = 520
  const H = 170
  const up = (periodReturn ?? 0) >= 0
  const stroke = up ? '#3DD68C' : '#F06070'

  const line = points.map((point, index) => {
    const x = 12 + (index / Math.max(points.length - 1, 1)) * (W - 24)
    const y = 16 + (1 - ((point.c - min) / range)) * (H - 34)
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ')
  const area = line ? `${line} L ${W - 12} ${H - 8} L 12 ${H - 8} Z` : ''

  return (
    <div className="card animate-fade-up d4" style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Price trend</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {periodReturn == null ? 'Trend unavailable' : `${up ? '+' : ''}${periodReturn.toFixed(2)}% over ${period}`}
          </div>
        </div>
        <div className="tab-bar">
          {(['1M', '3M', '1Y'] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={`tab${period === item ? ' active' : ''}`}
              onClick={() => setPeriod(item)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ height: 170, display: 'grid', alignItems: 'center' }}><Skeleton w="100%" h={150} /></div>
      ) : points.length < 2 ? (
        <div style={{ height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>
          No chart data available for this ticker.
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 170 }}>
          <defs>
            <linearGradient id={`qa-chart-${symbol}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0.2, 0.5, 0.8].map((factor) => (
            <line key={factor} x1={12} x2={W - 12} y1={16 + factor * (H - 34)} y2={16 + factor * (H - 34)} stroke="var(--border)" strokeDasharray="3 4" />
          ))}
          <path d={area} fill={`url(#qa-chart-${symbol})`} />
          <path d={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  )
}

function SignalListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="card-elevated" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{title}</div>
      <ul style={{ paddingLeft: 16, display: 'grid', gap: 8 }}>
        {items.map((item) => (
          <li key={item} style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function RangePositionCard({ range, positionPct, price }: { range: string | null; positionPct: number | null; price: string | null }) {
  return (
    <div className="card animate-fade-up d4" style={{ padding: '20px 22px' }}>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>52-week positioning</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
        {range ?? 'Range data unavailable'}
      </div>
      <div style={{ position: 'relative', height: 10, borderRadius: 999, background: 'var(--bg-elevated)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ width: `${positionPct ?? 0}%`, height: '100%', background: 'linear-gradient(90deg, var(--gold-dim), var(--gold), var(--green))' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, color: 'var(--text-muted)' }}>
        <span>52W low</span>
        <span>{positionPct == null ? 'Position unavailable' : `${positionPct}% through range`}</span>
        <span>{price ?? 'Current price unavailable'}</span>
      </div>
    </div>
  )
}

function RiskBadge({ label, level }: { label: string; level: RiskLevel }) {
  const palette = level === 'high'
    ? { color: 'var(--red)', bg: 'var(--red-dim)' }
    : level === 'medium'
      ? { color: 'var(--gold)', bg: 'rgba(200,169,110,0.14)' }
      : level === 'low'
        ? { color: 'var(--green)', bg: 'var(--green-dim)' }
        : { color: 'var(--text-secondary)', bg: 'rgba(91,156,246,0.12)' }

  return (
    <div className="card-elevated" style={{ padding: '12px 14px' }}>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</div>
      <span style={{ display: 'inline-flex', padding: '4px 8px', borderRadius: 999, fontSize: 12, fontWeight: 600, color: palette.color, background: palette.bg, textTransform: 'capitalize' }}>
        {level}
      </span>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 30, marginBottom: 12, opacity: 0.5 }}>⊕</div>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>No qualitative brief yet</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', maxWidth: 580, margin: '0 auto', lineHeight: 1.65 }}>
        Search a ticker such as <strong style={{ color: 'var(--text-secondary)' }}>JPM</strong>, <strong style={{ color: 'var(--text-secondary)' }}>GS</strong>, or <strong style={{ color: 'var(--text-secondary)' }}>SPY</strong> to generate a crisis-focused overview and structured JSON output.
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="card" style={{ padding: '20px 22px' }}>
        <Skeleton w={120} h={10} />
        <div style={{ marginTop: 12 }}><Skeleton w="55%" h={28} /></div>
        <div style={{ marginTop: 14 }}><Skeleton w="100%" h={12} /></div>
        <div style={{ marginTop: 8 }}><Skeleton w="90%" h={12} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 16 }}>
        <div className="card" style={{ padding: '20px 22px' }}><Skeleton w="40%" h={16} /><div style={{ marginTop: 12 }}><Skeleton w="100%" h={12} /></div><div style={{ marginTop: 8 }}><Skeleton w="100%" h={12} /></div><div style={{ marginTop: 8 }}><Skeleton w="72%" h={12} /></div></div>
        <div className="card" style={{ padding: '20px 22px' }}><Skeleton w="45%" h={16} /><div style={{ marginTop: 12 }}><Skeleton w="100%" h={12} /></div><div style={{ marginTop: 8 }}><Skeleton w="100%" h={12} /></div><div style={{ marginTop: 8 }}><Skeleton w="70%" h={12} /></div></div>
      </div>
    </div>
  )
}

function QualitativeAnalysisContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [ticker, setTicker] = useState(searchParams.get('ticker')?.toUpperCase() ?? '')
  const [result, setResult] = useState<QaResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bootedTicker = useRef('')

  const resolveTickerInput = useCallback(async (rawInput: string): Promise<string> => {
    const trimmed = rawInput.trim()
    if (!trimmed) throw new Error('Enter a company name, theme, or ticker like JPM or SPY.')

    const uppercase = trimmed.toUpperCase()
    if (TICKER_PATTERN.test(uppercase)) {
      return uppercase
    }

    const response = await fetch(`/api/ticker/search?q=${encodeURIComponent(trimmed)}`)
    if (!response.ok) {
      throw new Error('Search is currently unavailable.')
    }

    const data = await response.json()
    const bestMatch = Array.isArray(data)
      ? data.find((item): item is SearchResult => typeof item?.symbol === 'string')
      : null

    if (!bestMatch) {
      throw new Error('No matching ticker found. Try a company name, sector, or ETF phrase.')
    }

    return bestMatch.symbol.toUpperCase()
  }, [])

  const runAnalysis = useCallback(async (rawTicker: string) => {
    const rawQuery = rawTicker.trim()
    if (!rawQuery) {
      setError('Enter a company name, theme, or ticker like JPM or SPY.')
      setResult(null)
      return
    }

    setLoading(true)
    setError('')

    try {
      const symbol = await resolveTickerInput(rawQuery)
      bootedTicker.current = symbol
      setTicker(symbol)
      router.replace(`/protected/qa?ticker=${encodeURIComponent(symbol)}`, { scroll: false })

      const response = await fetch('/api/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: symbol }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Analysis unavailable.')
      }
      setResult(payload)
    } catch (cause) {
      setResult(null)
      setError(cause instanceof Error ? cause.message : 'Analysis unavailable.')
    } finally {
      setLoading(false)
    }
  }, [resolveTickerInput, router])

  useEffect(() => {
    const initialTicker = searchParams.get('ticker')?.trim().toUpperCase() ?? ''
    if (!initialTicker || bootedTicker.current === initialTicker) return
    bootedTicker.current = initialTicker
    setTicker(initialTicker)
    void runAnalysis(initialTicker)
  }, [runAnalysis, searchParams])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1100, fontFamily: "'DM Sans', sans-serif" }}>
      <div>
        <div style={{ fontSize: 10.5, color: 'var(--gold)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>Research</div>
        <h1 className="font-display" style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 8 }}>
          Qualitative Analysis
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.65, maxWidth: 920 }}>
          Generate a concise crisis-focused brief by searching the way you would on Google — type a ticker, company name, or plain-English phrase, and the app will resolve the best match before surfacing valuation, balance-sheet, and trading context alongside a price trend chart.
        </p>
      </div>

      <div className="card" style={{ padding: '20px 22px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <TickerSearch
            value={ticker}
            onChange={setTicker}
            onSelect={(symbol) => { setTicker(symbol); void runAnalysis(symbol) }}
            onSubmit={(symbol) => { void runAnalysis(symbol) }}
          />
          <button type="button" className="btn-gold" onClick={() => { void runAnalysis(ticker) }} disabled={loading}>
            {loading ? 'Generating…' : 'Run QA'}
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {SAMPLE_TICKERS.map((symbol) => (
            <button
              key={symbol}
              type="button"
              onClick={() => { void runAnalysis(symbol) }}
              className="btn-ghost"
              style={{ padding: '6px 10px', fontSize: 12.5 }}
            >
              {symbol}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Search like Google: try <strong style={{ color: 'var(--text-secondary)' }}>JPMorgan</strong>, <strong style={{ color: 'var(--text-secondary)' }}>largest US bank</strong>, or <strong style={{ color: 'var(--text-secondary)' }}>financial sector ETF</strong>. Press Enter to use the best match.
        </div>
      </div>

      {error && (
        <div className="card" style={{ padding: '14px 16px', borderColor: 'rgba(240,96,112,0.45)' }}>
          <div style={{ fontSize: 12.5, color: 'var(--red)' }}>{error}</div>
        </div>
      )}

      {loading ? <LoadingState /> : !result ? <EmptyState /> : (
        <>
          <div className="card animate-fade-up d1" style={{ padding: '22px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.14em' }}>{result.entityOverview.ticker}</span>
                  <span className="badge-neutral">{result.entityOverview.entityType}</span>
                </div>
                <h2 className="font-display" style={{ fontSize: 28, fontWeight: 500, marginBottom: 6 }}>{result.entityOverview.name}</h2>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 760 }}>{result.entityOverview.shortDescription}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Source status</div>
                <span className={result.metadata.cacheHit ? 'badge-neutral' : 'badge-up'}>{result.metadata.cacheHit ? 'Cached lookup' : 'Fresh lookup'}</span>
              </div>
            </div>
            <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Systemic relevance:</strong> {result.entityOverview.systemicRelevance}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 16 }}>
            <div className="card animate-fade-up d2" style={{ padding: '20px 22px' }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Entity overview</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {[
                  ['Ticker', result.entityOverview.ticker],
                  ['Exchange', result.entityOverview.exchange ?? 'Not available'],
                  ['Sector', result.entityOverview.sector ?? 'Not available'],
                  ['Entity type', result.entityOverview.entityType],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--text-primary)', textAlign: 'right' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card animate-fade-up d3" style={{ padding: '20px 22px' }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Financial snapshot</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <MetricTile label="Price" value={result.financialSnapshot.price} />
                <MetricTile label="Market cap" value={result.financialSnapshot.marketCap} />
                <MetricTile label="Volume" value={result.financialSnapshot.volume} />
                <MetricTile label="Beta" value={result.financialSnapshot.beta} />
                <MetricTile label="Valuation" value={result.financialSnapshot.valuationMetric} />
                <MetricTile label="Dividend yield" value={result.financialSnapshot.dividendYield} />
                <MetricTile label="52-week range" value={result.financialSnapshot.week52Range} />
                <MetricTile label="Institution metrics" value={result.financialSnapshot.institutionSpecificMetrics.join(' • ') || null} />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 16 }}>
            <PriceTrendCard symbol={result.entityOverview.ticker} />
            <RangePositionCard
              range={result.financialSnapshot.week52Range}
              positionPct={result.financialSnapshot.week52PositionPct}
              price={result.financialSnapshot.price}
            />
          </div>

          <div className="card animate-fade-up d4" style={{ padding: '20px 22px' }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Technical financial deep dive</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <SignalListCard title="Valuation lens" items={result.financialSnapshot.valuationSignals} />
              <SignalListCard title="Profitability" items={result.financialSnapshot.profitabilityMetrics} />
              <SignalListCard title="Balance-sheet focus" items={result.financialSnapshot.balanceSheetMetrics} />
              <SignalListCard title="Trading behavior" items={result.financialSnapshot.tradingSignals} />
            </div>
          </div>

          <div className="card animate-fade-up d5" style={{ padding: '20px 22px' }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Quick analysis</div>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12.5, color: 'var(--gold)', marginBottom: 6, fontWeight: 600 }}>What it is</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{result.quickAnalysis.whatItIs}</div>
              </div>
              <div>
                <div style={{ fontSize: 12.5, color: 'var(--gold)', marginBottom: 6, fontWeight: 600 }}>Why it matters in a crisis</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{result.quickAnalysis.whyItMattersInCrisis}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                {[
                  { label: 'Key vulnerabilities', values: result.quickAnalysis.keyVulnerabilities },
                  { label: 'Transmission channels', values: result.quickAnalysis.likelyTransmissionChannels },
                  { label: 'What to explore next', values: result.quickAnalysis.whatToExploreNext },
                ].map((group) => (
                  <div key={group.label} className="card-elevated" style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{group.label}</div>
                    <ul style={{ paddingLeft: 16, display: 'grid', gap: 8 }}>
                      {group.values.map((value) => (
                        <li key={value} style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{value}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card animate-fade-up d6" style={{ padding: '20px 22px' }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Crisis-relevance heuristics</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
              <RiskBadge label="Funding risk" level={result.crisisRelevanceHeuristics.fundingRisk} />
              <RiskBadge label="Liquidity risk" level={result.crisisRelevanceHeuristics.liquidityRisk} />
              <RiskBadge label="Counterparty risk" level={result.crisisRelevanceHeuristics.counterpartyRisk} />
              <RiskBadge label="Sentiment sensitivity" level={result.crisisRelevanceHeuristics.marketSentimentSensitivity} />
              <RiskBadge label="Interconnectedness" level={result.crisisRelevanceHeuristics.interconnectedness} />
              <RiskBadge label="Confidence level" level={result.crisisRelevanceHeuristics.confidenceLevel} />
              <div className="card-elevated" style={{ padding: '12px 14px', gridColumn: 'span 2' }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Major exposure categories</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {result.crisisRelevanceHeuristics.majorExposureCategories.map((item) => (
                    <span key={item} className="badge-neutral">{item}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>


          <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        </>
      )}
    </div>
  )
}

export default function QualitativeAnalysisPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <QualitativeAnalysisContent />
    </Suspense>
  )
}
