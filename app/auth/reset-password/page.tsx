'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }

    setDone(true)
    setLoading(false)
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

        <div className="card" style={{ padding: '36px 32px' }}>
          {done ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 20 }}>✓</div>
              <div className="font-display" style={{ fontSize: 22, fontWeight: 500, marginBottom: 10 }}>
                Password updated.
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 24 }}>
                Your password has been changed successfully.
              </div>
              <a
                href="/auth"
                className="btn-gold"
                style={{ display: 'block', width: '100%', padding: '12px', fontSize: 14, textAlign: 'center', textDecoration: 'none' }}
              >
                Sign In →
              </a>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 24 }}>
                <div className="font-display" style={{ fontSize: 22, fontWeight: 500 }}>
                  Set a new password.
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
                  Choose a strong password for your account.
                </div>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11.5, color: 'var(--text-muted)', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                    NEW PASSWORD
                  </label>
                  <input
                    className="input-dark"
                    type="password"
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>

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
                  {loading ? 'Updating…' : 'Update Password →'}
                </button>
              </form>
            </>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11.5, color: 'var(--text-muted)' }}>
          By continuing you agree to Graham's Terms of Service and Privacy Policy.
        </div>
      </div>
    </div>
  )
}
