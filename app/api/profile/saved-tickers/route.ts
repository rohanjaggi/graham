import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

type SavedTickerRow = {
  id: string
  symbol: string
  company_name: string | null
  created_at: string
  updated_at: string
}

const SAVED_TICKERS_CACHE_TTL_MS = 30 * 1000

type SavedTickerResponseItem = {
  id: string
  symbol: string
  companyName: string | null
  createdAt: string
  updatedAt: string
}

const SavedTickerSchema = z.object({
  symbol: z.string().trim().min(1).max(20),
  companyName: z.string().trim().min(1).max(200).nullable().optional(),
})

declare global {
  var __grahamSavedTickersCache: Map<string, { data: SavedTickerResponseItem[]; expiresAt: number }> | undefined
}

const savedTickersCache = globalThis.__grahamSavedTickersCache ?? new Map<string, { data: SavedTickerResponseItem[]; expiresAt: number }>()
globalThis.__grahamSavedTickersCache = savedTickersCache

export async function GET() {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const cacheKey = authData.user.id
  const cached = savedTickersCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data)
  }

  const { data, error } = await supabase
    .from('user_saved_tickers')
    .select('id, symbol, company_name, created_at, updated_at')
    .eq('user_id', authData.user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching saved tickers', error)
    return NextResponse.json({ error: 'Failed to fetch saved tickers' }, { status: 500 })
  }

  const rows = Array.isArray(data) ? (data as SavedTickerRow[]) : []
  const response = rows.map((row) => ({
    id: row.id,
    symbol: row.symbol,
    companyName: row.company_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))

  savedTickersCache.set(cacheKey, {
    data: response,
    expiresAt: Date.now() + SAVED_TICKERS_CACHE_TTL_MS,
  })

  return NextResponse.json(response)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = SavedTickerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid saved ticker payload' }, { status: 400 })
  }

  const symbol = parsed.data.symbol.toUpperCase()
  const companyName = parsed.data.companyName?.trim() || null

  const { data, error } = await supabase
    .from('user_saved_tickers')
    .upsert(
      {
        user_id: authData.user.id,
        symbol,
        company_name: companyName,
      },
      { onConflict: 'user_id,symbol' }
    )
    .select('id, symbol, company_name, created_at, updated_at')
    .single()

  if (error) {
    console.error('Error saving ticker', error)
    return NextResponse.json({ error: 'Failed to save ticker' }, { status: 500 })
  }

  savedTickersCache.delete(authData.user.id)

  return NextResponse.json({
    id: data.id,
    symbol: data.symbol,
    companyName: data.company_name,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = SavedTickerSchema.pick({ symbol: true }).safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid delete payload' }, { status: 400 })
  }

  const symbol = parsed.data.symbol.toUpperCase()

  const { error } = await supabase
    .from('user_saved_tickers')
    .delete()
    .eq('user_id', authData.user.id)
    .eq('symbol', symbol)

  if (error) {
    console.error('Error deleting saved ticker', error)
    return NextResponse.json({ error: 'Failed to delete ticker' }, { status: 500 })
  }

  savedTickersCache.delete(authData.user.id)

  return NextResponse.json({ ok: true })
}
