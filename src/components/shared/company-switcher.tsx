"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ChevronsUpDown, Building2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { CompanyRow, CompanyStatus } from "@/lib/supabase/types"

interface CompanySwitcherProps {
  companies: CompanyRow[]
  currentCompanyId?: string
}

const statusBadgeVariant: Record<
  CompanyStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  active: "default",
  inactive: "secondary",
  archived: "outline",
}

export function CompanySwitcher({
  companies,
  currentCompanyId,
}: CompanySwitcherProps) {
  const router = useRouter()
  const currentCompany = companies.find((c) => c.id === currentCompanyId)

  if (companies.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium",
          "border border-border bg-background transition-colors",
          "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <Building2 className="size-4 shrink-0 text-muted-foreground" />
        <span className="max-w-[140px] truncate">
          {currentCompany?.name ?? "Select company"}
        </span>
        {currentCompany && (
          <Badge
            variant={statusBadgeVariant[currentCompany.status]}
            className="ml-0.5"
          >
            {currentCompany.status}
          </Badge>
        )}
        <ChevronsUpDown className="ml-1 size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Companies</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {companies.map((company) => (
          <DropdownMenuItem
            key={company.id}
            onClick={() => router.push(`/dashboard/companies/${company.id}`)}
            className={cn(
              "flex items-center justify-between",
              company.id === currentCompanyId && "bg-accent"
            )}
          >
            <span className="truncate">{company.name}</span>
            <Badge
              variant={statusBadgeVariant[company.status]}
              className="ml-2 shrink-0"
            >
              {company.status}
            </Badge>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
