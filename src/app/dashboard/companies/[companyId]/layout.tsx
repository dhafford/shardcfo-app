import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/badge"
import type { CompanyRow, CompanyStatus } from "@/lib/supabase/types"

interface CompanyLayoutProps {
  children: React.ReactNode
  params: Promise<{ companyId: string }>
}

const statusBadgeVariant: Record<
  string,
  "default" | "secondary" | "outline"
> = {
  active: "default",
  archived: "secondary",
  onboarding: "outline",
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

  // Fetch the specific company (RLS ensures only owner can see it)
  const { data: rawCompany } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single()

  const company = rawCompany as CompanyRow | null

  if (!company) {
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

      {/* Scrollable company page content */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        {children}
      </div>
    </div>
  )
}

// Company data must be fetched at request time
export const dynamic = "force-dynamic"
