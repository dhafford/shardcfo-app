import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

/**
 * Creates a Supabase client for use in Server Component / Server Action /
 * Route Handler contexts.
 *
 * Must be called inside an async function because `cookies()` from
 * `next/headers` is itself async in Next.js 15+.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // `setAll` is called from a Server Component; cookie mutations
            // are a no-op there (only Route Handlers / Server Actions can
            // set cookies). The middleware handles session refresh instead.
          }
        },
      },
    },
  )
}
