"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

interface SubnavTab {
  label: string
  href: string
  accent?: "green"
}

interface CompanySubnavProps {
  companyId: string
}

export function CompanySubnav({ companyId }: CompanySubnavProps) {
  const pathname = usePathname()
  const base = `/dashboard/companies/${companyId}`

  const tabs: SubnavTab[] = [
    { label: "Overview", href: base },
    { label: "Financials", href: `${base}/financials` },
    { label: "Metrics", href: `${base}/metrics` },
    { label: "Budget", href: `${base}/budget` },
    { label: "Projections", href: `${base}/projections` },
    { label: "Scenarios", href: `${base}/scenarios` },
    { label: "Diligence", href: `${base}/diligence` },
    { label: "Board Deck", href: `${base}/board-deck` },
    { label: "Settings", href: `${base}/settings` },
    { label: "Import Data", href: `${base}/financials/import`, accent: "green" },
  ]

  return (
    <nav
      aria-label="Company sections"
      className="flex h-11 shrink-0 items-end gap-0 overflow-x-auto border-b bg-white px-4"
    >
      {tabs.map((tab) => {
        // Exact match for overview; for others, only highlight the most specific match
        const isActive =
          tab.href === base
            ? pathname === base
            : pathname.startsWith(tab.href) &&
              !tabs.some(
                (other) =>
                  other.href !== tab.href &&
                  other.href.startsWith(tab.href) &&
                  pathname.startsWith(other.href)
              )

        const isGreen = tab.accent === "green"

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "relative flex h-10 shrink-0 items-center px-3 text-sm font-medium transition-colors",
              "border-b-2 whitespace-nowrap",
              isGreen
                ? isActive
                  ? "border-emerald-500 text-emerald-700 bg-emerald-50/60"
                  : "border-transparent text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50/40"
                : isActive
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              isGreen && "ml-auto"
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
