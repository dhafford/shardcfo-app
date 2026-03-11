/**
 * PPTX generation helper using pptxgenjs.
 *
 * buildBoardDeckPptx(deck, companyData) creates a PptxGenJS presentation
 * matching ShardCFO brand colours and slide layout, then returns the
 * PptxGenJS instance. The caller can invoke .writeFile() or .stream() on it.
 */

import PptxGenJS from "pptxgenjs"
import type { BoardDeckRow, CompanyRow } from "@/lib/supabase/types"
import type { DeckSection } from "@/components/board-deck/deck-editor"

// ---------------------------------------------------------------------------
// Brand constants
// ---------------------------------------------------------------------------

const PRIMARY = "1A1A2E"
const ACCENT = "3B82F6"
const WHITE = "FFFFFF"
const MUTED = "94A3B8"
const LIGHT_GRAY = "F1F5F9"
const TEXT_DARK = "1E293B"

/** Slide dimensions in inches (16:9 — 10 × 5.625). */
const SLIDE_W = 10
const SLIDE_H = 5.625

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

/** Adds the standard slide header bar (navy background, company name, slide #). */
function addSlideHeader(
  slide: PptxGenJS.Slide,
  title: string,
  company: CompanyRow,
  slideNumber: number,
  totalSlides: number,
  period = ""
) {
  // Dark header band
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: SLIDE_W,
    h: 0.55,
    fill: { color: PRIMARY },
  })

  // Blue accent bar at very top
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: SLIDE_W,
    h: 0.03,
    fill: { color: ACCENT },
  })

  // Company initial avatar
  slide.addShape("roundRect", {
    x: 0.2,
    y: 0.1,
    w: 0.32,
    h: 0.32,
    fill: { color: ACCENT },
  })
  slide.addText(company.name.charAt(0).toUpperCase(), {
    x: 0.2,
    y: 0.1,
    w: 0.32,
    h: 0.32,
    align: "center",
    valign: "middle",
    fontSize: 12,
    bold: true,
    color: WHITE,
  })

  // Company name
  slide.addText(company.name, {
    x: 0.6,
    y: 0.1,
    w: 2,
    h: 0.32,
    align: "left",
    valign: "middle",
    fontSize: 9,
    color: "AAAAAA",
  })

  // Separator dot
  slide.addText("·", {
    x: 2.5,
    y: 0.1,
    w: 0.2,
    h: 0.32,
    align: "center",
    valign: "middle",
    fontSize: 9,
    color: "555555",
  })

  // Slide title
  slide.addText(title, {
    x: 2.65,
    y: 0.1,
    w: 4,
    h: 0.32,
    align: "left",
    valign: "middle",
    fontSize: 11,
    bold: true,
    color: WHITE,
  })

  // Period badge area (right side)
  if (period) {
    slide.addText(period, {
      x: SLIDE_W - 2.4,
      y: 0.12,
      w: 1.4,
      h: 0.28,
      align: "center",
      valign: "middle",
      fontSize: 8,
      bold: true,
      color: "93C5FD",
      fill: { color: "1E3A5F" },
    })
  }

  // Slide number
  slide.addText(`${slideNumber} / ${totalSlides}`, {
    x: SLIDE_W - 0.9,
    y: 0.15,
    w: 0.75,
    h: 0.22,
    align: "right",
    valign: "middle",
    fontSize: 7,
    color: "555555",
  })
}

// ---------------------------------------------------------------------------
// Per-section slide builders
// ---------------------------------------------------------------------------

function buildTitleSlide(
  pptx: PptxGenJS,
  section: DeckSection,
  company: CompanyRow,
  slideNumber: number,
  totalSlides: number
) {
  const slide = pptx.addSlide()
  const config = section.config

  const presentationTitle =
    (config.presentationTitle as string) || "Board of Directors Meeting"
  const subtitle =
    (config.subtitle as string) || "Confidential — Not for Distribution"
  const periodLabel = (config.periodLabel as string) || ""
  const date = (config.date as string) || new Date().toLocaleDateString("en-US")

  // Full-bleed navy gradient background
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: SLIDE_W,
    h: SLIDE_H,
    fill: { color: PRIMARY },
  })

  // Top accent bar
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: SLIDE_W,
    h: 0.05,
    fill: { color: ACCENT },
  })

  // Decorative circle (bottom-right)
  slide.addShape("ellipse", {
    x: SLIDE_W - 2.5,
    y: SLIDE_H - 2.5,
    w: 3.5,
    h: 3.5,
    fill: { color: "3B82F6", transparency: 92 },
    line: { color: "3B82F6", transparency: 85, width: 0.5 },
  })

  // Company avatar
  slide.addShape("roundRect", {
    x: 0.5,
    y: 0.35,
    w: 0.45,
    h: 0.45,
    fill: { color: ACCENT },
  })
  slide.addText(company.name.charAt(0).toUpperCase(), {
    x: 0.5,
    y: 0.35,
    w: 0.45,
    h: 0.45,
    align: "center",
    valign: "middle",
    fontSize: 14,
    bold: true,
    color: WHITE,
  })

  // Company name
  slide.addText(company.name, {
    x: 1.05,
    y: 0.37,
    w: 3,
    h: 0.4,
    align: "left",
    valign: "middle",
    fontSize: 11,
    color: "AAAAAA",
  })

  // Period badge
  if (periodLabel) {
    slide.addText(periodLabel, {
      x: 0.5,
      y: 1.5,
      w: 1.4,
      h: 0.3,
      align: "center",
      valign: "middle",
      fontSize: 9,
      bold: true,
      color: "93C5FD",
      fill: { color: "1E3A5F" },
    })
  }

  // Main title
  slide.addText(presentationTitle, {
    x: 0.5,
    y: 2.0,
    w: SLIDE_W - 3,
    h: 1.5,
    align: "left",
    valign: "top",
    fontSize: 32,
    bold: true,
    color: WHITE,
    wrap: true,
  })

  // Subtitle
  slide.addText(subtitle, {
    x: 0.5,
    y: 3.7,
    w: SLIDE_W - 3,
    h: 0.5,
    align: "left",
    valign: "middle",
    fontSize: 13,
    color: "888888",
  })

  // Footer
  slide.addShape("rect", {
    x: 0,
    y: SLIDE_H - 0.5,
    w: SLIDE_W,
    h: 0.5,
    fill: { color: "111122" },
  })
  slide.addText(date, {
    x: 0.5,
    y: SLIDE_H - 0.45,
    w: 3,
    h: 0.4,
    align: "left",
    valign: "middle",
    fontSize: 8,
    color: "555555",
  })
  slide.addText(`${slideNumber} / ${totalSlides}`, {
    x: SLIDE_W - 1,
    y: SLIDE_H - 0.45,
    w: 0.8,
    h: 0.4,
    align: "right",
    valign: "middle",
    fontSize: 8,
    color: "555555",
  })
}

function buildKeyHighlightsSlide(
  pptx: PptxGenJS,
  section: DeckSection,
  company: CompanyRow,
  slideNumber: number,
  totalSlides: number
) {
  const slide = pptx.addSlide()
  const config = section.config

  slide.background = { color: WHITE }

  addSlideHeader(
    slide,
    "Key Highlights",
    company,
    slideNumber,
    totalSlides,
    (config.periodLabel as string) || ""
  )

  const narrative = (config.narrative as string) || ""
  const wins = ((config.wins as string) || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
  const risks = ((config.risks as string) || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)

  // Narrative
  if (narrative) {
    slide.addText(narrative, {
      x: 0.4,
      y: 0.7,
      w: SLIDE_W - 0.8,
      h: 0.7,
      align: "left",
      fontSize: 10,
      color: TEXT_DARK,
      wrap: true,
    })
  }

  // Wins column
  slide.addText("Wins", {
    x: 0.4,
    y: 1.5,
    w: (SLIDE_W - 1) / 2,
    h: 0.3,
    align: "left",
    fontSize: 10,
    bold: true,
    color: "16A34A",
  })
  wins.forEach((win, i) => {
    slide.addText(`• ${win}`, {
      x: 0.4,
      y: 1.85 + i * 0.36,
      w: (SLIDE_W - 1) / 2,
      h: 0.34,
      align: "left",
      fontSize: 9,
      color: TEXT_DARK,
      wrap: true,
    })
  })

  // Risks column
  const colX = 0.4 + (SLIDE_W - 1) / 2 + 0.3
  slide.addText("Risks", {
    x: colX,
    y: 1.5,
    w: (SLIDE_W - 1) / 2,
    h: 0.3,
    align: "left",
    fontSize: 10,
    bold: true,
    color: "DC2626",
  })
  risks.forEach((risk, i) => {
    slide.addText(`• ${risk}`, {
      x: colX,
      y: 1.85 + i * 0.36,
      w: (SLIDE_W - 1) / 2,
      h: 0.34,
      align: "left",
      fontSize: 9,
      color: TEXT_DARK,
      wrap: true,
    })
  })
}

function buildFinancialSummarySlide(
  pptx: PptxGenJS,
  section: DeckSection,
  company: CompanyRow,
  slideNumber: number,
  totalSlides: number
) {
  const slide = pptx.addSlide()
  const config = section.config
  const period = (config.periodLabel as string) || ""
  const notes = (config.notes as string) || ""

  slide.background = { color: WHITE }
  addSlideHeader(slide, "Financial Summary", company, slideNumber, totalSlides, period)

  // Placeholder P&L rows
  const rows = [
    { label: "Total Revenue", value: "$2.54M", change: "+18.4%", positive: true },
    { label: "Gross Profit", value: "$1.84M", change: "+14.2%", positive: true },
    { label: "Gross Margin", value: "72.4%", change: "+0.8pp", positive: true },
    { label: "EBITDA", value: "$790K", change: "+25.4%", positive: true },
    { label: "Net Income", value: "$310K", change: "+38.2%", positive: true },
  ]

  rows.forEach((row, i) => {
    const y = 0.75 + i * 0.55
    slide.addShape("rect", {
      x: 0.4,
      y,
      w: 3.8,
      h: 0.48,
      fill: { color: i % 2 === 0 ? LIGHT_GRAY : WHITE },
    })
    slide.addText(row.label, {
      x: 0.55,
      y: y + 0.08,
      w: 2,
      h: 0.32,
      align: "left",
      valign: "middle",
      fontSize: 9,
      color: TEXT_DARK,
    })
    slide.addText(row.value, {
      x: 2.4,
      y: y + 0.08,
      w: 1,
      h: 0.32,
      align: "right",
      valign: "middle",
      fontSize: 9,
      bold: true,
      color: TEXT_DARK,
    })
    slide.addText(row.change, {
      x: 3.45,
      y: y + 0.08,
      w: 0.65,
      h: 0.32,
      align: "center",
      valign: "middle",
      fontSize: 8,
      bold: true,
      color: row.positive ? "16A34A" : "DC2626",
    })
  })

  if (notes) {
    slide.addText(notes, {
      x: 0.4,
      y: SLIDE_H - 0.7,
      w: 4.5,
      h: 0.5,
      align: "left",
      fontSize: 8,
      color: MUTED,
      italic: true,
      wrap: true,
    })
  }
}

function buildGenericSlide(
  pptx: PptxGenJS,
  section: DeckSection,
  title: string,
  company: CompanyRow,
  slideNumber: number,
  totalSlides: number
) {
  const slide = pptx.addSlide()
  const config = section.config
  const period = (config.periodLabel as string) || ""
  const notes = (config.notes as string) || ""

  slide.background = { color: WHITE }
  addSlideHeader(slide, title, company, slideNumber, totalSlides, period)

  // Placeholder content area
  slide.addShape("roundRect", {
    x: 0.4,
    y: 0.75,
    w: SLIDE_W - 0.8,
    h: SLIDE_H - 1.5,
    fill: { color: LIGHT_GRAY },
  })
  slide.addText(`${title}\n\nData will populate from your imported financials.`, {
    x: 0.4,
    y: 0.75,
    w: SLIDE_W - 0.8,
    h: SLIDE_H - 1.5,
    align: "center",
    valign: "middle",
    fontSize: 11,
    color: MUTED,
    wrap: true,
  })

  if (notes) {
    slide.addText(notes, {
      x: 0.4,
      y: SLIDE_H - 0.6,
      w: SLIDE_W - 0.8,
      h: 0.45,
      align: "left",
      fontSize: 8,
      color: MUTED,
      italic: true,
      wrap: true,
    })
  }
}

function buildAsksAndDecisionsSlide(
  pptx: PptxGenJS,
  section: DeckSection,
  company: CompanyRow,
  slideNumber: number,
  totalSlides: number
) {
  const slide = pptx.addSlide()
  const config = section.config

  slide.background = { color: WHITE }
  addSlideHeader(slide, "Asks & Decisions", company, slideNumber, totalSlides)

  const asks = ((config.asks as string) || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
  const decisions = ((config.decisions as string) || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)

  slide.addText("Asks", {
    x: 0.4,
    y: 0.75,
    w: (SLIDE_W - 1) / 2,
    h: 0.35,
    align: "left",
    fontSize: 11,
    bold: true,
    color: ACCENT,
  })
  asks.forEach((ask, i) => {
    slide.addText(`${i + 1}. ${ask}`, {
      x: 0.4,
      y: 1.2 + i * 0.45,
      w: (SLIDE_W - 1) / 2,
      h: 0.4,
      align: "left",
      fontSize: 9,
      color: TEXT_DARK,
      wrap: true,
    })
  })

  const colX = 0.4 + (SLIDE_W - 1) / 2 + 0.3
  slide.addText("Decisions Needed", {
    x: colX,
    y: 0.75,
    w: (SLIDE_W - 1) / 2,
    h: 0.35,
    align: "left",
    fontSize: 11,
    bold: true,
    color: "8B5CF6",
  })
  decisions.forEach((decision, i) => {
    slide.addText(`${i + 1}. ${decision}`, {
      x: colX,
      y: 1.2 + i * 0.45,
      w: (SLIDE_W - 1) / 2,
      h: 0.4,
      align: "left",
      fontSize: 9,
      color: TEXT_DARK,
      wrap: true,
    })
  })
}

// ---------------------------------------------------------------------------
// Section router
// ---------------------------------------------------------------------------

const SECTION_TITLE_MAP: Record<string, string> = {
  revenue_breakdown: "Revenue Breakdown",
  expense_breakdown: "Expense Breakdown",
  saas_metrics: "SaaS Metrics",
  cash_runway: "Cash & Runway",
  budget_variance: "Budget Variance",
  headcount_plan: "Headcount Plan",
  scenario_forecast: "Scenario Forecast",
  appendix: "Appendix",
}

function addSectionSlide(
  pptx: PptxGenJS,
  section: DeckSection,
  company: CompanyRow,
  slideNumber: number,
  totalSlides: number
) {
  switch (section.type) {
    case "title_slide":
      buildTitleSlide(pptx, section, company, slideNumber, totalSlides)
      break
    case "key_highlights":
      buildKeyHighlightsSlide(pptx, section, company, slideNumber, totalSlides)
      break
    case "financial_summary":
      buildFinancialSummarySlide(pptx, section, company, slideNumber, totalSlides)
      break
    case "asks_and_decisions":
      buildAsksAndDecisionsSlide(pptx, section, company, slideNumber, totalSlides)
      break
    default: {
      const title =
        SECTION_TITLE_MAP[section.type] ??
        section.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      buildGenericSlide(pptx, section, title, company, slideNumber, totalSlides)
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Builds a PptxGenJS presentation from a BoardDeckRow and company data.
 *
 * @returns The PptxGenJS instance — call `.writeFile({ fileName })` or
 *          `.stream()` on the result.
 */
export function buildBoardDeckPptx(
  deck: BoardDeckRow,
  company: CompanyRow
): PptxGenJS {
  const pptx = new PptxGenJS()

  pptx.layout = "LAYOUT_WIDE" // 13.33" × 7.5" — scaled to 960×540 equivalent
  pptx.author = "ShardCFO"
  pptx.company = company.name
  pptx.title = deck.title

  // Parse sections from deck content
  const content = (deck.content as Record<string, unknown>) ?? {}
  const rawSections = Array.isArray(content.sections) ? content.sections : []

  const sections: DeckSection[] = rawSections
    .map((s, i) => {
      const section = s as Record<string, unknown>
      return {
        id: (section.id as string) || String(i),
        type: (section.type as string) || "title_slide",
        config: (section.config as Record<string, unknown>) || {},
        order: typeof section.order === "number" ? section.order : i,
      }
    })
    .sort((a, b) => a.order - b.order)

  const totalSlides = sections.length

  sections.forEach((section, idx) => {
    addSectionSlide(pptx, section, company, idx + 1, totalSlides)
  })

  return pptx
}
