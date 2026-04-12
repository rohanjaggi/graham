'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { ScreenerRow, ScreenerFilters } from '@/app/api/screener/route'

// â”€â”€â”€ Ticker redirect helpers (preserved from original) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DEFAULT_SYMBOL = 'AAPL'
const TICKER_PATTERN = /^[A-Z][A-Z0-9.-]{0,9}$/
type SearchResult = { symbol: string; description: string }

async function tickerExists(symbol: string): Promise<boolean> {
  try { return (await fetch(`/api/ticker/${encodeURIComponent(symbol)}`)).ok } catch { return false }
}

async function resolveSymbol(raw: string): Promise<string> {
  const trimmed = raw.trim()
  if (!trimmed) return DEFAULT_SYMBOL
  const upper = trimmed.toUpperCase()
  const ranked: SearchResult[] = await fetch(`/api/ticker/search?q=${encodeURIComponent(trimmed)}`)
    .then(r => r.ok ? r.json() : []).then(d => Array.isArray(d) ? d : []).catch(() => [])
  const normalized = ranked.filter((x): x is SearchResult =>
    typeof x?.symbol === 'string' && typeof x?.description === 'string')
  const exact = normalized.find(x => x.symbol.toUpperCase() === upper)
  if (exact) return exact.symbol.toUpperCase()
  if (TICKER_PATTERN.test(upper) && await tickerExists(upper)) return upper
  return normalized[0]?.symbol?.toUpperCase() ?? DEFAULT_SYMBOL
}

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type UIFilters = {
  peMax: number | null
  pbMax: number | null
  roeMin: number | null
  roicMin: number | null
  grossMarginMin: number | null
  operatingMarginMin: number | null
  netMarginMin: number | null
  debtEquityMax: number | null
  currentRatioMin: number | null
  revenueGrowthMin: number | null
  epsGrowthMin: number | null
  dividendYieldMin: number | null
  marketCapMinB: number | null
  ytdReturnMin: number | null
  pctFrom52wHighMax: number | null
  pctFrom52wLowMin: number | null
  betaMax: number | null
  sharesDeclineYoy: boolean
  sector: string
}

type SavedPreset = { id: string; name: string; filters: UIFilters }

const EMPTY_FILTERS: UIFilters = {
  peMax: null, pbMax: null,
  roeMin: null, roicMin: null,
  grossMarginMin: null, operatingMarginMin: null, netMarginMin: null,
  debtEquityMax: null, currentRatioMin: null,
  revenueGrowthMin: null, epsGrowthMin: null,
  dividendYieldMin: null, marketCapMinB: null,
  ytdReturnMin: null, pctFrom52wHighMax: null, pctFrom52wLowMin: null,
  betaMax: null, sharesDeclineYoy: false, sector: '',
}

const BUILTIN_PRESETS: Record<string, Partial<UIFilters>> = {
  'Buffett Classic':    { roeMin: 15, grossMarginMin: 40, debtEquityMax: 0.5, peMax: 25 },
  'Dividend Kings':     { dividendYieldMin: 2, debtEquityMax: 1, roeMin: 12 },
  'Quality Compounder': { roeMin: 20, grossMarginMin: 50, revenueGrowthMin: 10 },
  'Near 52-wk Low':    { pctFrom52wHighMax: -30 },
  'Buyback Champions': { sharesDeclineYoy: true, roeMin: 12, debtEquityMax: 1 },
}

const SECTORS = [
  '', 'Technology', 'Healthcare', 'Consumer Defensive', 'Financial Services',
  'Industrials', 'Energy', 'Basic Materials', 'Communication Services',
  'Utilities', 'Real Estate', 'Consumer Cyclical',
]

// â”€â”€â”€ Color helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type ColorMetric = 'roe' | 'roic' | 'grossMargin' | 'netMargin' | 'operatingMargin' |
  'debtEquity' | 'revenueGrowth' | 'epsGrowth' | 'pe' | 'ytdReturn' | 'sharesChangeYoy'

function metricColor(key: ColorMetric, value: number | null): string {
  if (value == null) return 'var(--text-muted)'
  switch (key) {
    case 'roe':
    case 'roic':            return value >= 15 ? 'var(--green)' : value >= 8 ? 'var(--text-primary)' : 'var(--red)'
    case 'grossMargin':     return value >= 40 ? 'var(--green)' : value >= 20 ? 'var(--text-primary)' : 'var(--red)'
    case 'netMargin':
    case 'operatingMargin': return value >= 10 ? 'var(--green)' : value >= 0 ? 'var(--text-primary)' : 'var(--red)'
    case 'debtEquity':      return value <= 0.5 ? 'var(--green)' : value <= 1.5 ? 'var(--text-primary)' : 'var(--red)'
    case 'revenueGrowth':
    case 'epsGrowth':       return value >= 10 ? 'var(--green)' : value >= 0 ? 'var(--text-primary)' : 'var(--red)'
    case 'pe':              return value <= 15 ? 'var(--green)' : value <= 25 ? 'var(--text-primary)' : 'var(--red)'
    case 'ytdReturn':       return value >= 0 ? 'var(--green)' : 'var(--red)'
    case 'sharesChangeYoy': return value <= 0 ? 'var(--green)' : value <= 3 ? 'var(--text-primary)' : 'var(--red)'
    default: return 'var(--text-primary)'
  }
}

// â”€â”€â”€ Format helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function fmtPrice(v: number | null) {
  if (v == null) return '--'
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtCap(v: number | null) {
  if (v == null) return '--'
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`
  return `$${(v / 1e6).toFixed(0)}M`
}
function fmtNum(v: number | null, d = 1) { return v == null ? '--' : v.toFixed(d) }
function fmtPct(v: number | null, d = 1) { return v == null ? '--' : `${v.toFixed(d)}%` }

// â”€â”€â”€ Filter input â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function FilterInput({ label, value, onChange, placeholder, width = 110 }: {
  label: string; value: number | null; onChange: (v: number | null) => void
  placeholder: string; width?: number
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>
        {label}
      </label>
      <input className="input-dark" type="number" placeholder={placeholder} value={value ?? ''}
        onChange={e => { const v = e.target.value; onChange(v === '' ? null : parseFloat(v)) }}
        style={{ width }} />
    </div>
  )
}

// â”€â”€â”€ Column definitions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type Col = {
  key: keyof ScreenerRow; label: string; align: 'left' | 'right'
  fmt: (r: ScreenerRow) => string; color?: (r: ScreenerRow) => string
}

const COLUMNS: Col[] = [
  { key: 'symbol',        label: 'Ticker',     align: 'left',  fmt: r => r.symbol },
  { key: 'name',          label: 'Company',    align: 'left',  fmt: r => r.name },
  { key: 'sector',        label: 'Sector',     align: 'left',  fmt: r => r.sector },
  { key: 'price',         label: 'Price',      align: 'right', fmt: r => fmtPrice(r.price) },
  { key: 'marketCap',     label: 'Mkt Cap',    align: 'right', fmt: r => fmtCap(r.marketCap) },
  { key: 'pe',            label: 'P/E',        align: 'right', fmt: r => fmtNum(r.pe),
    color: r => metricColor('pe', r.pe) },
  { key: 'pb',            label: 'P/B',        align: 'right', fmt: r => fmtNum(r.pb, 2) },
  { key: 'roe',           label: 'ROE %',      align: 'right', fmt: r => fmtPct(r.roe),
    color: r => metricColor('roe', r.roe) },
  { key: 'roic',          label: 'ROIC %',     align: 'right', fmt: r => fmtPct(r.roic),
    color: r => metricColor('roic', r.roic) },
  { key: 'grossMargin',   label: 'Gross Mgn',  align: 'right', fmt: r => fmtPct(r.grossMargin),
    color: r => metricColor('grossMargin', r.grossMargin) },
  { key: 'debtEquity',    label: 'D/E',        align: 'right', fmt: r => fmtNum(r.debtEquity, 2),
    color: r => metricColor('debtEquity', r.debtEquity) },
  { key: 'revenueGrowth', label: 'Rev Grw',    align: 'right', fmt: r => fmtPct(r.revenueGrowth),
    color: r => metricColor('revenueGrowth', r.revenueGrowth) },
  { key: 'dividendYield', label: 'Yield',      align: 'right', fmt: r => fmtPct(r.dividendYield, 2) },
  { key: 'ytdReturn',     label: 'YTD',        align: 'right', fmt: r => fmtPct(r.ytdReturn),
    color: r => metricColor('ytdReturn', r.ytdReturn) },
  { key: 'sharesChangeYoy', label: 'Shr Chg YoY', align: 'right', fmt: r => fmtPct(r.sharesChangeYoy),
    color: r => metricColor('sharesChangeYoy', r.sharesChangeYoy) },
]

// â”€â”€â”€ Skeleton row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SkeletonRow() {
  return (
    <tr>
      {COLUMNS.map(col => (
        <td key={col.key} style={{ padding: '11px 12px' }}>
          <div style={{
            height: 13, borderRadius: 4,
            width: col.key === 'name' ? 140 : col.key === 'symbol' ? 48 : 60,
            background: 'linear-gradient(90deg, var(--bg-elevated) 25%, var(--bg-hover) 50%, var(--bg-elevated) 75%)',
            backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
          }} />
        </td>
      ))}
    </tr>
  )
}

// â”€â”€â”€ Main page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ScreenerPageFallback() {
  return (
    <div style={{ padding: '36px 32px', color: 'var(--text-muted)', fontSize: 13 }}>
      Loading screener...
    </div>
  )
}

export default function ScreenerPage() {
  return (
    <Suspense fallback={<ScreenerPageFallback />}>
      <ScreenerPageContent />
    </Suspense>
  )
}

function ScreenerPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawTicker = searchParams.get('ticker')?.trim() ?? ''

  const [rows, setRows] = useState<ScreenerRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<UIFilters>(EMPTY_FILTERS)
  const [filterTab, setFilterTab] = useState<'fundamental' | 'technical'>('fundamental')
  const [sortKey, setSortKey] = useState<keyof ScreenerRow>('marketCap')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>([])
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [savePresetName, setSavePresetName] = useState('')
  const [savingPreset, setSavingPreset] = useState(false)
  const saveInputRef = useRef<HTMLInputElement>(null)

  // Redirect branch â€” preserved behaviour
  useEffect(() => {
    if (!rawTicker) return
    let cancelled = false
    void resolveSymbol(rawTicker).then(symbol => {
      if (!cancelled) router.replace(`/protected/ticker/${encodeURIComponent(symbol)}`)
    })
    return () => { cancelled = true }
  }, [router, rawTicker])

  // Load saved presets
  useEffect(() => {
    if (rawTicker) return
    fetch('/api/screener/presets')
      .then(r => r.ok ? r.json() : { presets: [] })
      .then((d: { presets?: SavedPreset[] }) => setSavedPresets(Array.isArray(d.presets) ? d.presets : []))
      .catch(() => {})
  }, [rawTicker])

  function setFilter<K extends keyof UIFilters>(key: K, value: UIFilters[K]) {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  function toApiFilters(f: UIFilters, offset = 0): ScreenerFilters {
    const out: ScreenerFilters = { offset }
    if (f.peMax != null) out.peMax = f.peMax
    if (f.pbMax != null) out.pbMax = f.pbMax
    if (f.roeMin != null) out.roeMin = f.roeMin
    if (f.roicMin != null) out.roicMin = f.roicMin
    if (f.grossMarginMin != null) out.grossMarginMin = f.grossMarginMin
    if (f.operatingMarginMin != null) out.operatingMarginMin = f.operatingMarginMin
    if (f.netMarginMin != null) out.netMarginMin = f.netMarginMin
    if (f.debtEquityMax != null) out.debtEquityMax = f.debtEquityMax
    if (f.currentRatioMin != null) out.currentRatioMin = f.currentRatioMin
    if (f.revenueGrowthMin != null) out.revenueGrowthMin = f.revenueGrowthMin
    if (f.epsGrowthMin != null) out.epsGrowthMin = f.epsGrowthMin
    if (f.dividendYieldMin != null) out.dividendYieldMin = f.dividendYieldMin
    if (f.marketCapMinB != null) out.marketCapMinB = f.marketCapMinB
    if (f.ytdReturnMin != null) out.ytdReturnMin = f.ytdReturnMin
    if (f.pctFrom52wHighMax != null) out.pctFrom52wHighMax = f.pctFrom52wHighMax
    if (f.pctFrom52wLowMin != null) out.pctFrom52wLowMin = f.pctFrom52wLowMin
    if (f.betaMax != null) out.betaMax = f.betaMax
    if (f.sharesDeclineYoy) out.sharesDeclineYoy = true
    if (f.sector) out.sector = f.sector
    return out
  }

  async function runScreener(f: UIFilters = filters, offset = 0, append = false) {
    if (offset === 0) { setLoading(true); setError(null) } else setLoadingMore(true)
    try {
      const res = await fetch('/api/screener', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toApiFilters(f, offset)),
      })
      const data = await res.json() as { rows?: ScreenerRow[]; total?: number; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Screener request failed')
      const newRows = Array.isArray(data.rows) ? data.rows : []
      setRows(prev => append ? [...prev, ...newRows] : newRows)
      setTotal(data.total ?? newRows.length)
      setHasSearched(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load results')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  function applyPreset(partial: Partial<UIFilters>) {
    const merged = { ...EMPTY_FILTERS, ...partial }
    setFilters(merged)
    void runScreener(merged, 0)
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS)
    setRows([])
    setTotal(0)
    setHasSearched(false)
    setError(null)
  }

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'string' && typeof bv === 'string')
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
  }, [rows, sortKey, sortDir])

  function handleSort(key: keyof ScreenerRow) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  async function handleSavePreset() {
    if (!savePresetName.trim()) return
    setSavingPreset(true)
    try {
      const res = await fetch('/api/screener/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: savePresetName.trim(), filters }),
      })
      const data = await res.json() as { preset?: SavedPreset }
      if (data.preset) {
        setSavedPresets(prev => [data.preset!, ...prev])
        setSavePresetName('')
        setShowSaveInput(false)
      }
    } catch { /* ignore */ }
    setSavingPreset(false)
  }

  async function handleDeletePreset(id: string) {
    await fetch(`/api/screener/presets/${id}`, { method: 'DELETE' }).catch(() => {})
    setSavedPresets(prev => prev.filter(p => p.id !== id))
  }

  if (rawTicker) return null

  const labelStyle: React.CSSProperties = {
    fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.09em',
    textTransform: 'uppercase', paddingTop: 22, minWidth: 72,
  }
  const dividerStyle: React.CSSProperties = { height: 1, background: 'var(--border)' }

  return (
    <>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}to{background-position:-200% 0}}`}</style>

      <div className="animate-fade-up d1" style={{ padding: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Header */}
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--gold-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Screener</div>
          <h1 className="font-display text-gold-gradient" style={{ margin: '6px 0 0', fontSize: 42, fontWeight: 500, lineHeight: 1.05 }}>Stock Screener</h1>
          <p style={{ margin: '10px 0 0', color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.65, maxWidth: 860 }}>
            Warren Buffett-style quality filters across US-listed equities.
          </p>
        </div>

        {/* Preset bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.09em', textTransform: 'uppercase', marginRight: 2 }}>Presets</span>

          {Object.entries(BUILTIN_PRESETS).map(([name, partial]) => (
            <button key={name} type="button" className="btn-ghost"
              onClick={() => applyPreset(partial)}
              style={{ fontSize: 12, padding: '5px 12px' }}>
              {name}
            </button>
          ))}

          {savedPresets.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center' }}>
              <button type="button" className="btn-ghost"
                onClick={() => applyPreset(p.filters)}
                style={{ fontSize: 12, padding: '5px 10px', color: 'var(--gold)' }}>
                {p.name}
              </button>
              <button type="button"
                onClick={() => void handleDeletePreset(p.id)}
                style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}
                title="Delete preset">x</button>
            </div>
          ))}

          {showSaveInput ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input ref={saveInputRef} className="input-dark" placeholder="Preset name..."
                value={savePresetName}
                onChange={e => setSavePresetName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') void handleSavePreset()
                  if (e.key === 'Escape') { setShowSaveInput(false); setSavePresetName('') }
                }}
                style={{ width: 150 }} autoFocus />
              <button type="button" className="btn-ghost"
                onClick={() => void handleSavePreset()}
                disabled={savingPreset || !savePresetName.trim()}
                style={{ fontSize: 12, padding: '5px 12px' }}>
                {savingPreset ? '...' : 'Save'}
              </button>
              <button type="button"
                onClick={() => { setShowSaveInput(false); setSavePresetName('') }}
                style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button"
              onClick={() => setShowSaveInput(true)}
              style={{ fontSize: 11.5, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', fontFamily: "'DM Sans', sans-serif" }}>
              + Save preset
            </button>
          )}

          <button type="button" className="btn-ghost"
            onClick={clearFilters}
            style={{ fontSize: 12, padding: '5px 12px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
            Clear
          </button>
        </div>

        {/* Filter card */}
        <div className="card" style={{ padding: '18px 22px' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
            {(['fundamental', 'technical'] as const).map(tab => (
              <button key={tab} type="button"
                onClick={() => setFilterTab(tab)}
                style={{
                  fontSize: 13, fontWeight: filterTab === tab ? 600 : 400,
                  color: filterTab === tab ? 'var(--gold)' : 'var(--text-muted)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '0 0 10px', marginRight: 24,
                  borderBottom: filterTab === tab ? '2px solid var(--gold)' : '2px solid transparent',
                  fontFamily: "'DM Sans', sans-serif", textTransform: 'capitalize',
                  transition: 'color 0.15s',
                }}>
                {tab}
              </button>
            ))}
          </div>

          {filterTab === 'fundamental' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <span style={labelStyle}>Valuation</span>
                <FilterInput label="P/E Max" value={filters.peMax} onChange={v => setFilter('peMax', v)} placeholder="e.g. 25" />
                <FilterInput label="P/B Max" value={filters.pbMax} onChange={v => setFilter('pbMax', v)} placeholder="e.g. 3" />
              </div>
              <div style={dividerStyle} />
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <span style={labelStyle}>Quality</span>
                <FilterInput label="ROE Min %" value={filters.roeMin} onChange={v => setFilter('roeMin', v)} placeholder="e.g. 15" />
                <FilterInput label="ROIC Min %" value={filters.roicMin} onChange={v => setFilter('roicMin', v)} placeholder="e.g. 12" />
                <FilterInput label="Gross Margin Min %" value={filters.grossMarginMin} onChange={v => setFilter('grossMarginMin', v)} placeholder="e.g. 40" width={135} />
                <FilterInput label="Op. Margin Min %" value={filters.operatingMarginMin} onChange={v => setFilter('operatingMarginMin', v)} placeholder="e.g. 15" width={130} />
                <FilterInput label="Net Margin Min %" value={filters.netMarginMin} onChange={v => setFilter('netMarginMin', v)} placeholder="e.g. 10" width={130} />
              </div>
              <div style={dividerStyle} />
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <span style={labelStyle}>Balance</span>
                <FilterInput label="D/E Max" value={filters.debtEquityMax} onChange={v => setFilter('debtEquityMax', v)} placeholder="e.g. 0.5" />
                <FilterInput label="Current Ratio Min" value={filters.currentRatioMin} onChange={v => setFilter('currentRatioMin', v)} placeholder="e.g. 1.5" width={130} />
              </div>
              <div style={dividerStyle} />
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <span style={labelStyle}>Growth</span>
                <FilterInput label="Rev Growth Min %" value={filters.revenueGrowthMin} onChange={v => setFilter('revenueGrowthMin', v)} placeholder="e.g. 5" />
                <FilterInput label="EPS Growth Min %" value={filters.epsGrowthMin} onChange={v => setFilter('epsGrowthMin', v)} placeholder="e.g. 8" />
              </div>
              <div style={dividerStyle} />
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <span style={labelStyle}>Income</span>
                <FilterInput label="Dividend Yield Min %" value={filters.dividendYieldMin} onChange={v => setFilter('dividendYieldMin', v)} placeholder="e.g. 2" width={140} />
                <FilterInput label="Mkt Cap Min ($B)" value={filters.marketCapMinB} onChange={v => setFilter('marketCapMinB', v)} placeholder="e.g. 1" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>Sector</label>
                  <select value={filters.sector} onChange={e => setFilter('sector', e.target.value)}
                    className="input-dark" style={{ width: 190 }}>
                    {SECTORS.map(s => <option key={s} value={s}>{s === '' ? 'All sectors' : s}</option>)}
                  </select>
                </div>
              </div>
              <div style={dividerStyle} />
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ ...labelStyle, paddingTop: 0 }}>Capital</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={filters.sharesDeclineYoy}
                    onChange={e => setFilter('sharesDeclineYoy', e.target.checked)}
                    style={{ accentColor: 'var(--gold)', width: 14, height: 14 }} />
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    Shares outstanding declining YoY
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(buyback signal)</span>
                </label>
              </div>
            </div>
          )}

          {filterTab === 'technical' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <span style={labelStyle}>Performance</span>
                <FilterInput label="YTD Return Min %" value={filters.ytdReturnMin} onChange={v => setFilter('ytdReturnMin', v)} placeholder="e.g. 10" />
              </div>
              <div style={dividerStyle} />
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <span style={labelStyle}>52-wk Range</span>
                <FilterInput label="Max % below 52-wk High" value={filters.pctFrom52wHighMax} onChange={v => setFilter('pctFrom52wHighMax', v)} placeholder="e.g. -30" width={150} />
                <FilterInput label="Min % above 52-wk Low" value={filters.pctFrom52wLowMin} onChange={v => setFilter('pctFrom52wLowMin', v)} placeholder="e.g. 5" width={150} />
              </div>
              <div style={dividerStyle} />
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <span style={labelStyle}>Risk</span>
                <FilterInput label="Beta Max" value={filters.betaMax} onChange={v => setFilter('betaMax', v)} placeholder="e.g. 1.2" />
              </div>
            </div>
          )}
        </div>

        {/* Screen button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-gold"
            onClick={() => void runScreener(filters, 0)}
            disabled={loading}
            style={{ minWidth: 130, fontSize: 14 }}>
            {loading ? 'Screening...' : 'Run screen'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 13, color: 'var(--red)' }}>
            {error}
          </div>
        )}

        {/* Result count */}
        {hasSearched && !error && (
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
            Showing{' '}
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{rows.length}</span>
            {total > rows.length && (
              <> of <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{total.toLocaleString()}</span></>
            )}
            {' '}stock{rows.length !== 1 ? 's' : ''}
          </div>
        )}

        {/* Table */}
        {(loading || (hasSearched && !error)) && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {COLUMNS.map(col => (
                      <th key={col.key}
                        onClick={() => !loading && handleSort(col.key)}
                        style={{
                          padding: '10px 12px', textAlign: col.align,
                          color: sortKey === col.key ? 'var(--gold)' : 'var(--text-muted)',
                          fontSize: 10.5, fontWeight: 600, letterSpacing: '0.07em',
                          textTransform: 'uppercase', cursor: loading ? 'default' : 'pointer',
                          userSelect: 'none', whiteSpace: 'nowrap',
                        }}>
                        {col.label}
                        {sortKey === col.key && !loading && (
                          <span style={{ marginLeft: 3, opacity: 0.7 }}>
                            {sortDir === 'desc' ? '↓' : '↑'}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 12 }).map((_, i) => <SkeletonRow key={i} />)
                    : sorted.map(row => (
                      <tr key={row.symbol}
                        onClick={() => router.push(`/protected/ticker/${encodeURIComponent(row.symbol)}`)}
                        style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-elevated)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}>
                        {COLUMNS.map(col => (
                          <td key={col.key} style={{
                            padding: '10px 12px', textAlign: col.align,
                            color: col.color
                              ? col.color(row)
                              : col.key === 'symbol' ? 'var(--gold)' : 'var(--text-secondary)',
                            fontWeight: col.key === 'symbol' ? 600 : 400,
                            letterSpacing: col.key === 'symbol' ? '0.03em' : undefined,
                            whiteSpace: col.key === 'name' ? 'nowrap' : undefined,
                            maxWidth: col.key === 'name' ? 200 : col.key === 'sector' ? 150 : undefined,
                            overflow: (col.key === 'name' || col.key === 'sector') ? 'hidden' : undefined,
                            textOverflow: (col.key === 'name' || col.key === 'sector') ? 'ellipsis' : undefined,
                          }}>
                            {col.fmt(row)}
                          </td>
                        ))}
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !hasSearched && !error && (
          <div style={{ textAlign: 'center', padding: '64px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 36, marginBottom: 16, opacity: 0.35 }}>⌕</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Apply filters and click Screen
            </div>
            <div style={{ fontSize: 12.5 }}>
              Searches across all US-listed equities on NYSE &amp; NASDAQ
            </div>
          </div>
        )}

        {/* No results */}
        {!loading && hasSearched && !error && rows.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
            No stocks match your filters. Try relaxing one or more criteria.
          </div>
        )}

        {/* Load more */}
        {!loading && hasSearched && rows.length > 0 && rows.length < total && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button type="button" className="btn-ghost"
              onClick={() => void runScreener(filters, rows.length, true)}
              disabled={loadingMore}
              style={{ fontSize: 13, minWidth: 180 }}>
              {loadingMore ? 'Loading...' : `Load more (${(total - rows.length).toLocaleString()} remaining)`}
            </button>
          </div>
        )}

      </div>
    </>
  )
}

