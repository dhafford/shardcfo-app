"use client"

import {
  Presentation,
  Star,
  BarChart2,
  TrendingUp,
  Receipt,
  Gauge,
  Wallet,
  Scale,
  CheckSquare,
  FileText,
  Plus,
} from "lucide-react"
import { SECTION_TYPE_DEFINITIONS } from "@/lib/constants"
import type { SectionTypeDefinition } from "@/lib/constants"

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Presentation,
  Star,
  BarChart2,
  TrendingUp,
  Receipt,
  Gauge,
  Wallet,
  Scale,
  CheckSquare,
  FileText,
}

const CATEGORY_COLORS: Record<
  SectionTypeDefinition["category"],
  string
> = {
  overview: "bg-slate-100 text-slate-700",
  financials: "bg-blue-50 text-blue-700",
  metrics: "bg-violet-50 text-violet-700",
  narrative: "bg-green-50 text-green-700",
}

interface SectionLibraryProps {
  onAdd: (type: string) => void
}

export function SectionLibrary({ onAdd }: SectionLibraryProps) {
  return (
    <div className="p-2 space-y-1 max-h-72 overflow-y-auto">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 pb-1">
        Add Section
      </p>
      {SECTION_TYPE_DEFINITIONS.map((def) => {
        const Icon = ICON_MAP[def.icon] ?? FileText
        return (
          <button
            key={def.type}
            onClick={() => onAdd(def.type)}
            className="w-full flex items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-white transition-colors group"
          >
            <div className="mt-0.5 shrink-0 w-6 h-6 rounded-md bg-white border flex items-center justify-center shadow-sm">
              <Icon className="h-3.5 w-3.5 text-slate-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-medium text-foreground">{def.label}</span>
                <span
                  className={`text-[10px] px-1 py-0 rounded font-medium ${CATEGORY_COLORS[def.category]}`}
                >
                  {def.category}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 mt-0.5">
                {def.description}
              </p>
            </div>
            <Plus className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )
      })}
    </div>
  )
}
