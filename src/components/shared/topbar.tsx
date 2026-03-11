"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { Menu, Settings, LogOut, ChevronRight } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { CompanySwitcher } from "@/components/shared/company-switcher"
import { Sidebar } from "@/components/shared/sidebar"
import { createClient } from "@/lib/supabase/client"
import type { ProfileRow, CompanyRow } from "@/lib/supabase/types"

interface TopbarProps {
  profile: ProfileRow
  companies: CompanyRow[]
  currentCompanyId?: string
  breadcrumbs?: { label: string; href?: string }[]
}

export function Topbar({
  profile,
  companies,
  currentCompanyId,
  breadcrumbs,
}: TopbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = React.useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const displayName = profile.full_name ?? "User"
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  // Close mobile sheet when pathname changes (navigation)
  React.useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-white px-4">
      {/* Mobile sidebar toggle */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="md:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="size-5" />
        <span className="sr-only">Open navigation</span>
      </Button>

      {/* Mobile sidebar sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-60 p-0 bg-[#1a1a2e] border-none">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <Sidebar profile={profile} companies={companies} />
        </SheetContent>
      </Sheet>

      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1 text-sm text-muted-foreground flex-1 min-w-0"
        >
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1
            return (
              <React.Fragment key={idx}>
                {idx > 0 && (
                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />
                )}
                {crumb.href && !isLast ? (
                  <Link
                    href={crumb.href}
                    className="truncate transition-colors hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className={
                      isLast
                        ? "truncate font-medium text-foreground"
                        : "truncate"
                    }
                  >
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            )
          })}
        </nav>
      ) : (
        <div className="flex-1" />
      )}

      {/* Right side: company switcher + user menu */}
      <div className="flex items-center gap-2 ml-auto shrink-0">
        {currentCompanyId && (
          <CompanySwitcher
            companies={companies}
            currentCompanyId={currentCompanyId}
          />
        )}

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Avatar size="sm">
              {profile.avatar_url && (
                <AvatarImage src={profile.avatar_url} alt={displayName} />
              )}
              <AvatarFallback className="bg-slate-200 text-slate-700 text-xs font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-foreground">{displayName}</span>
                <span className="text-xs text-muted-foreground capitalize">
                  {profile.role}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
              <Settings className="mr-2 size-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleLogout}>
              <LogOut className="mr-2 size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
