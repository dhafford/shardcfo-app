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
  ChevronDown,
  FileText,
  Smartphone,
  Zap,
  BookOpen,
  FolderOpen,
  LayoutDashboard,
  DollarSign,
  BarChart3,
  PiggyBank,
  TrendingUp,
  Wrench,
  GitBranch,
  Search,
  Presentation,
  FolderOpen as FolderIcon,
  Settings as SettingsIcon,
  Upload,
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
      <div className="flex h-20 shrink-0 items-center px-3 overflow-hidden">
        <img
          src="/logo.svg"
          alt="ShardCFO"
          className={cn(
            "h-20 shrink-0 transition-all duration-200",
            collapsed ? "w-10 object-left object-cover" : "w-auto"
          )}
        />
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
            {companies.map((company) => (
              <CompanyNavItem
                key={company.id}
                company={company}
                pathname={pathname}
                collapsed={collapsed}
              />
            ))}
          </div>
        )}

        {/* Templates */}
        <div className="mt-3">
          {!collapsed && (
            <p className="mb-1 px-3 text-[0.625rem] font-semibold uppercase tracking-widest text-slate-500">
              Templates
            </p>
          )}
          <NavItem
            href="/dashboard/templates"
            icon={<FileText className="size-4 shrink-0" />}
            label="Templates"
            collapsed={collapsed}
            active={pathname.startsWith("/dashboard/templates")}
          />
        </div>

        {/* DTC App */}
        <div className="mt-3">
          {!collapsed && (
            <p className="mb-1 px-3 text-[0.625rem] font-semibold uppercase tracking-widest text-slate-500">
              DTC App
            </p>
          )}
          <NavItem
            href="/dashboard/dtc-app"
            icon={<Smartphone className="size-4 shrink-0" />}
            label="DTC App"
            collapsed={collapsed}
            active={pathname.startsWith("/dashboard/dtc-app")}
          />
        </div>

        {/* Forge */}
        <div className="mt-3">
          {!collapsed && (
            <p className="mb-1 px-3 text-[0.625rem] font-semibold uppercase tracking-widest text-slate-500">
              Forge
            </p>
          )}
          <NavItem
            href="/dashboard/forge"
            icon={<Zap className="size-4 shrink-0" />}
            label="Forge"
            collapsed={collapsed}
            active={pathname.startsWith("/dashboard/forge")}
          />
        </div>

        {/* Research */}
        <div className="mt-3">
          {!collapsed && (
            <p className="mb-1 px-3 text-[0.625rem] font-semibold uppercase tracking-widest text-slate-500">
              Research
            </p>
          )}
          <NavItem
            href="/dashboard/research"
            icon={<BookOpen className="size-4 shrink-0" />}
            label="Research"
            collapsed={collapsed}
            active={pathname.startsWith("/dashboard/research")}
          />
        </div>

        {/* Files */}
        <div className="mt-3">
          {!collapsed && (
            <p className="mb-1 px-3 text-[0.625rem] font-semibold uppercase tracking-widest text-slate-500">
              Files
            </p>
          )}
          <NavItem
            href="/dashboard/files"
            icon={<FolderOpen className="size-4 shrink-0" />}
            label="All Files"
            collapsed={collapsed}
            active={pathname.startsWith("/dashboard/files")}
          />
        </div>

      </nav>

      {/* Settings – pinned above user info */}
      <div className="px-2 pb-1">
        <NavItem
          href="/dashboard/settings"
          icon={<Settings className="size-4 shrink-0" />}
          label="Settings"
          collapsed={collapsed}
          active={pathname === "/dashboard/settings"}
        />
      </div>

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

// ---------------------------------------------------------------------------
// Company sub-tabs (mirrors company-subnav.tsx)
// ---------------------------------------------------------------------------

const COMPANY_TABS: { label: string; segment: string; icon: React.ReactNode; accent?: "green" }[] = [
  { label: "Overview", segment: "", icon: <LayoutDashboard className="size-3.5 shrink-0" /> },
  { label: "Financials", segment: "/financials", icon: <DollarSign className="size-3.5 shrink-0" /> },
  { label: "Metrics", segment: "/metrics", icon: <BarChart3 className="size-3.5 shrink-0" /> },
  { label: "Budget", segment: "/budget", icon: <PiggyBank className="size-3.5 shrink-0" /> },
  { label: "Projections", segment: "/projections", icon: <TrendingUp className="size-3.5 shrink-0" /> },
  { label: "Model Builder", segment: "/model-builder", icon: <Wrench className="size-3.5 shrink-0" /> },
  { label: "Scenarios", segment: "/scenarios", icon: <GitBranch className="size-3.5 shrink-0" /> },
  { label: "Diligence", segment: "/diligence", icon: <Search className="size-3.5 shrink-0" /> },
  { label: "Board Deck", segment: "/board-deck", icon: <Presentation className="size-3.5 shrink-0" /> },
  { label: "Files", segment: "/files", icon: <FolderIcon className="size-3.5 shrink-0" /> },
  { label: "Settings", segment: "/settings", icon: <SettingsIcon className="size-3.5 shrink-0" /> },
  { label: "Import Data", segment: "/financials/import", icon: <Upload className="size-3.5 shrink-0" />, accent: "green" },
]

function CompanyNavItem({
  company,
  pathname,
  collapsed,
}: {
  company: CompanyRow
  pathname: string
  collapsed: boolean
}) {
  const basePath = `/dashboard/companies/${company.id}`
  const isActive = pathname.startsWith(basePath)
  const [open, setOpen] = React.useState(isActive)

  // Auto-open when navigating into this company
  React.useEffect(() => {
    if (isActive && !open) setOpen(true)
  }, [isActive])

  // When collapsed, render a simple nav link
  if (collapsed) {
    return (
      <Link
        href={basePath}
        title={company.name}
        className={cn(
          "group flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors",
          "border-l-2 border-transparent",
          isActive
            ? "border-blue-400 bg-white/10 text-white"
            : "text-slate-400 hover:bg-white/5 hover:text-white"
        )}
      >
        <Building2 className="size-4 shrink-0" />
      </Link>
    )
  }

  return (
    <div>
      {/* Company header — click to toggle dropdown */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors text-left",
          "border-l-2 border-transparent",
          isActive
            ? "border-blue-400 bg-white/10 text-white"
            : "text-slate-400 hover:bg-white/5 hover:text-white"
        )}
      >
        <Building2 className="size-4 shrink-0" />
        <span className="truncate flex-1">{company.name}</span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-slate-500 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Sub-tabs dropdown */}
      {open && (
        <div className="ml-4 border-l border-white/10 pl-2 mt-0.5 mb-1 space-y-0.5">
          {COMPANY_TABS.map((tab) => {
            const href = `${basePath}${tab.segment}`
            const tabActive =
              tab.segment === ""
                ? pathname === basePath
                : pathname.startsWith(href) &&
                  !COMPANY_TABS.some(
                    (other) =>
                      other.segment !== tab.segment &&
                      other.segment.startsWith(tab.segment) &&
                      pathname.startsWith(`${basePath}${other.segment}`)
                  )

            const isGreen = tab.accent === "green"

            return (
              <Link
                key={tab.segment}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                  isGreen
                    ? tabActive
                      ? "border border-emerald-400/50 bg-emerald-500/20 text-emerald-300"
                      : "border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                    : tabActive
                      ? "bg-white/10 text-white"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                )}
              >
                {tab.icon}
                <span className="truncate">{tab.label}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

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
