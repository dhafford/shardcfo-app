import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

/**
 * Creates a Supabase client for use in browser (Client Component) contexts.
 *
 * Call this inside a Client Component or a custom hook — never at module
 * scope, so that each render gets a fresh client tied to the current auth
 * session cookies.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
