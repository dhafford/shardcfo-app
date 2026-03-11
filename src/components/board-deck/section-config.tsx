"use client"

import { Settings2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { SECTION_TYPE_DEFINITIONS } from "@/lib/constants"
import type { DeckSection } from "@/components/board-deck/deck-editor"

interface SectionConfigProps {
  section: DeckSection
  onChange: (config: Record<string, unknown>) => void
}

export function SectionConfig({ section, onChange }: SectionConfigProps) {
  const def = SECTION_TYPE_DEFINITIONS.find((d) => d.type === section.type)
  const config = section.config

  const set = (key: string, value: unknown) => {
    onChange({ ...config, [key]: value })
  }

  const renderFields = () => {
    switch (section.type) {
      case "title_slide":
        return (
          <>
            <Field label="Presentation Title">
              <Input
                value={(config.presentationTitle as string) ?? ""}
                onChange={(e) => set("presentationTitle", e.target.value)}
                placeholder="Q1 2025 Board Meeting"
              />
            </Field>
            <Field label="Subtitle">
              <Input
                value={(config.subtitle as string) ?? ""}
                onChange={(e) => set("subtitle", e.target.value)}
                placeholder="Confidential"
              />
            </Field>
            <Field label="Period Label">
              <Input
                value={(config.periodLabel as string) ?? ""}
                onChange={(e) => set("periodLabel", e.target.value)}
                placeholder="Q1 2025"
              />
            </Field>
            <Field label="Date">
              <Input
                type="date"
                value={(config.date as string) ?? ""}
                onChange={(e) => set("date", e.target.value)}
              />
            </Field>
          </>
        )

      case "key_highlights":
        return (
          <>
            <Field label="Narrative">
              <Textarea
                value={(config.narrative as string) ?? ""}
                onChange={(e) => set("narrative", e.target.value)}
                placeholder="Executive summary of the period..."
                rows={4}
              />
            </Field>
            <Field label="Wins (one per line)">
              <Textarea
                value={(config.wins as string) ?? ""}
                onChange={(e) => set("wins", e.target.value)}
                placeholder="Closed $500K ARR from enterprise deals&#10;Launched v2.0 product"
                rows={4}
              />
            </Field>
            <Field label="Risks (one per line)">
              <Textarea
                value={(config.risks as string) ?? ""}
                onChange={(e) => set("risks", e.target.value)}
                placeholder="Churn rate elevated in SMB segment&#10;Delayed hiring in engineering"
                rows={3}
              />
            </Field>
          </>
        )

      case "financial_summary":
      case "revenue_breakdown":
      case "expense_breakdown":
      case "budget_variance":
        return (
          <>
            <Field label="Period Label">
              <Input
                value={(config.periodLabel as string) ?? ""}
                onChange={(e) => set("periodLabel", e.target.value)}
                placeholder="Q1 2025"
              />
            </Field>
            <Field label="Narrative Notes">
              <Textarea
                value={(config.notes as string) ?? ""}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Key commentary for this section..."
                rows={3}
              />
            </Field>
          </>
        )

      case "saas_metrics":
        return (
          <>
            <Field label="Period Label">
              <Input
                value={(config.periodLabel as string) ?? ""}
                onChange={(e) => set("periodLabel", e.target.value)}
                placeholder="Q1 2025"
              />
            </Field>
            <Field label="Highlight Metrics (comma-separated slugs)">
              <Input
                value={(config.highlightMetrics as string) ?? ""}
                onChange={(e) => set("highlightMetrics", e.target.value)}
                placeholder="arr,mrr,ndr,cac_payback"
              />
            </Field>
          </>
        )

      case "cash_runway":
        return (
          <>
            <Field label="Period Label">
              <Input
                value={(config.periodLabel as string) ?? ""}
                onChange={(e) => set("periodLabel", e.target.value)}
                placeholder="Q1 2025"
              />
            </Field>
            <Field label="Scenario Note">
              <Textarea
                value={(config.scenarioNote as string) ?? ""}
                onChange={(e) => set("scenarioNote", e.target.value)}
                placeholder="Base case assumes current burn rate..."
                rows={3}
              />
            </Field>
          </>
        )

      case "asks_and_decisions":
        return (
          <>
            <Field label="Asks (one per line)">
              <Textarea
                value={(config.asks as string) ?? ""}
                onChange={(e) => set("asks", e.target.value)}
                placeholder="Approve $2M marketing budget&#10;Sign off on Series B timeline"
                rows={4}
              />
            </Field>
            <Field label="Decisions Needed (one per line)">
              <Textarea
                value={(config.decisions as string) ?? ""}
                onChange={(e) => set("decisions", e.target.value)}
                placeholder="Board resolution on option pool increase"
                rows={3}
              />
            </Field>
          </>
        )

      case "appendix":
        return (
          <>
            <Field label="Section Title">
              <Input
                value={(config.title as string) ?? ""}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Appendix"
              />
            </Field>
            <Field label="Notes">
              <Textarea
                value={(config.notes as string) ?? ""}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Additional context or references..."
                rows={4}
              />
            </Field>
          </>
        )

      default:
        return (
          <p className="text-xs text-muted-foreground">
            No configuration options for this section type.
          </p>
        )
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Settings2 className="h-4 w-4 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{def?.label ?? section.type}</p>
          <p className="text-xs text-muted-foreground truncate">{def?.description}</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">{renderFields()}</div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </Label>
      {children}
    </div>
  )
}
