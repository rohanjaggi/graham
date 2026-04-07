'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { formatSignedPercent, metricColorForValue } from '@/lib/ui/metricFormat'
import { Sidebar, Skeleton } from './ticker-shared'
import type { AnalysisData, CompanySummaryResponse, TickerData } from './ticker-types'
import { fmt, fmtMarketCap, getCrisisHeuristics } from './ticker-utils'

const OverviewTab = dynamic(() => import('./ticker-tabs').then((m) => m.OverviewTab))
const FinancialsTab = dynamic(() => import('./ticker-tabs').then((m) => m.FinancialsTab))
const NewsTab = dynamic(() => import('./ticker-tabs').then((m) => m.NewsTab))
const AnalysisTab = dynamic(() => import('./ticker-tabs').then((m) => m.AnalysisTab))

export default function TickerPage() {
  const router = useRouter()
  const params = useParams()
  const symbol = (params?.symbol as string ?? '').toUpperCase()

  const [data, setData] = useState<TickerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'overview' | 'financials' | 'news' | 'analysis'>('overview')
  const [companySummary, setCompanySummary] = useState('')
  const [companyWhatItIs, setCompanyWhatItIs] = useState('')
  const [companyDescription, setCompanyDescription] = useState('')
  const [companyCrisisRelevance, setCompanyCrisisRelevance] = useState('')
  const [companyKeyVulnerabilities, setCompanyKeyVulnerabilities] = useState<string[]>([])
  const [companyTransmissionChannels, setCompanyTransmissionChannels] = useState<string[]>([])
  const [companyWhatToExploreNext, setCompanyWhatToExploreNext] = useState<string[]>([])
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveFeedback, setSaveFeedback] = useState('')
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState('')

  useEffect(() => {
    if (!symbol) return
    setLoading(true)
    setError('')
    fetch(`/api/ticker/${symbol}`)
      .then((r) => {
        if (!r.ok) throw new Error('Ticker not found')
        return r.json()
      })
      .then((d) => { setData(d); setLoading(false) })
      .catch((e) => { setError(e.message); setLoading(false) })
  }, [symbol])

  useEffect(() => {
    if (!symbol) return
    setSummaryLoading(true)
    setCompanySummary('')
    setCompanyWhatItIs('')
    setCompanyDescription('')
    setCompanyCrisisRelevance('')
    setCompanyKeyVulnerabilities([])
    setCompanyTransmissionChannels([])
    setCompanyWhatToExploreNext([])

    fetch(`/api/ticker/${symbol}/summary`)
      .then((r) => r.ok ? r.json() : null)
      .then((d: CompanySummaryResponse | null) => {
        const summary = d?.summary?.trim() ?? ''
        const whatItIs = d?.whatItIs?.trim() ?? ''
        const description = d?.companyDescription?.trim() ?? ''
        const crisisRelevance = d?.crisisRelevance?.trim() ?? ''
        const keyVulnerabilities = Array.isArray(d?.keyVulnerabilities) ? d.keyVulnerabilities.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
        const transmissionChannels = Array.isArray(d?.transmissionChannels) ? d.transmissionChannels.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
        const whatToExploreNext = Array.isArray(d?.whatToExploreNext) ? d.whatToExploreNext.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []

        setCompanySummary(summary)
        setCompanyWhatItIs(whatItIs || summary)
        setCompanyDescription(description)
        setCompanyCrisisRelevance(crisisRelevance || 'Crisis relevance details are currently limited; review this company with sector-level and balance-sheet context in stressed markets.')
        setCompanyKeyVulnerabilities(keyVulnerabilities)
        setCompanyTransmissionChannels(transmissionChannels)
        setCompanyWhatToExploreNext(whatToExploreNext)
        setSummaryLoading(false)
      })
      .catch(() => setSummaryLoading(false))
  }, [symbol])

  useEffect(() => {
    if (!symbol) return
    let cancelled = false
    setIsSaved(false)
    setSaveFeedback('')

    fetch('/api/profile/saved-tickers')
      .then((r) => r.ok ? r.json() : [])
      .then((saved) => {
        if (cancelled || !Array.isArray(saved)) return
        setIsSaved(saved.some((item) => typeof item?.symbol === 'string' && item.symbol.toUpperCase() === symbol))
      })
      .catch(() => { if (!cancelled) setIsSaved(false) })

    return () => { cancelled = true }
  }, [symbol])

  useEffect(() => {
    if (tab !== 'analysis' || analysis || analysisLoading) return
    setAnalysisLoading(true)
    setAnalysisError('')
    fetch(`/api/ticker/${symbol}/analysis`)
      .then((r) => {
        if (!r.ok) throw new Error('Analysis unavailable')
        return r.json()
      })
      .then((d) => { setAnalysis(d.analysis); setAnalysisLoading(false) })
      .catch((e) => { setAnalysisError(e.message); setAnalysisLoading(false) })
  }, [tab, symbol, analysis, analysisLoading])

  async function handleSaveTicker() {
    if (!symbol || saveLoading) return
    setSaveLoading(true)
    setSaveFeedback('')

    try {
      const response = isSaved
        ? await fetch('/api/profile/saved-tickers', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol }) })
        : await fetch('/api/profile/saved-tickers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol, companyName: data?.name ?? null }) })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        setSaveFeedback(typeof payload?.error === 'string' ? payload.error : isSaved ? 'Could not remove ticker right now.' : 'Could not save ticker right now.')
        return
      }
      setIsSaved(!isSaved)
      setSaveFeedback(typeof payload?.message === 'string' ? payload.message : isSaved ? 'Removed from your profile.' : 'Saved to your profile.')
    } catch {
      setSaveFeedback(isSaved ? 'Could not remove ticker right now.' : 'Could not save ticker right now.')
    } finally {
      setSaveLoading(false)
    }
  }

  const heuristics = data ? getCrisisHeuristics(data, companyKeyVulnerabilities, companyTransmissionChannels, companyWhatToExploreNext) : null

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@keyframes shimmer {0%{background-position:200% 0}100%{background-position:-200% 0}} @keyframes spin {to { transform: rotate(360deg) }}`}</style>
      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-base)' }}>
        <header style={{ padding: '28px 36px 0', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
          <button className="btn-ghost" onClick={() => router.back()} style={{ fontSize: 12, padding: '6px 14px', marginBottom: 20, display: 'inline-flex', alignItems: 'center', gap: 6 }}>? Back</button>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              <Skeleton w={240} h={32} />
              <Skeleton w={160} h={16} />
            </div>
          ) : error ? (
            <div style={{ marginBottom: 24 }}>
              <div className="font-display" style={{ fontSize: 28, color: 'var(--text-primary)', marginBottom: 6 }}>Ticker not found</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>"{symbol}" didn't return any results. Check the symbol and try again.</div>
            </div>
          ) : data && (
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {data.logo && <img src={data.logo} alt={data.name} style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'contain', background: 'var(--bg-elevated)', padding: 4 }} />}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span className="font-display" style={{ fontSize: 30, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1 }}>{data.name}</span>
                    <span style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, letterSpacing: '0.05em' }}>{data.symbol}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="badge-neutral" style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4 }}>{data.exchange}</span>
                    <span className="badge-neutral" style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4 }}>{data.sector}</span>
                    {data.website && <a href={data.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--text-muted)', textDecoration: 'none' }}>? website</a>}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <button type="button" className={isSaved ? 'btn-ghost' : 'btn-gold'} onClick={() => void handleSaveTicker()} disabled={saveLoading} style={{ marginBottom: 10, minWidth: 94, padding: '6px 12px', fontSize: 12, cursor: saveLoading ? 'default' : 'pointer', opacity: saveLoading ? 0.75 : 1 }}>
                  {saveLoading ? (isSaved ? 'Unsaving...' : 'Saving...') : isSaved ? 'Unsave' : 'Save'}
                </button>
                <div style={{ fontSize: 36, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>${fmt(data.price)}</div>
                <div style={{ fontSize: 14, color: metricColorForValue(data.priceChangePct ?? undefined), marginTop: 6, fontWeight: 500 }}>
                  {data.priceChange == null ? '?' : `${data.priceChange > 0 ? '+' : data.priceChange < 0 ? '-' : ''}${fmt(Math.abs(data.priceChange))}`} ({formatSignedPercent((data.priceChangePct ?? 0) / 100)})
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Mkt Cap {fmtMarketCap(data.marketCap)}</div>
                {saveFeedback && <div style={{ fontSize: 11, color: isSaved ? 'var(--green)' : 'var(--red)', marginTop: 6 }}>{saveFeedback}</div>}
              </div>
            </div>
          )}

          {!loading && !error && (
            <div className="tab-bar" style={{ display: 'inline-flex', marginBottom: -1 }}>
              {(['overview', 'financials', 'news', 'analysis'] as const).map((t) => (
                <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", padding: '8px 20px', textTransform: 'capitalize' }}>
                  {t === 'analysis' ? 'Analysis' : t}
                </button>
              ))}
            </div>
          )}
        </header>

        <main style={{ flex: 1, overflowY: 'auto', padding: '32px 36px' }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Skeleton h={220} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>{[...Array(4)].map((_, i) => <Skeleton key={i} h={80} />)}</div>
              <Skeleton h={200} />
            </div>
          )}

          {!loading && error && (
            <div className="card" style={{ padding: '40px', textAlign: 'center', maxWidth: 480, margin: '60px auto' }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>?</div>
              <div style={{ fontSize: 16, color: 'var(--text-primary)', marginBottom: 8 }}>Could not load data</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>{error}</div>
              <button className="btn-ghost" onClick={() => router.back()} style={{ padding: '10px 24px' }}>? Go back</button>
            </div>
          )}

          {!loading && !error && data && tab === 'overview' && <OverviewTab data={data} symbol={symbol} summaryLoading={summaryLoading} companySummary={companySummary} companyWhatItIs={companyWhatItIs} companyDescription={companyDescription} companyCrisisRelevance={companyCrisisRelevance} companyKeyVulnerabilities={companyKeyVulnerabilities} companyTransmissionChannels={companyTransmissionChannels} companyWhatToExploreNext={companyWhatToExploreNext} heuristics={heuristics} />}
          {!loading && !error && data && tab === 'financials' && <FinancialsTab data={data} />}
          {!loading && !error && data && tab === 'news' && <NewsTab news={data.news} symbol={symbol} />}
          {!loading && !error && data && tab === 'analysis' && <AnalysisTab data={data} loading={analysisLoading} error={analysisError} analysis={analysis} />}
        </main>
      </div>
    </div>
  )
}
