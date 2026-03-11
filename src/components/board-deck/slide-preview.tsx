"use client"

import { TitleSlide } from "@/components/board-deck/sections/title-slide"
import { FinancialSummary } from "@/components/board-deck/sections/financial-summary"
import { RevenueBreakdown } from "@/components/board-deck/sections/revenue-breakdown"
import { ExpenseBreakdown } from "@/components/board-deck/sections/expense-breakdown"
import { SaasMetrics } from "@/components/board-deck/sections/saas-metrics"
import { CashRunway } from "@/components/board-deck/sections/cash-runway"
import { BudgetVariance } from "@/components/board-deck/sections/budget-variance"
import { KeyHighlights } from "@/components/board-deck/sections/key-highlights"
import { AsksAndDecisions } from "@/components/board-deck/sections/asks-and-decisions"
import { Appendix } from "@/components/board-deck/sections/appendix"
import type { DeckSection } from "@/components/board-deck/deck-editor"
import type { CompanyRow } from "@/lib/supabase/types"

interface SlidePreviewProps {
  section: DeckSection
  slideNumber: number
  totalSlides: number
  company: CompanyRow
  /** Scale factor — defaults to 0.6 for editor preview */
  scale?: number
}

function SlideNotFound({ type }: { type: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-slate-50">
      <p className="text-sm text-muted-foreground">
        Unknown section type: <code>{type}</code>
      </p>
    </div>
  )
}

function renderSection(
  section: DeckSection,
  slideNumber: number,
  totalSlides: number,
  company: CompanyRow
) {
  const commonProps = {
    config: section.config,
    slideNumber,
    totalSlides,
    company,
  }

  switch (section.type) {
    case "title_slide":
      return <TitleSlide {...commonProps} />
    case "financial_summary":
      return <FinancialSummary {...commonProps} />
    case "revenue_breakdown":
      return <RevenueBreakdown {...commonProps} />
    case "expense_breakdown":
      return <ExpenseBreakdown {...commonProps} />
    case "saas_metrics":
      return <SaasMetrics {...commonProps} />
    case "cash_runway":
      return <CashRunway {...commonProps} />
    case "budget_variance":
      return <BudgetVariance {...commonProps} />
    case "key_highlights":
      return <KeyHighlights {...commonProps} />
    case "asks_and_decisions":
      return <AsksAndDecisions {...commonProps} />
    case "appendix":
      return <Appendix {...commonProps} />
    default:
      return <SlideNotFound type={section.type} />
  }
}

export function SlidePreview({
  section,
  slideNumber,
  totalSlides,
  company,
  scale = 0.6,
}: SlidePreviewProps) {
  // Slide is 960x540 (16:9). We scale it via CSS transform.
  const slideW = 960
  const slideH = 540
  const scaledW = slideW * scale
  const scaledH = slideH * scale

  return (
    <div
      style={{ width: scaledW, height: scaledH }}
      className="overflow-hidden rounded-lg shadow-sm bg-white relative"
    >
      <div
        style={{
          width: slideW,
          height: slideH,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
        className="absolute top-0 left-0"
      >
        {renderSection(section, slideNumber, totalSlides, company)}
      </div>
    </div>
  )
}
