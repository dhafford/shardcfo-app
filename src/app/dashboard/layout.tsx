import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/shared/sidebar"
import { Topbar } from "@/components/shared/topbar"
import type { CompanyRow, ProfileRow } from "@/lib/supabase/types"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Fetch the user's profile (profiles.id = auth user id)
  const { data: rawProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  const profile = rawProfile as ProfileRow | null

  if (!profile) {
    // Profile not yet created — sign out to break redirect loop, then go to login
    await supabase.auth.signOut()
    redirect("/login?error=profile_missing")
  }

  // Fetch all companies the user owns
  let companies: CompanyRow[] = []

  const { data } = await supabase
    .from("companies")
    .select("*")
    .eq("owner_id", user.id)
    .eq("status", "active")
    .order("name", { ascending: true })
  companies = (data as CompanyRow[] | null) ?? []

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:flex md:flex-col">
        <Sidebar profile={profile} companies={companies} />
      </div>

      {/* Main area: topbar + scrollable content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          profile={profile}
          companies={companies}
        />

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
