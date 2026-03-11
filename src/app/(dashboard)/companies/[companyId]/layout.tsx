import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CompanySubnav } from "@/components/shared/company-subnav"
import { Badge } from "@/components/ui/badge"
import type { CompanyRow, CompanyStatus, ProfileRow } from "@/lib/supabase/types"

interface CompanyLayoutProps {
  children: React.ReactNode
  params: Promise<{ companyId: string }>
}

const statusBadgeVariant: Record<
  CompanyStatus,
  "default" | "secondary" | "outline"
> = {
  active: "default",
  inactive: "secondary",
  archived: "outline",
}

export default async function CompanyLayout({
  children,
  params,
}: CompanyLayoutProps) {
  const { companyId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Fetch profile for access control
  const { data: rawProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single()

  const profile = rawProfile as ProfileRow | null

  if (!profile) {
    redirect("/login?error=profile_missing")
  }

  // Fetch the specific company
  const { data: rawCompany } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single()

  const company = rawCompany as CompanyRow | null

  if (!company) {
    notFound()
  }

  // Access check: non-admins can only view their own company
  if (profile.role !== "admin" && profile.company_id !== companyId) {
    notFound()
  }

  return (
    <div className="flex h-full flex-col">
      {/* Company header strip */}
      <div className="flex items-center gap-3 border-b bg-white px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-sm font-semibold text-foreground truncate">
            {company.name}
          </h1>
          <Badge
            variant={statusBadgeVariant[company.status]}
            className="shrink-0"
          >
            {company.status}
          </Badge>
        </div>
        {company.industry && (
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {company.industry}
          </span>
        )}
      </div>

      {/* Section tab navigation */}
      <CompanySubnav companyId={companyId} />

      {/* Scrollable company page content */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        {children}
      </div>
    </div>
  )
}

// Company data must be fetched at request time
export const dynamic = "force-dynamic"
