import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const SYMBOL_RE = /^[A-Z][A-Z0-9.\-]{0,19}$/

const PostBody = z.object({
  symbol:                   z.string().regex(SYMBOL_RE),
  company_name:             z.string().max(200).default(''),
  label:                    z.string().max(200).nullable().optional(),
  base_fcf:                 z.number().finite(),
  wacc:                     z.number().positive().max(100),
  years:                    z.number().int().min(1).max(30),
  terminal_growth_rate:     z.number().min(-10).max(20),
  growth_rate_conservative: z.number().min(-100).max(100),
  growth_rate_neutral:      z.number().min(-100).max(100),
  growth_rate_bullish:      z.number().min(-100).max(100),
  market_price:             z.number().nullable().optional(),
  shares_outstanding:       z.number().min(0),
  net_debt:                 z.number().finite(),
  results_json: z.object({
    conservative: z.record(z.string(), z.unknown()),
    neutral:      z.record(z.string(), z.unknown()),
    bullish:      z.record(z.string(), z.unknown()),
  }),
})

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const symbol = req.nextUrl.searchParams.get('symbol')?.toUpperCase() ?? null
  if (symbol !== null && !SYMBOL_RE.test(symbol)) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 })
  }

  let query = supabase
    .from('dcf_snapshots')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (symbol) {
    query = query.eq('symbol', symbol)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ snapshots: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PostBody.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('dcf_snapshots')
    .insert({
      user_id: user.id,
      ...parsed.data,
      label: parsed.data.label ?? null,
      market_price: parsed.data.market_price ?? null,
    })
    .select('id, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ snapshot: data }, { status: 201 })
}
