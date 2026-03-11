import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import type { Database } from './types'

export interface UpdateSessionResult {
  supabaseResponse: NextResponse
  user: User | null
}

/**
 * Refreshes the Supabase auth session on every request and returns:
 * - `supabaseResponse` — the NextResponse with updated auth cookies that
 *    must be returned from the middleware (never replaced with a new
 *    NextResponse, or the cookies will be lost).
 * - `user` — the authenticated User, or null if unauthenticated.
 *
 * IMPORTANT: the `getUser()` call below is what triggers the token refresh.
 * Do not remove it or add redirects before it executes.
 */
export async function updateSessionWithUser(
  request: NextRequest,
): Promise<UpdateSessionResult> {
  // Mutable reference — the cookie setter may reassign this.
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // 1. Write the refreshed tokens onto the *request* so that any
          //    downstream Server Component sees the updated session immediately.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )

          // 2. Re-create the response from the mutated request headers so
          //    Next.js forwards the updated cookies to the browser.
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { supabaseResponse, user }
}
