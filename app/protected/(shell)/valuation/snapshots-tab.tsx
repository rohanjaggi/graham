'use client'

import { useEffect, useState } from 'react'
import type { DCFResult } from '@/lib/dcf'

export interface DcfSnapshot {
  id: string
  symbol: string
  company_name: string
  label: string | null
  base_fcf: number
  wacc: number
  years: number
  terminal_growth_rate: number
  growth_rate_conservative: number
  growth_rate_neutral: number
  growth_rate_bullish: number
  market_price: number | null
  shares_outstanding: number
  net_debt: number
  results_json: {
    conservative: DCFResult
    neutral: DCFResult
    bullish: DCFResult
  }
  created_at: string
}

function fmtPrice(n: number): string {
  return `$${n.toFixed(2)}`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function pctDiff(intrinsic: number, market: number): number {
  return ((intrinsic - market) / Math.abs(market)) * 100
}

function SnapshotCard({ snap, onDelete, deleting, showSymbol }: {
  snap: DcfSnapshot
  onDelete: (id: string) => void
  deleting: boolean
  showSymbol?: boolean
}) {
  const scenarios = [
    { label: 'Conservative', result: snap.results_json.conservative, color: '#F06070' },
    { label: 'Neutral', result: snap.results_json.neutral, color: 'var(--gold)' },
    { label: 'Bullish', result: snap.results_json.bullish, color: '#3DD68C' },
  ] as const

  return (
    <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {showSymbol && (
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)', letterSpacing: '0.04em' }}>
              {snap.symbol} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>{snap.company_name}</span>
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(snap.created_at)}</div>
        </div>
        <button
          type="button"
          disabled={deleting}
          onClick={() => onDelete(snap.id)}
          style={{
            fontSize: 11, color: deleting ? 'var(--text-muted)' : '#F06070',
            background: 'none', border: '1px solid currentColor', borderRadius: 5,
            padding: '3px 10px', cursor: deleting ? 'default' : 'pointer',
            fontFamily: "'DM Sans', sans-serif", opacity: deleting ? 0.5 : 1, transition: 'opacity 0.15s',
          }}
        >
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '6px 16px', padding: '10px 12px',
        background: 'var(--bg-elevated)', borderRadius: 7, fontSize: 11.5, color: 'var(--text-secondary)',
      }}>
        <span>WACC <strong style={{ color: 'var(--text-primary)' }}>{snap.wacc.toFixed(1)}%</strong></span>
        <span>Terminal g <strong style={{ color: 'var(--text-primary)' }}>{snap.terminal_growth_rate.toFixed(1)}%</strong></span>
        <span>Years <strong style={{ color: 'var(--text-primary)' }}>{snap.years}</strong></span>
        <span>
          Growth{' '}
          <strong style={{ color: '#F06070' }}>{snap.growth_rate_conservative.toFixed(1)}%</strong>
          {' / '}
          <strong style={{ color: 'var(--gold)' }}>{snap.growth_rate_neutral.toFixed(1)}%</strong>
          {' / '}
          <strong style={{ color: '#3DD68C' }}>{snap.growth_rate_bullish.toFixed(1)}%</strong>
        </span>
        {snap.market_price != null && (
          <span>Mkt Price <strong style={{ color: 'var(--text-primary)' }}>{fmtPrice(snap.market_price)}</strong></span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {scenarios.map(({ label, result, color }) => {
          const diff = snap.market_price != null ? pctDiff(result.intrinsicPricePerShare, snap.market_price) : null
          return (
            <div key={label} style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--bg-elevated)', borderRadius: 7 }}>
              <div style={{ fontSize: 10.5, color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 17, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {fmtPrice(result.intrinsicPricePerShare)}
              </div>
              {diff != null && (
                <div style={{ fontSize: 11, fontWeight: 500, marginTop: 3, color: diff >= 0 ? '#3DD68C' : '#F06070' }}>
                  {diff >= 0 ? '+' : '-'} {Math.abs(diff).toFixed(1)}%
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function SnapshotsTab({ symbol, refreshKey, onSwitchToDcf }: {
  symbol?: string
  refreshKey: number
  onSwitchToDcf: () => void
}) {
  const [snapshots, setSnapshots] = useState<DcfSnapshot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [showAllSnapshots, setShowAllSnapshots] = useState(false)

  useEffect(() => {
    setShowAllSnapshots(false)
  }, [symbol])

  const filterSymbol = symbol && !showAllSnapshots ? symbol : undefined

  useEffect(() => {
    setLoading(true)
    setError(null)
    const url = filterSymbol ? `/api/dcf-snapshots?symbol=${encodeURIComponent(filterSymbol)}` : '/api/dcf-snapshots'
    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((d: { snapshots: DcfSnapshot[] }) => setSnapshots(d.snapshots))
      .catch(e => setError(typeof e === 'string' ? e : 'Failed to load snapshots'))
      .finally(() => setLoading(false))
  }, [filterSymbol, refreshKey])

  async function handleDelete(id: string) {
    setDeletingIds(s => new Set(s).add(id))
    try {
      const res = await fetch(`/api/dcf-snapshots/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setSnapshots(prev => prev.filter(s => s.id !== id))
      } else {
        const body = await res.json().catch(() => ({}))
        alert(`Delete failed: ${(body as { error?: string }).error ?? res.statusText}`)
      }
    } catch {
      alert('Delete failed: network error')
    } finally {
      setDeletingIds(s => { const n = new Set(s); n.delete(id); return n })
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 0', color: 'var(--text-muted)', fontSize: 13 }}>
      Loading snapshots...
    </div>
  )

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 0', color: '#F06070', fontSize: 13 }}>
      {error}
    </div>
  )

  const contextLabel = filterSymbol
    ? `Showing ${filterSymbol} snapshots only`
    : 'Showing all saved snapshots'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {snapshots.length} Snapshot{snapshots.length !== 1 ? 's' : ''}{filterSymbol ? ` - ${filterSymbol}` : ' - All Stocks'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{contextLabel}</div>
            {symbol && !showAllSnapshots && (
              <button
                type="button"
                onClick={() => setShowAllSnapshots(true)}
                style={{
                  fontSize: 11.5, fontWeight: 600, color: 'var(--gold)',
                  background: 'rgba(200,169,110,0.08)', border: '1px solid rgba(200,169,110,0.25)',
                  borderRadius: 999, padding: '5px 12px', cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Show all snapshots
              </button>
            )}
            {symbol && showAllSnapshots && (
              <button
                type="button"
                onClick={() => setShowAllSnapshots(false)}
                style={{
                  fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: 999, padding: '5px 12px', cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Back to {symbol}
              </button>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onSwitchToDcf}
          style={{
            fontSize: 12.5, fontWeight: 600, color: 'var(--gold)',
            background: 'rgba(200,169,110,0.1)', border: '1px solid rgba(200,169,110,0.3)',
            borderRadius: 7, padding: '7px 16px', cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif", transition: 'background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,169,110,0.18)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(200,169,110,0.1)' }}
        >
          Run Live DCF {'->'}
        </button>
      </div>

      {snapshots.length === 0 && (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 6 }}>No snapshots yet</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12 }}>
            {filterSymbol
              ? `You have not saved a DCF snapshot for ${filterSymbol} yet.`
              : 'You have not saved any DCF snapshots yet.'}
          </div>
          {symbol && !showAllSnapshots && (
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 20 }}>
              If you saved another company earlier, click <strong style={{ color: 'var(--text-secondary)' }}>Show all snapshots</strong> to see it.
            </div>
          )}
          {!symbol && (
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 20 }}>
              Run the DCF and click <strong style={{ color: 'var(--text-secondary)' }}>Save Snapshot</strong> to record your assumptions and results.
            </div>
          )}
          <button
            type="button"
            onClick={onSwitchToDcf}
            style={{
              fontSize: 12.5, fontWeight: 600, color: 'var(--gold)',
              background: 'rgba(200,169,110,0.1)', border: '1px solid rgba(200,169,110,0.3)',
              borderRadius: 7, padding: '8px 20px', cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Run Live DCF {'->'}
          </button>
        </div>
      )}

      {snapshots.map(snap => (
        <SnapshotCard key={snap.id} snap={snap} onDelete={handleDelete} deleting={deletingIds.has(snap.id)} showSymbol={!filterSymbol} />
      ))}
    </div>
  )
}
