'use client'

import { useEffect, useRef, useState } from 'react'
import type { SearchResult } from './valuation-types'

export function fmt(n: number | null, decimals = 2, suffix = ''): string {
  if (n == null) return '—'
  return n.toFixed(decimals) + suffix
}

export function fmtMarketCap(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}T`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}B`
  return `$${n.toFixed(0)}M`
}

export function median(vals: number[]): number | null {
  const sorted = [...vals].sort((a, b) => a - b)
  if (!sorted.length) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/* ─── SKELETON ───────────────────────────────────────────────────────────── */

export function Skeleton({ w = '100%', h = 14 }: { w?: string | number; h?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 5,
      background: 'linear-gradient(90deg, var(--bg-elevated) 25%, var(--bg-hover) 50%, var(--bg-elevated) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

function formatRecentSearchLabel(updatedAt?: string): string {
  if (!updatedAt) return 'Recent'
  const updated = new Date(updatedAt).getTime()
  if (Number.isNaN(updated)) return 'Recent'

  const diffMinutes = Math.max(0, Math.round((Date.now() - updated) / 60000))
  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  return new Date(updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/* ─── TICKER SEARCH ──────────────────────────────────────────────────────── */

export function TickerSearch({ value, onSelect }: { value: string; onSelect: (sym: string, name: string) => void }) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [recentSearches, setRecentSearches] = useState<SearchResult[]>([])
  const [loadingRecentSearches, setLoadingRecentSearches] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    async function loadRecentSearches() {
      setLoadingRecentSearches(true)
      try {
        const res = await fetch('/api/profile/recent-searches?scope=valuation', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled || !Array.isArray(data?.searches)) return
        setRecentSearches(
          data.searches
            .filter((item: SearchResult) => typeof item?.symbol === 'string' && typeof item?.description === 'string')
            .slice(0, 8)
        )
      } catch {
        // ignore profile metadata fetch issues
      } finally {
        if (!cancelled) setLoadingRecentSearches(false)
      }
    }

    loadRecentSearches()
    return () => {
      cancelled = true
    }
  }, [])

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

  async function persistRecentSearch(symbol: string, description: string) {
    const normalizedSymbol = symbol.toUpperCase()
    const nextItem: SearchResult = {
      symbol: normalizedSymbol,
      description,
      updatedAt: new Date().toISOString(),
    }
    const next = [
      nextItem,
      ...recentSearches.filter((item) => item.symbol !== normalizedSymbol),
    ].slice(0, 8)
    setRecentSearches(next)
    try {
      await fetch('/api/profile/recent-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: normalizedSymbol,
          description,
          scope: 'valuation',
        }),
      })
    } catch {
      // ignore profile metadata save issues
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!val.trim()) {
      setResults([])
      setOpen(recentSearches.length > 0)
      setSearching(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/ticker/search?q=${encodeURIComponent(val)}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data)
          setOpen(data.length > 0)
        }
      } catch {
        // ignore
      }
      setSearching(false)
    }, 300)
  }

  const visibleResults = query.trim() ? results : recentSearches

  return (
    <div ref={wrapRef} style={{ position: 'relative', maxWidth: 400 }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: searching ? 'var(--gold)' : 'var(--text-muted)', fontSize: 15, pointerEvents: 'none', transition: 'color 0.15s' }}>?</span>
      <input
        className="input-dark"
        style={{ paddingLeft: 36, width: '100%' }}
        placeholder="Search ticker or company..."
        value={query}
        onChange={handleChange}
        onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); setQuery('') } }}
        onFocus={() => {
          if (!query.trim() && recentSearches.length > 0) setOpen(true)
          else if (results.length > 0) setOpen(true)
        }}
        autoComplete="off"
      />
      {open && (visibleResults.length > 0 || (!query.trim() && loadingRecentSearches)) && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 100,
          background: 'var(--bg-surface)', border: '1px solid var(--border-bright)',
          borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          {!query.trim() && recentSearches.length > 0 && (
            <div style={{ padding: '10px 16px 8px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Recent searches</div>
            </div>
          )}
          {!query.trim() && loadingRecentSearches && recentSearches.length === 0 && (
            <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>Loading recent searches...</div>
          )}
          {visibleResults.map((r, i) => (
            <button
              key={`${r.symbol}-${i}`}
              type="button"
              onClick={() => {
                persistRecentSearch(r.symbol, r.description)
                setOpen(false)
                setQuery(r.symbol)
                onSelect(r.symbol, r.description)
              }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: i < visibleResults.length - 1 ? '1px solid var(--border)' : 'none',
                fontFamily: "'DM Sans', sans-serif", transition: 'background 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)', minWidth: 56 }}>{r.symbol}</span>
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', flex: 1, textAlign: 'left', paddingLeft: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{query.trim() ? '->' : formatRecentSearchLabel(r.updatedAt)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 32, marginBottom: 16, opacity: 0.4 }}>⊞</div>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 6 }}>No ticker selected</div>
      <div style={{ fontSize: 12.5 }}>Search for a company above to begin valuation analysis.</div>
    </div>
  )
}

/* ─── COMPARABLES TAB ────────────────────────────────────────────────────── */
