"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Home,
  Building2,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  BarChart3,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { CompanyRow, ProfileRow } from "@/lib/supabase/types"
import { createClient } from "@/lib/supabase/client"

interface SidebarProps {
  profile: ProfileRow
  companies: CompanyRow[]
}

const SIDEBAR_COLLAPSED_KEY = "shardcfo:sidebar-collapsed"

export function Sidebar({ profile, companies }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const [collapsed, setCollapsed] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true"
  })

  // Keep localStorage in sync whenever collapsed changes
  React.useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed))
  }, [collapsed])

  function toggleCollapsed() {
    setCollapsed((prev) => !prev)
  }

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

  return (
    <aside
      style={{ width: collapsed ? 64 : 240, backgroundColor: "#1a1a2e" }}
      className="relative flex h-full flex-col transition-[width] duration-200 ease-in-out"
    >
      {/* Logo / Brand */}
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-4 overflow-hidden">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500">
          <BarChart3 className="size-5 text-white" />
        </div>
        {!collapsed && (
          <span className="text-base font-semibold tracking-tight text-white truncate">
            ShardCFO
          </span>
        )}
      </div>

      <Separator className="bg-white/10" />

      {/* Primary nav */}
      <nav className="flex flex-col gap-0.5 overflow-y-auto p-2 flex-1">
        <NavItem
          href="/dashboard"
          icon={<Home className="size-4 shrink-0" />}
          label="Portfolio"
          collapsed={collapsed}
          active={pathname === "/dashboard"}
        />

        {/* Companies section */}
        {companies.length > 0 && (
          <div className="mt-3">
            {!collapsed && (
              <p className="mb-1 px-3 text-[0.625rem] font-semibold uppercase tracking-widest text-slate-500">
                Companies
              </p>
            )}
            {companies.map((company) => {
              const companyPath = `/dashboard/companies/${company.id}`
              const isActive = pathname.startsWith(companyPath)
              return (
                <NavItem
                  key={company.id}
                  href={companyPath}
                  icon={<Building2 className="size-4 shrink-0" />}
                  label={company.name}
                  collapsed={collapsed}
                  active={isActive}
                />
              )
            })}
          </div>
        )}

        {/* Settings */}
        <div className="mt-3">
          {!collapsed && (
            <p className="mb-1 px-3 text-[0.625rem] font-semibold uppercase tracking-widest text-slate-500">
              Account
            </p>
          )}
          <NavItem
            href="/dashboard/settings"
            icon={<Settings className="size-4 shrink-0" />}
            label="Settings"
            collapsed={collapsed}
            active={pathname === "/dashboard/settings"}
          />
        </div>
      </nav>

      <Separator className="bg-white/10" />

      {/* User info + logout */}
      <div className="p-2">
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-2 py-2",
            collapsed && "justify-center"
          )}
        >
          <Avatar size="sm" className="shrink-0 ring-1 ring-white/20">
            {profile.avatar_url && (
              <AvatarImage src={profile.avatar_url} alt={displayName} />
            )}
            <AvatarFallback className="bg-slate-700 text-white text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-white leading-tight">
                {displayName}
              </p>
              <p className="truncate text-xs text-slate-400 leading-tight capitalize">
                {profile.role}
              </p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={handleLogout}
              className="shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              title="Log out"
            >
              <LogOut className="size-4" />
            </button>
          )}
        </div>
        {collapsed && (
          <button
            onClick={handleLogout}
            className="mt-1 flex w-full items-center justify-center rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            title="Log out"
          >
            <LogOut className="size-4" />
          </button>
        )}
      </div>

      {/* Collapse toggle button */}
      <button
        onClick={toggleCollapsed}
        style={{ backgroundColor: "#1a1a2e" }}
        className="absolute -right-3 top-[4.5rem] z-10 flex size-6 items-center justify-center rounded-full border border-white/20 text-slate-400 shadow-md transition-colors hover:text-white"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="size-3.5" />
        ) : (
          <ChevronLeft className="size-3.5" />
        )}
      </button>
    </aside>
  )
}

interface NavItemProps {
  href: string
  icon: React.ReactNode
  label: string
  collapsed: boolean
  active: boolean
}

function NavItem({ href, icon, label, collapsed, active }: NavItemProps) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors",
        "border-l-2 border-transparent",
        active
          ? "border-blue-400 bg-white/10 text-white"
          : "text-slate-400 hover:bg-white/5 hover:text-white"
      )}
    >
      {icon}
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  )
}
