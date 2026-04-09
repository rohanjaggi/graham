'use client'

import { useEffect, useState } from 'react'
import type { DCFResult } from '@/lib/dcf'

/* ─── TYPES ──────────────────────────────────────────────────────────────── */

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

/* ─── HELPERS ────────────────────────────────────────────────────────────── */

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

/* ─── SNAPSHOT CARD ──────────────────────────────────────────────────────── */

function SnapshotCard({ snap, onDelete, deleting }: {
  snap: DcfSnapshot
  onDelete: (id: string) => void
  deleting: boolean
}) {
  const scenarios = [
    { label: 'Conservative', result: snap.results_json.conservative, color: '#F06070' },
    { label: 'Neutral',      result: snap.results_json.neutral,      color: 'var(--gold)' },
    { label: 'Bullish',      result: snap.results_json.bullish,      color: '#3DD68C' },
  ] as const

  return (
    <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(snap.created_at)}</div>
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
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>

      {/* Assumptions pill row */}
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

      {/* Scenario intrinsic values */}
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
                  {diff >= 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(1)}%
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── MAIN COMPONENT ─────────────────────────────────────────────────────── */

export function SnapshotsTab({ symbol, refreshKey, onSwitchToDcf }: {
  symbol: string
  refreshKey: number
  onSwitchToDcf: () => void
}) {
  const [snapshots, setSnapshots] = useState<DcfSnapshot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!symbol) return
    setLoading(true)
    setError(null)
    fetch(`/api/dcf-snapshots?symbol=${encodeURIComponent(symbol)}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((d: { snapshots: DcfSnapshot[] }) => setSnapshots(d.snapshots))
      .catch(e => setError(typeof e === 'string' ? e : 'Failed to load snapshots'))
      .finally(() => setLoading(false))
  }, [symbol, refreshKey])

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
      Loading snapshots…
    </div>
  )

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 0', color: '#F06070', fontSize: 13 }}>
      {error}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Action bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {snapshots.length} Snapshot{snapshots.length !== 1 ? 's' : ''} · {symbol}
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
          Run Live DCF →
        </button>
      </div>

      {/* Empty state */}
      {snapshots.length === 0 && (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, opacity: 0.3, marginBottom: 14 }}>⊟</div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 6 }}>No snapshots yet</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 20 }}>
            Run the DCF and click <strong style={{ color: 'var(--text-secondary)' }}>Save Snapshot</strong> to record your assumptions and results.
          </div>
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
            Run Live DCF →
          </button>
        </div>
      )}

      {/* Snapshot list */}
      {snapshots.map(snap => (
        <SnapshotCard key={snap.id} snap={snap} onDelete={handleDelete} deleting={deletingIds.has(snap.id)} />
      ))}
    </div>
  )
}
