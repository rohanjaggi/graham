'use client'

import { FinRow, MetricCard, PriceChart, Skeleton } from './ticker-shared'
import type { AnalysisData, CrisisHeuristics, TickerData } from './ticker-types'
import { fmt, fmtDate, fmtMarketCap, riskBadgeStyle } from './ticker-utils'

export function OverviewTab(props: {
  data: TickerData
  symbol: string
  summaryLoading: boolean
  companySummary: string
  companyWhatItIs: string
  companyDescription: string
  companyCrisisRelevance: string
  companyKeyVulnerabilities: string[]
  companyTransmissionChannels: string[]
  companyWhatToExploreNext: string[]
  heuristics: CrisisHeuristics | null
}) {
  const { data, symbol, summaryLoading, companySummary, companyWhatItIs, companyDescription, companyCrisisRelevance, companyKeyVulnerabilities, companyTransmissionChannels, companyWhatToExploreNext, heuristics } = props

  return (
    <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {(summaryLoading || companySummary || companyWhatItIs || companyCrisisRelevance) && (
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Quick analysis</div>
          {summaryLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Skeleton w="100%" h={12} />
              <Skeleton w="84%" h={12} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>What the company is</div>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>{companyWhatItIs || companySummary}</p>
                <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>{companyDescription || companySummary}</p>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Why it matters in a crisis</div>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>{companyCrisisRelevance}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {[
                  { title: 'Key vulnerabilities', items: companyKeyVulnerabilities.length > 0 ? companyKeyVulnerabilities : ['Cyclical earnings pressure during demand and valuation contractions.', 'Liquidity or refinancing pressure if capital markets tighten abruptly.', 'Operational and regulatory shocks that can reduce earnings visibility.'] },
                  { title: 'Transmission channels', items: companyTransmissionChannels.length > 0 ? companyTransmissionChannels : ['Asset repricing can spread stress to credit, funding, and equity markets.', 'Counterparty and customer behavior can accelerate liquidity strains.', 'Capital allocation shifts can impact lending, investment, and confidence.'] },
                  { title: 'What to explore next', items: companyWhatToExploreNext.length > 0 ? companyWhatToExploreNext : ['Balance-sheet resilience: leverage, maturities, and liquidity buffers.', 'Peer positioning across margins, valuation, and growth durability.', 'Downside scenarios under recession, spread widening, and funding stress.'] },
                ].map(section => (
                  <div key={section.title} style={{ border: '1px solid var(--border)', background: 'var(--bg-elevated)', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>{section.title}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {section.items.map((item, idx) => <div key={`${section.title}-${idx}`} style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{item}</div>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <PriceChart symbol={symbol} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <MetricCard label="P/E Ratio" value={fmt(data.pe, 1, 'x')} sub="Price / Earnings" />
        <MetricCard label="Market Cap" value={fmtMarketCap(data.marketCap)} sub={data.exchange} />
        <MetricCard label="52-Week Range" value={`$${fmt(data.week52Low ?? data.dayLow, 0)} - $${fmt(data.week52High ?? data.dayHigh, 0)}`} sub="Low / High" />
        <MetricCard label="Dividend Yield" value={data.dividendYield ? `${fmt(data.dividendYield, 2)}%` : 'None'} sub="Indicated annual" />
      </div>
      <div className="card" style={{ padding: '24px 28px' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>Price Detail</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {[{ label: 'Open', value: `$${fmt(data.open)}` }, { label: 'Prev Close', value: `$${fmt(data.prevClose)}` }, { label: 'Day High', value: `$${fmt(data.dayHigh)}` }, { label: 'Day Low', value: `$${fmt(data.dayLow)}` }, { label: '52W High', value: `$${fmt(data.week52High)}` }, { label: '52W Low', value: `$${fmt(data.week52Low)}` }].map(({ label, value }) => <div key={label}><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div><div style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{value}</div></div>)}
        </div>
      </div>
      <div className="card" style={{ padding: '24px 28px' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>Fundamental Summary</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0 40px' }}>
          <FinRow label="P/E (Normalised)" value={fmt(data.pe, 1, 'x')} />
          <FinRow label="EV / EBITDA" value={fmt(data.evEbitda, 1, 'x')} />
          <FinRow label="Price / Book" value={fmt(data.pb, 2, 'x')} />
          <FinRow label="Return on Equity" value={fmt(data.roe, 1, '%')} good={(data.roe ?? 0) > 15} bad={(data.roe ?? 0) < 0} />
          <FinRow label="Revenue Growth (YoY)" value={fmt(data.revenueGrowth, 1, '%')} good={(data.revenueGrowth ?? 0) > 10} bad={(data.revenueGrowth ?? 0) < 0} />
          <FinRow label="Gross Margin" value={fmt(data.grossMargin, 1, '%')} good={(data.grossMargin ?? 0) > 40} bad={(data.grossMargin ?? 0) < 10} />
          <FinRow label="Debt / Equity" value={fmt(data.debtEquity, 2, 'x')} good={(data.debtEquity ?? 99) < 0.5} bad={(data.debtEquity ?? 0) > 2} />
          <FinRow label="Dividend Yield" value={data.dividendYield ? `${fmt(data.dividendYield, 2)}%` : '-'} />
        </div>
      </div>
      {heuristics && <CrisisHeuristicsCard heuristics={heuristics} />}
    </div>
  )
}

function CrisisHeuristicsCard({ heuristics }: { heuristics: CrisisHeuristics }) {
  const riskItems = [
    { label: 'Funding risk', value: heuristics.fundingRisk },
    { label: 'Liquidity risk', value: heuristics.liquidityRisk },
    { label: 'Counterparty risk', value: heuristics.counterpartyRisk },
    { label: 'Sentiment sensitivity', value: heuristics.sentimentSensitivity },
    { label: 'Interconnectedness', value: heuristics.interconnectedness },
    { label: 'Confidence level', value: heuristics.confidenceLevel },
  ]

  return (
    <div className="card" style={{ padding: '20px 22px' }}>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Crisis-relevance heuristics</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))', gap: 10 }}>
          {riskItems.slice(0, 4).map((item) => <RiskItemCard key={item.label} label={item.label} value={item.value} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))', gap: 10 }}>
          {riskItems.slice(4, 6).map((item) => <RiskItemCard key={item.label} label={item.label} value={item.value} />)}
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-elevated)', padding: '11px 12px', minHeight: 76, gridColumn: '3 / 5' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>Major exposure categories</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {heuristics.exposureCategories.map((item) => <span key={item} style={{ fontSize: 12, color: '#9fb6e9', background: 'rgba(95, 138, 219, 0.12)', border: '1px solid rgba(95, 138, 219, 0.28)', borderRadius: 6, padding: '4px 9px' }}>{item}</span>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function RiskItemCard({ label, value }: { label: string; value: string }) {
  return <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-elevated)', padding: '11px 12px', minHeight: 76 }}><div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>{label}</div><span style={{ ...riskBadgeStyle(value as never), display: 'inline-block', borderRadius: 999, padding: '4px 11px', fontSize: 12, fontWeight: 600 }}>{value}</span></div>
}

export function FinancialsTab({ data }: { data: TickerData }) {
  return <div className="animate-fade-up"><div className="card" style={{ padding: '28px 32px' }}><div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Key Ratios & Metrics</div><div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>Trailing twelve months unless noted</div><FinRow label="P/E Ratio (Normalised)" value={fmt(data.pe, 1, 'x')} /><FinRow label="P/E Ratio (TTM)" value={fmt(data.pe, 1, 'x')} /><FinRow label="Price / Book" value={fmt(data.pb, 2, 'x')} /><FinRow label="EV / EBITDA" value={fmt(data.evEbitda, 1, 'x')} /><FinRow label="Return on Equity (TTM)" value={fmt(data.roe, 1, '%')} good={(data.roe ?? 0) > 15} bad={(data.roe ?? 0) < 0} /><FinRow label="Revenue Growth YoY" value={fmt(data.revenueGrowth, 1, '%')} good={(data.revenueGrowth ?? 0) > 10} bad={(data.revenueGrowth ?? 0) < 0} /><FinRow label="Gross Margin (TTM)" value={fmt(data.grossMargin, 1, '%')} good={(data.grossMargin ?? 0) > 40} bad={(data.grossMargin ?? 0) < 10} /><FinRow label="Debt / Equity (Annual)" value={fmt(data.debtEquity, 2, 'x')} good={(data.debtEquity ?? 99) < 0.5} bad={(data.debtEquity ?? 0) > 2} /><FinRow label="Dividend Yield (Indicated)" value={data.dividendYield ? `${fmt(data.dividendYield, 2)}%` : 'None'} /><FinRow label="Market Capitalisation" value={fmtMarketCap(data.marketCap)} /></div><div style={{ marginTop: 16, padding: '14px 18px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)' }}><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Data sourced from Finnhub. Green = healthy, red = potential concern, grey = neutral. Not financial advice.</span></div></div>
}

export function NewsTab({ news, symbol }: { news: TickerData['news']; symbol: string }) {
  return <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{news.length === 0 ? <div className="card" style={{ padding: '40px', textAlign: 'center' }}><div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No recent news found for {symbol}.</div></div> : news.map((item, i) => <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}><div className="card" style={{ padding: '20px 24px', cursor: 'pointer', transition: 'border-color 0.15s' }} onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold-dim)')} onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}><div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.5 }}>{item.headline}</div>{item.summary && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.summary}</div>}<div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 500 }}>{item.source}</span><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtDate(item.datetime)}</span></div></div><span style={{ fontSize: 16, color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }}>Read article -&gt;</span></div></div></a>)}</div>
}

export function AnalysisTab({ data, loading, error, analysis }: { data: TickerData; loading: boolean; error: string; analysis: AnalysisData | null }) {
  if (loading) {
    return <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><div className="card" style={{ padding: '28px', display: 'flex', alignItems: 'center', gap: 14 }}><div style={{ width: 20, height: 20, border: '2px solid var(--gold-dim)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} /><div><div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>Analysing {data.name}...</div><div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Reading SEC filing, financial metrics, and recent news</div></div></div>{[80, 60, 90].map((w, i) => <Skeleton key={i} w={`${w}%`} h={18} />)}</div>
  }
  if (error) {
    return <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><div className="card" style={{ padding: '28px', textAlign: 'center' }}><div style={{ fontSize: 13, color: 'var(--red)', marginBottom: 8 }}>Analysis failed</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{error}</div></div></div>
  }
  if (!analysis) return null

  const verdictColor = analysis.verdict?.includes('Buy') ? 'var(--green)' : analysis.verdict?.includes('Sell') ? 'var(--red)' : 'var(--gold)'
  const moatColor = analysis.moat === 'Wide' ? 'var(--green)' : analysis.moat === 'Narrow' ? 'var(--gold)' : 'var(--text-muted)'

  return (
    <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card" style={{ padding: '22px 24px' }}><div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>AI Verdict</div><div style={{ fontSize: 26, fontWeight: 700, color: verdictColor, marginBottom: 8 }}>{analysis.verdict}</div><div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{analysis.verdictReasoning}</div></div>
        <div className="card" style={{ padding: '22px 24px' }}><div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Competitive Moat</div><div style={{ fontSize: 26, fontWeight: 700, color: moatColor, marginBottom: 8 }}>{analysis.moat}</div><div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{analysis.moatReasoning}</div></div>
      </div>
      <div className="card" style={{ padding: '20px 24px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}><span style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Business Quality Score</span><span style={{ fontSize: 18, fontWeight: 700, color: 'var(--gold)' }}>{analysis.qualityScore}<span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}> / 10</span></span></div><div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 100, overflow: 'hidden' }}><div style={{ height: '100%', width: `${(analysis.qualityScore / 10) * 100}%`, background: 'linear-gradient(90deg, var(--gold-bright), var(--gold))', borderRadius: 100, transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)' }} /></div></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card" style={{ padding: '22px 24px' }}><div style={{ fontSize: 10.5, color: 'var(--green)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14, fontWeight: 600 }}>Bull Thesis</div><div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{analysis.bullThesis?.map((pt, i) => <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><span style={{ color: 'var(--green)', fontSize: 12, marginTop: 2, flexShrink: 0 }}>+</span><span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{pt}</span></div>)}</div></div>
        <div className="card" style={{ padding: '22px 24px' }}><div style={{ fontSize: 10.5, color: 'var(--red)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14, fontWeight: 600 }}>Bear Thesis</div><div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{analysis.bearThesis?.map((pt, i) => <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><span style={{ color: 'var(--red)', fontSize: 12, marginTop: 2, flexShrink: 0 }}>-</span><span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{pt}</span></div>)}</div></div>
      </div>
      <div className="card" style={{ padding: '22px 24px' }}><div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>Key Risks</div><div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{analysis.keyRisks?.map((risk, i) => <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', paddingBottom: 10, borderBottom: i < analysis.keyRisks.length - 1 ? '1px solid var(--border)' : 'none' }}><span style={{ color: 'var(--gold-dim)', fontSize: 11, marginTop: 2, flexShrink: 0 }}>!</span><span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{risk}</span></div>)}</div></div>
      <div className="card" style={{ padding: '22px 24px' }}><div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Management & Capital Allocation</div><div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{analysis.managementSignals}</div></div>
      <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)' }}><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>AI analysis generated by GPT-5.4-mini using SEC filings, financial metrics, and recent news. Not financial advice.</span></div>
    </div>
  )
}
