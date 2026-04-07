'use client'

import dynamic from 'next/dynamic'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatSignedPercent, metricColorForValue } from '@/lib/ui/metricFormat'
import { DCFTab } from './dcf-tab'
import { EmptyState, TickerSearch } from './valuation-shared'

const ComparablesTab = dynamic(() => import('./comparables-tab').then((m) => m.ComparablesTab))

type CompanyProfile = { name: string; logo: string | null; sector: string | null; marketCap: number | null; price: number | null; revenueGrowth: number | null }

function ValuationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [symbol, setSymbol] = useState(searchParams.get('symbol')?.toUpperCase() ?? '')
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [activeTab, setActiveTab] = useState<'dcf' | 'comparables'>(
    searchParams.get('tab') === 'comparables' ? 'comparables' : 'dcf'
  )
  const [compsKey, setCompsKey] = useState(0)

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
      <div style={{ marginBottom: 28 }}>
        <div className="font-display" style={{ fontSize: 26, fontWeight: 500, marginBottom: 4 }}>Valuation</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>DCF and comparable company analysis</div>
      </div>

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

      <div className="tab-bar" style={{ marginBottom: 28 }}>
        <button className={`tab${activeTab === 'dcf' ? ' active' : ''}`} onClick={() => switchTab('dcf')}>DCF Valuation</button>
        <button className={`tab${activeTab === 'comparables' ? ' active' : ''}`} onClick={() => switchTab('comparables')}>Comparables</button>
      </div>

      {activeTab === 'dcf' && (symbol ? <DCFTab symbol={symbol} currentPrice={profile?.price ?? null} /> : <EmptyState />)}
      {activeTab === 'comparables' && (symbol ? <ComparablesTab key={`${symbol}-${compsKey}`} symbol={symbol} /> : <EmptyState />)}
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
