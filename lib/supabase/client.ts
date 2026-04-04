import { createBrowserClient } from '@supabase/ssr'

function createMissingBrowserClient() {
  return {
    auth: {
      async signUp() {
        return { data: { user: null, session: null }, error: { message: 'Supabase environment variables are not configured.' } }
      },
      async signInWithPassword() {
        return { data: { user: null, session: null }, error: { message: 'Supabase environment variables are not configured.' } }
      },
      async signInWithOAuth() {
        return { data: { provider: null, url: null }, error: { message: 'Supabase environment variables are not configured.' } }
      },
      async signOut() {
        return { error: null }
      },
      async getUser() {
        return { data: { user: null }, error: null }
      },
      async updateUser() {
        return { data: { user: null }, error: { message: 'Supabase environment variables are not configured.' } }
      },
    },
  }
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !key) {
    return createMissingBrowserClient() as ReturnType<typeof createBrowserClient>
  }

  return createBrowserClient(url, key)
}
