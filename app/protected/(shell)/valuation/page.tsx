'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DCFTab } from './dcf-tab'

/* ─── TYPES ──────────────────────────────────────────────────────────────── */

interface CompanyData {
  symbol: string
  name: string
  sector: string
  marketCap: number | null
  price: number | null
  pe: number | null
  pb: number | null
  evEbitda: number | null
  evRevenue: number | null
  roe: number | null
  grossMargin: number | null
  revenueGrowth: number | null
  debtEquity: number | null
}

interface PeerAssessment {
  symbol: string
  score: number
  keep: boolean
  reason: string
  aiAdded?: boolean
}

interface MetricWeight {
  score: number
  reason: string
}

interface AiInsights {
  peerAssessments: PeerAssessment[]
  suggestedAdditions: string[]
  metricWeights: Record<string, MetricWeight>
  analystNote: string
}

interface CompsData {
  subject: CompanyData
  peers: CompanyData[]
  aiInsights: AiInsights | null
}

interface SearchResult {
  symbol: string
  description: string
}

/* ─── HELPERS ────────────────────────────────────────────────────────────── */

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

function median(vals: number[]): number | null {
  const sorted = [...vals].sort((a, b) => a - b)
  if (!sorted.length) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/* ─── SKELETON ───────────────────────────────────────────────────────────── */

function Skeleton({ w = '100%', h = 14 }: { w?: string | number; h?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 5,
      background: 'linear-gradient(90deg, var(--bg-elevated) 25%, var(--bg-hover) 50%, var(--bg-elevated) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

/* ─── TICKER SEARCH ──────────────────────────────────────────────────────── */

function TickerSearch({ value, onSelect }: { value: string; onSelect: (sym: string, name: string) => void }) {
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
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!val.trim()) { setResults([]); setOpen(false); setSearching(false); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/ticker/search?q=${encodeURIComponent(val)}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data)
          setOpen(data.length > 0)
        }
      } catch { /* ignore */ }
      setSearching(false)
    }, 300)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', maxWidth: 400 }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: searching ? 'var(--gold)' : 'var(--text-muted)', fontSize: 15, pointerEvents: 'none', transition: 'color 0.15s' }}>⌕</span>
      <input
        className="input-dark"
        style={{ paddingLeft: 36, width: '100%' }}
        placeholder="Search ticker or company…"
        value={query}
        onChange={handleChange}
        onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); setQuery('') } }}
        onFocus={() => { if (results.length > 0) setOpen(true) }}
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 100,
          background: 'var(--bg-surface)', border: '1px solid var(--border-bright)',
          borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          {results.map((r, i) => (
            <button
              key={r.symbol}
              type="button"
              onClick={() => { setOpen(false); setQuery(r.symbol); onSelect(r.symbol, r.description) }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                fontFamily: "'DM Sans', sans-serif", transition: 'background 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)', minWidth: 56 }}>{r.symbol}</span>
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', flex: 1, textAlign: 'left', paddingLeft: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>↗</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── EMPTY STATE ────────────────────────────────────────────────────────── */

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 32, marginBottom: 16, opacity: 0.4 }}>⊞</div>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 6 }}>No ticker selected</div>
      <div style={{ fontSize: 12.5 }}>Search for a company above to begin valuation analysis.</div>
    </div>
  )
}

/* ─── COMPARABLES TAB ────────────────────────────────────────────────────── */

const METRIC_KEYS: { key: keyof CompanyData; label: string; valuation: boolean; interpretation: string }[] = [
  { key: 'pe',          label: 'P/E',          valuation: true,  interpretation: 'Price / Earnings. Lower = cheaper. Less meaningful for unprofitable or hyper-growth companies where earnings understate value.' },
  { key: 'evEbitda',    label: 'EV/EBITDA',    valuation: true,  interpretation: 'Enterprise Value / Operating Profit. Capital-structure neutral — removes debt distortion. The most broadly applicable valuation multiple.' },
  { key: 'pb',          label: 'P/B',          valuation: true,  interpretation: 'Price / Book Value. Most relevant for asset-heavy sectors (banks, real estate, industrials). Less useful for asset-light software businesses.' },
  { key: 'evRevenue',   label: 'EV/Revenue',   valuation: true,  interpretation: 'Enterprise Value / Revenue. Best for high-growth or pre-profit companies where EBITDA is not yet meaningful. Also useful for SaaS and platform businesses.' },
  { key: 'grossMargin', label: 'Gross Margin', valuation: false, interpretation: 'Revenue minus direct costs (%). Higher = stronger pricing power and competitive moat. A key differentiator between commodity and software businesses.' },
  { key: 'roe',         label: 'ROE',          valuation: false, interpretation: 'Net Income / Shareholders\' Equity. Measures how efficiently a company generates profit from equity capital. High ROE can justify premium multiples.' },
]

// Only these metrics are valid for implied valuation (margin/ROE are not price-based multiples)
const IMPLIED_VALUATION_KEYS = new Set(['pe', 'evEbitda', 'evRevenue'])

function ComparablesSuffix(key: string) {
  return key === 'grossMargin' || key === 'roe' ? '%' : 'x'
}

/* ─── GROWTH-ADJUSTED VERDICT ────────────────────────────────────────────── */

interface VerdictResult {
  verdict: string
  verdictColor: string
  growthAdvantage: number
  marginAdvantage: number
  medianGrowth: number
  medianMargin: number
  avgExcessPremium: number
  signals: { key: string; label: string; premium: number; justifiedPremium: number; excess: number }[]
}

function computeValuationVerdict(
  subject: CompanyData,
  peers: CompanyData[],
  medians: Partial<Record<keyof CompanyData, number | null>>
): VerdictResult | null {
  const peerGrowths = peers.map(p => p.revenueGrowth).filter((v): v is number => v != null)
  const peerMargins = peers.map(p => p.grossMargin).filter((v): v is number => v != null)
  const medianGrowth = median(peerGrowths) ?? 0
  const medianMargin = median(peerMargins) ?? 0
  const growthAdvantage = (subject.revenueGrowth ?? 0) - medianGrowth
  const marginAdvantage = (subject.grossMargin ?? 0) - medianMargin

  // Justified premium rule:
  // Each 1pp of growth advantage justifies ~1.5% multiple premium (PEG-inspired)
  // Each 1pp of margin advantage justifies ~0.5% premium (quality)
  const justifiedPremium = growthAdvantage * 1.5 + Math.max(0, marginAdvantage) * 0.5

  const signals: VerdictResult['signals'] = []
  for (const { key, label } of METRIC_KEYS.filter(m => IMPLIED_VALUATION_KEYS.has(m.key))) {
    const subVal = subject[key as keyof CompanyData] as number | null
    const med = medians[key as keyof CompanyData]
    if (subVal == null || med == null || med === 0) continue
    const premium = ((subVal - med) / med) * 100
    signals.push({ key, label, premium, justifiedPremium, excess: premium - justifiedPremium })
  }

  if (!signals.length) return null

  const avgExcessPremium = signals.reduce((s, x) => s + x.excess, 0) / signals.length

  let verdict: string, verdictColor: string
  if (avgExcessPremium > 25)      { verdict = 'Overvalued';           verdictColor = '#F06070' }
  else if (avgExcessPremium > 10) { verdict = 'Slightly Overvalued';  verdictColor = '#F09060' }
  else if (avgExcessPremium < -25){ verdict = 'Undervalued';          verdictColor = '#3DD68C' }
  else if (avgExcessPremium < -10){ verdict = 'Slightly Undervalued'; verdictColor = '#7DD6AC' }
  else                             { verdict = 'Fairly Valued';        verdictColor = 'var(--gold)' }

  return { verdict, verdictColor, growthAdvantage, marginAdvantage, medianGrowth, medianMargin, avgExcessPremium, signals }
}

function ComparablesTab({ symbol }: { symbol: string }) {
  const router = useRouter()
  const [data, setData] = useState<CompsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortKey, setSortKey] = useState<keyof CompanyData | null>(null)
  const [sortAsc, setSortAsc] = useState(true)
  const [aiExpanded, setAiExpanded] = useState(false)
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    setLoading(true)
    fetch(`/api/ticker/${symbol}/comps`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Failed to load comparables data.'); setLoading(false) })
  }, [symbol])

  if (loading) return <CompsLoading />
  if (error || !data) return (
    <div className="card" style={{ padding: '28px 32px', textAlign: 'center' }}>
      <div style={{ fontSize: 13, color: 'var(--red)' }}>{error || 'No data available.'}</div>
    </div>
  )

  const { subject, peers, aiInsights } = data
  const metricWeights = aiInsights?.metricWeights ?? {}

  // Sort metrics by AI weight score (descending)
  const orderedMetrics = [...METRIC_KEYS].sort((a, b) => {
    const wa = metricWeights[a.key]?.score ?? 5
    const wb = metricWeights[b.key]?.score ?? 5
    return wb - wa
  })

  // Compute medians across peers (not including subject)
  const medians: Partial<Record<keyof CompanyData, number | null>> = {}
  for (const { key } of METRIC_KEYS) {
    const vals = peers.map(p => p[key] as number | null).filter((v): v is number => v != null)
    medians[key] = median(vals)
  }

  // Sort peers for table
  let sortedPeers = [...peers]
  if (sortKey) {
    sortedPeers = sortedPeers.sort((a, b) => {
      const av = a[sortKey] as number | null
      const bv = b[sortKey] as number | null
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return sortAsc ? av - bv : bv - av
    })
  }

  function handleSort(key: keyof CompanyData) {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(true) }
  }

  function cellColor(key: keyof CompanyData, val: number | null, isSubject: boolean): string {
    if (!isSubject || val == null) return 'inherit'
    const med = medians[key]
    if (med == null) return 'inherit'
    const metric = METRIC_KEYS.find(m => m.key === key)
    if (!metric) return 'inherit'
    // valuation multiples: cheaper (lower) = good; profitability: higher = good
    const cheaper = metric.valuation ? val < med : val > med
    return cheaper ? '#3DD68C' : '#F06070'
  }

  // AI insights summary
  const kept = aiInsights?.peerAssessments.filter(p => p.keep).length ?? 0
  const removed = aiInsights?.peerAssessments.filter(p => !p.keep).length ?? 0
  const added = aiInsights?.suggestedAdditions.length ?? 0

  // Distribution strips (top 3 by weight)
  const top3 = orderedMetrics.slice(0, 3)

  // Implied valuation — P/E, EV/EBITDA, EV/Revenue only
  const peerGrowths = peers.map(p => p.revenueGrowth).filter((v): v is number => v != null)
  const peerMargins = peers.map(p => p.grossMargin).filter((v): v is number => v != null)
  const medianGrowth = median(peerGrowths) ?? 0
  const medianMargin = median(peerMargins) ?? 0
  const growthAdvantage = (subject.revenueGrowth ?? 0) - medianGrowth
  const marginAdvantage = (subject.grossMargin ?? 0) - medianMargin
  // Each 1pp growth advantage justifies ~1.5% premium; each 1pp margin advantage ~0.5%
  const justifiedPremiumPct = growthAdvantage * 1.5 + Math.max(0, marginAdvantage) * 0.5

  const impliedPrices: { label: string; implied: number; impliedAdj: number; peerCount: number; weight: number }[] = []
  if (subject.price != null) {
    for (const { key, label } of METRIC_KEYS.filter(m => IMPLIED_VALUATION_KEYS.has(m.key))) {
      const subjectRatio = subject[key as keyof CompanyData] as number | null
      const med = medians[key as keyof CompanyData]
      const weight = metricWeights[key]?.score ?? 5
      if (weight < 6) continue
      if (subjectRatio == null || med == null || subjectRatio === 0) continue
      const peerVals = peers.map(p => p[key as keyof CompanyData] as number | null).filter((v): v is number => v != null)
      if (peerVals.length < 3) continue
      const rawImplied = subject.price! * (med / subjectRatio)
      // Growth-adjusted: peer median uplifted by the justified premium
      const adjMed = (med as number) * (1 + justifiedPremiumPct / 100)
      const adjImplied = subject.price! * (adjMed / subjectRatio)
      impliedPrices.push({ label, implied: rawImplied, impliedAdj: adjImplied, peerCount: peerVals.length, weight })
    }
  }

  // Valuation verdict
  const verdict = computeValuationVerdict(subject, peers, medians)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* AI Transparency Card */}
      {aiInsights && (
        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 11, background: 'rgba(200,169,110,0.12)', color: 'var(--gold)', padding: '2px 8px', borderRadius: 4, fontWeight: 600, letterSpacing: '0.06em' }}>AI PEER REVIEW</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Graham reviewed <strong style={{ color: 'var(--text-primary)' }}>{kept + removed} Finnhub peers</strong> — kept {kept}, removed {removed}{added > 0 ? `, added ${added} suggested` : ''}.
              </div>
              {aiInsights.analystNote && (
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.7, borderLeft: '2px solid var(--border-bright)', paddingLeft: 12 }}>
                  {aiInsights.analystNote}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setAiExpanded(e => !e)}
              style={{ fontSize: 11.5, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif", padding: '4px 8px' }}
            >
              {aiExpanded ? 'Hide ▲' : 'Details ▼'}
            </button>
          </div>

          {aiExpanded && (
            <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {aiInsights.peerAssessments.map(p => (
                <div key={p.symbol} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: p.keep ? 1 : 0.45 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: p.keep ? 'var(--gold)' : 'var(--text-muted)', minWidth: 52 }}>{p.symbol}</span>
                  {p.aiAdded ? (
                    <span style={{ fontSize: 10.5, padding: '1px 7px', borderRadius: 4, fontWeight: 600, background: 'rgba(200,169,110,0.15)', color: 'var(--gold)' }}>AI +</span>
                  ) : (
                    <span style={{
                      fontSize: 10.5, padding: '1px 7px', borderRadius: 4, fontWeight: 600,
                      background: p.score >= 7 ? 'rgba(61,214,140,0.12)' : p.score >= 4 ? 'rgba(200,169,110,0.1)' : 'rgba(240,96,112,0.1)',
                      color: p.score >= 7 ? '#3DD68C' : p.score >= 4 ? 'var(--gold)' : '#F06070',
                    }}>{p.score}/10</span>
                  )}
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.reason}</span>
                  {!p.keep && !p.aiAdded && <span style={{ fontSize: 10, color: '#F06070', marginLeft: 'auto' }}>removed</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Peers Table */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Peer Comparison</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'DM Sans', sans-serif" }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '10px 24px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Company</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleSort('price')}>
                  Price {sortKey === 'price' ? (sortAsc ? '↑' : '↓') : ''}
                </th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleSort('marketCap')}>
                  Mkt Cap {sortKey === 'marketCap' ? (sortAsc ? '↑' : '↓') : ''}
                </th>
                {orderedMetrics.map(({ key, label, interpretation }) => {
                  const w = metricWeights[key]?.score ?? 5
                  const aiReason = metricWeights[key]?.reason
                  const tooltip = aiReason ? `${interpretation}\n\nAI: ${aiReason}` : interpretation
                  return (
                    <th
                      key={key}
                      title={tooltip}
                      style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', opacity: w < 4 ? 0.45 : 1 }}
                      onClick={() => handleSort(key)}
                    >
                      {label} {sortKey === key ? (sortAsc ? '↑' : '↓') : ''}
                      {w >= 8 && <span style={{ fontSize: 9, color: 'var(--gold)', marginLeft: 3 }}>●</span>}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {/* Subject row */}
              <tr style={{ borderBottom: '1px solid var(--border)', borderLeft: '3px solid var(--gold)', background: 'rgba(200,169,110,0.04)' }}>
                <td style={{ padding: '12px 24px 12px 21px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}>{subject.symbol}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>{subject.name}</div>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>${fmt(subject.price)}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmtMarketCap(subject.marketCap)}</td>
                {orderedMetrics.map(({ key }) => {
                  const val = subject[key] as number | null
                  const w = metricWeights[key]?.score ?? 5
                  const color = cellColor(key, val, true)
                  const suffix = ComparablesSuffix(key)
                  return (
                    <td key={key} style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color, fontVariantNumeric: 'tabular-nums', opacity: w < 4 ? 0.45 : 1 }}>
                      {val != null ? `${fmt(val, 1)}${suffix}` : '—'}
                    </td>
                  )
                })}
              </tr>

              {/* Peer rows */}
              {sortedPeers.map(peer => (
                <tr
                  key={peer.symbol}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s' }}
                  onClick={() => router.push(`/protected/ticker/${peer.symbol}`)}
                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-elevated)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
                >
                  <td style={{ padding: '11px 24px' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{peer.symbol}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>{peer.name}</div>
                  </td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontSize: 13, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>${fmt(peer.price)}</td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontSize: 13, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{fmtMarketCap(peer.marketCap)}</td>
                  {orderedMetrics.map(({ key }) => {
                    const val = peer[key] as number | null
                    const w = metricWeights[key]?.score ?? 5
                    return (
                      <td key={key} style={{ padding: '11px 16px', textAlign: 'right', fontSize: 13, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', opacity: w < 4 ? 0.45 : 1 }}>
                        {val != null ? `${fmt(val, 1)}${ComparablesSuffix(key)}` : '—'}
                      </td>
                    )
                  })}
                </tr>
              ))}

              {/* Sector Median row */}
              <tr style={{ background: 'rgba(200,169,110,0.03)', borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 24px' }}>
                  <div style={{ fontSize: 11.5, fontStyle: 'italic', color: 'var(--text-muted)' }}>Sector Median</div>
                </td>
                <td style={{ padding: '10px 16px' }} />
                <td style={{ padding: '10px 16px' }} />
                {orderedMetrics.map(({ key }) => {
                  const med = medians[key]
                  const suffix = ComparablesSuffix(key)
                  return (
                    <td key={key} style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', fontVariantNumeric: 'tabular-nums' }}>
                      {med != null ? `${fmt(med, 1)}${suffix}` : '—'}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
        {aiInsights && (
          <div style={{ padding: '8px 24px 10px', fontSize: 11, color: 'var(--text-muted)' }}>
            ● = high relevance metric for {subject.name} · click column headers to sort · click peers to view their page
          </div>
        )}
      </div>

      {/* Distribution Strips */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20 }}>Multiple Distribution</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {top3.map(({ key, label }) => {
            const allVals = [subject, ...peers].map(c => c[key] as number | null).filter((v): v is number => v != null)
            if (allVals.length < 2) return null
            const min = Math.min(...allVals)
            const max = Math.max(...allVals)
            const range = max - min || 1
            const subVal = subject[key] as number | null
            const subPct = subVal != null ? ((subVal - min) / range) * 100 : null
            const percentile = subVal != null
              ? Math.round((allVals.filter(v => v <= subVal).length / allVals.length) * 100)
              : null
            const dotColor = subPct != null
              ? (subPct <= 33 ? 'var(--gold)' : subPct >= 67 ? '#F06070' : 'var(--text-secondary)')
              : 'var(--text-muted)'
            const suffix = ComparablesSuffix(key)
            const weight = metricWeights[key]?.score ?? 5
            return (
              <div key={key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
                    {weight >= 8 && <span style={{ fontSize: 10, background: 'rgba(200,169,110,0.12)', color: 'var(--gold)', padding: '1px 6px', borderRadius: 3 }}>Key metric</span>}
                  </div>
                  {percentile != null && (
                    <span style={{ fontSize: 11.5, color: dotColor }}>{subject.symbol} at {percentile}th percentile</span>
                  )}
                </div>
                <div style={{ position: 'relative', height: 6, background: 'var(--bg-elevated)', borderRadius: 100 }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(61,214,140,0.3), rgba(240,96,112,0.3))', borderRadius: 100 }} />
                  {subPct != null && (
                    <div style={{
                      position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)',
                      left: `${subPct}%`, width: 12, height: 12, borderRadius: '50%',
                      background: dotColor, border: '2px solid var(--bg-surface)',
                      boxShadow: '0 0 6px rgba(0,0,0,0.4)',
                    }} />
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10.5, color: 'var(--text-muted)' }}>
                  <span>{fmt(min, 1)}{suffix}</span>
                  <span>{fmt(max, 1)}{suffix}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Implied Valuation */}
      {impliedPrices.length >= 1 && subject.price != null && (
        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Implied Valuation</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
            Implied price if {subject.symbol} traded at peer-median multiples
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: impliedPrices.length >= 2 ? 24 : 0 }}>
            {impliedPrices.map(({ label, implied, impliedAdj, peerCount, weight }) => {
              const diff = ((implied - subject.price!) / subject.price!) * 100
              const diffAdj = ((impliedAdj - subject.price!) / subject.price!) * 100
              const up = diff >= 0
              const upAdj = diffAdj >= 0
              const hasGrowthAdj = Math.abs(justifiedPremiumPct) > 2
              return (
                <div key={label} className="card" style={{ padding: '16px 18px', background: 'var(--bg-elevated)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
                    <span style={{ fontSize: 9.5, background: weight >= 8 ? 'rgba(200,169,110,0.12)' : 'var(--bg-surface)', color: weight >= 8 ? 'var(--gold)' : 'var(--text-muted)', padding: '1px 5px', borderRadius: 3 }}>{weight}/10</span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', marginBottom: 2 }}>
                    ${implied.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 12, color: up ? '#3DD68C' : '#F06070', fontWeight: 500, marginBottom: hasGrowthAdj ? 8 : 0 }}>
                    {up ? '▲' : '▼'} {Math.abs(diff).toFixed(1)}% vs current
                  </div>
                  {hasGrowthAdj && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>
                        Growth-adjusted ({justifiedPremiumPct >= 0 ? '+' : ''}{justifiedPremiumPct.toFixed(0)}% justified)
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                        ${impliedAdj.toFixed(2)}{' '}
                        <span style={{ fontSize: 11, color: upAdj ? '#3DD68C' : '#F06070', fontWeight: 500 }}>
                          {upAdj ? '▲' : '▼'} {Math.abs(diffAdj).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )}
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 6 }}>Based on {peerCount} peers</div>
                </div>
              )
            })}
          </div>

          {impliedPrices.length >= 2 && (() => {
            const prices = impliedPrices.map(p => p.implied)
            const minI = Math.min(...prices)
            const maxI = Math.max(...prices)
            const cur = subject.price!
            const rangeMin = Math.min(minI, cur) * 0.95
            const rangeMax = Math.max(maxI, cur) * 1.05
            const span = rangeMax - rangeMin
            const pctMin = ((minI - rangeMin) / span) * 100
            const pctMax = ((maxI - rangeMin) / span) * 100
            const pctCur = ((cur - rangeMin) / span) * 100
            return (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>Implied range vs current price</div>
                <div style={{ position: 'relative', height: 8, background: 'var(--bg-elevated)', borderRadius: 100, margin: '0 8px' }}>
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0, borderRadius: 100,
                    left: `${pctMin}%`, width: `${pctMax - pctMin}%`,
                    background: 'linear-gradient(90deg, rgba(61,214,140,0.35), rgba(61,214,140,0.15))',
                  }} />
                  <div style={{ position: 'absolute', top: -3, bottom: -3, width: 2, left: `${pctCur}%`, background: 'var(--gold)', borderRadius: 1 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                  <span>Implied low ${minI.toFixed(2)}</span>
                  <span style={{ color: 'var(--gold)' }}>Current ${cur.toFixed(2)}</span>
                  <span>Implied high ${maxI.toFixed(2)}</span>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Valuation Assessment */}
      {verdict && (
        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Valuation Assessment</div>
            <span style={{
              fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 5,
              background: `${verdict.verdictColor}18`,
              color: verdict.verdictColor,
              letterSpacing: '0.04em',
            }}>{verdict.verdict}</span>
          </div>

          {/* Growth & margin context */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 4 }}>Revenue Growth vs Peers</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: verdict.growthAdvantage >= 0 ? '#3DD68C' : '#F06070', fontVariantNumeric: 'tabular-nums' }}>
                {verdict.growthAdvantage >= 0 ? '+' : ''}{verdict.growthAdvantage.toFixed(1)}pp
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {subject.symbol} {fmt(subject.revenueGrowth, 1)}% vs peer median {fmt(verdict.medianGrowth, 1)}%
              </div>
            </div>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 4 }}>Gross Margin vs Peers</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: verdict.marginAdvantage >= 0 ? '#3DD68C' : '#F06070', fontVariantNumeric: 'tabular-nums' }}>
                {verdict.marginAdvantage >= 0 ? '+' : ''}{verdict.marginAdvantage.toFixed(1)}pp
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {subject.symbol} {fmt(subject.grossMargin, 1)}% vs peer median {fmt(verdict.medianMargin, 1)}%
              </div>
            </div>
          </div>

          {/* Per-metric breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {verdict.signals.map(sig => {
              const isPremium = sig.premium > 0
              const isJustified = Math.abs(sig.excess) <= 15
              return (
                <div key={sig.key} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12.5 }}>
                  <span style={{ minWidth: 72, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{sig.label}</span>
                  <span style={{ color: isPremium ? '#F06070' : '#3DD68C', fontWeight: 500, minWidth: 60, fontVariantNumeric: 'tabular-nums' }}>
                    {isPremium ? '+' : ''}{sig.premium.toFixed(0)}% vs peers
                  </span>
                  <span style={{
                    fontSize: 10.5, padding: '1px 7px', borderRadius: 4, fontWeight: 500,
                    background: isJustified ? 'rgba(61,214,140,0.1)' : 'rgba(240,96,112,0.1)',
                    color: isJustified ? '#3DD68C' : '#F06070',
                  }}>
                    {isJustified ? 'justified' : sig.excess > 0 ? 'excess premium' : 'discount'}
                  </span>
                  {sig.justifiedPremium !== 0 && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {sig.justifiedPremium >= 0 ? '+' : ''}{sig.justifiedPremium.toFixed(0)}% justified by growth/margins
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {verdict.signals.length > 0 && (
            <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              {verdict.avgExcessPremium > 10
                ? `${subject.symbol} trades at a premium to peers that exceeds what its growth and margin profile can justify. The excess premium of ~${verdict.avgExcessPremium.toFixed(0)}pp suggests the market is pricing in above-consensus expectations.`
                : verdict.avgExcessPremium < -10
                ? `${subject.symbol} appears to trade at a discount to peers despite its fundamental profile. This may signal an entry opportunity or reflect market concerns not captured in trailing metrics.`
                : `${subject.symbol}'s valuation appears broadly in line with peers once its growth and margin profile is accounted for. The premium/discount is within the range that fundamentals can reasonably justify.`}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── COMPS LOADING ──────────────────────────────────────────────────────── */

function CompsLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="card" style={{ padding: '20px 24px' }}>
        <Skeleton w={260} h={14} />
        <div style={{ marginTop: 10 }}><Skeleton w="80%" h={12} /></div>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid var(--border)' }}><Skeleton w={120} h={11} /></div>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 24, padding: '14px 24px', borderBottom: '1px solid var(--border)' }}>
            <Skeleton w={100} h={14} />
            <Skeleton w={60} h={14} />
            <Skeleton w={70} h={14} />
            <Skeleton w={50} h={14} />
            <Skeleton w={60} h={14} />
            <Skeleton w={50} h={14} />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── MAIN PAGE ──────────────────────────────────────────────────────────── */

type CompanyProfile = { name: string; logo: string | null; sector: string | null; marketCap: number | null; price: number | null; revenueGrowth: number | null }

function ValuationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [symbol, setSymbol] = useState(searchParams.get('symbol')?.toUpperCase() ?? '')
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [activeTab, setActiveTab] = useState<'dcf' | 'comparables'>(
    searchParams.get('tab') === 'comparables' ? 'comparables' : 'dcf'
  )
  const [compsKey, setCompsKey] = useState(0) // increment to re-mount comps on symbol change

  useEffect(() => {
    if (!symbol) { setProfile(null); return }
    setProfile(null)
    fetch(`/api/ticker/${symbol}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        setProfile({
          name: d.name ?? symbol,
          logo: d.logo ?? null,
          sector: d.sector ?? null,
          marketCap: d.marketCap ?? null,
          price: d.price ?? null,
          revenueGrowth: d.revenueGrowthYoy ?? null,
        })
      })
      .catch(() => {})
  }, [symbol])

  const handleSelect = useCallback((sym: string, _name: string) => {
    const upper = sym.toUpperCase()
    setSymbol(upper)
    setCompsKey(k => k + 1)
    router.push(`/protected/valuation?symbol=${upper}&tab=${activeTab}`, { scroll: false })
  }, [activeTab, router])

  function switchTab(nextTab: 'dcf' | 'comparables') {
    setActiveTab(nextTab)
    const query = symbol
      ? `/protected/valuation?symbol=${symbol}&tab=${nextTab}`
      : `/protected/valuation?tab=${nextTab}`
    router.push(query, { scroll: false })
  }

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--gold-dim)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Valuation</div>
        <h1 className="font-display text-gold-gradient" style={{ fontSize: 42, fontWeight: 500, lineHeight: 1.05, marginBottom: 8 }}>Valuation</h1>
        <div style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.65 }}>DCF and comparable company analysis</div>
      </div>

      {/* Ticker search */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Select Company</div>
        <TickerSearch value={symbol} onSelect={handleSelect} />
        {symbol && (
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10 }}>
            {profile?.logo ? (
              <img src={profile.logo} alt={profile.name} style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 6, background: '#fff', padding: 3, flexShrink: 0 }} onError={e => { e.currentTarget.style.display = 'none' }} />
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: 6, background: 'rgba(200,169,110,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--gold)', flexShrink: 0 }}>
                {symbol[0]}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{profile?.name ?? symbol}</span>
                <span style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600, letterSpacing: '0.04em' }}>{symbol}</span>
              </div>
              {profile?.sector && (
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{profile.sector}</div>
              )}
            </div>
            {profile && (
              <div style={{ display: 'flex', gap: 24, flexShrink: 0 }}>
                {profile.price != null && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Price</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>${profile.price.toFixed(2)}</div>
                  </div>
                )}
                {profile.marketCap != null && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Mkt Cap</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                      {profile.marketCap >= 1000 ? `$${(profile.marketCap / 1000).toFixed(1)}T` : `$${profile.marketCap.toFixed(0)}B`}
                    </div>
                  </div>
                )}
                {profile.revenueGrowth != null && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Rev Growth</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: profile.revenueGrowth >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 2 }}>
                      {profile.revenueGrowth >= 0 ? '+' : ''}{profile.revenueGrowth.toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>
            )}
            {!profile && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tab-bar" style={{ marginBottom: 28 }}>
        <button className={`tab${activeTab === 'dcf' ? ' active' : ''}`} onClick={() => switchTab('dcf')}>
          DCF Valuation
        </button>
        <button className={`tab${activeTab === 'comparables' ? ' active' : ''}`} onClick={() => switchTab('comparables')}>
          Comparables
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'dcf' && (
        symbol ? (
          <DCFTab symbol={symbol} currentPrice={profile?.price ?? null} />
        ) : <EmptyState />
      )}

      {activeTab === 'comparables' && (
        symbol ? (
          <ComparablesTab key={`${symbol}-${compsKey}`} symbol={symbol} />
        ) : <EmptyState />
      )}
    </div>
  )
}

export default function ValuationPage() {
  return (
    <Suspense>
      <ValuationContent />
    </Suspense>
  )
}
