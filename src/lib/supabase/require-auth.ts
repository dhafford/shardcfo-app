import { createClient } from "./server";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

/**
 * Requires authentication in a server action or server component.
 * Returns the authenticated user and a typed Supabase client.
 *
 * Usage:
 *   const { user, supabase } = await requireAuth();
 *
 * For server actions that should return an error instead of redirecting:
 *   const { user, supabase } = await requireAuth({ redirect: false });
 */
export async function requireAuth(
  opts?: { redirect?: boolean }
): Promise<{ user: User; supabase: Awaited<ReturnType<typeof createClient>> }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (opts?.redirect === false) {
      throw new Error("Not authenticated");
    }
    redirect("/login");
  }

  return { user, supabase };
}
