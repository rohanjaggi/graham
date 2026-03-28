'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/* ─── GOOGLE ICON ───────────────────────────────────────────────────────── */

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

/* ─── AUTH PAGE ─────────────────────────────────────────────────────────── */

export default function AuthPage() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (mode === 'signup') {
      if (password !== confirm) {
        setError('Passwords do not match.')
        setLoading(false)
        return
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) { setError(error.message); setLoading(false); return }
      // Show confirmation prompt — don't redirect yet
      setAwaitingConfirmation(true)
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      // Route to onboarding if profile not yet completed
      const profileComplete = data.user?.user_metadata?.profile_complete
      window.location.href = profileComplete ? '/protected' : '/onboarding'
    }

    setLoading(false)
  }

  async function handleGoogle() {
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setGoogleLoading(false) }
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
    }}>
      {/* Dot grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle, rgba(200,169,110,0.11) 1px, transparent 1px)',
        backgroundSize: '36px 36px',
      }} />
      {/* Radial glow */}
      <div style={{
        position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 600,
        background: 'radial-gradient(circle, rgba(200,169,110,0.07) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      <div className="animate-fade-up" style={{ width: '100%', maxWidth: 420, padding: '0 24px', position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div className="font-display text-gold-gradient" style={{ fontSize: 34, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1 }}>
            Graham
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 6 }}>
            Long-Term Intelligence
          </div>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '36px 32px' }}>

          {/* ── Email confirmation screen ── */}
          {awaitingConfirmation && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 20 }}>✉️</div>
              <div className="font-display" style={{ fontSize: 22, fontWeight: 500, marginBottom: 10 }}>
                Check your inbox.
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 24 }}>
                We sent a confirmation link to<br />
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{email}</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', lineHeight: 1.6, marginBottom: 24 }}>
                Click the link in the email to confirm your address, then return here to sign in.
              </div>
              <button
                className="btn-ghost"
                style={{ width: '100%', padding: '11px' }}
                onClick={() => { setAwaitingConfirmation(false); setMode('login') }}
              >
                Back to Sign In
              </button>
            </div>
          )}

          {/* ── Normal auth form ── */}
          {!awaitingConfirmation && (<>
          {/* Tab toggle */}
          <div className="tab-bar" style={{ marginBottom: 28 }}>
            <button
              className={`tab${mode === 'login' ? ' active' : ''}`}
              onClick={() => { setMode('login'); setError('') }}
              style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
            >
              Sign In
            </button>
            <button
              className={`tab${mode === 'signup' ? ' active' : ''}`}
              onClick={() => { setMode('signup'); setError('') }}
              style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
            >
              Create Account
            </button>
          </div>

          {/* Heading */}
          <div style={{ marginBottom: 24 }}>
            <div className="font-display" style={{ fontSize: 22, fontWeight: 500 }}>
              {mode === 'login' ? 'Welcome back.' : 'Begin your journey.'}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
              {mode === 'login'
                ? 'Sign in to access your portfolio.'
                : 'Create an account to get started.'}
            </div>
          </div>

          {/* Google OAuth */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 10, padding: '10px 16px',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)',
              borderRadius: 8, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
              fontSize: 13.5, color: 'var(--text-primary)',
              transition: 'border-color 0.2s, background 0.2s',
              marginBottom: 20, opacity: googleLoading ? 0.7 : 1,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-elevated)' }}
          >
            <GoogleIcon />
            {googleLoading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11.5, color: 'var(--text-muted)', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                EMAIL ADDRESS
              </label>
              <input
                className="input-dark"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label style={{ fontSize: 11.5, color: 'var(--text-muted)', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                PASSWORD
              </label>
              <input
                className="input-dark"
                type="password"
                placeholder={mode === 'signup' ? 'Minimum 8 characters' : '••••••••'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            </div>

            {mode === 'signup' && (
              <div>
                <label style={{ fontSize: 11.5, color: 'var(--text-muted)', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                  CONFIRM PASSWORD
                </label>
                <input
                  className="input-dark"
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{ fontSize: 12.5, color: 'var(--red)', background: 'var(--red-dim)', padding: '10px 14px', borderRadius: 6 }}>
                {error}
              </div>
            )}

            <button
              className="btn-gold"
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '12px', fontSize: 14, marginTop: 4, opacity: loading ? 0.7 : 1 }}
            >
              {loading
                ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
                : (mode === 'login' ? 'Sign In →' : 'Create Account →')}
            </button>
          </form>
          </>)}
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11.5, color: 'var(--text-muted)' }}>
          By continuing you agree to Graham's Terms of Service and Privacy Policy.
        </div>
      </div>
    </div>
  )
}
