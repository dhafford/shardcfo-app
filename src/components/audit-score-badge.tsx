"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ShieldCheck,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types matching the compact JSON from X-Banker-Audit-Details header
// ---------------------------------------------------------------------------

export interface AuditFailure {
  id: string   // e.g. "A4", "D2"
  s: string    // section: "A" | "B" | "C" | "D"
  g: boolean   // gating (Section A = true)
  d: string    // description
  t?: string   // details (optional)
}

export interface AuditDetails {
  passed: number
  total: number
  pct: number
  sectionAPass: boolean
  failures: AuditFailure[]
}

/** Parse audit details from API response headers */
export function parseAuditHeaders(res: Response): AuditDetails | null {
  const raw = res.headers.get("X-Banker-Audit-Details")
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuditDetails
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// AuditScoreBadge — compact inline badge
// ---------------------------------------------------------------------------

export function AuditScoreBadge({ audit }: { audit: AuditDetails | null }) {
  const [expanded, setExpanded] = React.useState(false)

  if (!audit) return null

  const { pct, sectionAPass, passed, total, failures } = audit
  const gatingFailures = failures.filter((f) => f.g)
  const scoredFailures = failures.filter((f) => !f.g)

  const color =
    sectionAPass && pct >= 90
      ? "emerald"
      : sectionAPass && pct >= 70
        ? "yellow"
        : "red"

  const Icon = color === "emerald" ? CheckCircle2 : color === "yellow" ? AlertTriangle : XCircle

  const colorClasses = {
    emerald: "text-emerald-700 border-emerald-300 bg-emerald-50",
    yellow: "text-yellow-700 border-yellow-300 bg-yellow-50",
    red: "text-red-700 border-red-300 bg-red-50",
  }

  const barColor = {
    emerald: "bg-emerald-500",
    yellow: "bg-yellow-500",
    red: "bg-red-500",
  }

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="focus:outline-none"
        aria-label="Toggle audit details"
      >
        <Badge
          variant="outline"
          className={cn(
            "gap-1.5 cursor-pointer select-none transition-colors",
            colorClasses[color]
          )}
        >
          <Icon className="w-3 h-3" />
          <span className="tabular-nums font-semibold">{pct}%</span>
          <span className="hidden sm:inline text-xs font-normal opacity-75">
            ({passed}/{total})
          </span>
          <ChevronDown
            className={cn(
              "w-3 h-3 transition-transform",
              expanded && "rotate-180"
            )}
          />
        </Badge>
      </button>

      {expanded && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-lg border bg-white shadow-lg p-4 space-y-3 text-sm">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-slate-500" />
              <span className="font-semibold text-slate-900">Banker Bible Audit</span>
            </div>
            <Badge
              variant="outline"
              className={cn("text-xs", colorClasses[color])}
            >
              {sectionAPass ? "Section A: PASS" : "Section A: FAIL"}
            </Badge>
          </div>

          {/* Score bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Quality Score</span>
              <span className={cn("font-semibold tabular-nums", {
                "text-emerald-700": color === "emerald",
                "text-yellow-700": color === "yellow",
                "text-red-700": color === "red",
              })}>
                {pct}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", barColor[color])}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-slate-400">
              {passed} of {total} checks passed
            </p>
          </div>

          {/* Gating failures (Section A) */}
          {gatingFailures.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">
                Gating Failures (must fix)
              </p>
              {gatingFailures.map((f) => (
                <div key={f.id} className="flex items-start gap-2 text-xs">
                  <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium text-slate-700">{f.id}:</span>{" "}
                    <span className="text-slate-600">{f.d}</span>
                    {f.t && (
                      <p className="text-slate-400 mt-0.5">{f.t}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Scored failures (Section B/C/D) */}
          {scoredFailures.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wide">
                Quality Improvements
              </p>
              {scoredFailures.map((f) => (
                <div key={f.id} className="flex items-start gap-2 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium text-slate-700">{f.id}:</span>{" "}
                    <span className="text-slate-600">{f.d}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* All passed */}
          {failures.length === 0 && (
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm font-medium">All checks passed — client-ready</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
