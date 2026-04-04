import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const TICKER_PATTERN = /^[A-Z][A-Z0-9.-]{0,9}$/

type SavedTickerRow = {
  symbol: string
  company_name: string | null
  created_at: string
}

type SavedTickerItem = {
  symbol: string
  companyName: string | null
  createdAt: string
}

function normalizeSymbol(input: string): string {
  return input.trim().toUpperCase()
}

function getSavedTickersFromMetadata(userMetadata: unknown): SavedTickerItem[] {
  if (!userMetadata || typeof userMetadata !== 'object') {
    return []
  }

  const raw = (userMetadata as { savedTickers?: unknown }).savedTickers
  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const symbol = typeof (item as { symbol?: unknown }).symbol === 'string'
        ? normalizeSymbol((item as { symbol: string }).symbol)
        : ''
      if (!TICKER_PATTERN.test(symbol)) {
        return null
      }

      const companyName = typeof (item as { companyName?: unknown }).companyName === 'string'
        ? (item as { companyName: string }).companyName.trim() || null
        : null
      const createdAtRaw = typeof (item as { createdAt?: unknown }).createdAt === 'string'
        ? (item as { createdAt: string }).createdAt
        : ''
      const createdAt = createdAtRaw && !Number.isNaN(Date.parse(createdAtRaw))
        ? createdAtRaw
        : new Date().toISOString()

      return { symbol, companyName, createdAt }
    })
    .filter((item): item is SavedTickerItem => Boolean(item))
}

function dbErrorMessage(prefix: string, error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code ?? '') : ''
  const message = typeof error === 'object' && error && 'message' in error ? String((error as { message?: unknown }).message ?? '') : ''

  if (isMissingTableError(error)) {
    return `${prefix}: saved tickers table is missing. Run the latest Supabase migration.`
  }
  if (code === '42501') {
    return `${prefix}: permission denied by row-level security policy.`
  }
  if (code === '42P10') {
    return `${prefix}: unique constraint missing for (user_id, symbol). Apply latest migration.`
  }

  return message ? `${prefix}: ${message}` : prefix
}

function isMissingTableError(error: unknown): boolean {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code ?? '') : ''
  const message = typeof error === 'object' && error && 'message' in error ? String((error as { message?: unknown }).message ?? '') : ''

  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    /Could not find the table/i.test(message) ||
    /schema cache/i.test(message)
  )
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('user_saved_tickers')
    .select('symbol, company_name, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (isMissingTableError(error)) {
    return NextResponse.json(getSavedTickersFromMetadata(user.user_metadata))
  }

  if (error) {
    return NextResponse.json({ error: 'Failed to load saved tickers' }, { status: 500 })
  }

  return NextResponse.json(
    ((data ?? []) as SavedTickerRow[]).map((row) => ({
      symbol: row.symbol,
      companyName: row.company_name,
      createdAt: row.created_at,
    }))
  )
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
  const rawSymbol = typeof body?.symbol === 'string' ? body.symbol : ''
  const symbol = normalizeSymbol(rawSymbol)
  const companyName = typeof body?.companyName === 'string' ? body.companyName.trim() : null

  if (!TICKER_PATTERN.test(symbol)) {
    return NextResponse.json({ error: 'Invalid symbol format' }, { status: 400 })
  }

  const { error } = await supabase
    .from('user_saved_tickers')
    .upsert(
      {
        user_id: user.id,
        symbol,
        company_name: companyName && companyName.length > 0 ? companyName : null,
      },
      {
        onConflict: 'user_id,symbol',
        ignoreDuplicates: false,
      }
    )

  if (!error) {
    return NextResponse.json({ ok: true, symbol })
  }

  if (isMissingTableError(error)) {
    const existing = getSavedTickersFromMetadata(user.user_metadata)
    const withoutSymbol = existing.filter((item) => item.symbol !== symbol)
    const next: SavedTickerItem[] = [
      {
        symbol,
        companyName: companyName && companyName.length > 0 ? companyName : null,
        createdAt: new Date().toISOString(),
      },
      ...withoutSymbol,
    ].slice(0, 50)

    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        ...(user.user_metadata ?? {}),
        savedTickers: next,
      },
    })

    if (metadataError) {
      return NextResponse.json({ error: dbErrorMessage('Failed to save ticker', metadataError) }, { status: 500 })
    }

    return NextResponse.json({ ok: true, symbol })
  }

  // Fallback for older schemas where ON CONFLICT target is not available yet.
  if ((error as { code?: string } | null)?.code === '42P10') {
    const { data: existing, error: readError } = await supabase
      .from('user_saved_tickers')
      .select('id')
      .eq('user_id', user.id)
      .eq('symbol', symbol)
      .limit(1)

    if (readError) {
      return NextResponse.json({ error: dbErrorMessage('Failed to save ticker', readError) }, { status: 500 })
    }

    if (Array.isArray(existing) && existing.length > 0) {
      return NextResponse.json({ ok: true, symbol })
    }

    const { error: insertError } = await supabase
      .from('user_saved_tickers')
      .insert({
        user_id: user.id,
        symbol,
        company_name: companyName && companyName.length > 0 ? companyName : null,
      })

    if (insertError) {
      return NextResponse.json({ error: dbErrorMessage('Failed to save ticker', insertError) }, { status: 500 })
    }

    return NextResponse.json({ ok: true, symbol })
  }

  return NextResponse.json({ error: dbErrorMessage('Failed to save ticker', error) }, { status: 500 })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const rawSymbol = typeof body?.symbol === 'string' ? body.symbol : ''
  const symbol = normalizeSymbol(rawSymbol)

  if (!TICKER_PATTERN.test(symbol)) {
    return NextResponse.json({ error: 'Invalid symbol format' }, { status: 400 })
  }

  const { error } = await supabase
    .from('user_saved_tickers')
    .delete()
    .eq('user_id', user.id)
    .eq('symbol', symbol)

  if (isMissingTableError(error)) {
    const existing = getSavedTickersFromMetadata(user.user_metadata)
    const next = existing.filter((item) => item.symbol !== symbol)

    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        ...(user.user_metadata ?? {}),
        savedTickers: next,
      },
    })

    if (metadataError) {
      return NextResponse.json({ error: dbErrorMessage('Failed to remove ticker', metadataError) }, { status: 500 })
    }

    return NextResponse.json({ ok: true, symbol })
  }

  if (error) {
    return NextResponse.json({ error: 'Failed to remove ticker' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, symbol })
}
