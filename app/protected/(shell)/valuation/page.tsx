'use client'

import dynamic from 'next/dynamic'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatSignedPercent, metricColorForValue } from '@/lib/ui/metricFormat'
import { DCFTab } from './dcf-tab'
import { SnapshotsTab } from './snapshots-tab'
import { TickerSearch } from './valuation-shared'

const ComparablesTab = dynamic(() => import('./comparables-tab').then((m) => m.ComparablesTab))

type CompanyProfile = { name: string; logo: string | null; sector: string | null; marketCap: number | null; price: number | null; revenueGrowth: number | null }

function ValuationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [symbol, setSymbol] = useState(searchParams.get('symbol')?.toUpperCase() ?? '')
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [activeTab, setActiveTab] = useState<'snapshots' | 'dcf' | 'comparables'>(() => {
    const t = searchParams.get('tab')
    if (t === 'dcf') return 'dcf'
    if (t === 'comparables') return 'comparables'
    return 'snapshots'
  })
  const [compsKey, setCompsKey] = useState(0)
  const [snapshotRefreshKey, setSnapshotRefreshKey] = useState(0) // increment to re-mount comps on symbol change

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
    setActiveTab('snapshots')
    router.push(`/protected/valuation?symbol=${upper}&tab=snapshots`, { scroll: false })
  }, [router])

  function switchTab(nextTab: 'snapshots' | 'dcf' | 'comparables') {
    setActiveTab(nextTab)
    const query = symbol
      ? `/protected/valuation?symbol=${symbol}&tab=${nextTab}`
      : `/protected/valuation?tab=${nextTab}`
    router.push(query, { scroll: false })
  }

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--gold-dim)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Valuation</div>
        <h1 className="font-display text-gold-gradient" style={{ fontSize: 42, fontWeight: 500, lineHeight: 1.05, marginBottom: 8 }}>Valuation</h1>
        <div style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.65 }}>DCF and comparable company analysis</div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Select Company</div>
        <TickerSearch value={symbol} onSelect={handleSelect} />
        {symbol && (
          <div
            style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', transition: 'border-color 0.15s' }}
            onClick={() => router.push(`/protected/ticker/${symbol}`)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold-dim)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
          >
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
                    <div style={{ fontSize: 14, fontWeight: 600, color: metricColorForValue(profile.revenueGrowth), marginTop: 2 }}>
                      {formatSignedPercent(profile.revenueGrowth / 100, 1)}
                    </div>
                  </div>
                )}
              </div>
            )}
            {!profile && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading...</div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 28, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {([
          { key: 'snapshots', label: 'Snapshots' },
          { key: 'dcf',       label: 'Live DCF' },
          { key: 'comparables', label: 'Comparables' },
        ] as const).map(({ key, label }) => {
          const isActive = activeTab === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => switchTab(key)}
              style={{
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--gold)' : 'var(--text-muted)',
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--gold)' : '2px solid transparent',
                padding: '10px 18px',
                marginBottom: -1,
                cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                letterSpacing: isActive ? '-0.01em' : '0',
                transition: 'color 0.15s, border-color 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {!symbol ? (
        <SnapshotsTab
          refreshKey={snapshotRefreshKey}
          onSwitchToDcf={() => switchTab('dcf')}
        />
      ) : (
        <>
          <div style={{ display: activeTab === 'snapshots' ? 'block' : 'none' }}>
            <SnapshotsTab
              symbol={symbol}
              refreshKey={snapshotRefreshKey}
              onSwitchToDcf={() => switchTab('dcf')}
            />
          </div>
          <div key={symbol} style={{ display: activeTab === 'dcf' ? 'block' : 'none' }}>
            <DCFTab
              symbol={symbol}
              currentPrice={profile?.price ?? null}
              onSave={() => setSnapshotRefreshKey(k => k + 1)}
            />
          </div>
          <div key={`${symbol}-${compsKey}`} style={{ display: activeTab === 'comparables' ? 'block' : 'none' }}>
            <ComparablesTab symbol={symbol} />
          </div>
        </>
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
