'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type NavItem = { label: string; href?: string }

type UserProfile = {
  email: string
  firstName: string
  fullName: string
}

function ProfileModal({ profile, onClose, onSave }: {
  profile: UserProfile
  onClose: () => void
  onSave: (firstName: string) => Promise<void>
}) {
  const [firstName, setFirstName] = useState(profile.firstName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSave() {
    if (!firstName.trim()) return
    setSaving(true)
    setError('')
    setSuccess(false)
    try {
      await onSave(firstName.trim())
      setSuccess(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-bright)',
        borderRadius: 14, padding: '32px 36px', width: 400,
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Profile
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1, padding: 4 }}
          >
            ×
          </button>
        </div>

        {/* Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--gold-bright), var(--gold))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 700, color: '#0A0C12', flexShrink: 0,
          }}>
            {firstName?.[0]?.toUpperCase() ?? '·'}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              {firstName || '—'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {profile.email}
            </div>
          </div>
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              Display Name
            </label>
            <input
              className="input-dark"
              value={firstName}
              onChange={e => { setFirstName(e.target.value); setSuccess(false) }}
              onKeyDown={e => { if (e.key === 'Enter') void handleSave() }}
              placeholder="Your name"
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              Email
            </label>
            <input
              className="input-dark"
              value={profile.email}
              disabled
              style={{ width: '100%', opacity: 0.5, cursor: 'not-allowed' }}
            />
          </div>
        </div>

        {/* Feedback */}
        {error && (
          <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 12 }}>{error}</div>
        )}
        {success && (
          <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 12 }}>Name updated successfully.</div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              fontSize: 13, padding: '8px 18px', borderRadius: 6,
              background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)',
              cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !firstName.trim()}
            style={{
              fontSize: 13, padding: '8px 18px', borderRadius: 6,
              background: 'linear-gradient(135deg, var(--gold-bright), var(--gold))',
              border: 'none', color: '#0A0C12', fontWeight: 600,
              cursor: saving || !firstName.trim() ? 'not-allowed' : 'pointer',
              opacity: saving || !firstName.trim() ? 0.6 : 1,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

const NAV: { section: string; items: NavItem[] }[] = [
  { section: 'ANALYSIS',  items: [{ label: 'Overview', href: '/protected' }, { label: 'Research', href: '/protected/research' }, { label: 'Technical' }] },
  { section: 'ANALYSIS',  items: [{ label: 'Overview', href: '/protected' }, { label: 'Research', href: '/protected/research' }, { label: 'Technical' }] },
  { section: 'VALUATION', items: [{ label: 'Valuation', href: '/protected/valuation' }] },
  { section: 'PORTFOLIO', items: [{ label: 'Optimiser', href: '/protected/optimiser' }, { label: 'Portfolios', href: '/protected/portfolios' }, { label: 'Tail Risk', href: '/protected/tail-risk' }] },
  { section: 'PORTFOLIO', items: [{ label: 'Optimiser', href: '/protected/optimiser' }, { label: 'Portfolios', href: '/protected/portfolios' }, { label: 'Tail Risk', href: '/protected/tail-risk' }] },
]

function Sidebar() {
  const pathname = usePathname()

  function isActive(href: string | undefined): boolean {
    if (href === '/protected') return pathname === '/protected'
    if (href) return pathname === href || pathname.startsWith(`${href}/`)
    return false
  }

  return (
    <aside style={{
      width: 224, minWidth: 224, height: '100vh',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      padding: '0 14px',
    }}>
      <div style={{ padding: '0 6px 14px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
        <Link href="/protected" style={{ textDecoration: 'none', color: 'inherit' }}>
          <img src="/images/graham-logo.png" alt="Graham" style={{ width: 140, height: 140, objectFit: 'contain', filter: 'invert(1) sepia(1) saturate(2) hue-rotate(5deg) brightness(0.85)', display: 'block', margin: '-15px auto -30px' }} />
          <div className="font-display text-gold-gradient" style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1 }}>
            Graham
          </div>
        </Link>
        <div style={{ fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '0.13em', marginTop: 5, textTransform: 'uppercase' }}>
          Long-Term Intelligence
        </div>
      </div>

      <nav style={{ flex: 1, paddingTop: 18, overflowY: 'auto' }}>
        {NAV.map(({ section, items }) => (
          <div key={section} style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.13em', color: 'var(--text-muted)', padding: '0 14px 8px', textTransform: 'uppercase' }}>
              {section}
            </div>
            {items.map(({ label, href }) => {
              const icon =
                label === 'Overview' ? '⬡' : label === 'Research' ? '⊕' : label === 'Technical' ? '△' :
                label === 'Valuation' ? '⊞' :
                label === 'Portfolios' ? '●' :
                label === 'Portfolios' ? '●' :
                label === 'Optimiser' ? '◎' : '◐'
              const active = href ? isActive(href) : false
              const inner = (
                <>
                  <span style={{ fontSize: 13, opacity: 0.75 }}>{icon}</span>
                  {label}
                </>
              )
              if (href) {
                return (
                  <Link key={label} href={href} className={`nav-item${active ? ' active' : ''}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 10 }}>
                    {inner}
                  </Link>
                )
              }
              return (
                <div key={label} className="nav-item">
                  <span style={{ fontSize: 13, opacity: 0.75 }}>{icon}</span>
                  {label}
                </div>
              )
            })}
          </div>
        ))}
      </nav>

      <div style={{ padding: '16px 6px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>IS4228 · Spring 2025</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.5, marginTop: 3 }}>v0.1.0 · mock data</div>
      </div>
    </aside>
  )
}

const FALLBACK_INDICES = [
  { label: 'S&P 500', val: '—', chg: '—', up: true },
  { label: 'NASDAQ',  val: '—', chg: '—', up: true },
  { label: '20+Y UST', val: '—', chg: '—', up: true },
]

type IndexItem = { label: string; val: string; chg: string; up: boolean }
type SearchResult = { symbol: string; description: string }
const TICKER_PATTERN = /^[A-Z][A-Z0-9.-]{0,9}$/

async function tickerExists(symbol: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/ticker/${encodeURIComponent(symbol)}`)
    return response.ok
  } catch {
    return false
  }
}

async function resolveBestSymbol(rawQuery: string, seededResults: SearchResult[] = []): Promise<string | null> {
  const trimmed = rawQuery.trim()
  if (!trimmed) return null

  const uppercase = trimmed.toUpperCase()
  const ranked = seededResults.length > 0
    ? seededResults
    : await fetch(`/api/ticker/search?q=${encodeURIComponent(trimmed)}`)
        .then((response) => response.ok ? response.json() : [])
        .then((data) => Array.isArray(data) ? data : [])
        .catch(() => [])

  const normalized = ranked.filter((item): item is SearchResult => {
    return typeof item?.symbol === 'string' && typeof item?.description === 'string'
  })

  const exact = normalized.find((item) => item.symbol.toUpperCase() === uppercase)
  if (exact) return exact.symbol.toUpperCase()

  if (TICKER_PATTERN.test(uppercase) && await tickerExists(uppercase)) {
    return uppercase
  }

  return normalized[0]?.symbol?.toUpperCase() ?? (TICKER_PATTERN.test(uppercase) ? uppercase : null)
}
const TICKER_PATTERN = /^[A-Z][A-Z0-9.-]{0,9}$/

async function tickerExists(symbol: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/ticker/${encodeURIComponent(symbol)}`)
    return response.ok
  } catch {
    return false
  }
}

async function resolveBestSymbol(rawQuery: string, seededResults: SearchResult[] = []): Promise<string | null> {
  const trimmed = rawQuery.trim()
  if (!trimmed) return null

  const uppercase = trimmed.toUpperCase()
  const ranked = seededResults.length > 0
    ? seededResults
    : await fetch(`/api/ticker/search?q=${encodeURIComponent(trimmed)}`)
        .then((response) => response.ok ? response.json() : [])
        .then((data) => Array.isArray(data) ? data : [])
        .catch(() => [])

  const normalized = ranked.filter((item): item is SearchResult => {
    return typeof item?.symbol === 'string' && typeof item?.description === 'string'
  })

  const exact = normalized.find((item) => item.symbol.toUpperCase() === uppercase)
  if (exact) return exact.symbol.toUpperCase()

  if (TICKER_PATTERN.test(uppercase) && await tickerExists(uppercase)) {
    return uppercase
  }

  return normalized[0]?.symbol?.toUpperCase() ?? (TICKER_PATTERN.test(uppercase) ? uppercase : null)
}

function TopBar() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [initial, setInitial] = useState('·')
  const [indices, setIndices] = useState<IndexItem[]>(FALLBACK_INDICES)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile>({ email: '', firstName: '', fullName: '' })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then((response: {
      data: {
        user: {
          user_metadata?: { first_name?: string; full_name?: string }
          email?: string
        } | null
      }
    }) => {
      if (!response.data.user) return
      const meta = response.data.user.user_metadata
<<<<<<< HEAD
      const email = response.data.user.email ?? ''
      const firstName = meta?.first_name || meta?.full_name?.split(' ')[0] || email.split('@')[0] || 'User'
      const fullName = meta?.full_name || firstName
      setDisplayName(firstName)
      setInitial(firstName[0].toUpperCase())
      setUserProfile({ email, firstName, fullName })
=======
      const name = meta?.first_name || meta?.full_name?.split(' ')[0] || response.data.user.email?.split('@')[0] || 'User'
      setDisplayName(name)
      setInitial(name[0].toUpperCase())
      setUserProfile({
        email: response.data.user.email ?? '',
        firstName: meta?.first_name ?? name,
        fullName: meta?.full_name ?? '',
      })
>>>>>>> 1845f35 (fix: handle profile save)
    })

    async function loadMarket() {
      try {
        const res = await fetch('/api/market')
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data) && data.length > 0) setIndices(data)
        }
      } catch { /* ignore */ }
    }
    loadMarket()
    const id = setInterval(loadMarket, 60_000)

    function onClickOutside(e: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => {
      clearInterval(id)
      document.removeEventListener('mousedown', onClickOutside)
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!val.trim()) { setResults([]); setOpen(false); setSearching(false); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/ticker/search?q=${encodeURIComponent(val)}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data)
          setOpen(data.length > 0)
        }
      } catch { /* ignore */ }
      setSearching(false)
    }, 300)
  }

  function handleSelect(symbol: string) {
    setQuery('')
    setResults([])
    setOpen(false)
    router.push(`/protected/qa?ticker=${encodeURIComponent(symbol)}`)
  }

  async function handleSubmitSearch(rawQuery: string) {
    const trimmed = rawQuery.trim()
    if (!trimmed) return

    const resolved = await resolveBestSymbol(trimmed, results)
    if (resolved) handleSelect(resolved)
  }

<<<<<<< HEAD
  async function handleSaveProfile(newFirstName: string) {
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      data: { first_name: newFirstName, full_name: newFirstName },
    })
    if (error) throw new Error(error.message)
    setDisplayName(newFirstName)
    setInitial(newFirstName[0].toUpperCase())
    setUserProfile(p => ({ ...p, firstName: newFirstName, fullName: newFirstName }))
=======
  async function handleSaveProfile(firstName: string) {
    const supabase = createClient()
    await supabase.auth.updateUser({ data: { first_name: firstName } })
    setDisplayName(firstName)
    setInitial(firstName[0].toUpperCase())
    setUserProfile(prev => ({ ...prev, firstName }))
>>>>>>> 1845f35 (fix: handle profile save)
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth')
  }

  return (
    <>
    <header style={{
      height: 56, borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', padding: '0 28px', gap: 20,
      background: 'var(--bg-surface)',
    }}>
      <div ref={searchWrapRef} style={{ flex: 1, position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: searching ? 'var(--gold)' : 'var(--text-muted)', fontSize: 15, pointerEvents: 'none', transition: 'color 0.15s' }}>⌕</span>
        <input
          className="input-dark"
          style={{ paddingLeft: 36 }}
          placeholder="Search ticker or company..."
          placeholder="Search ticker or company..."
          value={query}
          onChange={handleQueryChange}
          onKeyDown={e => {
            if (e.key === 'Escape') { setOpen(false); setQuery('') }
            if (e.key === 'Enter') {
              e.preventDefault()
              void handleSubmitSearch(query)
            }
          }}
          onKeyDown={e => {
            if (e.key === 'Escape') { setOpen(false); setQuery('') }
            if (e.key === 'Enter') {
              e.preventDefault()
              void handleSubmitSearch(query)
            }
          }}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          autoComplete="off"
        />
        {open && results.length > 0 && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 100,
            background: 'var(--bg-surface)', border: '1px solid var(--border-bright)',
            borderRadius: 10, overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            {results.map((r, i) => (
              <button
                key={r.symbol}
                type="button"
                onClick={() => handleSelect(r.symbol)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                  fontFamily: "'DM Sans', sans-serif",
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)', letterSpacing: '0.03em', minWidth: 56, textAlign: 'left' }}>{r.symbol}</span>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', flex: 1, textAlign: 'left', paddingLeft: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>↗</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
        {indices.map((m: IndexItem) => (
          <div key={m.label} style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{m.label}</div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, marginTop: 1 }}>
              {m.val}{' '}
              <span style={{ color: m.up ? 'var(--green)' : 'var(--red)', fontSize: 11 }}>{m.chg}</span>
            </div>
          </div>
        ))}
        <div style={{ width: 1, height: 28, background: 'var(--border)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px',
              borderRadius: 6, transition: 'background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            title="Edit profile"
          >
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold-bright), var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#0A0C12', flexShrink: 0 }}>
              {initial}
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{displayName}</span>
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            style={{ fontSize: 11.5, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 4, transition: 'color 0.15s', fontFamily: "'DM Sans', sans-serif" }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
    {profileOpen && (
      <ProfileModal
        profile={userProfile}
        onClose={() => setProfileOpen(false)}
        onSave={handleSaveProfile}
      />
    )}
    </>
  )
}

const FALLBACK_TICKERS = [
  { sym: 'AAPL',  price: '—', chg: '—', up: true },
  { sym: 'MSFT',  price: '—', chg: '—', up: true },
  { sym: 'GOOGL', price: '—', chg: '—', up: true },
  { sym: 'AMZN',  price: '—', chg: '—', up: true },
  { sym: 'NVDA',  price: '—', chg: '—', up: true },
  { sym: 'BRK.B', price: '—', chg: '—', up: true },
  { sym: 'JPM',   price: '—', chg: '—', up: true },
  { sym: 'V',     price: '—', chg: '—', up: true },
  { sym: 'JNJ',   price: '—', chg: '—', up: true },
  { sym: 'MA',    price: '—', chg: '—', up: true },
  { sym: 'WMT',   price: '—', chg: '—', up: true },
  { sym: 'DIS',   price: '—', chg: '—', up: true },
]

type TickerItem = { sym: string; price: string; chg: string; up: boolean }

function TickerTape() {
  const [tickers, setTickers] = useState<TickerItem[]>(FALLBACK_TICKERS)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/quotes')
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data) && data.length > 0) setTickers(data)
        }
      } catch { /* ignore */ }
    }
    load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [])

  const items = [...tickers, ...tickers]
  return (
    <div className="ticker-wrap" style={{ height: 32, background: 'rgba(200,169,110,0.04)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>
      <div className="ticker-inner animate-ticker">
        {items.map((t, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 22px', fontSize: 11.5 }}>
            <span style={{ fontWeight: 600, color: 'var(--gold)', letterSpacing: '0.04em' }}>{t.sym}</span>
            <span style={{ color: 'var(--text-secondary)' }}>{t.price}</span>
            <span style={{ color: t.up ? 'var(--green)' : 'var(--red)', fontSize: 10.5 }}>{t.chg}</span>
            <span style={{ color: 'var(--border-bright)', fontSize: 10, marginLeft: 4 }}>·</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export function ProtectedShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar />
        <TickerTape />
        <main style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
          {children}
        </main>
      </div>
    </div>
  )
}


