import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('user_screener_presets')
    .select('id, name, filters, created_at')
    .eq('user_id', authData.user.id)
    .order('created_at', { ascending: false })

  if (error) {
    // Table may not exist yet — return empty list gracefully
    return NextResponse.json({ presets: [] })
  }

  return NextResponse.json({ presets: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: { name?: unknown; filters?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (name.length > 100) return NextResponse.json({ error: 'Name too long' }, { status: 400 })

  const { data, error } = await supabase
    .from('user_screener_presets')
    .insert({ user_id: authData.user.id, name, filters: body.filters ?? {} })
    .select('id, name, filters, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to save preset' }, { status: 500 })
  }

  return NextResponse.json({ preset: data })
}
