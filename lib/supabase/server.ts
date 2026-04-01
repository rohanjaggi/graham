import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function createMissingServerClient() {
  return {
    auth: {
      async getUser() {
        return { data: { user: null }, error: null }
      },
      async signOut() {
        return { error: null }
      },
    },
  }
}

//finnhub api: d76cfo1r01qm4b7tou6gd76cfo1r01qm4b7tou70
export async function createClient() {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL //
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !key) {
    return createMissingServerClient() as ReturnType<typeof createServerClient>
  }

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore: called from Server Component, cookies set in middleware
          }
        },
      },
    }
  )
}
