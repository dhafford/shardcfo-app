import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth / magic-link callback handler.
 *
 * Supabase redirects here after a successful OAuth flow or magic-link click,
 * appending a `code` query parameter. We exchange that code for a session,
 * which writes the auth cookies, then redirect the user into the app.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Redirect to the intended destination (default: /dashboard).
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If code is missing or exchange failed, send user to login with an error.
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(
      "Authentication failed. Please try again."
    )}`
  );
}
