import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const ScopeSchema = z.enum(['valuation', 'research'])

const SearchItemSchema = z.object({
  symbol: z.string().trim().min(1).max(20),
  description: z.string().trim().min(1).max(200),
  scope: ScopeSchema,
})

type RecentSearchItem = {
  symbol: string
  description: string
  scope: 'valuation' | 'research'
  updatedAt: string
}

const RECENT_SEARCH_CACHE_TTL_MS = 30 * 1000

declare global {
  var __grahamRecentSearchCache: Map<string, { data: RecentSearchItem[]; expiresAt: number }> | undefined
}

const recentSearchCache = globalThis.__grahamRecentSearchCache ?? new Map<string, { data: RecentSearchItem[]; expiresAt: number }>()
globalThis.__grahamRecentSearchCache = recentSearchCache

function normalizeRecentSearches(userMetadata: unknown): RecentSearchItem[] {
  if (!userMetadata || typeof userMetadata !== 'object') return []

  const raw = (userMetadata as { recentSearches?: unknown }).recentSearches
  if (!Array.isArray(raw)) return []

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const symbol = typeof (item as { symbol?: unknown }).symbol === 'string'
        ? (item as { symbol: string }).symbol.trim().toUpperCase()
        : ''
      const description = typeof (item as { description?: unknown }).description === 'string'
        ? (item as { description: string }).description.trim()
        : ''
      const scope = typeof (item as { scope?: unknown }).scope === 'string'
        && ((item as { scope: string }).scope === 'valuation' || (item as { scope: string }).scope === 'research')
        ? (item as { scope: 'valuation' | 'research' }).scope
        : null
      const updatedAtRaw = typeof (item as { updatedAt?: unknown }).updatedAt === 'string'
        ? (item as { updatedAt: string }).updatedAt
        : ''
      const updatedAt = updatedAtRaw && !Number.isNaN(Date.parse(updatedAtRaw))
        ? updatedAtRaw
        : new Date().toISOString()

      if (!symbol || !description || !scope) return null
      return { symbol, description, scope, updatedAt }
    })
    .filter((item): item is RecentSearchItem => Boolean(item))
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const scopeResult = ScopeSchema.safeParse(request.nextUrl.searchParams.get('scope') ?? 'valuation')
  if (!scopeResult.success) {
    return NextResponse.json({ error: 'Invalid scope.' }, { status: 400 })
  }

  const cacheKey = `${user.id}:${scopeResult.data}`
  const cached = recentSearchCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ searches: cached.data })
  }

  const items = normalizeRecentSearches(user.user_metadata)
    .filter((item) => item.scope === scopeResult.data)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8)

  recentSearchCache.set(cacheKey, {
    data: items,
    expiresAt: Date.now() + RECENT_SEARCH_CACHE_TTL_MS,
  })

  return NextResponse.json({ searches: items })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = SearchItemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid recent-search payload.' }, { status: 400 })
  }

  const normalizedSymbol = parsed.data.symbol.toUpperCase()
  const now = new Date().toISOString()
  const existing = normalizeRecentSearches(user.user_metadata)
  const deduped = existing.filter((item) => !(item.scope === parsed.data.scope && item.symbol === normalizedSymbol))
  const next: RecentSearchItem[] = [
    {
      symbol: normalizedSymbol,
      description: parsed.data.description,
      scope: parsed.data.scope,
      updatedAt: now,
    },
    ...deduped,
  ].slice(0, 24)

  const { error: updateError } = await supabase.auth.updateUser({
    data: {
      ...(user.user_metadata ?? {}),
      recentSearches: next,
    },
  })

  if (updateError) {
    return NextResponse.json({ error: 'Unable to save recent search.' }, { status: 500 })
  }

  recentSearchCache.delete(`${user.id}:valuation`)
  recentSearchCache.delete(`${user.id}:research`)

  return NextResponse.json({ ok: true })
}
