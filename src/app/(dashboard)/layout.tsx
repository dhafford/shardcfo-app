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

  // Fetch the user's profile
  const { data: rawProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single()

  const profile = rawProfile as ProfileRow | null

  if (!profile) {
    // Profile not yet created — send back to login with an error indicator
    redirect("/login?error=profile_missing")
  }

  // Fetch all companies the user has access to.
  // For admins we return all companies; for others we return only the
  // company linked to their profile.
  let companies: CompanyRow[] = []

  if (profile.role === "admin") {
    const { data } = await supabase
      .from("companies")
      .select("*")
      .eq("status", "active")
      .order("name", { ascending: true })
    companies = (data as CompanyRow[] | null) ?? []
  } else if (profile.company_id) {
    const { data } = await supabase
      .from("companies")
      .select("*")
      .eq("id", profile.company_id)
      .single()
    if (data) companies = [data as CompanyRow]
  }

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
