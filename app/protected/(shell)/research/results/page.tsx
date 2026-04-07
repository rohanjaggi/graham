'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

type SearchResult = {
  symbol: string
  description: string
}

export default function ResearchResultsPage() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q')?.trim() ?? ''
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const hasQuery = useMemo(() => query.length > 0, [query])

  useEffect(() => {
    let cancelled = false

    async function loadResults() {
      if (!query) {
        setResults([])
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        const response = await fetch(`/api/ticker/search?q=${encodeURIComponent(query)}&mode=intent`)
        if (!response.ok) {
          throw new Error('Search failed')
        }

        const data = await response.json()
        if (!Array.isArray(data)) {
          throw new Error('Invalid search response')
        }

        const normalized = data.filter((item): item is SearchResult => {
          return typeof item?.symbol === 'string' && typeof item?.description === 'string'
        })

        if (!cancelled) {
          setResults(normalized.slice(0, 10))
        }
      } catch {
        if (!cancelled) {
          setError('We could not generate matches right now. Please try another prompt.')
          setResults([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadResults()
    return () => {
      cancelled = true
    }
  }, [query])

  return (
    <div className="animate-fade-up d1" style={{ width: '100%', margin: '4.5vh 0 0', padding: '0 4px 28px' }}>
      <section className="card" style={{ padding: '22px 0 0', overflow: 'hidden' }}>
        <div style={{ padding: '0 26px 18px' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--gold-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
            Research Results
          </div>
          <h1 className="font-display text-gold-gradient" style={{ margin: '6px 0 0', fontSize: 42, fontWeight: 500, lineHeight: 1.05 }}>
            Matches for "{query || 'your prompt'}"
          </h1>
          <p style={{ margin: '12px 0 0', color: 'var(--text-secondary)', fontSize: 14.5, lineHeight: 1.65, maxWidth: 920 }}>
            We ranked the most relevant public stocks and ETFs for your idea. Pick one to open the full research view.
          </p>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', padding: '18px 22px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>
              {hasQuery ? 'Top idea matches' : 'Enter a prompt from the research page'}
            </div>
            <Link href="/protected/research" className="btn-ghost" style={{ textDecoration: 'none' }}>
              Back to research
            </Link>
          </div>

          {loading && (
            <div className="card-elevated" style={{ minHeight: 220, display: 'grid', placeItems: 'center' }}>
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: 22, marginBottom: 8, color: 'var(--gold)' }}>⌕</div>
                <div style={{ fontSize: 18, fontWeight: 500 }}>Finding relevant stocks...</div>
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="card-elevated" style={{ padding: '22px 20px', color: 'var(--red)' }}>
              {error}
            </div>
          )}

          {!loading && !error && results.length === 0 && (
            <div className="card-elevated" style={{ padding: '24px 20px', color: 'var(--text-secondary)' }}>
              No relevant results yet. Try a broader prompt such as medtech, AI infrastructure, or consumer staples.
            </div>
          )}

          {!loading && !error && results.length > 0 && (
            <div style={{ display: 'grid', gap: 12 }}>
              {results.map((result, index) => (
                <Link
                  key={`${result.symbol}-${index}`}
                  href={`/protected/qa?ticker=${encodeURIComponent(result.symbol)}`}
                  className="card-elevated"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 16,
                    padding: '16px 18px',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        background: 'rgba(200,169,110,0.14)',
                        color: 'var(--gold)',
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {index + 1}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.04em' }}>
                        {result.symbol}
                      </div>
                      <div style={{ marginTop: 4, color: 'var(--text-secondary)', fontSize: 13.5, lineHeight: 1.6 }}>
                        {result.description}
                      </div>
                    </div>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12.5, whiteSpace: 'nowrap' }}>
                    Open research →
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
