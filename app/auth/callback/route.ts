import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      if (next) {
        return NextResponse.redirect(new URL(next, origin))
      }
      // New Google user → onboarding; existing → dashboard
      const profileComplete = data.user.user_metadata?.profile_complete
      return NextResponse.redirect(new URL(profileComplete ? '/protected' : '/onboarding', origin))
    }
  }

  return NextResponse.redirect(new URL('/auth?error=callback_failed', origin))
}
