import { type NextRequest, NextResponse } from 'next/server'
import { updateSessionWithUser } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSessionWithUser(request)

  const { pathname } = request.nextUrl

  // Protect /dashboard and all sub-routes
  const isDashboardRoute = pathname.startsWith('/dashboard')

  if (isDashboardRoute && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    // Preserve the originally requested URL so we can redirect back after login
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // If an authenticated user visits auth pages, send them to the dashboard
  const isAuthRoute = pathname === '/login' || pathname === '/signup'

  if (isAuthRoute && user) {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/dashboard'
    dashboardUrl.search = ''
    return NextResponse.redirect(dashboardUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static  (static assets)
     * - _next/image   (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - public folder files (images, fonts, etc.)
     *
     * The session refresh must run on every matched route so auth cookies
     * stay current. Restricting to only /dashboard would leave other pages
     * with stale tokens.
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf)$).*)',
  ],
}
