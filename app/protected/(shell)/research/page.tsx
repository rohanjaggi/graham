'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type SearchResult = {
  symbol: string
  description: string
}

const TICKER_PATTERN = /^[A-Z][A-Z0-9.-]{0,9}$/

async function tickerExists(symbol: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/ticker/${encodeURIComponent(symbol)}`)
    return response.ok
  } catch {
    return false
  }
}

export default function ResearchSearchPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [savedTickerSymbols, setSavedTickerSymbols] = useState<string[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const canSearch = useMemo(() => query.trim().length > 0 && !loading, [query, loading])

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', onOutsideClick)
    return () => {
      document.removeEventListener('mousedown', onOutsideClick)
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadSavedTickers() {
      try {
        const response = await fetch('/api/profile/saved-tickers')
        if (!response.ok) return

        const saved = await response.json()
        if (!Array.isArray(saved) || cancelled) return

        const symbols = saved
          .map((item) => typeof item?.symbol === 'string' ? item.symbol.toUpperCase() : '')
          .filter((symbol): symbol is string => symbol.length > 0)

        // Keep insertion order while removing duplicates.
        setSavedTickerSymbols(Array.from(new Set(symbols)))
      } catch {
        // Leave empty if unavailable.
      }
    }

    void loadSavedTickers()
    return () => {
      cancelled = true
    }
  }, [])

  function handleSelect(symbol: string) {
    setQuery('')
    setResults([])
    setOpen(false)
    router.push(`/protected/qa?ticker=${encodeURIComponent(symbol)}`)
  }

  const quickExploreSymbols = savedTickerSymbols

  function handleQueryChange(value: string) {
    setQuery(value)
    setError('')
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!value.trim()) {
      setResults([])
      setOpen(false)
      setSearching(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const response = await fetch(`/api/ticker/search?q=${encodeURIComponent(value)}`)
        if (!response.ok) {
          setResults([])
          setOpen(false)
          return
        }

        const ranked = await response.json()
        if (!Array.isArray(ranked)) {
          setResults([])
          setOpen(false)
          return
        }

        const normalized = ranked.filter((item): item is SearchResult => {
          return typeof item?.symbol === 'string' && typeof item?.description === 'string'
        })
        setResults(normalized)
        setOpen(normalized.length > 0)
      } catch {
        setResults([])
        setOpen(false)
      } finally {
        setSearching(false)
      }
    }, 300)
  }

  async function resolveSymbol(rawQuery: string): Promise<string | null> {
    const trimmed = rawQuery.trim()
    if (!trimmed) return null

    const uppercase = trimmed.toUpperCase()
    const response = await fetch(`/api/ticker/search?q=${encodeURIComponent(trimmed)}`)
    if (!response.ok) {
      if (TICKER_PATTERN.test(uppercase) && await tickerExists(uppercase)) return uppercase
      return null
    }

    const ranked = await response.json()
    if (!Array.isArray(ranked)) {
      if (TICKER_PATTERN.test(uppercase) && await tickerExists(uppercase)) return uppercase
      return null
    }

    const normalized = ranked.filter((item): item is SearchResult => {
      return typeof item?.symbol === 'string' && typeof item?.description === 'string'
    })

    const exact = normalized.find((item) => item.symbol.toUpperCase() === uppercase)
    if (exact) return exact.symbol.toUpperCase()

    if (TICKER_PATTERN.test(uppercase) && await tickerExists(uppercase)) return uppercase

    const best = normalized.find((item) => item.symbol.length > 0)
    return best?.symbol ?? null
  }

  async function handleSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    setLoading(true)
    try {
      const symbol = await resolveSymbol(query)
      if (!symbol) {
        setError('No matching ticker found. Try another company or symbol.')
        return
      }

      handleSelect(symbol)
    } catch {
      setError('Search is temporarily unavailable. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleQuickSearch(rawQuery: string) {
    setError('')
    setLoading(true)
    try {
      const symbol = await resolveSymbol(rawQuery)
      if (!symbol) {
        setError('No matching ticker found. Try another company or symbol.')
        return
      }
      handleSelect(symbol)
    } catch {
      setError('Search is temporarily unavailable. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-up d1" style={{ maxWidth: 1120, margin: '4.5vh auto 0', padding: '0 16px 28px' }}>
      <section className="card" style={{ padding: '22px 0 0', overflow: 'hidden' }}>
        <div style={{ padding: '0 26px 18px' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--gold-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
            Research
          </div>
          <h1 className="font-display text-gold-gradient" style={{ margin: '6px 0 0', fontSize: 48, fontWeight: 500, lineHeight: 1.03 }}>
            Qualitative Analysis
          </h1>
          <p style={{ margin: '12px 0 0', color: 'var(--text-secondary)', fontSize: 14.5, lineHeight: 1.65, maxWidth: 980 }}>
            Generate a concise crisis-focused brief by searching the way you would on Google. Type a ticker, company name, or plain-English phrase,
            and we will resolve the best match before sending you to QA.
          </p>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '18px 22px' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
            <div ref={wrapRef} style={{ flex: 1, position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: searching ? 'var(--gold)' : 'var(--text-muted)',
                fontSize: 15,
                pointerEvents: 'none',
                transition: 'color 0.15s',
              }}
            >
              ⌕
            </span>
              <input
                className="input-dark"
                style={{ paddingLeft: 36, minHeight: 42 }}
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onFocus={() => { if (results.length > 0) setOpen(true) }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setOpen(false)
                    setQuery('')
                  }
                }}
                placeholder="Search like Google: ticker, company, or plain-English phrase..."
                autoComplete="off"
                aria-label="Search ticker or company"
              />
              {open && results.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-bright)',
                    borderRadius: 10,
                    overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                  }}
                >
                  {results.map((r, i) => (
                    <button
                      key={r.symbol}
                      type="button"
                      onClick={() => handleSelect(r.symbol)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 16px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                        fontFamily: "'DM Sans', sans-serif",
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(event) => { event.currentTarget.style.background = 'var(--bg-elevated)' }}
                      onMouseLeave={(event) => { event.currentTarget.style.background = 'none' }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)', letterSpacing: '0.03em', minWidth: 56, textAlign: 'left' }}>
                        {r.symbol}
                      </span>
                      <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', flex: 1, textAlign: 'left', paddingLeft: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.description}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>↗</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={!canSearch}
              className="btn-gold"
              style={{ minWidth: 108, opacity: canSearch ? 1 : 0.6, cursor: canSearch ? 'pointer' : 'not-allowed' }}
            >
              {loading || searching ? 'Running...' : 'Run QA'}
            </button>
            <button
              type="button"
              className="btn-ghost"
              style={{ minWidth: 92 }}
              onClick={() => router.push('/protected/explore')}
            >
              Explore
            </button>
          </form>

          {quickExploreSymbols.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {quickExploreSymbols.map((symbol) => (
                <button
                  key={symbol}
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setQuery(symbol)
                    void handleQuickSearch(symbol)
                  }}
                  style={{ padding: '6px 11px', borderRadius: 7, fontSize: 12 }}
                >
                  {symbol}
                </button>
              ))}
            </div>
          )}

          <p style={{ marginTop: 10, color: 'var(--text-muted)', fontSize: 12.5 }}>
            Search like Google: try JPMorgan, largest US bank, or financial sector ETF. Press Enter to use the best match.
          </p>

          {error && (
            <p style={{ marginTop: 10, marginBottom: 0, color: 'var(--red)', fontSize: 13 }}>
              {error}
            </p>
          )}
        </div>

        <div style={{ padding: '20px 22px 24px' }}>
          <div className="card-elevated" style={{ minHeight: 230, display: 'grid', placeItems: 'center' }}>
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', maxWidth: 520, padding: '24px 18px' }}>
              <div style={{ fontSize: 26, lineHeight: 1, marginBottom: 8, color: 'var(--text-muted)' }}>⊕</div>
              <div style={{ fontSize: 23, fontWeight: 500, marginBottom: 8 }}>No qualitative brief yet</div>
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.65 }}>
                Search a ticker such as JPM, GS, or SPY to generate a crisis-focused overview and structured qualitative output.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
