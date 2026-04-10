import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params
  const sym = symbol.toUpperCase()

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('user_ticker_thesis')
    .select('bull_case, bear_case, thesis')
    .eq('user_id', user.id)
    .eq('symbol', sym)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Failed to fetch thesis' }, { status: 500 })

  return NextResponse.json({
    bullCase: data?.bull_case ?? '',
    bearCase: data?.bear_case ?? '',
    thesis: data?.thesis ?? '',
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params
  const sym = symbol.toUpperCase()

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { bullCase?: string; bearCase?: string; thesis?: string } = {}
  try { body = await req.json() } catch { /* empty */ }

  const { error } = await supabase
    .from('user_ticker_thesis')
    .upsert({
      user_id: user.id,
      symbol: sym,
      bull_case: body.bullCase ?? '',
      bear_case: body.bearCase ?? '',
      thesis: body.thesis ?? '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,symbol' })

  if (error) return NextResponse.json({ error: 'Failed to save thesis' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
