import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { error } = await supabase
    .from('user_screener_presets')
    .delete()
    .eq('id', id)
    .eq('user_id', authData.user.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete preset' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
