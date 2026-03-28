'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/* ─── STEP DATA ──────────────────────────────────────────────────────────── */

const INVESTMENT_STYLES = [
  { id: 'value',   label: 'Value Investing',  desc: 'Deep fundamental analysis, margin of safety' },
  { id: 'growth',  label: 'Growth Investing', desc: 'High-quality compounders, long runway' },
  { id: 'blend',   label: 'Blend',            desc: 'Quality at a reasonable price' },
  { id: 'income',  label: 'Income',           desc: 'Dividends, cash-flow focused' },
]

const EXPERIENCE_OPTIONS = ['< 1 year', '1–3 years', '3–5 years', '5–10 years', '10+ years']

const RISK_OPTIONS = [
  { id: 'conservative', label: 'Conservative', desc: 'Capital preservation is paramount' },
  { id: 'moderate',     label: 'Moderate',     desc: 'Balanced growth and protection' },
  { id: 'aggressive',   label: 'Aggressive',   desc: 'Maximum long-run compounding' },
]

const PORTFOLIO_SIZES = ['< $10k', '$10k–$50k', '$50k–$250k', '$250k–$1M', '$1M+']

const GOALS = [
  'Capital appreciation',
  'Retirement nest egg',
  'Dividend income',
  'Wealth preservation',
  'Financial independence',
]

/* ─── SELECT CHIP ────────────────────────────────────────────────────────── */

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '9px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
        fontFamily: "'DM Sans', sans-serif",
        border: active ? '1px solid var(--gold-dim)' : '1px solid var(--border)',
        background: active ? 'rgba(200,169,110,0.1)' : 'var(--bg-elevated)',
        color: active ? 'var(--gold)' : 'var(--text-secondary)',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  )
}

/* ─── CARD OPTION ────────────────────────────────────────────────────────── */

function CardOption({ active, onClick, label, desc }: { active: boolean; onClick: () => void; label: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '16px 18px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
        fontFamily: "'DM Sans', sans-serif",
        border: active ? '1px solid var(--gold-dim)' : '1px solid var(--border)',
        background: active ? 'rgba(200,169,110,0.08)' : 'var(--bg-elevated)',
        transition: 'all 0.15s',
        width: '100%',
      }}
    >
      <div style={{ fontSize: 13.5, fontWeight: 500, color: active ? 'var(--gold)' : 'var(--text-primary)', marginBottom: 3 }}>
        {active ? '● ' : '○ '}{label}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{desc}</div>
    </button>
  )
}

/* ─── ONBOARDING ─────────────────────────────────────────────────────────── */

export default function Onboarding() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Step 1
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  // Step 2
  const [style, setStyle] = useState('')
  const [experience, setExperience] = useState('')

  // Step 3
  const [risk, setRisk] = useState('')
  const [portfolioSize, setPortfolioSize] = useState('')
  const [goal, setGoal] = useState('')

  const totalSteps = 3
  const progress = (step / totalSteps) * 100

  async function handleFinish() {
    setSaving(true)
    setError('')

    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: `${firstName} ${lastName}`.trim(),
        first_name: firstName,
        last_name: lastName,
        investment_style: style,
        experience,
        risk_tolerance: risk,
        portfolio_size: portfolioSize,
        primary_goal: goal,
        profile_complete: true,
      },
    })

    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }

    window.location.href = '/protected'
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif",
      position: 'relative',
      overflow: 'hidden',
      padding: '40px 24px',
    }}>
      {/* Dot grid */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle, rgba(200,169,110,0.1) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
      <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 700, height: 600, background: 'radial-gradient(circle, rgba(200,169,110,0.06) 0%, transparent 65%)', pointerEvents: 'none' }} />

      <div className="animate-fade-up" style={{ width: '100%', maxWidth: 520, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div className="font-display text-gold-gradient" style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em' }}>Graham</div>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Step {step} of {totalSteps}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {step === 1 ? 'Identity' : step === 2 ? 'Investment Style' : 'Portfolio Profile'}
            </span>
          </div>
          <div style={{ height: 3, background: 'var(--border)', borderRadius: 100, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, var(--gold-bright), var(--gold))', borderRadius: 100, transition: 'width 0.4s cubic-bezier(0.16,1,0.3,1)' }} />
          </div>
        </div>

        <div className="card" style={{ padding: '36px 32px' }}>

          {/* ── STEP 1: Identity ── */}
          {step === 1 && (
            <div>
              <div className="font-display" style={{ fontSize: 26, fontWeight: 500, marginBottom: 6 }}>
                Welcome to Graham.
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 28, lineHeight: 1.6 }}>
                Let's set up your profile. This helps us personalise your experience.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>First Name</label>
                  <input className="input-dark" placeholder="Benjamin" value={firstName} onChange={e => setFirstName(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Last Name</label>
                  <input className="input-dark" placeholder="Graham" value={lastName} onChange={e => setLastName(e.target.value)} />
                </div>
              </div>

              <button
                className="btn-gold"
                onClick={() => firstName.trim() && setStep(2)}
                disabled={!firstName.trim()}
                style={{ width: '100%', padding: '12px', fontSize: 14, marginTop: 28, opacity: firstName.trim() ? 1 : 0.5 }}
              >
                Continue →
              </button>
            </div>
          )}

          {/* ── STEP 2: Investment Style ── */}
          {step === 2 && (
            <div>
              <div className="font-display" style={{ fontSize: 26, fontWeight: 500, marginBottom: 6 }}>
                Your investment style.
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
                How do you approach capital allocation?
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                {INVESTMENT_STYLES.map(s => (
                  <CardOption key={s.id} active={style === s.id} onClick={() => setStyle(s.id)} label={s.label} desc={s.desc} />
                ))}
              </div>

              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
                  Years investing
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {EXPERIENCE_OPTIONS.map(e => (
                    <Chip key={e} active={experience === e} onClick={() => setExperience(e)}>{e}</Chip>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-ghost" onClick={() => setStep(1)} style={{ flex: 1, padding: '11px' }}>← Back</button>
                <button
                  className="btn-gold"
                  onClick={() => style && experience && setStep(3)}
                  disabled={!style || !experience}
                  style={{ flex: 2, padding: '11px', opacity: style && experience ? 1 : 0.5 }}
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Portfolio Profile ── */}
          {step === 3 && (
            <div>
              <div className="font-display" style={{ fontSize: 26, fontWeight: 500, marginBottom: 6 }}>
                Portfolio profile.
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
                One last step — tell us about your portfolio goals.
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Risk Tolerance</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {RISK_OPTIONS.map(r => (
                    <CardOption key={r.id} active={risk === r.id} onClick={() => setRisk(r.id)} label={r.label} desc={r.desc} />
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
                  Portfolio size (approximate)
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {PORTFOLIO_SIZES.map(s => (
                    <Chip key={s} active={portfolioSize === s} onClick={() => setPortfolioSize(s)}>{s}</Chip>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
                  Primary goal
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {GOALS.map(g => (
                    <Chip key={g} active={goal === g} onClick={() => setGoal(g)}>{g}</Chip>
                  ))}
                </div>
              </div>

              {error && (
                <div style={{ fontSize: 12.5, color: 'var(--red)', background: 'var(--red-dim)', padding: '10px 14px', borderRadius: 6, marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-ghost" onClick={() => setStep(2)} style={{ flex: 1, padding: '11px' }}>← Back</button>
                <button
                  className="btn-gold"
                  onClick={handleFinish}
                  disabled={!risk || !portfolioSize || !goal || saving}
                  style={{ flex: 2, padding: '11px', fontSize: 14, opacity: risk && portfolioSize && goal ? 1 : 0.5 }}
                >
                  {saving ? 'Saving…' : 'Enter Graham ↗'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11.5, color: 'var(--text-muted)' }}>
          Your data is stored securely and never sold to third parties.
        </div>
      </div>
    </div>
  )
}
