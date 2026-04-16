'use client'

import Link from 'next/link'
import { useState } from 'react'

/* ─── HERO CHART ─────────────────────────────────────────────────────────── */

function HeroChart() {
  const data = [220, 228, 224, 235, 241, 238, 252, 261, 255, 268, 274, 271, 283, 291, 288, 301]
  const W = 480, H = 160
  const min = Math.min(...data), max = Math.max(...data)
  const pts: [number, number][] = data.map((v, i) => [
    8 + (i / (data.length - 1)) * (W - 16),
    8 + (1 - (v - min) / (max - min)) * (H - 16),
  ])
  const line = pts.map(([x, y], i) =>
    i === 0 ? `M ${x} ${y}` : `C ${x - 20} ${pts[i - 1][1]} ${x - 20} ${y} ${x} ${y}`
  ).join(' ')
  const area = `${line} L ${pts[pts.length - 1][0]} ${H} L ${pts[0][0]} ${H} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C8A96E" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#C8A96E" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#hg)" />
      <path d={line} fill="none" stroke="#C8A96E" strokeWidth="2" strokeLinecap="round" className="chart-line" />
    </svg>
  )
}

/* ─── DATA ───────────────────────────────────────────────────────────────── */

const FEATURES = [
  { icon: '⊞', title: 'DCF Valuation',       desc: 'Adjustable WACC, growth rates, and terminal value assumptions. Real-time intrinsic value and margin of safety.' },
  { icon: '◎', title: 'Portfolio Optimiser',  desc: 'Mean-variance optimisation with risk tolerance control. Visualise the efficient frontier across your holdings.' },
  { icon: '⊕', title: 'Qualitative Research', desc: 'Company snapshot on ticker search — financials, moat rating, bull/bear thesis, and analyst consensus.' },
  { icon: '≋', title: 'Quick Comparables',    desc: 'Peer benchmarking across P/E, EV/EBITDA, P/B, and ROE. Add and remove peers dynamically.' },
  { icon: '△', title: 'Technical Analysis',   desc: 'Customisable overlays — MA20/50/200, Bollinger Bands, RSI, MACD — with clean signal summary.' },
  { icon: '◐', title: 'Tail Risk',            desc: 'Maximum drawdown, VaR, CVaR, and historical stress scenarios (COVID, GFC). Know your worst-case.' },
]

const PRINCIPLES = [
  { heading: "Owner's Mindset",         body: 'Every position is treated as partial ownership of a business — not a price-chart entry point.' },
  { heading: 'Margin of Safety',        body: 'Every thesis is stress-tested against intrinsic value. We only act when the price is right.' },
  { heading: 'Concentrated Conviction', body: 'High-quality positions, deeply understood, held long enough for compounding to do its work.' },
]

const TIERS = [
  {
    name: 'Free',
    tagline: 'For curious investors getting started.',
    monthlyPrice: 0,
    annualPrice: 0,
    cta: 'Get Started Free',
    ctaStyle: 'ghost' as const,
    highlight: false,
    features: [
      { label: 'Up to 3 tickers',                 on: true  },
      { label: 'Basic qualitative snapshot',       on: true  },
      { label: 'MA20 / MA50 overlays',             on: true  },
      { label: 'Manual portfolio tracking',        on: true  },
      { label: 'DCF modelling',                    on: false },
      { label: 'Portfolio optimiser',              on: false },
      { label: 'Quick Comparables',                on: false },
      { label: 'Tail risk analysis',               on: false },
      { label: 'CSV export',                       on: false },
      { label: 'Email alerts',                     on: false },
    ],
  },
  {
    name: 'Pro',
    tagline: 'For serious, long-horizon investors.',
    monthlyPrice: 19,
    annualPrice: 15,
    badge: 'Most Popular',
    cta: 'Start 14-Day Trial',
    ctaStyle: 'gold' as const,
    highlight: true,
    features: [
      { label: 'Unlimited tickers',                on: true },
      { label: 'Full qualitative research',        on: true },
      { label: 'All TA indicators + MACD / RSI',   on: true },
      { label: 'Portfolio tracking',               on: true },
      { label: 'DCF modelling',                    on: true },
      { label: 'Portfolio optimiser',              on: true },
      { label: 'Quick Comparables (10 peers)',     on: true },
      { label: 'Tail risk analysis',               on: true },
      { label: 'CSV export',                       on: true },
      { label: 'Email alerts',                     on: false },
    ],
  },
  {
    name: 'Institutional',
    tagline: 'For funds, family offices, and teams.',
    monthlyPrice: 89,
    annualPrice: 69,
    cta: 'Contact Sales',
    ctaStyle: 'ghost' as const,
    highlight: false,
    features: [
      { label: 'Everything in Pro',                on: true },
      { label: 'Multi-portfolio management',       on: true },
      { label: 'API access (5,000 req/day)',        on: true },
      { label: 'Custom benchmarks',                on: true },
      { label: 'Compliance-ready exports',         on: true },
      { label: 'Team seats (up to 10)',            on: true },
      { label: 'Priority support (< 4h SLA)',      on: true },
      { label: 'Dedicated onboarding',             on: true },
      { label: 'SSO / SAML',                       on: true },
      { label: 'Email alerts',                     on: true },
    ],
  },
]

/* ─── HELPERS ────────────────────────────────────────────────────────────── */

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

/* ─── LANDING PAGE ───────────────────────────────────────────────────────── */

export default function Landing() {
  const [annual, setAnnual] = useState(false)

  return (
    <div style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: "'DM Sans', sans-serif", minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── NAV ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        height: 60,
        padding: '0 56px',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(7,12,21,0.88)',
        backdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1280, margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/images/graham-logo.png" alt="Graham" style={{ width: 72, height: 72, objectFit: 'contain', filter: 'invert(1) sepia(1) saturate(2) hue-rotate(5deg) brightness(0.85)', flexShrink: 0 }} />
          <div className="font-display text-gold-gradient" style={{ fontSize: 29, fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1 }}>Graham</div>
        </div>

        <div style={{ display: 'flex', gap: 36, fontSize: 13, color: 'var(--text-secondary)' }}>
          {([
            { label: 'Features',   id: 'features'   },
            { label: 'Philosophy', id: 'philosophy'  },
            { label: 'Pricing',    id: 'pricing'     },
          ] as { label: string; id: string }[]).map(({ label, id }) => (
            <span
              key={label}
              onClick={() => scrollTo(id)}
              style={{ cursor: 'pointer', transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = label === 'Pricing' ? 'var(--gold)' : 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            >
              {label}
            </span>
          ))}
        </div>

        <Link href="/protected">
          <button className="btn-gold" style={{ padding: '8px 22px', fontSize: 13 }}>Enter App →</button>
        </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', padding: '100px 56px 80px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle, rgba(200,169,110,0.12) 1px, transparent 1px)', backgroundSize: '38px 38px', opacity: 0.7 }} />
        <div style={{ position: 'absolute', top: '15%', left: '20%', width: 700, height: 600, background: 'radial-gradient(ellipse, rgba(200,169,110,0.07) 0%, transparent 65%)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', maxWidth: 1280, margin: '0 auto', width: '100%', position: 'relative', zIndex: 1 }}>
        <div style={{ flex: 1, maxWidth: 620 }}>
          <div className="badge-neutral animate-fade-in" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 32, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', boxShadow: '0 0 6px var(--green)' }} />
            Built for long-term investors
          </div>
          <h1 className="font-display animate-fade-up d1" style={{ fontSize: 80, fontWeight: 500, lineHeight: 0.92, letterSpacing: '-0.035em', marginBottom: 30 }}>
            <span className="text-gold-gradient">Invest</span><br />with conviction.
          </h1>
          <p className="animate-fade-up d3" style={{ fontSize: 17, color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 520, marginBottom: 44 }}>
            Graham unifies intrinsic valuation, portfolio optimisation, and qualitative research — purpose-built for disciplined, long-horizon capital allocation.
          </p>
          <div className="animate-fade-up d4" style={{ display: 'flex', gap: 12, marginBottom: 80 }}>
            <Link href="/protected"><button className="btn-gold animate-pulse-gold" style={{ padding: '13px 32px', fontSize: 14 }}>Open Graham ↗</button></Link>
            <button className="btn-ghost" style={{ padding: '13px 28px', fontSize: 14 }} onClick={() => scrollTo('features')}>Explore Features ↓</button>
          </div>
          <div className="animate-fade-up d5" style={{ display: 'flex', alignItems: 'center', gap: 0, paddingTop: 28, borderTop: '1px solid var(--border)' }}>
            {([
              { icon: '⊞', label: 'DCF Valuation' },
              { icon: '◎', label: 'Portfolio Optimiser' },
              { icon: '△', label: 'Technical Analysis' },
              { icon: '◐', label: 'Tail Risk' },
            ] as { icon: string; label: string }[]).map((f, i) => (
              <div key={f.label} style={{ display: 'flex', alignItems: 'center' }}>
                {i > 0 && <div style={{ width: 1, height: 28, background: 'var(--border)', margin: '0 20px' }} />}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--gold)', opacity: 0.75 }}>{f.icon}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{f.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="animate-fade-up d2" style={{ position: 'relative', width: 460, flexShrink: 0, marginLeft: 80, marginTop: 48 }}>
          <div className="card glow-gold" style={{ padding: '26px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Portfolio Value</div>
                <div className="font-display" style={{ fontSize: 32, fontWeight: 500, marginTop: 5, letterSpacing: '-0.02em' }}>$300,820</div>
              </div>
              <span className="badge-up" style={{ marginTop: 4 }}>+18.3% YTD</span>
            </div>
            <div style={{ height: 140 }}><HeroChart /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 10.5, color: 'var(--text-muted)' }}><span>Mar 2024</span><span>Mar 2025</span></div>
            <div className="divider" style={{ margin: '16px 0' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[{ t: 'AAPL', n: 'Apple Inc.', v: '$84.2k', g: '+18.4%' }, { t: 'MSFT', n: 'Microsoft Corp.', v: '$66.2k', g: '+24.1%' }, { t: 'GOOGL', n: 'Alphabet Inc.', v: '$51.1k', g: '+31.7%' }].map(h => (
                <div key={h.t} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', width: 42 }}>{h.t}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{h.n}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <span style={{ fontSize: 12.5 }}>{h.v}</span>
                    <span className="badge-up" style={{ fontSize: 10.5 }}>{h.g}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card-elevated animate-fade-in d5" style={{ position: 'absolute', top: -22, right: -28, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)' }} />
            <div>
              <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Sharpe Ratio</div>
              <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--green)' }}>1.42</div>
            </div>
          </div>
          <div className="card-elevated animate-fade-in d6" style={{ position: 'absolute', bottom: -20, left: -32, padding: '10px 16px', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
            <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>Intrinsic Value · AAPL</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <span style={{ fontSize: 17, fontWeight: 600 }}>$186.40</span>
              <span className="badge-down" style={{ fontSize: 10 }}>−12.7% upside</span>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding: '100px 56px', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ marginBottom: 60 }}>
          <div style={{ fontSize: 10.5, color: 'var(--gold)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 16 }}>Platform</div>
          <h2 className="font-display" style={{ fontSize: 54, fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1, maxWidth: 480 }}>Six instruments.<br />One discipline.</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{ padding: '40px 38px', background: 'var(--bg-surface)', borderRight: (i + 1) % 3 !== 0 ? '1px solid var(--border)' : 'none', borderBottom: i < 3 ? '1px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-surface)')}>
              <div style={{ fontSize: 24, marginBottom: 18, color: 'var(--gold)', opacity: 0.85 }}>{f.icon}</div>
              <div className="font-display" style={{ fontSize: 20, fontWeight: 500, marginBottom: 10 }}>{f.title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.75 }}>{f.desc}</div>
            </div>
          ))}
        </div>
        </div>
      </section>

      {/* ── PHILOSOPHY ── */}
      <section id="philosophy" style={{ padding: '120px 56px', background: 'var(--bg-surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 900, height: 500, background: 'radial-gradient(ellipse, rgba(200,169,110,0.05) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 840, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 10.5, color: 'var(--gold)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 36 }}>Philosophy</div>
          <blockquote className="font-display" style={{ fontSize: 40, fontWeight: 400, lineHeight: 1.3, letterSpacing: '-0.02em', marginBottom: 24, fontStyle: 'italic' }}>
            "The stock market is a device for transferring money from the impatient to the patient."
          </blockquote>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', letterSpacing: '0.07em', marginBottom: 72 }}>— Warren Buffett</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 52 }}>
            {PRINCIPLES.map(p => (
              <div key={p.heading} style={{ textAlign: 'left' }}>
                <div style={{ width: 28, height: 1, background: 'var(--gold)', marginBottom: 20 }} />
                <div className="font-display" style={{ fontSize: 19, fontWeight: 500, marginBottom: 10 }}>{p.heading}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.8 }}>{p.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ padding: '110px 56px', borderBottom: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
        {/* Background glow */}
        <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)', width: 800, height: 600, background: 'radial-gradient(ellipse, rgba(200,169,110,0.06) 0%, transparent 65%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontSize: 10.5, color: 'var(--gold)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 16 }}>Pricing</div>
            <h2 className="font-display" style={{ fontSize: 54, fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1, marginBottom: 16 }}>
              Built to scale with<br />your conviction.
            </h2>
            <p style={{ fontSize: 15, color: 'var(--text-muted)', maxWidth: 440, margin: '0 auto 36px', lineHeight: 1.7 }}>
              Start free and upgrade as your portfolio grows. No hidden fees — pay only for the depth you need.
            </p>

            {/* Billing toggle */}
            <div style={{ display: 'inline-flex', alignItems: 'center', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 100, padding: 4, gap: 2 }}>
              <button
                onClick={() => setAnnual(false)}
                style={{ padding: '7px 20px', borderRadius: 100, fontSize: 12.5, fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'all 0.2s', background: !annual ? 'var(--bg-hover)' : 'transparent', color: !annual ? 'var(--text-primary)' : 'var(--text-muted)' }}
              >
                Monthly
              </button>
              <button
                onClick={() => setAnnual(true)}
                style={{ padding: '7px 20px', borderRadius: 100, fontSize: 12.5, fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'all 0.2s', background: annual ? 'var(--bg-hover)' : 'transparent', color: annual ? 'var(--gold)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                Annual
                <span style={{ fontSize: 10, background: 'rgba(61,214,140,0.15)', color: 'var(--green)', padding: '2px 7px', borderRadius: 100, fontWeight: 600, letterSpacing: '0.04em' }}>Save 20%</span>
              </button>
            </div>
          </div>

          {/* Tier cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, maxWidth: 1100, margin: '0 auto' }}>
            {TIERS.map((tier) => {
              const price = annual ? tier.annualPrice : tier.monthlyPrice
              return (
                <div
                  key={tier.name}
                  style={{
                    background: tier.highlight ? 'var(--bg-surface)' : 'var(--bg-base)',
                    border: tier.highlight ? '1px solid var(--gold-dim)' : '1px solid var(--border)',
                    borderRadius: 16,
                    padding: '36px 32px',
                    position: 'relative',
                    boxShadow: tier.highlight ? '0 0 40px rgba(200,169,110,0.1)' : 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                  onMouseEnter={e => { if (!tier.highlight) { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-bright)' } }}
                  onMouseLeave={e => { if (!tier.highlight) { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)' } }}
                >
                  {/* Badge */}
                  {tier.badge && (
                    <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, var(--gold-bright), var(--gold))', color: '#0A0C12', fontSize: 10.5, fontWeight: 700, padding: '4px 14px', borderRadius: 100, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                      ★ {tier.badge}
                    </div>
                  )}

                  {/* Plan name */}
                  <div style={{ marginBottom: 4 }}>
                    <div className="font-display" style={{ fontSize: 22, fontWeight: 500, color: tier.highlight ? 'var(--gold)' : 'var(--text-primary)' }}>{tier.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>{tier.tagline}</div>
                  </div>

                  {/* Price */}
                  <div style={{ margin: '28px 0 24px', paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span className="font-display" style={{ fontSize: price === 0 ? 42 : 52, fontWeight: 500, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
                        {price === 0 ? 'Free' : `$${price}`}
                      </span>
                      {price > 0 && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>/ mo{annual ? ', billed annually' : ''}</span>}
                    </div>
                    {annual && price > 0 && (
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                        <span style={{ textDecoration: 'line-through', marginRight: 6 }}>${tier.monthlyPrice}/mo</span>
                        <span style={{ color: 'var(--green)' }}>You save ${(tier.monthlyPrice - price) * 12}/yr</span>
                      </div>
                    )}
                  </div>

                  {/* Feature list */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                    {tier.features.map((f) => (
                      <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 13, color: f.on ? 'var(--green)' : 'var(--text-muted)', opacity: f.on ? 1 : 0.4, flexShrink: 0 }}>
                          {f.on ? '✓' : '✕'}
                        </span>
                        <span style={{ fontSize: 12.5, color: f.on ? 'var(--text-secondary)' : 'var(--text-muted)', opacity: f.on ? 1 : 0.45 }}>{f.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  {tier.ctaStyle === 'gold' ? (
                    <button className="btn-gold" style={{ width: '100%', padding: '13px', fontSize: 13.5, textAlign: 'center' }}>{tier.cta}</button>
                  ) : (
                    <button className="btn-ghost" style={{ width: '100%', padding: '13px', fontSize: 13.5, textAlign: 'center' }}>{tier.cta}</button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Fine print */}
          <div style={{ textAlign: 'center', marginTop: 32, fontSize: 11.5, color: 'var(--text-muted)' }}>
            No credit card required for Free tier · Cancel Pro anytime · Institutional contracts billed quarterly
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: '120px 56px', textAlign: 'center' }}>
        <div style={{ fontSize: 10.5, color: 'var(--gold)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 24 }}>Get Started</div>
        <h2 className="font-display" style={{ fontSize: 64, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 0.95, marginBottom: 28 }}>
          Start investing like<br /><span className="text-gold-gradient">you mean it.</span>
        </h2>
        <p style={{ fontSize: 15, color: 'var(--text-muted)', maxWidth: 480, margin: '0 auto 44px', lineHeight: 1.75 }}>
          Access portfolio optimisation, DCF valuation, qualitative research, and tail risk analysis — unified in one platform.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Link href="/protected"><button className="btn-gold animate-pulse-gold" style={{ padding: '14px 44px', fontSize: 15 }}>Open Graham ↗</button></Link>
          <button className="btn-ghost" style={{ padding: '14px 28px', fontSize: 15 }} onClick={() => scrollTo('pricing')}>View Pricing</button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ padding: '28px 56px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 1280, margin: '0 auto' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/images/graham-logo.png" alt="Graham" style={{ width: 28, height: 28, objectFit: 'contain', filter: 'invert(1) sepia(1) saturate(2) hue-rotate(5deg) brightness(0.85)' }} />
            <div className="font-display text-gold-gradient" style={{ fontSize: 19, fontWeight: 500 }}>Graham</div>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3, letterSpacing: '0.06em' }}>Long-Term Investment Intelligence</div>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'right' }}>
          <div>IS4228 · Spring 2025</div>
          <div style={{ marginTop: 3, opacity: 0.55 }}>Mock data only · Not financial advice</div>
        </div>
        </div>
      </footer>

    </div>
  )
}
