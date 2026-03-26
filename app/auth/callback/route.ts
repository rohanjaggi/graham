import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // New Google user → onboarding; existing → dashboard
      const profileComplete = data.user.user_metadata?.profile_complete
      return NextResponse.redirect(new URL(profileComplete ? '/protected' : '/onboarding', origin))
    }
  }

  return NextResponse.redirect(new URL('/auth?error=callback_failed', origin))
}
