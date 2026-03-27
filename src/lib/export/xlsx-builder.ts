/**
 * Excel workbook builders using ExcelJS.
 *
 * Three public exports:
 *   buildProjectionWorkbook  — 3-statement model (IS / BS / CF / Assumptions)
 *   buildScenarioWorkbook    — scenario analysis (Monthly / Summary / Assumptions)
 *   buildModelEngineWorkbook — model engine output (IS / BS / CF / Diagnostics)
 *
 * Each returns Promise<Buffer> from workbook.xlsx.writeBuffer().
 *
 * buildProjectionWorkbook produces a LIVE FORMULA model:
 *   - Assumptions tab: hardcoded input cells (yellow, editable)
 *   - Income Statement: projected columns are Excel formulas referencing Assumptions
 *   - Balance Sheet: projected columns reference IS + Assumptions + prior BS
 *   - Cash Flow: projected columns reference IS + BS deltas
 *   - BS Cash = CFS Ending Cash (the circular plug is resolved by formula order)
 */

import ExcelJS from "exceljs"
import type {
  HistoricalYear,
  ProjectedYear,
  ProjectionAssumptions,
} from "@/lib/projections/types"
import type {
  ScenarioProjection,
  ScenarioAssumptions,
} from "@/lib/calculations/scenario-engine"

// Re-export types so consumers can import them from this module
export type { HistoricalYear, ProjectedYear, ProjectionAssumptions }
export type { ScenarioProjection, ScenarioAssumptions }

// ---------------------------------------------------------------------------
// Brand constants
// ---------------------------------------------------------------------------

const COLOR_HEADER_BG  = "1e293b"   // navy
const COLOR_HEADER_FG  = "FFFFFF"   // white
const COLOR_HIST_BG    = "F8FAFC"   // light gray (historical cells)
const COLOR_PROJ_BG    = "EFF6FF"   // light blue (formula cells)
const COLOR_TOTAL_BG   = "E2E8F0"   // slightly darker gray for totals
const COLOR_ASSUMP_BG  = "FFFFF0"   // light yellow (editable assumption cells)
const COLOR_SECTION_BG = "CBD5E1"   // section header background

// ---------------------------------------------------------------------------
// Column letter helper
// ---------------------------------------------------------------------------

function colLetter(col: number): string {
  let s = ""
  let c = col
  while (c > 0) {
    c--
    s = String.fromCharCode(65 + (c % 26)) + s
    c = Math.floor(c / 26)
  }
  return s
}

// ---------------------------------------------------------------------------
// RowTracker — assigns and recalls row numbers by key
// ---------------------------------------------------------------------------

class RowTracker {
  private current: number
  private map = new Map<string, number>()

  constructor(start = 1) {
    this.current = start
  }

  /** Advance to next row, optionally registering it under a key */
  next(key?: string): number {
    this.current++
    if (key) this.map.set(key, this.current)
    return this.current
  }

  /** Advance to next row without registering */
  skip(): number {
    return ++this.current
  }

  /** Register the CURRENT row under a key (without advancing) */
  tag(key: string): number {
    this.map.set(key, this.current)
    return this.current
  }

  /** Get registered row number — throws if key was never registered */
  get(key: string): number {
    const v = this.map.get(key)
    if (v === undefined) throw new Error(`RowTracker: unknown key "${key}"`)
    return v
  }

  /** Current row number */
  get row(): number {
    return this.current
  }
}

// ---------------------------------------------------------------------------
// Shared cell helpers
// ---------------------------------------------------------------------------

function applyHeaderStyle(row: ExcelJS.Row): void {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_HEADER_BG}` } }
    cell.font = { bold: true, color: { argb: `FF${COLOR_HEADER_FG}` }, size: 10, name: "Calibri" }
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: false }
    cell.border = { bottom: { style: "thin", color: { argb: "FF334155" } } }
  })
}

function applyCurrencyFormat(cell: ExcelJS.Cell): void {
  cell.numFmt = '#,##0;(#,##0);"-"'
}

function applyPercentFormat(cell: ExcelJS.Cell): void {
  cell.numFmt = "0.0%"
}

function applyTotalStyle(row: ExcelJS.Row, startCol: number): void {
  row.getCell(1).font = { bold: true, size: 10, name: "Calibri" }
  for (let c = startCol; c <= (row.cellCount || startCol + 20); c++) {
    const cell = row.getCell(c)
    if (cell.value !== null && cell.value !== undefined) {
      cell.font = { bold: true, size: 10, name: "Calibri" }
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_TOTAL_BG}` } }
    }
  }
}

function applyDoubleUnderline(row: ExcelJS.Row, startCol: number, endCol: number): void {
  for (let c = startCol; c <= endCol; c++) {
    row.getCell(c).border = { bottom: { style: "double", color: { argb: "FF1e293b" } } }
    row.getCell(c).font = { bold: true, size: 10, name: "Calibri" }
  }
}

function labelCell(row: ExcelJS.Row, label: string, indent = 0): void {
  const cell = row.getCell(1)
  cell.value = indent > 0 ? "  ".repeat(indent) + label : label
  cell.font = { size: 10, name: "Calibri" }
  cell.alignment = { horizontal: "left", vertical: "middle" }
}

function paintDataRow(
  row: ExcelJS.Row,
  firstDataCol: number,
  lastDataCol: number,
  histCount: number,
  isBold = false
): void {
  for (let c = firstDataCol; c <= lastDataCol; c++) {
    const isProj = c > firstDataCol + histCount - 1
    const bgColor = isProj ? COLOR_PROJ_BG : COLOR_HIST_BG
    const cell = row.getCell(c)
    if (!isBold) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${bgColor}` } }
    } else {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_TOTAL_BG}` } }
      cell.font = { bold: true, size: 10, name: "Calibri" }
    }
  }
}

function setupSheet(
  sheet: ExcelJS.Worksheet,
  yearLabels: string[],
  histCount: number
): void {
  sheet.getColumn(1).width = 30
  for (let c = 2; c <= yearLabels.length + 1; c++) {
    sheet.getColumn(c).width = 14
  }

  const headerValues = ["", ...yearLabels]
  const headerRow = sheet.addRow(headerValues)
  applyHeaderStyle(headerRow)
  headerRow.height = 18

  for (let c = 2; c <= yearLabels.length + 1; c++) {
    const cell = headerRow.getCell(c)
    const isProj = c > histCount + 1
    if (!isProj) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } }
    }
  }

  sheet.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }]
}

function writeSectionHeader(sheet: ExcelJS.Worksheet, label: string, colCount: number): void {
  const row = sheet.addRow([label])
  row.getCell(1).font = { bold: true, italic: true, size: 9, color: { argb: "FF475569" }, name: "Calibri" }
  row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_SECTION_BG}` } }
  for (let c = 2; c <= colCount + 1; c++) {
    row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_SECTION_BG}` } }
  }
  row.height = 14
}

function writeBlankRow(sheet: ExcelJS.Worksheet): void {
  sheet.addRow([]).height = 6
}

// ---------------------------------------------------------------------------
// buildProjectionWorkbook — LIVE FORMULA MODEL
// ---------------------------------------------------------------------------

// Revenue method metadata for tab generation
const REVENUE_METHOD_META: Record<string, { label: string; shortLabel: string; inputs: { key: string; label: string; type: "currency" | "percent" | "number" }[] }> = {
  growth_rate: { label: "Simple Growth Rate", shortLabel: "Growth Rate", inputs: [] },
  volume_price: { label: "Volume × Price", shortLabel: "Vol x Price", inputs: [
    { key: "vp_units_1", label: "Product 1 — Units", type: "number" }, { key: "vp_asp_1", label: "Product 1 — ASP", type: "currency" },
    { key: "vp_units_2", label: "Product 2 — Units", type: "number" }, { key: "vp_asp_2", label: "Product 2 — ASP", type: "currency" },
    { key: "vp_units_3", label: "Product 3 — Units", type: "number" }, { key: "vp_asp_3", label: "Product 3 — ASP", type: "currency" },
    { key: "vp_unit_growth", label: "Unit Growth (YoY)", type: "percent" }, { key: "vp_asp_growth", label: "ASP Growth (YoY)", type: "percent" },
  ] },
  tam: { label: "Top-Down / TAM-Based", shortLabel: "TAM", inputs: [
    { key: "tam_total", label: "Total Addressable Market", type: "currency" }, { key: "tam_growth", label: "TAM Growth (CAGR)", type: "percent" },
    { key: "sam_pct", label: "SAM % of TAM", type: "percent" }, { key: "som_share", label: "Market Share %", type: "percent" },
  ] },
  sales_capacity: { label: "Sales Capacity", shortLabel: "Sales Cap", inputs: [
    { key: "sc_beg_reps", label: "Beginning Reps", type: "number" }, { key: "sc_new_hires", label: "New Hires/Year", type: "number" },
    { key: "sc_attrition", label: "Attrition/Year", type: "number" }, { key: "sc_ramp_months", label: "Ramp (months)", type: "number" },
    { key: "sc_quota", label: "Annual Quota ($)", type: "currency" }, { key: "sc_attainment", label: "Attainment %", type: "percent" },
  ] },
  cohort: { label: "Cohort / Bookings", shortLabel: "Cohort", inputs: [
    { key: "coh_new_acv", label: "New Cohort ACV", type: "currency" }, { key: "coh_new_logos", label: "New Logos", type: "number" },
    { key: "coh_gross_churn", label: "Qtr Gross Churn", type: "percent" }, { key: "coh_expansion", label: "Qtr Expansion", type: "percent" },
    { key: "coh_recog", label: "Recognition (mo)", type: "number" },
  ] },
  arr_waterfall: { label: "ARR Waterfall", shortLabel: "ARR", inputs: [
    { key: "arr_beg", label: "Beginning ARR", type: "currency" }, { key: "arr_new", label: "New ARR", type: "currency" },
    { key: "arr_expansion", label: "Expansion ARR", type: "currency" }, { key: "arr_churn", label: "Churned ARR", type: "currency" },
    { key: "arr_contraction", label: "Contraction ARR", type: "currency" }, { key: "arr_nrr", label: "Target NRR", type: "percent" },
    { key: "arr_grr", label: "Target GRR", type: "percent" },
  ] },
  same_store: { label: "Same-Store + New Store", shortLabel: "Same Store", inputs: [
    { key: "ss_existing", label: "Existing Stores", type: "number" }, { key: "ss_rev_per", label: "Rev/Store ($)", type: "currency" },
    { key: "ss_sssg", label: "SSSG %", type: "percent" }, { key: "ss_new_stores", label: "New Stores", type: "number" },
    { key: "ss_new_rev", label: "Rev/New Store ($)", type: "currency" }, { key: "ss_partial", label: "Partial-Yr Factor", type: "number" },
  ] },
  backlog: { label: "Contract Backlog", shortLabel: "Backlog", inputs: [
    { key: "bl_opening", label: "Opening Backlog", type: "currency" }, { key: "bl_new_awards", label: "New Awards", type: "currency" },
    { key: "bl_burn_rate", label: "Burn Rate %/yr", type: "percent" }, { key: "bl_book_bill", label: "Book-to-Bill", type: "number" },
    { key: "bl_win_rate", label: "Win Rate %", type: "percent" },
  ] },
  yield: { label: "Yield-Based (FinServ)", shortLabel: "Yield", inputs: [
    { key: "yld_assets", label: "Earning Assets", type: "currency" }, { key: "yld_nim", label: "NIM %", type: "percent" },
    { key: "yld_aum", label: "AUM", type: "currency" }, { key: "yld_mgmt_fee", label: "Mgmt Fee %", type: "percent" },
    { key: "yld_nonint", label: "Non-Int Income", type: "currency" },
  ] },
  usage: { label: "Usage / Consumption", shortLabel: "Usage", inputs: [
    { key: "usg_customers", label: "Active Customers", type: "number" }, { key: "usg_cust_growth", label: "Cust Growth %", type: "percent" },
    { key: "usg_avg_usage", label: "Avg Usage/Cust/Mo", type: "number" }, { key: "usg_usage_growth", label: "Usage Growth %", type: "percent" },
    { key: "usg_price", label: "Price/Unit ($)", type: "currency" }, { key: "usg_vol_disc", label: "Vol Discount %", type: "percent" },
  ] },
  advertising: { label: "Advertising / Monetization", shortLabel: "Ad/Mktplace", inputs: [
    { key: "ad_dau", label: "DAU", type: "number" }, { key: "ad_sessions", label: "Sessions/DAU", type: "number" },
    { key: "ad_load", label: "Ads/Session", type: "number" }, { key: "ad_cpm", label: "CPM ($)", type: "currency" },
    { key: "ad_gmv", label: "Marketplace GMV", type: "currency" }, { key: "ad_take_rate", label: "Take Rate %", type: "percent" },
  ] },
  recurring_split: { label: "Recurring + Non-Recurring", shortLabel: "Rec+NonRec", inputs: [
    { key: "rnr_sub_arr", label: "Subscription ARR", type: "currency" }, { key: "rnr_maint_rate", label: "Maintenance Rate %", type: "percent" },
    { key: "rnr_ps_attach", label: "PS Attach Rate %", type: "percent" }, { key: "rnr_ps_avg", label: "Avg PS ($)", type: "currency" },
    { key: "rnr_new_cust", label: "New Customers/Yr", type: "number" }, { key: "rnr_impl", label: "Impl Fee ($)", type: "currency" },
  ] },
  channel_mix: { label: "Channel Mix", shortLabel: "Channels", inputs: [
    { key: "ch_direct_deals", label: "Direct Deals", type: "number" }, { key: "ch_direct_acv", label: "Direct ACV ($)", type: "currency" },
    { key: "ch_partner_deals", label: "Partner Deals", type: "number" }, { key: "ch_partner_disc", label: "Partner Disc %", type: "percent" },
    { key: "ch_oem_deals", label: "OEM Deals", type: "number" }, { key: "ch_oem_disc", label: "OEM Disc %", type: "percent" },
  ] },
  geo_segment: { label: "Geographic Segmentation", shortLabel: "Geography", inputs: [
    { key: "geo_na_rev", label: "NA Revenue ($)", type: "currency" }, { key: "geo_na_growth", label: "NA Growth %", type: "percent" },
    { key: "geo_eu_rev", label: "Europe Rev (local)", type: "currency" }, { key: "geo_eu_fx", label: "EUR/USD Rate", type: "number" },
    { key: "geo_apac_rev", label: "APAC Rev (local)", type: "currency" }, { key: "geo_apac_fx", label: "APAC/USD Rate", type: "number" },
  ] },
}

// Expense category metadata: display label, IS mapping, and input rows
const EXPENSE_CATEGORY_META: Record<string, {
  label: string
  shortLabel: string
  isMapping: "cogs" | "sm" | "rd" | "ga" | "da" | "intExp" | "capex"
  inputs: { key: string; label: string; type: "currency" | "percent" | "number"; default: number }[]
}> = {
  cogs: {
    label: "Cost of Goods Sold",
    shortLabel: "COGS",
    isMapping: "cogs",
    inputs: [
      { key: "cogs_pct_rev",  label: "COGS as % of Revenue",         type: "percent",  default: 0.35 },
      { key: "cogs_mat_pct",  label: "  Raw Materials (% of COGS)",  type: "percent",  default: 0.50 },
      { key: "cogs_labor_pct", label: "  Direct Labor (% of COGS)",          type: "percent",  default: 0.30 },
      { key: "cogs_oh_pct",   label: "  Manufacturing Overhead (%)",        type: "percent",  default: 0.12 },
      { key: "cogs_ship_pct", label: "  Shipping & Freight (%)",            type: "percent",  default: 0.08 },
    ],
  },
  marketing: {
    label: "Marketing & Sales",
    shortLabel: "Marketing",
    isMapping: "sm",
    inputs: [
      { key: "mktg_pct_rev",     label: "Marketing as % of Revenue",      type: "percent",  default: 0.15 },
      { key: "mktg_digital_pct", label: "  Digital Ads (% of Marketing)", type: "percent",  default: 0.40 },
      { key: "mktg_content_pct", label: "  Content Marketing (%)",        type: "percent",  default: 0.15 },
      { key: "mktg_events_pct",  label: "  Events & Conferences (%)",     type: "percent",  default: 0.20 },
      { key: "mktg_agency_pct",  label: "  Agency Fees (%)",              type: "percent",  default: 0.15 },
      { key: "mktg_print_pct",   label: "  Print & Promotional (%)",      type: "percent",  default: 0.10 },
    ],
  },
  rd: {
    label: "Research & Development",
    shortLabel: "R&D",
    isMapping: "rd",
    inputs: [
      { key: "rd_pct_rev",   label: "R&D as % of Revenue",            type: "percent",  default: 0.20 },
      { key: "rd_staff_pct", label: "  R&D Staff Costs (% of R&D)",   type: "percent",  default: 0.60 },
      { key: "rd_proto_pct", label: "  Prototyping (%)",              type: "percent",  default: 0.15 },
      { key: "rd_qa_pct",    label: "  Testing & QA (%)",             type: "percent",  default: 0.10 },
      { key: "rd_patent_pct", label: "  Patent Filings (%)",           type: "percent",  default: 0.05 },
      { key: "rd_lab_pct",   label: "  Lab Supplies (%)",             type: "percent",  default: 0.10 },
    ],
  },
  opex: {
    label: "Operating Expenses",
    shortLabel: "OpEx",
    isMapping: "ga",
    inputs: [
      { key: "opex_sqft",      label: "Office Sq Ft per Employee",        type: "number",   default: 150   },
      { key: "opex_rent_sqft", label: "Rent per Sq Ft (annual $)",        type: "currency", default: 65    },
      { key: "opex_util_pct",  label: "Utilities (% of Rent)",            type: "percent",  default: 0.08  },
      { key: "opex_insurance", label: "Insurance (fixed $/mo)",           type: "currency", default: 1500  },
      { key: "opex_supplies",  label: "Office Supplies ($/employee/mo)",  type: "currency", default: 50    },
      { key: "opex_sw_subs",   label: "Software Subscriptions ($/emp/mo)",type: "currency", default: 200   },
    ],
  },
  payroll: {
    label: "Payroll & Benefits",
    shortLabel: "Payroll",
    isMapping: "ga",
    inputs: [
      { key: "pay_hc",          label: "Headcount",                     type: "number",   default: 50    },
      { key: "pay_avg_salary",  label: "Avg Salary per Employee ($)",   type: "currency", default: 95000 },
      { key: "pay_bonus_pct",   label: "Bonus (% of Base)",             type: "percent",  default: 0.10  },
      { key: "pay_health_pct",  label: "Health Insurance (% of Base)",  type: "percent",  default: 0.12  },
      { key: "pay_401k_pct",    label: "401k Contributions (% of Base)",type: "percent",  default: 0.06  },
      { key: "pay_taxes_pct",   label: "Payroll Taxes (% of Base)",     type: "percent",  default: 0.10  },
      { key: "pay_sbc_per_emp", label: "SBC per Employee ($/yr)",       type: "currency", default: 2000  },
    ],
  },
  technology: {
    label: "Technology & IT",
    shortLabel: "Technology",
    isMapping: "ga",
    inputs: [
      { key: "it_cost_per",   label: "IT Cost per Employee ($/yr)",   type: "currency", default: 8500  },
      { key: "it_saas_pct",   label: "  SaaS Licenses (% of IT)",    type: "percent",  default: 0.40  },
      { key: "it_cloud_pct",  label: "  Cloud Hosting (% of IT)",    type: "percent",  default: 0.30  },
      { key: "it_security_pct", label: "  Cybersecurity (% of IT)",   type: "percent",  default: 0.12  },
      { key: "it_support_pct",  label: "  IT Support (% of IT)",    type: "percent",  default: 0.08  },
    ],
  },
  professional: {
    label: "Professional Services",
    shortLabel: "Prof Svcs",
    isMapping: "ga",
    inputs: [
      { key: "prof_legal",   label: "Legal Fees ($/mo)",             type: "currency", default: 8000  },
      { key: "prof_audit",   label: "Accounting & Audit ($/mo)",    type: "currency", default: 5000  },
      { key: "prof_consult", label: "Consulting ($/mo)",             type: "currency", default: 12000 },
      { key: "prof_contract", label: "  Contractors ($/mo)",          type: "currency", default: 15000 },
    ],
  },
  travel: {
    label: "Travel & Entertainment",
    shortLabel: "T&E",
    isMapping: "ga",
    inputs: [
      { key: "te_budget",    label: "T&E Budget per Employee ($/yr)",type: "currency", default: 3500  },
      { key: "te_air_pct",   label: "  Airfare (% of T&E)",         type: "percent",  default: 0.35  },
      { key: "te_hotel_pct", label: "  Hotels (% of T&E)",          type: "percent",  default: 0.25  },
      { key: "te_meals_pct", label: "  Meals & Per Diem (%)",       type: "percent",  default: 0.20  },
      { key: "te_client_pct", label: "  Client Entertainment (%)",   type: "percent",  default: 0.10  },
    ],
  },
  capex: {
    label: "Capital Expenditures",
    shortLabel: "CapEx",
    isMapping: "capex",
    inputs: [
      { key: "capex_pct_rev",  label: "CapEx as % of Revenue",      type: "percent",  default: 0.05  },
      { key: "capex_it_pct",   label: "  IT Hardware (% of CapEx)", type: "percent",  default: 0.45  },
      { key: "capex_furn_pct", label: "  Furniture & Fixtures (%)", type: "percent",  default: 0.20  },
      { key: "capex_lease_pct", label: "  Leasehold Improvements (%)", type: "percent",  default: 0.25  },
      { key: "capex_veh_pct",  label: "  Vehicles (%)",             type: "percent",  default: 0.10  },
    ],
  },
  debt: {
    label: "Debt Service",
    shortLabel: "Debt",
    isMapping: "intExp",
    inputs: [
      { key: "debt_balance",  label: "Outstanding Debt ($)",        type: "currency", default: 0     },
      { key: "debt_rate",     label: "Annual Interest Rate",        type: "percent",  default: 0.065 },
      { key: "debt_term_mo",  label: "Remaining Term (months)",     type: "number",   default: 60    },
    ],
  },
  taxes_reg: {
    label: "Taxes & Regulatory",
    shortLabel: "Taxes/Reg",
    isMapping: "ga",
    inputs: [
      { key: "tax_property",    label: "Property Tax ($/mo)",       type: "currency", default: 4500  },
      { key: "tax_sales",       label: "Sales & Use Tax ($/mo)",    type: "currency", default: 3200  },
      { key: "tax_license",     label: "Licensing Fees ($/mo)",     type: "currency", default: 1000  },
      { key: "tax_compliance",  label: "Compliance Costs ($/mo)",   type: "currency", default: 2500  },
    ],
  },
  da: {
    label: "Depreciation & Amortization",
    shortLabel: "D&A",
    isMapping: "da",
    inputs: [
      { key: "da_depr_rate",  label: "Depreciation Rate (SL %/yr)",  type: "percent",  default: 0.20  },
      { key: "da_intang_mo",  label: "Intangible Amortization ($/mo)",type: "currency", default: 2000  },
    ],
  },
}

// IS mapping groups: which cost categories feed into which IS line
const IS_MAPPING_GROUPS = {
  cogs:   ["cogs"],
  sm:     ["marketing"],
  rd:     ["rd"],
  da:     ["da"],
  intExp: ["debt"],
  capex:  ["capex"],
  // Everything else rolls into G&A
  ga:     ["opex", "payroll", "technology", "professional", "travel", "taxes_reg"],
} as const

export async function buildProjectionWorkbook(
  historicals: HistoricalYear[],
  projected: ProjectedYear[],
  assumptions: ProjectionAssumptions,
  companyName: string,
  revenueMethods?: string[],
  methodInputs?: Record<string, number>,
  activeExpenses?: string[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "ShardCFO"
  workbook.company = companyName
  workbook.created = new Date()

  const histCount  = historicals.length
  const projYears  = projected.length
  const numStreams  = assumptions.revenueStreams.length

  // First data column is B (col index 2).
  // Historical columns: 2 .. 2+histCount-1
  // Projected columns:  2+histCount .. 2+histCount+projYears-1
  const firstProjCol = 2 + histCount  // e.g. if histCount=4, projYears start at col 6

  // For the Assumptions sheet, year i (0-based) is in column 2+i (B=yr0, C=yr1, ...)
  const assumpColForYear = (i: number) => colLetter(2 + i)

  // The Excel column letter for a projected year column (i = 0-based projection index)
  const projColLetter = (i: number) => colLetter(firstProjCol + i)

  // All year labels
  const allLabels = [...historicals.map((h) => h.label), ...projected.map((p) => p.label)]
  const totalCols = allLabels.length

  // =========================================================================
  // SHEET 1: Assumptions
  // =========================================================================

  const assumpRows = new RowTracker(1) // row 1 = header

  const assumpSheet = workbook.addWorksheet("Basic Assumptions", { properties: { tabColor: { argb: "FFFFFFC0" } } })

  assumpSheet.getColumn(1).width = 32
  for (let c = 2; c <= projYears + 1; c++) {
    assumpSheet.getColumn(c).width = 14
  }

  // Row 1: header
  const assumpHeader = assumpSheet.addRow(["Projection Assumptions", ...projected.map((p) => p.label)])
  applyHeaderStyle(assumpHeader)
  assumpHeader.height = 18
  assumpSheet.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }]

  // Helper: write one assumption row with yellow editable cells
  const writeAssumpRow = (
    key: string,
    label: string,
    values: number[],
    fmt: "percent" | "currency" | "number"
  ): number => {
    assumpRows.next(key)
    const row = assumpSheet.addRow([label, ...values])
    labelCell(row, label)
    for (let c = 2; c <= projYears + 1; c++) {
      const cell = row.getCell(c)
      if (fmt === "percent") applyPercentFormat(cell)
      else if (fmt === "currency") applyCurrencyFormat(cell)
      // days: leave as integer
      cell.font = { size: 10, name: "Calibri" }
      cell.alignment = { horizontal: "right", vertical: "middle" }
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_ASSUMP_BG}` } }
    }
    row.height = 15
    return assumpRows.row
  }

  const writeAssumpSectionHeader = (label: string): void => {
    assumpRows.next()
    const row = assumpSheet.addRow([label])
    row.getCell(1).font = { bold: true, italic: true, size: 9, color: { argb: "FF475569" }, name: "Calibri" }
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_SECTION_BG}` } }
    for (let c = 2; c <= projYears + 1; c++) {
      row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_SECTION_BG}` } }
    }
    row.height = 14
  }

  const writeAssumpBlank = (): void => {
    assumpRows.next()
    assumpSheet.addRow([]).height = 6
  }

  // --- Revenue Growth Rates (rows 2 = blank, 3 = section, 4..3+N = streams) ---
  writeAssumpBlank() // row 2

  writeAssumpSectionHeader("Revenue Growth Rates") // row 3

  // One row per stream, starting at row 4
  const streamGrowthRows: number[] = []
  for (const stream of assumptions.revenueStreams) {
    const rowNum = writeAssumpRow(
      `streamGrowth_${stream.name}`,
      stream.name,
      stream.growthRates.slice(0, projYears),
      "percent"
    )
    streamGrowthRows.push(rowNum)
  }

  writeAssumpBlank()

  // --- Cost Structure ---
  writeAssumpSectionHeader("Cost Structure (% of Revenue)")
  writeAssumpRow("cogs",   "COGS %",                 assumptions.cogsPercent.slice(0, projYears),                  "percent")
  writeAssumpRow("rd",     "R&D %",                   assumptions.rdPercent.slice(0, projYears),                    "percent")
  writeAssumpRow("sm",     "S&M %",                   assumptions.smPercent.slice(0, projYears),                    "percent")
  writeAssumpRow("ga",     "G&A %",                   assumptions.gaPercent.slice(0, projYears),                    "percent")
  writeAssumpRow("sbc",    "SBC %",                   assumptions.sbcPercent.slice(0, projYears),                   "percent")
  writeAssumpRow("da",     "D&A %",                   assumptions.daPercent.slice(0, projYears),                    "percent")
  writeAssumpRow("daSplitPPE", "D&A Split — PPE Share", Array(projYears).fill(0.4),                                "percent")
  writeAssumpRow("tax",    "Tax Rate",                 assumptions.taxRate.slice(0, projYears),                      "percent")

  writeAssumpBlank()

  // --- Balance Sheet Drivers ---
  writeAssumpSectionHeader("Balance Sheet Drivers")
  writeAssumpRow("dso",       "DSO (days)",                          assumptions.dso.slice(0, projYears),                             "number")
  writeAssumpRow("dpo",       "DPO (days)",                          assumptions.dpo.slice(0, projYears),                             "number")
  writeAssumpRow("prepaid",   "Prepaid % of Revenue",                assumptions.prepaidPercent.slice(0, projYears),                  "percent")
  writeAssumpRow("accrued",   "Accrued Liab % of Revenue",           assumptions.accruedLiabPercent.slice(0, projYears),              "percent")
  writeAssumpRow("defrevC",   "Deferred Rev Current % of Revenue",   assumptions.deferredRevCurrentPercent.slice(0, projYears),       "percent")
  writeAssumpRow("defrevNC",  "Deferred Rev Non-Current % of Rev",   assumptions.deferredRevNonCurrentPercent.slice(0, projYears),    "percent")

  writeAssumpBlank()

  // --- CapEx & Investing ---
  writeAssumpSectionHeader("CapEx & Investing (% of Revenue)")
  writeAssumpRow("capex",  "CapEx %",        assumptions.capexPercent.slice(0, projYears),       "percent")
  writeAssumpRow("capsw",  "Cap Software %", assumptions.capSoftwarePercent.slice(0, projYears), "percent")

  writeAssumpBlank()

  // --- Financing ---
  writeAssumpSectionHeader("Financing (Absolute $)")
  writeAssumpRow("intInc",    "Interest Income",    assumptions.interestIncome.slice(0, projYears),   "currency")
  writeAssumpRow("intExp",    "Interest Expense",   assumptions.interestExpense.slice(0, projYears),  "currency")
  writeAssumpRow("newDebt",   "New Debt Issuance",  assumptions.newDebt.slice(0, projYears),          "currency")
  writeAssumpRow("debtRepay", "Debt Repayments",    assumptions.debtRepayments.slice(0, projYears),   "currency")
  writeAssumpRow("equityIss", "Equity Issuance",    assumptions.equityIssuance.slice(0, projYears),   "currency")
  writeAssumpRow("buybacks",  "Share Repurchases",  assumptions.shareRepurchases.slice(0, projYears), "currency")
  writeAssumpRow("divs",      "Dividends Paid",     assumptions.dividendsPaid.slice(0, projYears),    "currency")

  // =========================================================================
  // SHEET: Full Financial Model Builder
  // =========================================================================
  // Mirrors Basic Assumptions layout but adds debt tranche detail, NOL
  // vintage tracking, revolver mechanics, and advanced tax / equity inputs.

  const fmbSheet = workbook.addWorksheet("Full Financial Model Builder", { properties: { tabColor: { argb: "FFBFDBFE" } } })

  fmbSheet.getColumn(1).width = 36
  for (let c = 2; c <= projYears + 1; c++) fmbSheet.getColumn(c).width = 16

  // Reuse helpers scoped to this sheet
  const fmbRow = new RowTracker(1)

  const fmbHeader = fmbSheet.addRow(["Full Financial Model Builder", ...projected.map((p) => p.label)])
  applyHeaderStyle(fmbHeader)

  const writeFmbBlank = () => { fmbRow.next(); fmbSheet.addRow([]) }
  const writeFmbSection = (title: string) => {
    fmbRow.next()
    writeSectionHeader(fmbSheet, title, projYears)
  }
  const writeFmbRow = (
    key: string,
    label: string,
    values: number[],
    fmt: "currency" | "percent" | "number",
  ) => {
    fmbRow.next(key)
    const row = fmbSheet.addRow([label, ...values])
    const labelCell = row.getCell(1)
    labelCell.font = { size: 10, name: "Calibri" }
    labelCell.alignment = { vertical: "middle" }
    for (let c = 2; c <= values.length + 1; c++) {
      const cell = row.getCell(c)
      if (fmt === "currency") applyCurrencyFormat(cell)
      else if (fmt === "percent") applyPercentFormat(cell)
      else cell.numFmt = "#,##0.0"
      cell.font = { size: 10, name: "Calibri" }
      cell.alignment = { horizontal: "right", vertical: "middle" }
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_ASSUMP_BG}` } }
    }
    row.height = 15
  }
  const writeFmbNote = (text: string) => {
    fmbRow.next()
    const row = fmbSheet.addRow([text])
    row.getCell(1).font = { size: 9, italic: true, color: { argb: "FF64748B" }, name: "Calibri" }
    row.height = 14
  }

  // =====================================================================
  // REVENUE BUILD METHODOLOGIES
  // =====================================================================
  // 14 frameworks — fill in the methodology that matches your business.
  // Leave unused sections blank; only populated rows feed the model.

  writeFmbBlank()
  writeFmbSection("REVENUE BUILD — Select Your Methodology")
  writeFmbNote("Fill in the section(s) that match your business model. Unused sections can be left blank.")
  writeFmbNote("Multiple methodologies can be combined (e.g., Volume×Price by segment + Seasonality overlay).")

  // ---- 1. Volume × Price ----
  writeFmbBlank()
  writeFmbSection("1. Volume × Price")
  writeFmbNote("Revenue = Units Sold × ASP. The most auditable build. Use per product line for mix-shift analysis.")
  writeFmbRow("fmb_vp_units_1",   "Product Line 1 — Units Sold",     Array(projYears).fill(0), "number")
  writeFmbRow("fmb_vp_asp_1",     "Product Line 1 — ASP ($)",        Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_vp_units_2",   "Product Line 2 — Units Sold",     Array(projYears).fill(0), "number")
  writeFmbRow("fmb_vp_asp_2",     "Product Line 2 — ASP ($)",        Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_vp_units_3",   "Product Line 3 — Units Sold",     Array(projYears).fill(0), "number")
  writeFmbRow("fmb_vp_asp_3",     "Product Line 3 — ASP ($)",        Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_vp_unit_growth","Unit Growth Rate (YoY)",          Array(projYears).fill(0), "percent")
  writeFmbRow("fmb_vp_asp_growth", "ASP Growth Rate (YoY)",           Array(projYears).fill(0), "percent")
  writeFmbNote("Industries: Consumer electronics, CPG, pharma, automotive, e-commerce, airlines.")

  // ---- 2. Top-Down / TAM-Based ----
  writeFmbBlank()
  writeFmbSection("2. Top-Down / TAM-Based")
  writeFmbNote("Revenue = TAM × Market Share %. Layer TAM → SAM → SOM for rigor.")
  writeFmbRow("fmb_tam_total",     "Total Addressable Market ($)",    Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_tam_growth",    "TAM Growth Rate (CAGR)",          Array(projYears).fill(0), "percent")
  writeFmbRow("fmb_sam_pct",       "SAM as % of TAM",                 Array(projYears).fill(0), "percent")
  writeFmbRow("fmb_som_share",     "Market Share % (of SAM)",         Array(projYears).fill(0), "percent")
  writeFmbNote("Revenue = TAM × SAM% × Share%. Best for early-stage / new market entry. Always pair with a bottoms-up build.")

  // ---- 3. Bottoms-Up by Sales Capacity ----
  writeFmbBlank()
  writeFmbSection("3. Bottoms-Up by Sales Capacity")
  writeFmbNote("Revenue = Productive Reps × Quota × Attainment. The B2B SaaS gold standard.")
  writeFmbRow("fmb_sc_beg_reps",   "Beginning Quota-Carrying Reps",   Array(projYears).fill(0), "number")
  writeFmbRow("fmb_sc_new_hires",  "New Hires (per year)",            Array(projYears).fill(0), "number")
  writeFmbRow("fmb_sc_attrition",  "Attrition (reps lost)",           Array(projYears).fill(0), "number")
  writeFmbRow("fmb_sc_ramp_months","Ramp Time to Full Productivity (months)", Array(projYears).fill(6), "number")
  writeFmbRow("fmb_sc_quota",      "Annual Quota per Rep ($)",        Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_sc_attainment", "Average Quota Attainment %",      Array(projYears).fill(0.85), "percent")
  writeFmbNote("Ramped Capacity = Fully Ramped × 100% + New Hires × (months ramped / 12) × Attainment.")
  writeFmbNote("Industries: B2B SaaS, enterprise software, professional services, insurance, recruiting.")

  // ---- 4. Cohort / Bookings-Based ----
  writeFmbBlank()
  writeFmbSection("4. Cohort / Bookings-Based (SaaS)")
  writeFmbNote("Cohort Rev_t = Bookings_c × Retention(t-c) × (1 + Expansion). Sum all surviving cohorts.")
  writeFmbRow("fmb_coh_new_acv",   "New Cohort ACV ($)",              Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_coh_new_logos", "New Logos (customers)",            Array(projYears).fill(0), "number")
  writeFmbRow("fmb_coh_gross_churn","Quarterly Gross Churn Rate",     Array(projYears).fill(0.03), "percent")
  writeFmbRow("fmb_coh_expansion", "Quarterly Net Expansion Rate",    Array(projYears).fill(0.02), "percent")
  writeFmbRow("fmb_coh_recog",     "Recognition Period (months)",      Array(projYears).fill(12), "number")
  writeFmbNote("Essential for subscription businesses. Forces explicit retention and expansion modeling.")
  writeFmbNote("Industries: SaaS, streaming, mobile gaming, D2C subscription, insurance, fintech lending.")

  // ---- 5. ARR Waterfall ----
  writeFmbBlank()
  writeFmbSection("5. ARR Waterfall")
  writeFmbNote("Ending ARR = Beg ARR + New + Expansion - Churn - Contraction. The SaaS operating lingua franca.")
  writeFmbRow("fmb_arr_beg",       "Beginning ARR ($)",               Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_arr_new",       "New ARR (new logos)",             Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_arr_expansion", "Expansion ARR (upsell/xsell)",   Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_arr_churn",     "Churned ARR (lost customers)",   Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_arr_contraction","Contraction ARR (downgrades)",  Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_arr_nrr",       "Target Net Revenue Retention %",  Array(projYears).fill(1.10), "percent")
  writeFmbRow("fmb_arr_grr",       "Target Gross Revenue Retention %",Array(projYears).fill(0.92), "percent")
  writeFmbNote("NRR > 120% = best-in-class. GRR < 85% = red flag. Revenue ≈ Avg(Beg,End ARR) for annual periods.")

  // ---- 6. Same-Store + New Store ----
  writeFmbBlank()
  writeFmbSection("6. Same-Store + New Store")
  writeFmbNote("Revenue = Existing Stores × (1 + SSSG) + New Stores × Ramp Rev. Retail / restaurant standard.")
  writeFmbRow("fmb_ss_existing",   "Existing Store Count",            Array(projYears).fill(0), "number")
  writeFmbRow("fmb_ss_rev_per",    "Avg Revenue per Existing Store ($)", Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_ss_sssg",       "Same-Store Sales Growth (SSSG)",  Array(projYears).fill(0.03), "percent")
  writeFmbRow("fmb_ss_new_stores", "New Stores Opened",               Array(projYears).fill(0), "number")
  writeFmbRow("fmb_ss_new_rev",    "Avg Revenue per New Store ($)",   Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_ss_partial",    "New Store Partial-Year Factor",    Array(projYears).fill(0.5), "number")
  writeFmbNote("SSSG 3-5% = healthy for mature retail. Negative comps for multiple Qs = major red flag.")
  writeFmbNote("Industries: Restaurant chains, retail, fitness, grocery, hotels, banking branches, clinics.")

  // ---- 7. Contract Backlog / Pipeline ----
  writeFmbBlank()
  writeFmbSection("7. Contract Backlog / Pipeline")
  writeFmbNote("Rev = Backlog Burn + New Wins. For project-based / long-cycle businesses (ASC 606 % completion).")
  writeFmbRow("fmb_bl_opening",    "Beginning Backlog ($)",           Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_bl_new_awards", "New Contract Awards ($)",         Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_bl_burn_rate",  "Backlog Burn Rate (%/year)",      Array(projYears).fill(0.33), "percent")
  writeFmbRow("fmb_bl_book_bill",  "Target Book-to-Bill Ratio",       Array(projYears).fill(1.10), "number")
  writeFmbRow("fmb_bl_pipeline",   "Weighted Pipeline ($)",           Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_bl_win_rate",   "Pipeline Win Rate %",             Array(projYears).fill(0.30), "percent")
  writeFmbNote("Book-to-bill > 1.0× = growing backlog (positive). EAC revisions are the key margin risk.")
  writeFmbNote("Industries: Defense/aerospace, construction, gov IT, shipbuilding, oilfield services.")

  // ---- 8. Yield-Based (Financial Services) ----
  writeFmbBlank()
  writeFmbSection("8. Yield-Based (Financial Services)")
  writeFmbNote("NII = Avg Earning Assets × NIM. Fee Rev = AUM × Fee Rate. The bank/asset mgr framework.")
  writeFmbRow("fmb_yld_assets",    "Avg Earning Assets ($)",          Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_yld_yield",     "Asset Yield (%)",                 Array(projYears).fill(0.05), "percent")
  writeFmbRow("fmb_yld_cost_funds","Cost of Funds (%)",               Array(projYears).fill(0.02), "percent")
  writeFmbRow("fmb_yld_nim",       "Net Interest Margin (NIM)",       Array(projYears).fill(0.03), "percent")
  writeFmbRow("fmb_yld_aum",       "Assets Under Management ($)",     Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_yld_mgmt_fee",  "Management Fee Rate (%)",         Array(projYears).fill(0.0075), "percent")
  writeFmbRow("fmb_yld_perf_fee",  "Performance Fee / Carry (%)",     Array(projYears).fill(0), "percent")
  writeFmbRow("fmb_yld_nonint",    "Non-Interest Income ($)",         Array(projYears).fill(0), "currency")
  writeFmbNote("NIM expansion/compression is the #1 bank stock driver. AUM × market return drives fee revenue.")
  writeFmbNote("Industries: Banks, asset managers, insurance, REITs, fintech lenders, credit cards, exchanges.")

  // ---- 9. Usage / Consumption-Based ----
  writeFmbBlank()
  writeFmbSection("9. Usage / Consumption-Based")
  writeFmbNote("Revenue = Active Customers × Avg Usage × Price/Unit. Metered / pay-as-you-go models.")
  writeFmbRow("fmb_usg_customers", "Active Customers",                Array(projYears).fill(0), "number")
  writeFmbRow("fmb_usg_cust_growth","Customer Growth Rate (YoY)",    Array(projYears).fill(0), "percent")
  writeFmbRow("fmb_usg_avg_usage", "Avg Usage per Customer / Period", Array(projYears).fill(0), "number")
  writeFmbRow("fmb_usg_usage_growth","Usage Growth per Customer (YoY)",Array(projYears).fill(0), "percent")
  writeFmbRow("fmb_usg_price",     "Price per Unit ($)",              Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_usg_price_chg", "Price Change (YoY)",              Array(projYears).fill(0), "percent")
  writeFmbRow("fmb_usg_vol_disc",  "Volume Discount Drag (%)",        Array(projYears).fill(0), "percent")
  writeFmbNote("Key metric: Dollar-based net expansion. Revenue less predictable than committed ARR.")
  writeFmbNote("Industries: Cloud infra (AWS/GCP/Azure), APIs (Twilio/Stripe), Snowflake, telecom, utilities, AI inference.")

  // ---- 10. Advertising / Monetization ----
  writeFmbBlank()
  writeFmbSection("10. Advertising / Monetization")
  writeFmbNote("Ad Rev = Impressions × CPM / 1000. Marketplace Rev = GMV × Take Rate.")
  writeFmbRow("fmb_ad_dau",        "Daily Active Users (DAU)",        Array(projYears).fill(0), "number")
  writeFmbRow("fmb_ad_sessions",   "Sessions per DAU",                Array(projYears).fill(0), "number")
  writeFmbRow("fmb_ad_load",       "Ads per Session",                 Array(projYears).fill(0), "number")
  writeFmbRow("fmb_ad_cpm",        "Average CPM ($)",                 Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_ad_arpu",       "ARPU — Ad Tier ($/user/yr)",     Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_ad_gmv",        "Marketplace GMV ($)",             Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_ad_take_rate",  "Marketplace Take Rate (%)",       Array(projYears).fill(0), "percent")
  writeFmbRow("fmb_ad_paid_users", "Paid Subscribers",                Array(projYears).fill(0), "number")
  writeFmbRow("fmb_ad_sub_arpu",   "ARPU — Paid Tier ($/user/yr)",   Array(projYears).fill(0), "currency")
  writeFmbNote("ARPU is the north star for ad businesses. For marketplaces, take rate expansion is a powerful lever.")
  writeFmbNote("Industries: Social media, search, streaming, marketplaces, gaming, publishers, classifieds.")

  // ---- 11. Recurring + Non-Recurring Split ----
  writeFmbBlank()
  writeFmbSection("11. Recurring + Non-Recurring Split")
  writeFmbNote("Total Revenue = Recurring + Non-Recurring. Model separately — different margins and multiples.")
  writeFmbRow("fmb_rnr_sub_arr",   "Subscription / Recurring ARR ($)",Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_rnr_maint",     "Maintenance Revenue ($)",         Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_rnr_maint_rate","Maintenance Rate (% of base)",    Array(projYears).fill(0.20), "percent")
  writeFmbRow("fmb_rnr_license",   "License / One-Time Revenue ($)",  Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_rnr_ps_attach", "Prof. Services Attach Rate (%)",  Array(projYears).fill(0), "percent")
  writeFmbRow("fmb_rnr_ps_avg",    "Avg Prof. Services Engagement ($)",Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_rnr_impl",      "Implementation Fees per Customer ($)",Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_rnr_hw",        "Hardware / Equipment Revenue ($)", Array(projYears).fill(0), "currency")
  writeFmbNote("Recurring mix shift from 70% → 90% can re-rate multiples even on flat revenue.")
  writeFmbNote("Industries: Enterprise SW (license→SaaS transition), IoT, security, fitness+content, medical devices.")

  // ---- 12. Channel Mix ----
  writeFmbBlank()
  writeFmbSection("12. Channel Mix")
  writeFmbNote("Total Revenue = Direct + Partner + OEM. Each channel has its own discount, margin, and growth rate.")
  writeFmbRow("fmb_ch_direct_deals","Direct Sales — # Deals",        Array(projYears).fill(0), "number")
  writeFmbRow("fmb_ch_direct_acv", "Direct Sales — ACV ($)",          Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_ch_partner_deals","Partner/VAR — # Deals",        Array(projYears).fill(0), "number")
  writeFmbRow("fmb_ch_partner_acv","Partner/VAR — ACV ($)",           Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_ch_partner_disc","Partner Discount (%)",           Array(projYears).fill(0.20), "percent")
  writeFmbRow("fmb_ch_oem_deals",  "OEM / Reseller — # Deals",       Array(projYears).fill(0), "number")
  writeFmbRow("fmb_ch_oem_acv",    "OEM / Reseller — ACV ($)",        Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_ch_oem_disc",   "OEM Discount (%)",                Array(projYears).fill(0.40), "percent")
  writeFmbNote("Blended ASP = SUM(Channel_Mix% × Net_ASP). Cloud marketplace fees typically 3-5%.")
  writeFmbNote("Industries: Enterprise SW, consumer electronics, CPG, apparel, pharma, cloud marketplace resale.")

  // ---- 13. Geographic Segmentation ----
  writeFmbBlank()
  writeFmbSection("13. Geographic Segmentation")
  writeFmbNote("Revenue by region with FX overlay. Consolidated = SUM(Local Rev × FX Rate).")
  writeFmbRow("fmb_geo_na_rev",    "North America Revenue ($)",       Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_geo_na_growth", "North America Growth (%)",        Array(projYears).fill(0), "percent")
  writeFmbRow("fmb_geo_eu_rev",    "Europe Revenue (local €)",        Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_geo_eu_fx",     "EUR/USD Exchange Rate",           Array(projYears).fill(1.08), "number")
  writeFmbRow("fmb_geo_eu_growth", "Europe Growth (%)",               Array(projYears).fill(0), "percent")
  writeFmbRow("fmb_geo_apac_rev",  "APAC Revenue (local)",            Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_geo_apac_fx",   "APAC/USD Exchange Rate",          Array(projYears).fill(1.0), "number")
  writeFmbRow("fmb_geo_apac_growth","APAC Growth (%)",                Array(projYears).fill(0), "percent")
  writeFmbRow("fmb_geo_latam_rev", "LATAM Revenue (local)",           Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_geo_latam_fx",  "LATAM/USD Exchange Rate",         Array(projYears).fill(1.0), "number")
  writeFmbRow("fmb_geo_latam_growth","LATAM Growth (%)",              Array(projYears).fill(0), "percent")
  writeFmbNote("FX can swing reported growth ±200-500bps. Always present constant-currency growth alongside reported.")
  writeFmbNote("Industries: Any multinational. Critical for cos with 40%+ international revenue mix.")

  // ---- 14. Seasonality Overlays ----
  writeFmbBlank()
  writeFmbSection("14. Seasonality Overlays")
  writeFmbNote("Quarterly Rev = Annual Rev × Seasonality Index. SUM(Q1..Q4 indices) must = 100%.")
  writeFmbRow("fmb_seas_q1",       "Q1 Seasonality Index (%)",        Array(projYears).fill(0.25), "percent")
  writeFmbRow("fmb_seas_q2",       "Q2 Seasonality Index (%)",        Array(projYears).fill(0.25), "percent")
  writeFmbRow("fmb_seas_q3",       "Q3 Seasonality Index (%)",        Array(projYears).fill(0.25), "percent")
  writeFmbRow("fmb_seas_q4",       "Q4 Seasonality Index (%)",        Array(projYears).fill(0.25), "percent")
  writeFmbNote("Enterprise SaaS: ~35-40% of bookings in Q4 (budget flush). Retail: 30-40% of rev in Q4 (holiday).")
  writeFmbNote("Applied on top of any methodology. Derive indices from trailing 3-5yr avg (Q_Rev / Annual_Rev).")

  // ---- Simple Growth Rate Fallback ----
  writeFmbBlank()
  writeFmbSection("Simple Revenue Growth (Fallback)")
  writeFmbNote("If none of the above methodologies apply, use simple YoY growth rates per stream.")
  for (const stream of assumptions.revenueStreams) {
    writeFmbRow(`fmb_stream_${stream.name}`, `${stream.name} — YoY Growth`, stream.growthRates.slice(0, projYears), "percent")
  }

  writeFmbBlank()

  // =====================================================================
  // EXPENSE BUILD — Customizable by Category
  // =====================================================================
  // 12 expense categories from financial analyst workbook.
  // Each has sub-line items with driver-based inputs.
  // Users can customize line items, drivers, and amounts per year.

  writeFmbBlank()
  writeFmbSection("EXPENSE BUILD — Customizable by Category")
  writeFmbNote("12 expense categories with sub-line item detail. Edit line items, add rows, change drivers.")
  writeFmbNote("Drivers: % of Rev, per-headcount, fixed $, or % of category total. Yellow cells are editable.")

  // ---- Workforce Assumptions (shared driver for headcount-based expenses) ----
  writeFmbBlank()
  writeFmbSection("Workforce Assumptions (shared drivers)")
  writeFmbRow("fmb_hc_start",     "Starting Headcount",            Array(projYears).fill(50),     "number")
  writeFmbRow("fmb_hc_growth",    "Headcount Growth Rate (YoY)",   Array(projYears).fill(0.05),   "percent")
  writeFmbRow("fmb_avg_salary",   "Avg Salary per Employee ($)",   Array(projYears).fill(95000),  "currency")
  writeFmbRow("fmb_benefits_pct", "Benefits as % of Salary",       Array(projYears).fill(0.28),   "percent")
  writeFmbRow("fmb_inflation",    "Annual Inflation Rate",          Array(projYears).fill(0.03),   "percent")
  writeFmbNote("Headcount drives: payroll, T&E, office space, IT costs, and office supplies.")

  // ---- 1. Payroll & Benefits ----
  writeFmbBlank()
  writeFmbSection("1. Payroll & Benefits (Acct 5000–5050)")
  writeFmbNote("Base Salaries = Headcount × Avg Salary. Sub-items as % of base salary.")
  writeFmbRow("fmb_pay_base",     "Base Salaries ($)",             Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_pay_bonus_pct","Bonus (% of Base)",             Array(projYears).fill(0.10), "percent")
  writeFmbRow("fmb_pay_health",   "Health Insurance (% of Base)",  Array(projYears).fill(0.12), "percent")
  writeFmbRow("fmb_pay_401k",     "401k Contributions (% of Base)",Array(projYears).fill(0.06), "percent")
  writeFmbRow("fmb_pay_taxes",    "Payroll Taxes (% of Base)",     Array(projYears).fill(0.10), "percent")
  writeFmbRow("fmb_pay_sbc_per",  "SBC per Employee ($/yr)",       Array(projYears).fill(2000), "currency")
  writeFmbRow("fmb_pay_other",    "Other Payroll ($)",             Array(projYears).fill(0), "currency")
  writeFmbNote("Total = Base + (Bonus + Health + 401k + Taxes) × Base + SBC × HC + Other")

  // ---- 2. Operating Expenses ----
  writeFmbBlank()
  writeFmbSection("2. Operating Expenses (Acct 6000–6050)")
  writeFmbNote("Facilities-driven: Rent = HC × SqFt/Employee × $/SqFt. Utilities as % of rent.")
  writeFmbRow("fmb_opex_sqft",    "Office Sq Ft per Employee",     Array(projYears).fill(150),    "number")
  writeFmbRow("fmb_opex_rent_sqft","Rent per Sq Ft (annual $)",   Array(projYears).fill(65),     "currency")
  writeFmbRow("fmb_opex_util_pct","Utilities (% of Rent)",         Array(projYears).fill(0.08),   "percent")
  writeFmbRow("fmb_opex_insurance","Insurance (fixed $/mo)",       Array(projYears).fill(1500),   "currency")
  writeFmbRow("fmb_opex_supplies","Office Supplies ($/employee/mo)",Array(projYears).fill(50),    "currency")
  writeFmbRow("fmb_opex_sw_subs", "Software Subscriptions ($/emp/mo)",Array(projYears).fill(200), "currency")
  writeFmbRow("fmb_opex_maint",   "Maintenance & Repairs (fixed $/mo)",Array(projYears).fill(800),"currency")
  writeFmbRow("fmb_opex_other",   "Other OpEx ($)",                Array(projYears).fill(0), "currency")

  // ---- 3. Travel & Entertainment ----
  writeFmbBlank()
  writeFmbSection("3. Travel & Entertainment (Acct 6100–6130)")
  writeFmbNote("Driven by per-employee T&E budget. Sub-items as % of total T&E allocation.")
  writeFmbRow("fmb_te_budget",    "T&E Budget per Employee ($/yr)",Array(projYears).fill(3500),   "currency")
  writeFmbRow("fmb_te_air_pct",   "  Airfare (% of T&E)",         Array(projYears).fill(0.35),   "percent")
  writeFmbRow("fmb_te_hotel_pct", "  Hotels (% of T&E)",           Array(projYears).fill(0.25),   "percent")
  writeFmbRow("fmb_te_meals_pct", "  Meals & Per Diem (% of T&E)",Array(projYears).fill(0.20),   "percent")
  writeFmbRow("fmb_te_client_pct","  Client Entertainment (%)",    Array(projYears).fill(0.10),   "percent")
  writeFmbRow("fmb_te_mile_pct",  "  Mileage Reimbursement (%)",   Array(projYears).fill(0.05),   "percent")
  writeFmbRow("fmb_te_conf_pct",  "  Conference Fees (%)",          Array(projYears).fill(0.05),   "percent")

  // ---- 4. Marketing & Advertising ----
  writeFmbBlank()
  writeFmbSection("4. Marketing & Advertising (Acct 6200–6220)")
  writeFmbNote("Total Marketing = Revenue × Marketing %. Sub-items as allocation of total.")
  writeFmbRow("fmb_mktg_pct_rev", "Marketing as % of Revenue",    assumptions.smPercent.slice(0, projYears), "percent")
  writeFmbRow("fmb_mktg_digital", "  Digital Ads (% of Marketing)",Array(projYears).fill(0.40),   "percent")
  writeFmbRow("fmb_mktg_content", "  Content Marketing (%)",       Array(projYears).fill(0.15),   "percent")
  writeFmbRow("fmb_mktg_events",  "  Events & Conferences (%)",    Array(projYears).fill(0.20),   "percent")
  writeFmbRow("fmb_mktg_agency",  "  Agency Fees (%)",              Array(projYears).fill(0.15),   "percent")
  writeFmbRow("fmb_mktg_print",   "  Print & Promotional (%)",     Array(projYears).fill(0.10),   "percent")

  // ---- 5. Cost of Goods Sold ----
  writeFmbBlank()
  writeFmbSection("5. Cost of Goods Sold (Acct 7000–7030)")
  writeFmbNote("Total COGS = Revenue × COGS %. Sub-items as % of COGS total.")
  writeFmbRow("fmb_cogs_pct_rev", "COGS as % of Revenue",         assumptions.cogsPercent.slice(0, projYears), "percent")
  writeFmbRow("fmb_cogs_mat",     "  Raw Materials (% of COGS)",   Array(projYears).fill(0.50),   "percent")
  writeFmbRow("fmb_cogs_labor",   "  Direct Labor (% of COGS)",    Array(projYears).fill(0.30),   "percent")
  writeFmbRow("fmb_cogs_overhead","  Manufacturing Overhead (%)",   Array(projYears).fill(0.12),   "percent")
  writeFmbRow("fmb_cogs_shipping","  Shipping & Freight (%)",       Array(projYears).fill(0.08),   "percent")

  // ---- 6. Capital Expenditures ----
  writeFmbBlank()
  writeFmbSection("6. Capital Expenditures (Acct 8000–8020)")
  writeFmbNote("Total CapEx = Revenue × CapEx %. Sub-items as allocation of CapEx budget.")
  writeFmbRow("fmb_capex_pct_rev","CapEx as % of Revenue",         assumptions.capexPercent.slice(0, projYears), "percent")
  writeFmbRow("fmb_capex_it",     "  IT Hardware (% of CapEx)",    Array(projYears).fill(0.45),   "percent")
  writeFmbRow("fmb_capex_furn",   "  Furniture & Fixtures (%)",     Array(projYears).fill(0.20),   "percent")
  writeFmbRow("fmb_capex_lease",  "  Leasehold Improvements (%)",  Array(projYears).fill(0.25),   "percent")
  writeFmbRow("fmb_capex_vehicle","  Vehicles (%)",                 Array(projYears).fill(0.10),   "percent")

  // ---- 7. Professional Services ----
  writeFmbBlank()
  writeFmbSection("7. Professional Services (Acct 8100–8120)")
  writeFmbNote("Fixed monthly costs. Adjust per year for growth or one-time events (M&A, IPO audit).")
  writeFmbRow("fmb_prof_legal",   "Legal Fees ($/mo)",              Array(projYears).fill(8000),   "currency")
  writeFmbRow("fmb_prof_audit",   "Accounting & Audit ($/mo)",     Array(projYears).fill(5000),   "currency")
  writeFmbRow("fmb_prof_consult", "Consulting ($/mo)",              Array(projYears).fill(12000),  "currency")
  writeFmbRow("fmb_prof_contract","Contractors ($/mo)",             Array(projYears).fill(15000),  "currency")
  writeFmbRow("fmb_prof_other",   "Other Professional ($/mo)",     Array(projYears).fill(0),      "currency")

  // ---- 8. Technology & IT ----
  writeFmbBlank()
  writeFmbSection("8. Technology & IT (Acct 8200–8210)")
  writeFmbNote("Per-employee IT cost with sub-allocation. Cloud hosting scales with customers/usage.")
  writeFmbRow("fmb_it_cost_per",  "IT Cost per Employee ($/yr)",   Array(projYears).fill(8500),   "currency")
  writeFmbRow("fmb_it_saas_pct",  "  SaaS Licenses (% of IT)",    Array(projYears).fill(0.40),   "percent")
  writeFmbRow("fmb_it_cloud_pct", "  Cloud Hosting (% of IT)",     Array(projYears).fill(0.30),   "percent")
  writeFmbRow("fmb_it_telecom_pct","  Telecom (% of IT)",          Array(projYears).fill(0.10),   "percent")
  writeFmbRow("fmb_it_security",  "  Cybersecurity (% of IT)",     Array(projYears).fill(0.12),   "percent")
  writeFmbRow("fmb_it_support",   "  IT Support (% of IT)",        Array(projYears).fill(0.08),   "percent")

  // ---- 9. Research & Development ----
  writeFmbBlank()
  writeFmbSection("9. Research & Development (Acct 8300–8310)")
  writeFmbNote("Total R&D = Revenue × R&D %. Sub-allocation by function.")
  writeFmbRow("fmb_rd_pct_rev",   "R&D as % of Revenue",           assumptions.rdPercent.slice(0, projYears), "percent")
  writeFmbRow("fmb_rd_staff",     "  R&D Staff Costs (% of R&D)",  Array(projYears).fill(0.60),   "percent")
  writeFmbRow("fmb_rd_proto",     "  Prototyping (%)",              Array(projYears).fill(0.15),   "percent")
  writeFmbRow("fmb_rd_qa",        "  Testing & QA (%)",             Array(projYears).fill(0.10),   "percent")
  writeFmbRow("fmb_rd_patent",    "  Patent Filings (%)",           Array(projYears).fill(0.05),   "percent")
  writeFmbRow("fmb_rd_lab",       "  Lab Supplies (%)",             Array(projYears).fill(0.10),   "percent")

  // ---- 10. Debt Service ----
  writeFmbBlank()
  writeFmbSection("10. Debt Service (Acct 9000–9010)")
  writeFmbNote("Interest = Beginning Balance × Rate / 12. Principal = Straight-line over term.")
  writeFmbRow("fmb_debt_balance", "Outstanding Debt ($)",           Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_debt_rate",    "Annual Interest Rate",           Array(projYears).fill(0.065),  "percent")
  writeFmbRow("fmb_debt_term",    "Remaining Term (months)",        Array(projYears).fill(60),     "number")
  writeFmbNote("Principal = Outstanding Debt / Remaining Term. Interest declines as balance amortizes.")

  // ---- 11. Taxes & Regulatory ----
  writeFmbBlank()
  writeFmbSection("11. Taxes & Regulatory (Acct 9100+)")
  writeFmbNote("Mostly fixed costs. Adjust for jurisdiction changes or new compliance requirements.")
  writeFmbRow("fmb_tax_property", "Property Tax ($/mo)",            Array(projYears).fill(4500),   "currency")
  writeFmbRow("fmb_tax_sales",    "Sales & Use Tax ($/mo)",         Array(projYears).fill(3200),   "currency")
  writeFmbRow("fmb_tax_license",  "Licensing Fees ($/mo)",          Array(projYears).fill(1000),   "currency")
  writeFmbRow("fmb_tax_compliance","Compliance Costs ($/mo)",       Array(projYears).fill(2500),   "currency")
  writeFmbRow("fmb_tax_stat_rate","Income Tax Rate (statutory)",    assumptions.taxRate.slice(0, projYears), "percent")

  // ---- 12. Depreciation & Amortization ----
  writeFmbBlank()
  writeFmbSection("12. Depreciation & Amortization")
  writeFmbNote("D&A driven from CapEx base × depreciation rate. Intangible amortization added separately.")
  writeFmbRow("fmb_da_depr_rate", "Depreciation Rate (SL %/yr)",   Array(projYears).fill(0.20),   "percent")
  writeFmbRow("fmb_da_intang_mo", "Intangible Amortization ($/mo)",Array(projYears).fill(2000),   "currency")
  writeFmbNote("Depreciation = Cumulative CapEx Base × Rate / 12. 5-yr SL = 20%/yr.")

  // ---- Custom Expense Lines ----
  writeFmbBlank()
  writeFmbSection("Custom Expense Lines")
  writeFmbNote("Add your own expense categories below. Specify the driver type in column A.")
  writeFmbRow("fmb_custom_1",     "Custom Expense 1 ($)",           Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_custom_2",     "Custom Expense 2 ($)",           Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_custom_3",     "Custom Expense 3 ($)",           Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_custom_4",     "Custom Expense 4 ($)",           Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_custom_5",     "Custom Expense 5 ($)",           Array(projYears).fill(0), "currency")
  writeFmbNote("Tip: Insert additional rows as needed. Group by GL account code for audit trail.")

  // ---- Expense Summary (reference) ----
  writeFmbBlank()
  writeFmbSection("Cost Structure Summary (% of Revenue)")
  writeFmbNote("These are the high-level rates that feed the Basic Assumptions IS formulas:")
  writeFmbRow("fmb_cogs",  "COGS %",       assumptions.cogsPercent.slice(0, projYears),  "percent")
  writeFmbRow("fmb_rd",    "R&D %",        assumptions.rdPercent.slice(0, projYears),    "percent")
  writeFmbRow("fmb_sm",    "S&M %",        assumptions.smPercent.slice(0, projYears),    "percent")
  writeFmbRow("fmb_ga",    "G&A %",        assumptions.gaPercent.slice(0, projYears),    "percent")
  writeFmbRow("fmb_sbc",   "SBC %",        assumptions.sbcPercent.slice(0, projYears),   "percent")
  writeFmbRow("fmb_tax",   "Statutory Tax Rate", assumptions.taxRate.slice(0, projYears), "percent")
  writeFmbNote("Update these rates to match the detail build above. They flow to the IS formulas on the Basic Assumptions tab.")

  writeFmbBlank()

  // --- Section 3: Working Capital Drivers ---
  writeFmbSection("Working Capital Drivers")
  writeFmbRow("fmb_dso",      "DSO (days)",                        assumptions.dso.slice(0, projYears),                          "number")
  writeFmbRow("fmb_dpo",      "DPO (days)",                        assumptions.dpo.slice(0, projYears),                          "number")
  writeFmbRow("fmb_prepaid",  "Prepaid % of Revenue",              assumptions.prepaidPercent.slice(0, projYears),                "percent")
  writeFmbRow("fmb_accrued",  "Accrued Liab % of Revenue",         assumptions.accruedLiabPercent.slice(0, projYears),            "percent")
  writeFmbRow("fmb_defrevC",  "Deferred Rev Current % of Revenue", assumptions.deferredRevCurrentPercent.slice(0, projYears),     "percent")
  writeFmbRow("fmb_defrevNC", "Deferred Rev Non-Curr % of Revenue",assumptions.deferredRevNonCurrentPercent.slice(0, projYears),  "percent")

  writeFmbBlank()

  // --- Section 4: PP&E & Depreciation ---
  writeFmbSection("PP&E & Depreciation")
  writeFmbRow("fmb_capex",    "CapEx (% of Revenue)",        assumptions.capexPercent.slice(0, projYears),       "percent")
  writeFmbRow("fmb_capsw",    "Capitalized Software (% of Revenue)", assumptions.capSoftwarePercent.slice(0, projYears), "percent")
  writeFmbRow("fmb_da",       "D&A (% of Revenue proxy)",    assumptions.daPercent.slice(0, projYears),          "percent")
  writeFmbNote("Tip: For a full model, derive D&A from PP&E schedule useful lives rather than % of revenue.")
  writeFmbRow("fmb_useful",   "PP&E Useful Life (years)",    Array(projYears).fill(10),                          "number")
  writeFmbRow("fmb_sw_useful","Software Useful Life (years)", Array(projYears).fill(5),                          "number")

  writeFmbBlank()

  // --- Section 5: Debt Schedules ---
  writeFmbSection("Debt Schedule — Term Loans")
  writeFmbRow("fmb_tl_open",     "Term Loan Opening Balance",   Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_tl_rate",     "Interest Rate (annual)",      Array(projYears).fill(0.05), "percent")
  writeFmbRow("fmb_tl_amort",    "Mandatory Amortization",      assumptions.debtRepayments.slice(0, projYears), "currency")
  writeFmbRow("fmb_tl_prepay",   "Optional Prepayments",        Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_pik_rate",    "PIK Interest Rate",           Array(projYears).fill(0), "percent")
  writeFmbNote("Interest = Avg(Opening, Closing) × Rate. PIK accrues to principal and is added back in CFO.")

  writeFmbBlank()

  writeFmbSection("Debt Schedule — Revolver")
  writeFmbRow("fmb_rev_commit",  "Total Commitment",            Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_rev_rate",    "Drawn Rate (SOFR + spread)",  Array(projYears).fill(0.06), "percent")
  writeFmbRow("fmb_rev_fee",     "Undrawn Commitment Fee",      Array(projYears).fill(0.0025), "percent")
  writeFmbRow("fmb_rev_mincash", "Minimum Cash Balance",        Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_rev_locs",    "Letters of Credit Outstanding", Array(projYears).fill(0), "currency")
  writeFmbNote("Revolver draws/sweeps are solved iteratively: if Cash < MinCash → draw; if Cash > MinCash → sweep.")

  writeFmbBlank()

  writeFmbSection("New Debt & Equity Issuances ($)")
  writeFmbRow("fmb_new_debt",    "New Debt Issuance",           assumptions.newDebt.slice(0, projYears),          "currency")
  writeFmbRow("fmb_equity_iss",  "Equity Issuance",             assumptions.equityIssuance.slice(0, projYears),   "currency")

  writeFmbBlank()

  // --- Section 6: Tax & NOL ---
  writeFmbSection("Tax Schedule & NOL Tracking")
  writeFmbRow("fmb_stat_rate",   "Statutory Tax Rate",          assumptions.taxRate.slice(0, projYears), "percent")
  writeFmbRow("fmb_state_rate",  "State & Local Tax Rate",      Array(projYears).fill(0.05), "percent")
  writeFmbRow("fmb_eff_rate",    "Effective Tax Rate Override",  Array(projYears).fill(0),    "percent")
  writeFmbNote("If Effective Rate Override > 0, it is used instead of statutory + state calculation.")
  writeFmbBlank()
  writeFmbRow("fmb_nol_open",    "NOL Carryforward Opening",    Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_nol_limit",   "NOL Utilization Limit",       Array(projYears).fill(0.80), "percent")
  writeFmbNote("Post-TCJA NOLs limited to 80% of taxable income. Pre-2018 vintages may offset 100%.")
  writeFmbRow("fmb_sec382",      "Section 382 Annual Limit",    Array(projYears).fill(0), "currency")
  writeFmbNote("Section 382 limits annual NOL usage after >50% ownership change.")
  writeFmbBlank()
  writeFmbRow("fmb_dta_open",    "Deferred Tax Asset (Opening)", Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_dtl_open",    "Deferred Tax Liability (Opening)", Array(projYears).fill(0), "currency")
  writeFmbRow("fmb_va_pct",      "Valuation Allowance (% of DTA)", Array(projYears).fill(0), "percent")
  writeFmbNote("Record VA if more-likely-than-not that DTA will not be realized (cumulative 3-year loss = strong negative evidence).")

  writeFmbBlank()

  // --- Section 7: Equity & Share Count ---
  writeFmbSection("Equity & Share Count")
  writeFmbRow("fmb_shares_basic","Basic Shares Outstanding",     Array(projYears).fill(0), "number")
  writeFmbRow("fmb_buyback",     "Share Repurchase Budget",      assumptions.shareRepurchases.slice(0, projYears), "currency")
  writeFmbRow("fmb_div",         "Dividends Paid",               assumptions.dividendsPaid.slice(0, projYears),   "currency")
  writeFmbRow("fmb_avg_price",   "Avg Stock Price (for buyback calc)", Array(projYears).fill(0), "currency")
  writeFmbBlank()
  writeFmbSection("Stock Options (TSM)")
  writeFmbRow("fmb_opt_shares",  "Options Outstanding",          Array(projYears).fill(0), "number")
  writeFmbRow("fmb_opt_strike",  "Avg Exercise Price",           Array(projYears).fill(0), "currency")
  writeFmbNote("TSM dilution = Options × (Avg Price - Strike) / Avg Price, if in-the-money.")
  writeFmbBlank()
  writeFmbSection("RSUs & Convertibles")
  writeFmbRow("fmb_rsu_shares",  "Unvested RSU Shares",         Array(projYears).fill(0), "number")
  writeFmbRow("fmb_conv_shares", "Convertible Debt Shares",      Array(projYears).fill(0), "number")
  writeFmbRow("fmb_conv_int",    "Convertible Interest (saved)", Array(projYears).fill(0), "currency")
  writeFmbNote("If-Converted: add back interest (net of tax) to numerator and conversion shares to denominator, if dilutive.")

  writeFmbBlank()

  // --- Section 8: GAAP / IFRS Policy Flags ---
  writeFmbSection("Accounting Policy Flags")
  {
    const flagLabels: [string, string][] = [
      ["Accounting Standard", "US_GAAP"],
      ["Interest Paid Classification", "CFO"],
      ["Dividends Paid Classification", "CFF"],
      ["Lease Model", "ASC_842"],
      ["R&D Accounting", "EXPENSE_ALL"],
      ["Impairment Reversal", "NOT_ALLOWED"],
      ["SBC Forfeiture Method", "AS_OCCUR"],
      ["Inventory Method", "FIFO"],
    ]
    for (const [label, defaultVal] of flagLabels) {
      fmbRow.next()
      const row = fmbSheet.addRow([label, defaultVal])
      row.getCell(1).font = { size: 10, name: "Calibri" }
      row.getCell(2).font = { size: 10, name: "Calibri", bold: true }
      row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_ASSUMP_BG}` } }
      row.height = 15
    }
  }
  writeFmbNote("Change policy flags to toggle GAAP/IFRS treatment for CFS classification, leases, R&D, and impairment.")

  writeFmbBlank()

  // --- Section 9: Covenant Testing ---
  writeFmbSection("Financial Covenant Thresholds")
  writeFmbRow("fmb_max_lev",     "Max Leverage (Debt / EBITDA)", Array(projYears).fill(4.0), "number")
  writeFmbRow("fmb_min_icr",     "Min Interest Coverage (EBITDA / Interest)", Array(projYears).fill(2.0), "number")
  writeFmbRow("fmb_min_liq",     "Min Liquidity (Cash + Revolver Avail)", Array(projYears).fill(0), "currency")
  writeFmbNote("Covenants are tested each period. Breach triggers a WARNING diagnostic.")

  // Freeze pane
  fmbSheet.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }]

  // =========================================================================
  // REVENUE BUILD TABS — one per selected methodology (built BEFORE IS)
  // =========================================================================
  // Each tab tracks the Excel row number of its "Total Revenue" line.
  // The IS Total Revenue formula then SUMs across all rev tab totals.

  const selectedMethods = revenueMethods ?? ["growth_rate"]
  const inputs = methodInputs ?? {}

  // Will hold { tabName, totalRevRow } for each generated rev tab
  type RevTabRef = { tabName: string; totalRevRow: number }
  const revTabRefs: RevTabRef[] = []

  for (const methodId of selectedMethods) {
    const meta = REVENUE_METHOD_META[methodId]
    if (!meta) continue

    const tabName = `Rev — ${meta.shortLabel}`.slice(0, 31) // Excel 31-char limit
    const revSheet = workbook.addWorksheet(tabName, { properties: { tabColor: { argb: "FFDBEAFE" } } })

    revSheet.getColumn(1).width = 34
    for (let c = 2; c <= projYears + 1; c++) revSheet.getColumn(c).width = 16

    // Row 1: Header
    const hdr = revSheet.addRow([`Revenue Build — ${meta.label}`, ...projected.map((p) => p.label)])
    applyHeaderStyle(hdr)

    // Row 2: blank
    revSheet.addRow([])

    // Row 3: Assumptions section header
    const assumpHdr = revSheet.addRow(["Assumptions"])
    assumpHdr.getCell(1).font = { bold: true, size: 11, name: "Calibri", color: { argb: "FF1E293B" } }
    assumpHdr.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_SECTION_BG}` } }
    for (let c = 2; c <= projYears + 1; c++) {
      assumpHdr.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_SECTION_BG}` } }
    }

    // Track input row numbers for formula references
    const revInputRows: Record<string, number> = {}

    if (meta.inputs.length === 0 && methodId === "growth_rate") {
      // Per-stream: base revenue (seed) + growth rate rows
      for (const stream of assumptions.revenueStreams) {
        const lastHistStreamRev = historicals.length > 0
          ? (historicals[historicals.length - 1].revenueByStream[stream.name] ?? 0)
          : 0
        // Base Revenue row (yellow editable seed — blue font = input per Banker Bible B1)
        const baseRow = revSheet.addRow([
          `${stream.name} — Base Revenue`,
          ...Array(projYears).fill(lastHistStreamRev),
        ])
        revInputRows[`base_${stream.name}`] = revSheet.rowCount
        for (let c = 2; c <= projYears + 1; c++) {
          const cell = baseRow.getCell(c)
          applyCurrencyFormat(cell)
          cell.font = { size: 10, name: "Calibri", color: { argb: "FF0000CC" } }
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_ASSUMP_BG}` } }
        }
        baseRow.getCell(1).font = { size: 10, name: "Calibri" }
        // Growth Rate row
        const growthRow = revSheet.addRow([
          `${stream.name} — YoY Growth`,
          ...stream.growthRates.slice(0, projYears),
        ])
        revInputRows[`growth_${stream.name}`] = revSheet.rowCount
        for (let c = 2; c <= projYears + 1; c++) {
          const cell = growthRow.getCell(c)
          applyPercentFormat(cell)
          cell.font = { size: 10, name: "Calibri", color: { argb: "FF0000CC" } }
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_ASSUMP_BG}` } }
        }
        growthRow.getCell(1).font = { size: 10, name: "Calibri" }
      }
    } else {
      // Methodology-specific inputs (same value seeded across all years)
      for (const inp of meta.inputs) {
        const val = inputs[inp.key] ?? 0
        const row = revSheet.addRow([inp.label, ...Array(projYears).fill(val)])
        revInputRows[inp.key] = revSheet.rowCount
        for (let c = 2; c <= projYears + 1; c++) {
          const cell = row.getCell(c)
          if (inp.type === "currency") applyCurrencyFormat(cell)
          else if (inp.type === "percent") applyPercentFormat(cell)
          else cell.numFmt = "#,##0.0"
          cell.font = { size: 10, name: "Calibri", color: { argb: "FF0000CC" } }
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_ASSUMP_BG}` } }
        }
        row.getCell(1).font = { size: 10, name: "Calibri" }
      }
    }

    // Blank separator
    revSheet.addRow([])

    // Calculated Revenue section header
    const calcHdr = revSheet.addRow(["Calculated Revenue"])
    calcHdr.getCell(1).font = { bold: true, size: 11, name: "Calibri", color: { argb: "FF1E293B" } }
    calcHdr.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_SECTION_BG}` } }
    for (let c = 2; c <= projYears + 1; c++) {
      calcHdr.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_SECTION_BG}` } }
    }

    let totalRevRowOnSheet: number

    if (methodId === "growth_rate") {
      // Per-stream revenue rows — FORMULA: Year1 = Base*(1+Growth), Year2+ = Prior*(1+Growth)
      const streamStartRow = revSheet.rowCount + 1
      for (let s = 0; s < numStreams; s++) {
        const stream = assumptions.revenueStreams[s]
        const projStreamVals = projected.map((p) => p.revenueByStream[stream.name] ?? 0)
        const row = revSheet.addRow([stream.name, ...Array(projYears).fill(null)])
        const revStreamRow = revSheet.rowCount
        const baseRowNum = revInputRows[`base_${stream.name}`]
        const growthRowNum = revInputRows[`growth_${stream.name}`]
        for (let c = 2; c <= projYears + 1; c++) {
          const col = colLetter(c)
          const cell = row.getCell(c)
          if (c === 2) {
            // First projected year: Base Revenue × (1 + Growth Rate)
            cell.value = {
              formula: `${col}${baseRowNum}*(1+${col}${growthRowNum})`,
              result: projStreamVals[0],
            }
          } else {
            // Subsequent years: Prior Year Revenue × (1 + Growth Rate)
            const priorCol = colLetter(c - 1)
            cell.value = {
              formula: `${priorCol}${revStreamRow}*(1+${col}${growthRowNum})`,
              result: projStreamVals[c - 2] ?? 0,
            }
          }
          applyCurrencyFormat(cell)
          cell.font = { size: 10, name: "Calibri" }
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_PROJ_BG}` } }
        }
        row.getCell(1).font = { size: 10, name: "Calibri" }
      }
      // Total Revenue row — SUM of stream rows
      const totalRow = revSheet.addRow(["Total Revenue", ...Array(projYears).fill(null)])
      totalRevRowOnSheet = revSheet.rowCount
      for (let c = 2; c <= projYears + 1; c++) {
        const cell = totalRow.getCell(c)
        const col = colLetter(c)
        cell.value = {
          formula: `SUM(${col}${streamStartRow}:${col}${streamStartRow + numStreams - 1})`,
          result: projected[c - 2]?.totalRevenue ?? 0,
        }
        applyCurrencyFormat(cell)
        cell.font = { bold: true, size: 10, name: "Calibri" }
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_PROJ_BG}` } }
      }
      totalRow.getCell(1).font = { bold: true, size: 10, name: "Calibri" }
      applyTotalStyle(totalRow, 2)
    } else {
      // Other methodologies: formula note + LIVE FORMULA revenue output row
      const formulaNote = revSheet.addRow([getMethodFormulaNote(methodId)])
      formulaNote.getCell(1).font = { size: 9, italic: true, color: { argb: "FF64748B" }, name: "Calibri" }

      const revRow = revSheet.addRow(["Revenue from This Method", ...Array(projYears).fill(null)])
      totalRevRowOnSheet = revSheet.rowCount
      for (let c = 2; c <= projYears + 1; c++) {
        const col = colLetter(c)
        const cell = revRow.getCell(c)
        const formula = buildMethodRevenueFormula(methodId, revInputRows, col)
        cell.value = { formula, result: projected[c - 2]?.totalRevenue ?? 0 }
        applyCurrencyFormat(cell)
        cell.font = { bold: true, size: 10, name: "Calibri" }
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_PROJ_BG}` } }
      }
      revRow.getCell(1).font = { bold: true, size: 10, name: "Calibri" }
      applyTotalStyle(revRow, 2)
    }

    // YoY growth row — FORMULA
    revSheet.addRow([])
    const yoyGrowthRow = revSheet.addRow(["YoY Revenue Growth", ...Array(projYears).fill(null)])
    for (let c = 2; c <= projYears + 1; c++) {
      const col = colLetter(c)
      const cell = yoyGrowthRow.getCell(c)
      if (c === 2) {
        // First year: no prior on this tab
        cell.value = { formula: "0", result: projected[0]?.revenueGrowth ?? 0 }
      } else {
        const priorCol = colLetter(c - 1)
        cell.value = {
          formula: `IF(${priorCol}${totalRevRowOnSheet}=0,0,(${col}${totalRevRowOnSheet}-${priorCol}${totalRevRowOnSheet})/${priorCol}${totalRevRowOnSheet})`,
          result: projected[c - 2]?.revenueGrowth ?? 0,
        }
      }
      applyPercentFormat(cell)
      cell.font = { size: 10, name: "Calibri" }
    }
    yoyGrowthRow.getCell(1).font = { size: 10, name: "Calibri" }

    // Note
    revSheet.addRow([])
    const noteRow = revSheet.addRow(["This tab's Total Revenue feeds into the Income Statement IS Total Revenue row."])
    noteRow.getCell(1).font = { size: 9, italic: true, color: { argb: "FF64748B" }, name: "Calibri" }
    if (selectedMethods.length > 1) {
      const multiNote = revSheet.addRow([`${selectedMethods.length} revenue methods selected. IS Total Revenue = SUM across all Rev tabs.`])
      multiNote.getCell(1).font = { size: 9, italic: true, color: { argb: "FF2563EB" }, name: "Calibri" }
    }

    revSheet.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }]

    revTabRefs.push({ tabName, totalRevRow: totalRevRowOnSheet })
  }

  // =========================================================================
  // COST / EXPENSE TABS — one per active expense category (built BEFORE IS)
  // =========================================================================
  // Each tab tracks the Excel row number of its "Total" line.
  // IS expense formulas reference these totals.

  type CostTabRef = { tabName: string; totalRow: number; isMapping: string }
  const costTabRefs: CostTabRef[] = []

  const activeCostCategories = activeExpenses ?? []

  for (const expId of activeCostCategories) {
    const meta = EXPENSE_CATEGORY_META[expId]
    if (!meta) continue

    const tabName = `Cost — ${meta.shortLabel}`.slice(0, 31)
    const costSheet = workbook.addWorksheet(tabName, { properties: { tabColor: { argb: "FFFDE8C8" } } })

    costSheet.getColumn(1).width = 36
    for (let c = 2; c <= projYears + 1; c++) costSheet.getColumn(c).width = 16

    // Row 1: Header
    const costHdr = costSheet.addRow([`Expense Build — ${meta.label}`, ...projected.map((p) => p.label)])
    applyHeaderStyle(costHdr)

    // Row 2: blank
    costSheet.addRow([])

    // Assumptions section
    const costAssumpHdr = costSheet.addRow(["Assumptions"])
    costAssumpHdr.getCell(1).font = { bold: true, size: 11, name: "Calibri", color: { argb: "FF1E293B" } }
    costAssumpHdr.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_SECTION_BG}` } }
    for (let c = 2; c <= projYears + 1; c++) {
      costAssumpHdr.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_SECTION_BG}` } }
    }

    // Track assumption input rows by key (keyed by input key, value = sheet row number)
    const costInputRows: Record<string, number> = {}

    for (const inp of meta.inputs) {
      const val = inputs[inp.key] ?? inp.default
      const row = costSheet.addRow([inp.label, ...Array(projYears).fill(val)])
      costInputRows[inp.key] = costSheet.rowCount
      for (let c = 2; c <= projYears + 1; c++) {
        const cell = row.getCell(c)
        if (inp.type === "currency") applyCurrencyFormat(cell)
        else if (inp.type === "percent") applyPercentFormat(cell)
        else cell.numFmt = "#,##0.0"
        cell.font = { size: 10, name: "Calibri" }
        cell.alignment = { horizontal: "right", vertical: "middle" }
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_ASSUMP_BG}` } }
      }
      row.getCell(1).font = { size: 10, name: "Calibri" }
      row.height = 15
    }

    // Blank separator
    costSheet.addRow([])

    // Calculated Costs section
    const calcCostHdr = costSheet.addRow(["Calculated Costs"])
    calcCostHdr.getCell(1).font = { bold: true, size: 11, name: "Calibri", color: { argb: "FF1E293B" } }
    calcCostHdr.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_SECTION_BG}` } }
    for (let c = 2; c <= projYears + 1; c++) {
      calcCostHdr.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_SECTION_BG}` } }
    }

    // Sub-line items and the total row depend on the expense category
    // Revenue reference for % of rev drivers:
    // IS Total Revenue will be on the IS sheet — but we can pre-compute the IS revenue row
    // because the IS row layout is deterministic. We know:
    //   IS row 1 = header, row 2 = blank, row 3 = "Revenue" section header
    //   rows 4..3+numStreams = stream rows
    //   row 4+numStreams = Total Revenue (tagged "totalRevenue")
    // So the IS totalRevenue row = 4 + numStreams
    const isRevRowPrecomputed = 4 + numStreams

    const firstCalcRow = costSheet.rowCount + 1
    let lastCalcRow = firstCalcRow

    if (expId === "cogs") {
      // Raw Materials, Direct Labor, Overhead, Shipping — all as % of (Rev × COGS%)
      const pctKey  = "cogs_pct_rev"
      const pctRow  = costInputRows[pctKey]
      const subItems: [string, string][] = [
        ["Raw Materials",          "cogs_mat_pct"],
        ["Direct Labor",           "cogs_labor_pct"],
        ["Manufacturing Overhead", "cogs_oh_pct"],
        ["Shipping & Freight",     "cogs_ship_pct"],
      ]
      for (const [label, subKey] of subItems) {
        const subRow = costInputRows[subKey]
        if (subRow === undefined) continue
        const row = costSheet.addRow([label, ...Array(projYears).fill(null)])
        lastCalcRow = costSheet.rowCount
        for (let c = 2; c <= projYears + 1; c++) {
          const col = colLetter(c)
          // Total = Rev × COGS% × sub%
          const cell = row.getCell(c)
          cell.value = {
            formula: `'Income Statement'!${col}${isRevRowPrecomputed}*${col}${pctRow}*${col}${subRow}`,
            result: undefined,
          }
          applyCurrencyFormat(cell)
          cell.font = { size: 10, name: "Calibri" }
          cell.alignment = { horizontal: "right", vertical: "middle" }
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_PROJ_BG}` } }
        }
        row.getCell(1).font = { size: 10, name: "Calibri" }
        row.height = 15
      }
    } else if (expId === "marketing") {
      // Total = Rev × marketing%; show sub-allocations
      const pctKey = "mktg_pct_rev"
      const pctRow = costInputRows[pctKey]
      const subItems: [string, string][] = [
        ["Digital Ads",         "mktg_digital_pct"],
        ["Content Marketing",   "mktg_content_pct"],
        ["Events & Conferences","mktg_events_pct"],
        ["Agency Fees",         "mktg_agency_pct"],
        ["Print & Promotional", "mktg_print_pct"],
      ]
      for (const [label, subKey] of subItems) {
        const subRow = costInputRows[subKey]
        if (subRow === undefined) continue
        const row = costSheet.addRow([label, ...Array(projYears).fill(null)])
        lastCalcRow = costSheet.rowCount
        for (let c = 2; c <= projYears + 1; c++) {
          const col = colLetter(c)
          const cell = row.getCell(c)
          cell.value = {
            formula: `'Income Statement'!${col}${isRevRowPrecomputed}*${col}${pctRow}*${col}${subRow}`,
            result: undefined,
          }
          applyCurrencyFormat(cell)
          cell.font = { size: 10, name: "Calibri" }
          cell.alignment = { horizontal: "right", vertical: "middle" }
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_PROJ_BG}` } }
        }
        row.getCell(1).font = { size: 10, name: "Calibri" }
        row.height = 15
      }
    } else if (expId === "rd") {
      // Total = Rev × rd%; sub-allocations
      const pctKey = "rd_pct_rev"
      const pctRow = costInputRows[pctKey]
      const subItems: [string, string][] = [
        ["R&D Staff Costs",    "rd_staff_pct"],
        ["Prototyping",        "rd_proto_pct"],
        ["Testing & QA",       "rd_qa_pct"],
        ["Patent Filings",     "rd_patent_pct"],
        ["Lab Supplies",       "rd_lab_pct"],
      ]
      for (const [label, subKey] of subItems) {
        const subRow = costInputRows[subKey]
        if (subRow === undefined) continue
        const row = costSheet.addRow([label, ...Array(projYears).fill(null)])
        lastCalcRow = costSheet.rowCount
        for (let c = 2; c <= projYears + 1; c++) {
          const col = colLetter(c)
          const cell = row.getCell(c)
          cell.value = {
            formula: `'Income Statement'!${col}${isRevRowPrecomputed}*${col}${pctRow}*${col}${subRow}`,
            result: undefined,
          }
          applyCurrencyFormat(cell)
          cell.font = { size: 10, name: "Calibri" }
          cell.alignment = { horizontal: "right", vertical: "middle" }
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_PROJ_BG}` } }
        }
        row.getCell(1).font = { size: 10, name: "Calibri" }
        row.height = 15
      }
    } else if (expId === "payroll") {
      // Total = HC × Salary × (1 + bonus + health + 401k + taxes) + HC × SBC_per_emp
      const hcRow      = costInputRows["pay_hc"]
      const salRow     = costInputRows["pay_avg_salary"]
      const bonusRow   = costInputRows["pay_bonus_pct"]
      const healthRow  = costInputRows["pay_health_pct"]
      const k401Row    = costInputRows["pay_401k_pct"]
      const taxesRow   = costInputRows["pay_taxes_pct"]
      const sbcRow     = costInputRows["pay_sbc_per_emp"]
      const subItems: [string, string][] = [
        ["Base Salaries",     "basesal"],
        ["Bonus",             "bonus"],
        ["Health Insurance",  "health"],
        ["401k Contributions","k401"],
        ["Payroll Taxes",     "payrtax"],
        ["SBC",               "sbc"],
      ]
      const formulas: Record<string, (col: string) => string> = {
        basesal: (col) => `${col}${hcRow}*${col}${salRow}`,
        bonus:   (col) => `${col}${hcRow}*${col}${salRow}*${col}${bonusRow}`,
        health:  (col) => `${col}${hcRow}*${col}${salRow}*${col}${healthRow}`,
        k401:    (col) => `${col}${hcRow}*${col}${salRow}*${col}${k401Row}`,
        payrtax: (col) => `${col}${hcRow}*${col}${salRow}*${col}${taxesRow}`,
        sbc:     (col) => `${col}${hcRow}*${col}${sbcRow}`,
      }
      for (const [label, key] of subItems) {
        const row = costSheet.addRow([label, ...Array(projYears).fill(null)])
        lastCalcRow = costSheet.rowCount
        for (let c = 2; c <= projYears + 1; c++) {
          const col = colLetter(c)
          const cell = row.getCell(c)
          cell.value = { formula: formulas[key](col), result: undefined }
          applyCurrencyFormat(cell)
          cell.font = { size: 10, name: "Calibri" }
          cell.alignment = { horizontal: "right", vertical: "middle" }
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_PROJ_BG}` } }
        }
        row.getCell(1).font = { size: 10, name: "Calibri" }
        row.height = 15
      }
    } else if (expId === "capex") {
      // CapEx lines
      const pctRow = costInputRows["capex_pct_rev"]
      const subItems: [string, string][] = [
        ["IT Hardware",           "capex_it_pct"],
        ["Furniture & Fixtures",  "capex_furn_pct"],
        ["Leasehold Improvements","capex_lease_pct"],
        ["Vehicles",              "capex_veh_pct"],
      ]
      for (const [label, subKey] of subItems) {
        const subRow = costInputRows[subKey]
        if (subRow === undefined) continue
        const row = costSheet.addRow([label, ...Array(projYears).fill(null)])
        lastCalcRow = costSheet.rowCount
        for (let c = 2; c <= projYears + 1; c++) {
          const col = colLetter(c)
          const cell = row.getCell(c)
          cell.value = {
            formula: `'Income Statement'!${col}${isRevRowPrecomputed}*${col}${pctRow}*${col}${subRow}`,
            result: undefined,
          }
          applyCurrencyFormat(cell)
          cell.font = { size: 10, name: "Calibri" }
          cell.alignment = { horizontal: "right", vertical: "middle" }
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_PROJ_BG}` } }
        }
        row.getCell(1).font = { size: 10, name: "Calibri" }
        row.height = 15
      }
    } else if (expId === "debt") {
      // Interest = Balance × Rate; Principal = Balance / Term
      const balRow  = costInputRows["debt_balance"]
      const rateRow = costInputRows["debt_rate"]
      const termRow = costInputRows["debt_term_mo"]
      const subItems: [string, (col: string) => string][] = [
        ["Interest Expense", (col) => `${col}${balRow}*${col}${rateRow}`],
        ["Principal Payment",(col) => `IF(${col}${termRow}>0,${col}${balRow}/${col}${termRow}*12,0)`],
      ]
      for (const [label, fn] of subItems) {
        const row = costSheet.addRow([label, ...Array(projYears).fill(null)])
        lastCalcRow = costSheet.rowCount
        for (let c = 2; c <= projYears + 1; c++) {
          const col = colLetter(c)
          const cell = row.getCell(c)
          cell.value = { formula: fn(col), result: undefined }
          applyCurrencyFormat(cell)
          cell.font = { size: 10, name: "Calibri" }
          cell.alignment = { horizontal: "right", vertical: "middle" }
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_PROJ_BG}` } }
        }
        row.getCell(1).font = { size: 10, name: "Calibri" }
        row.height = 15
      }
    } else if (expId === "da") {
      // D&A = CapEx × depr rate + intang amort × 12
      const deprRow   = costInputRows["da_depr_rate"]
      const intangRow = costInputRows["da_intang_mo"]
      const subItems: [string, (col: string) => string][] = [
        ["Depreciation",           (col) => `'Income Statement'!${col}${isRevRowPrecomputed}*${col}${deprRow}`],
        ["Intangible Amortization",(col) => `${col}${intangRow}*12`],
      ]
      for (const [label, fn] of subItems) {
        const row = costSheet.addRow([label, ...Array(projYears).fill(null)])
        lastCalcRow = costSheet.rowCount
        for (let c = 2; c <= projYears + 1; c++) {
          const col = colLetter(c)
          const cell = row.getCell(c)
          cell.value = { formula: fn(col), result: undefined }
          applyCurrencyFormat(cell)
          cell.font = { size: 10, name: "Calibri" }
          cell.alignment = { horizontal: "right", vertical: "middle" }
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_PROJ_BG}` } }
        }
        row.getCell(1).font = { size: 10, name: "Calibri" }
        row.height = 15
      }
    } else {
      // Generic: show one "Total Cost" row driven by % of Rev (if pct input exists) or fixed $ inputs × 12
      // Find first percent-of-rev input or use first currency input × 12
      const pctInput = meta.inputs.find((inp) => inp.type === "percent")
      const curInput = meta.inputs.find((inp) => inp.type === "currency")
      const row = costSheet.addRow(["Total Cost", ...Array(projYears).fill(null)])
      lastCalcRow = costSheet.rowCount
      for (let c = 2; c <= projYears + 1; c++) {
        const col = colLetter(c)
        const cell = row.getCell(c)
        if (pctInput && costInputRows[pctInput.key]) {
          cell.value = {
            formula: `'Income Statement'!${col}${isRevRowPrecomputed}*${col}${costInputRows[pctInput.key]}`,
            result: undefined,
          }
        } else if (curInput && costInputRows[curInput.key]) {
          cell.value = {
            formula: `${col}${costInputRows[curInput.key]}*12`,
            result: undefined,
          }
        } else {
          cell.value = 0
        }
        applyCurrencyFormat(cell)
        cell.font = { size: 10, name: "Calibri" }
        cell.alignment = { horizontal: "right", vertical: "middle" }
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_PROJ_BG}` } }
      }
      row.getCell(1).font = { size: 10, name: "Calibri" }
      row.height = 15
    }

    // Total row — SUM of calculated sub-items
    const totalRow = costSheet.addRow(["Total", ...Array(projYears).fill(null)])
    const totalRowOnSheet = costSheet.rowCount
    for (let c = 2; c <= projYears + 1; c++) {
      const col = colLetter(c)
      const cell = totalRow.getCell(c)
      cell.value = { formula: `SUM(${col}${firstCalcRow}:${col}${lastCalcRow})`, result: undefined }
      applyCurrencyFormat(cell)
      cell.font = { bold: true, size: 10, name: "Calibri" }
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_TOTAL_BG}` } }
      cell.alignment = { horizontal: "right", vertical: "middle" }
    }
    totalRow.getCell(1).font = { bold: true, size: 10, name: "Calibri" }
    applyTotalStyle(totalRow, 2)

    // % of Revenue note row
    const pctRevRow = costSheet.addRow(["% of Revenue", ...Array(projYears).fill(null)])
    for (let c = 2; c <= projYears + 1; c++) {
      const col = colLetter(c)
      const cell = pctRevRow.getCell(c)
      cell.value = {
        formula: `IF('Income Statement'!${col}${isRevRowPrecomputed}=0,0,${col}${totalRowOnSheet}/'Income Statement'!${col}${isRevRowPrecomputed})`,
        result: undefined,
      }
      applyPercentFormat(cell)
      cell.font = { size: 10, name: "Calibri" }
      cell.alignment = { horizontal: "right", vertical: "middle" }
    }
    pctRevRow.getCell(1).font = { size: 9, italic: true, color: { argb: "FF64748B" }, name: "Calibri" }

    costSheet.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }]

    costTabRefs.push({ tabName, totalRow: totalRowOnSheet, isMapping: meta.isMapping })
  }

  // Helper: build IS formula for an expense line.
  // If there are cost tab refs with the matching IS mapping, SUM them; else fall back to % of Rev.
  const buildExpenseFormula = (
    isMapKey: string,
    fallbackFn: (col: string, aCol: string) => string,
  ): ((i: number, col: string, aCol: string) => string) => {
    const matchingTabs = costTabRefs.filter((r) => r.isMapping === isMapKey)
    if (matchingTabs.length === 0) {
      return (_i, col, aCol) => fallbackFn(col, aCol)
    }
    return (_i, col) => {
      const refs = matchingTabs.map((r) => `'${r.tabName}'!${col}${r.totalRow}`)
      return refs.length === 1 ? refs[0] : `SUM(${refs.join(",")})`
    }
  }

  // =========================================================================
  // SHEET 2: Income Statement
  // =========================================================================

  const isRows = new RowTracker(1) // row 1 = header

  const isSheet = workbook.addWorksheet("Income Statement", { properties: { tabColor: { argb: "FFC6EFCE" } } })
  setupSheet(isSheet, allLabels, histCount)

  // Helper: add one row, historical values hard-coded, projected cells get formulas
  // formulaFn(colIdx 0-based, colLetter, assumpColLetter) => formula string
  const writeISRow = (
    key: string | null,
    label: string,
    histVals: (number | null)[],
    projVals_: (number | null)[],
    fmt: "currency" | "percent",
    formulaFn: ((i: number, col: string, aCol: string) => string) | null,
    opts: { bold?: boolean; indent?: number } = {}
  ): number => {
    if (key) isRows.next(key); else isRows.next()

    const cells: (number | { formula: string; result: number | null } | null)[] = [
      ...histVals,
      ...projVals_.map((pv, i) => {
        if (formulaFn) {
          const col = projColLetter(i)
          const aCol = assumpColForYear(i)
          return { formula: formulaFn(i, col, aCol), result: pv }
        }
        return pv
      }),
    ]

    const row = isSheet.addRow([label, ...cells])
    labelCell(row, label, opts.indent ?? 0)

    for (let c = 2; c <= totalCols + 1; c++) {
      const cell = row.getCell(c)
      if (fmt === "currency") applyCurrencyFormat(cell)
      else applyPercentFormat(cell)
      cell.font = { bold: !!opts.bold, size: 10, name: "Calibri" }
      cell.alignment = { horizontal: "right", vertical: "middle" }
    }
    paintDataRow(row, 2, totalCols + 1, histCount, !!opts.bold)
    row.height = 15
    if (opts.bold) applyTotalStyle(row, 2)
    return isRows.row
  }

  // Row 2: blank
  isRows.next()
  writeBlankRow(isSheet)

  // Row 3: Section header "Revenue"
  isRows.next()
  writeSectionHeader(isSheet, "Revenue", totalCols)

  // Rows 4..3+N: Revenue streams
  const isStreamRows: number[] = []
  for (let s = 0; s < numStreams; s++) {
    const stream = assumptions.revenueStreams[s]
    isRows.next(`stream_${s}`)
    isStreamRows.push(isRows.row)

    const histStreamVals = historicals.map((h) => h.revenueByStream[stream.name] ?? null)
    const projStreamVals = projected.map((p)  => p.revenueByStream[stream.name]  ?? null)

    const cells: (number | { formula: string; result: number | null } | null)[] = [
      ...histStreamVals,
      ...projStreamVals.map((pv, i) => {
        const col = projColLetter(i)
        const aCol = assumpColForYear(i)
        // Prior column: if i==0, prior is last historical col; else prior proj col
        const priorCol = i === 0 ? colLetter(1 + histCount) : projColLetter(i - 1)
        const growthRow = streamGrowthRows[s]
        return {
          formula: `${priorCol}${isRows.row}*(1+'Basic Assumptions'!${aCol}${growthRow})`,
          result: pv,
        }
      }),
    ]

    const row = isSheet.addRow([stream.name, ...cells])
    labelCell(row, stream.name, 1)
    for (let c = 2; c <= totalCols + 1; c++) {
      const cell = row.getCell(c)
      applyCurrencyFormat(cell)
      cell.font = { size: 10, name: "Calibri" }
      cell.alignment = { horizontal: "right", vertical: "middle" }
    }
    paintDataRow(row, 2, totalCols + 1, histCount, false)
    row.height = 15
  }

  // Total Revenue row
  // If revenue tabs are present, SUM their total rows; otherwise SUM the IS stream rows.
  {
    const streamFirst = isStreamRows[0]
    const streamLast  = isStreamRows[isStreamRows.length - 1]
    const revFormula = revTabRefs.length > 0
      ? (_i: number, col: string) => {
          const refs = revTabRefs.map((r) => `'${r.tabName}'!${col}${r.totalRevRow}`)
          return refs.length === 1 ? refs[0] : `SUM(${refs.join(",")})`
        }
      : (_i: number, col: string) => `SUM(${col}${streamFirst}:${col}${streamLast})`
    writeISRow(
      "totalRevenue",
      "Total Revenue",
      historicals.map((h) => h.revenue),
      projected.map((p) => p.totalRevenue),
      "currency",
      revFormula,
      { bold: true }
    )
  }

  // Revenue Growth %
  {
    const revRow = isRows.get("totalRevenue")
    writeISRow(
      "revenueGrowth",
      "Revenue Growth %",
      historicals.map(() => null),
      projected.map((p) => p.revenueGrowth),
      "percent",
      (i, col) => {
        const priorCol = i === 0 ? colLetter(1 + histCount) : projColLetter(i - 1)
        return `(${col}${revRow}-${priorCol}${revRow})/${priorCol}${revRow}`
      },
      { indent: 1 }
    )
  }

  isRows.next(); writeBlankRow(isSheet)

  // COGS
  {
    const revRow = isRows.get("totalRevenue")
    writeISRow(
      "cogs",
      "COGS",
      historicals.map((h) => h.cogs),
      projected.map((p) => p.cogs),
      "currency",
      buildExpenseFormula(
        "cogs",
        (col, aCol) => `${col}${revRow}*'Basic Assumptions'!${aCol}${assumpRows.get("cogs")}`,
      ),
      { indent: 1 }
    )
    writeISRow(
      "cogsPercent",
      "COGS %",
      historicals.map(() => null),
      projected.map((p) => p.cogsPercent),
      "percent",
      (_i, col, _aCol) => `${col}${isRows.get("cogs")}/${col}${revRow}`,
      { indent: 1 }
    )
  }

  // Gross Profit
  {
    const revRow  = isRows.get("totalRevenue")
    const cogsRow = isRows.get("cogs")
    writeISRow(
      "grossProfit",
      "Gross Profit",
      historicals.map((h) => h.grossProfit),
      projected.map((p) => p.grossProfit),
      "currency",
      (_i, col) => `${col}${revRow}-${col}${cogsRow}`,
      { bold: true }
    )
    writeISRow(
      "grossMargin",
      "Gross Margin %",
      historicals.map(() => null),
      projected.map((p) => p.grossMargin),
      "percent",
      (_i, col) => `${col}${isRows.get("grossProfit")}/${col}${revRow}`,
      { indent: 1 }
    )
  }

  isRows.next(); writeBlankRow(isSheet)
  isRows.next(); writeSectionHeader(isSheet, "Operating Expenses", totalCols)

  // R&D, S&M, G&A
  {
    const revRow = isRows.get("totalRevenue")
    writeISRow(
      "rd",
      "R&D",
      historicals.map((h) => h.rdExpense),
      projected.map((p) => p.rdExpense),
      "currency",
      buildExpenseFormula(
        "rd",
        (col, aCol) => `${col}${revRow}*'Basic Assumptions'!${aCol}${assumpRows.get("rd")}`,
      ),
      { indent: 1 }
    )
    writeISRow(
      "sm",
      "S&M",
      historicals.map((h) => h.smExpense),
      projected.map((p) => p.smExpense),
      "currency",
      buildExpenseFormula(
        "sm",
        (col, aCol) => `${col}${revRow}*'Basic Assumptions'!${aCol}${assumpRows.get("sm")}`,
      ),
      { indent: 1 }
    )
    writeISRow(
      "ga",
      "G&A",
      historicals.map((h) => h.gaExpense),
      projected.map((p) => p.gaExpense),
      "currency",
      buildExpenseFormula(
        "ga",
        (col, aCol) => `${col}${revRow}*'Basic Assumptions'!${aCol}${assumpRows.get("ga")}`,
      ),
      { indent: 1 }
    )
  }

  // Total OpEx
  {
    const rdRow = isRows.get("rd")
    const gaRow = isRows.get("ga")
    writeISRow(
      "totalOpex",
      "Total OpEx",
      historicals.map((h) => h.totalOpex),
      projected.map((p) => p.totalOpex),
      "currency",
      (_i, col) => `SUM(${col}${rdRow}:${col}${gaRow})`,
      { bold: true }
    )
  }

  isRows.next(); writeBlankRow(isSheet)

  // SBC, D&A
  {
    const revRow = isRows.get("totalRevenue")
    writeISRow(
      "sbc",
      "SBC",
      historicals.map(() => null),
      projected.map((p) => p.sbc),
      "currency",
      (_i, col, aCol) => `${col}${revRow}*'Basic Assumptions'!${aCol}${assumpRows.get("sbc")}`,
      { indent: 1 }
    )
    writeISRow(
      "da",
      "D&A",
      historicals.map(() => null),
      projected.map((p) => p.da),
      "currency",
      buildExpenseFormula(
        "da",
        (col, aCol) => `${col}${revRow}*'Basic Assumptions'!${aCol}${assumpRows.get("da")}`,
      ),
      { indent: 1 }
    )
  }

  // EBITDA = TotalRevenue - COGS - TotalOpEx
  {
    const revRow   = isRows.get("totalRevenue")
    const cogsRow  = isRows.get("cogs")
    const opexRow  = isRows.get("totalOpex")
    writeISRow(
      "ebitda",
      "EBITDA",
      historicals.map((h) => h.ebitda),
      projected.map((p) => p.ebitda),
      "currency",
      (_i, col) => `${col}${revRow}-${col}${cogsRow}-${col}${opexRow}`,
      { bold: true }
    )
    writeISRow(
      "ebitdaMargin",
      "EBITDA Margin %",
      historicals.map(() => null),
      projected.map((p) => p.ebitdaMargin),
      "percent",
      (_i, col) => `${col}${isRows.get("ebitda")}/${col}${revRow}`,
      { indent: 1 }
    )
  }

  // Operating Income = EBITDA - SBC - D&A
  {
    const ebitdaRow = isRows.get("ebitda")
    const sbcRow    = isRows.get("sbc")
    const daRow     = isRows.get("da")
    const revRow    = isRows.get("totalRevenue")
    writeISRow(
      "operatingIncome",
      "Operating Income",
      historicals.map((h) => h.operatingIncome),
      projected.map((p) => p.operatingIncome),
      "currency",
      (_i, col) => `${col}${ebitdaRow}-${col}${sbcRow}-${col}${daRow}`,
      { bold: true }
    )
    writeISRow(
      "operatingMargin",
      "Operating Margin %",
      historicals.map(() => null),
      projected.map((p) => p.operatingMargin),
      "percent",
      (_i, col) => `${col}${isRows.get("operatingIncome")}/${col}${revRow}`,
      { indent: 1 }
    )
  }

  isRows.next(); writeBlankRow(isSheet)

  // Interest Income / Expense
  {
    writeISRow(
      "intInc",
      "Interest Income",
      historicals.map(() => null),
      projected.map((p) => p.interestIncome),
      "currency",
      (_i, _col, aCol) => `'Basic Assumptions'!${aCol}${assumpRows.get("intInc")}`,
      { indent: 1 }
    )
    writeISRow(
      "intExp",
      "Interest Expense",
      historicals.map(() => null),
      projected.map((p) => p.interestExpense),
      "currency",
      buildExpenseFormula(
        "intExp",
        (_col, aCol) => `'Basic Assumptions'!${aCol}${assumpRows.get("intExp")}`,
      ),
      { indent: 1 }
    )
  }

  // Pre-Tax Income = OI + IntInc - IntExp
  {
    const oiRow  = isRows.get("operatingIncome")
    const iiRow  = isRows.get("intInc")
    const ieRow  = isRows.get("intExp")
    writeISRow(
      "preTaxIncome",
      "Pre-Tax Income",
      historicals.map(() => null),
      projected.map((p) => p.preTaxIncome),
      "currency",
      (_i, col) => `${col}${oiRow}+${col}${iiRow}-${col}${ieRow}`,
      { bold: true }
    )
  }

  // Income Tax = MAX(0, EBT * taxRate)
  {
    const ebtRow = isRows.get("preTaxIncome")
    const revRow = isRows.get("totalRevenue")
    writeISRow(
      "incomeTax",
      "Income Tax",
      historicals.map(() => null),
      projected.map((p) => p.incomeTax),
      "currency",
      (_i, col, aCol) => `MAX(0,${col}${ebtRow}*'Basic Assumptions'!${aCol}${assumpRows.get("tax")})`,
      { indent: 1 }
    )

    // Net Income = EBT - Tax
    const taxRow = isRows.get("incomeTax")
    writeISRow(
      "netIncome",
      "Net Income",
      historicals.map((h) => h.netIncome),
      projected.map((p) => p.netIncome),
      "currency",
      (_i, col) => `${col}${ebtRow}-${col}${taxRow}`,
      { bold: true }
    )
    writeISRow(
      "netMargin",
      "Net Margin %",
      historicals.map(() => null),
      projected.map((p) => p.netMargin),
      "percent",
      (_i, col) => `${col}${isRows.get("netIncome")}/${col}${revRow}`,
      { indent: 1 }
    )
  }

  // =========================================================================
  // SHEET 3: Balance Sheet
  // =========================================================================

  const bsRows = new RowTracker(1)

  const bsSheet = workbook.addWorksheet("Balance Sheet", { properties: { tabColor: { argb: "FFBFDBFE" } } })
  setupSheet(bsSheet, allLabels, histCount)

  // Helper: write one BS row
  // formulaFn receives (i 0-based, projColLetter, assumpColLetter, priorColLetter)
  const writeBSRow = (
    key: string | null,
    label: string,
    projVals_: (number | null)[],
    fmt: "currency" | "percent",
    formulaFn: ((i: number, col: string, aCol: string, priorCol: string) => string) | null,
    opts: { bold?: boolean; indent?: number } = {}
  ): number => {
    if (key) bsRows.next(key); else bsRows.next()

    const cells: (number | { formula: string; result: number | null } | null)[] = [
      ...historicals.map(() => null as null),
      ...projVals_.map((pv, i) => {
        if (formulaFn) {
          const col      = projColLetter(i)
          const aCol     = assumpColForYear(i)
          const priorCol = i === 0 ? colLetter(1 + histCount) : projColLetter(i - 1)
          return { formula: formulaFn(i, col, aCol, priorCol), result: pv }
        }
        return pv
      }),
    ]

    const row = bsSheet.addRow([label, ...cells])
    labelCell(row, label, opts.indent ?? 0)
    for (let c = 2; c <= totalCols + 1; c++) {
      const cell = row.getCell(c)
      if (fmt === "currency") applyCurrencyFormat(cell)
      else applyPercentFormat(cell)
      cell.font = { bold: !!opts.bold, size: 10, name: "Calibri" }
      cell.alignment = { horizontal: "right", vertical: "middle" }
    }
    paintDataRow(row, 2, totalCols + 1, histCount, !!opts.bold)
    row.height = 15
    if (opts.bold) applyTotalStyle(row, 2)
    return bsRows.row
  }

  bsRows.next(); writeBlankRow(bsSheet)
  bsRows.next(); writeSectionHeader(bsSheet, "Current Assets", totalCols)

  // Cash — plug from CFS (forward reference; we store the row number now and use it when building CFS)
  // The formula references 'Cash Flow'!{endingCashRow}{col} — we'll assign endingCashRow after building CFS.
  // To handle the forward reference we store a sentinel and patch cells after CFS is built.
  // We track the Cash row number on the BS sheet.
  writeBSRow(
    "cash",
    "Cash & Equivalents",
    projected.map((p) => p.cash),
    "currency",
    null, // formulas patched after CFS is built
    { indent: 1 }
  )

  writeBSRow(
    "sti",
    "ST Investments",
    projected.map((p) => p.shortTermInvestments),
    "currency",
    (_i, _col, _aCol, priorCol) => `${priorCol}${bsRows.get("sti")}`,
    { indent: 1 }
  )

  // AR = Revenue * DSO / 365
  {
    const revRow = isRows.get("totalRevenue")
    writeBSRow(
      "ar",
      "Accounts Receivable",
      projected.map((p) => p.accountsReceivable),
      "currency",
      (_i, col, aCol) =>
        `'Income Statement'!${col}${revRow}*'Basic Assumptions'!${aCol}${assumpRows.get("dso")}/365`,
      { indent: 1 }
    )
  }

  // Prepaid = Revenue * prepaidPct
  {
    const revRow = isRows.get("totalRevenue")
    writeBSRow(
      "prepaid",
      "Prepaid Expenses",
      projected.map((p) => p.prepaidExpenses),
      "currency",
      (_i, col, aCol) =>
        `'Income Statement'!${col}${revRow}*'Basic Assumptions'!${aCol}${assumpRows.get("prepaid")}`,
      { indent: 1 }
    )
  }

  // Total Current Assets = SUM(cash:prepaid)
  {
    const cashRow    = bsRows.get("cash")
    const prepaidRow = bsRows.get("prepaid")
    writeBSRow(
      "tca",
      "Total Current Assets",
      projected.map((p) => p.totalCurrentAssets),
      "currency",
      (_i, col) => `SUM(${col}${cashRow}:${col}${prepaidRow})`,
      { bold: true }
    )
  }

  bsRows.next(); writeBlankRow(bsSheet)
  bsRows.next(); writeSectionHeader(bsSheet, "Non-Current Assets", totalCols)

  // Net PP&E = prior + Rev*capexPct - DA*0.4
  {
    const revRow = isRows.get("totalRevenue")
    const daRow  = isRows.get("da")
    writeBSRow(
      "ppe",
      "PP&E, Net",
      projected.map((p) => p.ppeNet),
      "currency",
      (_i, col, aCol, priorCol) =>
        `MAX(0,${priorCol}${bsRows.get("ppe")}+'Income Statement'!${col}${revRow}*'Basic Assumptions'!${aCol}${assumpRows.get("capex")}-'Income Statement'!${col}${daRow}*'Basic Assumptions'!${aCol}${assumpRows.get("daSplitPPE")})`,
      { indent: 1 }
    )
  }

  writeBSRow(
    "goodwill",
    "Goodwill",
    projected.map((p) => p.goodwill),
    "currency",
    (_i, _col, _aCol, priorCol) => `${priorCol}${bsRows.get("goodwill")}`,
    { indent: 1 }
  )

  writeBSRow(
    "intangibles",
    "Intangibles",
    projected.map((p) => p.intangibles),
    "currency",
    (_i, _col, _aCol, priorCol) => `${priorCol}${bsRows.get("intangibles")}`,
    { indent: 1 }
  )

  // Cap Software = prior + Rev*capSWPct - DA*0.6
  {
    const revRow = isRows.get("totalRevenue")
    const daRow  = isRows.get("da")
    writeBSRow(
      "capsw",
      "Capitalized Software, Net",
      projected.map((p) => p.capSoftwareNet),
      "currency",
      (_i, col, aCol, priorCol) =>
        `MAX(0,${priorCol}${bsRows.get("capsw")}+'Income Statement'!${col}${revRow}*'Basic Assumptions'!${aCol}${assumpRows.get("capsw")}-'Income Statement'!${col}${daRow}*(1-'Basic Assumptions'!${aCol}${assumpRows.get("daSplitPPE")}))`,
      { indent: 1 }
    )
  }

  writeBSRow(
    "onca",
    "Other Non-Current Assets",
    projected.map((p) => p.otherNonCurrentAssets),
    "currency",
    (_i, _col, _aCol, priorCol) => `${priorCol}${bsRows.get("onca")}`,
    { indent: 1 }
  )

  // Total NCA
  {
    const ppeRow  = bsRows.get("ppe")
    const oncaRow = bsRows.get("onca")
    writeBSRow(
      "tnca",
      "Total Non-Current Assets",
      projected.map((p) => p.totalNonCurrentAssets),
      "currency",
      (_i, col) => `SUM(${col}${ppeRow}:${col}${oncaRow})`,
      { bold: true }
    )
  }

  bsRows.next(); writeBlankRow(bsSheet)

  // Total Assets
  {
    const tcaRow  = bsRows.get("tca")
    const tncaRow = bsRows.get("tnca")
    writeBSRow(
      "totalAssets",
      "Total Assets",
      projected.map((p) => p.totalAssets),
      "currency",
      (_i, col) => `${col}${tcaRow}+${col}${tncaRow}`,
      { bold: true }
    )
    applyDoubleUnderline(bsSheet.lastRow!, 2, totalCols + 1)
  }

  bsRows.next(); writeBlankRow(bsSheet)
  bsRows.next(); writeSectionHeader(bsSheet, "Current Liabilities", totalCols)

  // AP = COGS * DPO / 365
  {
    const cogsRow = isRows.get("cogs")
    writeBSRow(
      "ap",
      "Accounts Payable",
      projected.map((p) => p.accountsPayable),
      "currency",
      (_i, col, aCol) =>
        `'Income Statement'!${col}${cogsRow}*'Basic Assumptions'!${aCol}${assumpRows.get("dpo")}/365`,
      { indent: 1 }
    )
  }

  // Accrued Liabilities = Rev * accruedPct
  {
    const revRow = isRows.get("totalRevenue")
    writeBSRow(
      "accrued",
      "Accrued Liabilities",
      projected.map((p) => p.accruedLiabilities),
      "currency",
      (_i, col, aCol) =>
        `'Income Statement'!${col}${revRow}*'Basic Assumptions'!${aCol}${assumpRows.get("accrued")}`,
      { indent: 1 }
    )
  }

  // Deferred Revenue Current = Rev * defrevC
  {
    const revRow = isRows.get("totalRevenue")
    writeBSRow(
      "defrevC",
      "Deferred Revenue (Current)",
      projected.map((p) => p.deferredRevenueCurrent),
      "currency",
      (_i, col, aCol) =>
        `'Income Statement'!${col}${revRow}*'Basic Assumptions'!${aCol}${assumpRows.get("defrevC")}`,
      { indent: 1 }
    )
  }

  writeBSRow(
    "currentDebt",
    "Current Debt",
    projected.map((p) => p.currentDebt),
    "currency",
    (_i, _col, _aCol, priorCol) => `${priorCol}${bsRows.get("currentDebt")}`,
    { indent: 1 }
  )

  writeBSRow(
    "ocl",
    "Other Current Liabilities",
    projected.map((p) => p.otherCurrentLiabilities),
    "currency",
    (_i, _col, _aCol, priorCol) => `${priorCol}${bsRows.get("ocl")}`,
    { indent: 1 }
  )

  // Total Current Liabilities
  {
    const apRow  = bsRows.get("ap")
    const oclRow = bsRows.get("ocl")
    writeBSRow(
      "tcl",
      "Total Current Liabilities",
      projected.map((p) => p.totalCurrentLiabilities),
      "currency",
      (_i, col) => `SUM(${col}${apRow}:${col}${oclRow})`,
      { bold: true }
    )
  }

  bsRows.next(); writeBlankRow(bsSheet)
  bsRows.next(); writeSectionHeader(bsSheet, "Non-Current Liabilities", totalCols)

  // Long-Term Debt = prior + newDebt - debtRepay
  writeBSRow(
    "ltd",
    "Long-Term Debt",
    projected.map((p) => p.longTermDebt),
    "currency",
    (_i, _col, aCol, priorCol) =>
      `MAX(0,${priorCol}${bsRows.get("ltd")}+'Basic Assumptions'!${aCol}${assumpRows.get("newDebt")}-'Basic Assumptions'!${aCol}${assumpRows.get("debtRepay")})`,
    { indent: 1 }
  )

  // Deferred Revenue NC = Rev * defrevNC
  {
    const revRow = isRows.get("totalRevenue")
    writeBSRow(
      "defrevNC",
      "Deferred Revenue (Non-Current)",
      projected.map((p) => p.deferredRevenueNonCurrent),
      "currency",
      (_i, col, aCol) =>
        `'Income Statement'!${col}${revRow}*'Basic Assumptions'!${aCol}${assumpRows.get("defrevNC")}`,
      { indent: 1 }
    )
  }

  writeBSRow(
    "oncl",
    "Other Non-Current Liabilities",
    projected.map((p) => p.otherNonCurrentLiabilities),
    "currency",
    (_i, _col, _aCol, priorCol) => `${priorCol}${bsRows.get("oncl")}`,
    { indent: 1 }
  )

  // Total NCL
  {
    const ltdRow  = bsRows.get("ltd")
    const onclRow = bsRows.get("oncl")
    writeBSRow(
      "tncl",
      "Total Non-Current Liabilities",
      projected.map((p) => p.totalNonCurrentLiabilities),
      "currency",
      (_i, col) => `SUM(${col}${ltdRow}:${col}${onclRow})`,
      { bold: true }
    )
  }

  bsRows.next(); writeBlankRow(bsSheet)

  // Total Liabilities
  {
    const tclRow  = bsRows.get("tcl")
    const tnclRow = bsRows.get("tncl")
    writeBSRow(
      "totalLiabilities",
      "Total Liabilities",
      projected.map((p) => p.totalLiabilities),
      "currency",
      (_i, col) => `${col}${tclRow}+${col}${tnclRow}`,
      { bold: true }
    )
  }

  bsRows.next(); writeBlankRow(bsSheet)
  bsRows.next(); writeSectionHeader(bsSheet, "Equity", totalCols)

  // Common Stock = prior (carry forward)
  writeBSRow(
    "cs",
    "Common Stock",
    projected.map((p) => p.commonStock),
    "currency",
    (_i, _col, _aCol, priorCol) => `${priorCol}${bsRows.get("cs")}`,
    { indent: 1 }
  )

  // APIC = prior + SBC + equityIssuance
  {
    const sbcRow = isRows.get("sbc")
    writeBSRow(
      "apic",
      "APIC",
      projected.map((p) => p.apic),
      "currency",
      (_i, col, aCol, priorCol) =>
        `${priorCol}${bsRows.get("apic")}+'Income Statement'!${col}${sbcRow}+'Basic Assumptions'!${aCol}${assumpRows.get("equityIss")}`,
      { indent: 1 }
    )
  }

  // Retained Earnings = prior + NI - dividends
  {
    const niRow = isRows.get("netIncome")
    writeBSRow(
      "re",
      "Retained Earnings",
      projected.map((p) => p.retainedEarnings),
      "currency",
      (_i, col, aCol, priorCol) =>
        `${priorCol}${bsRows.get("re")}+'Income Statement'!${col}${niRow}-'Basic Assumptions'!${aCol}${assumpRows.get("divs")}`,
      { indent: 1 }
    )
  }

  // Treasury Stock = prior - shareRepurchases
  writeBSRow(
    "ts",
    "Treasury Stock",
    projected.map((p) => p.treasuryStock),
    "currency",
    (_i, _col, aCol, priorCol) =>
      `${priorCol}${bsRows.get("ts")}-'Basic Assumptions'!${aCol}${assumpRows.get("buybacks")}`,
    { indent: 1 }
  )

  // Total Equity
  {
    const csRow = bsRows.get("cs")
    const tsRow = bsRows.get("ts")
    writeBSRow(
      "totalEquity",
      "Total Equity",
      projected.map((p) => p.totalEquity),
      "currency",
      (_i, col) => `SUM(${col}${csRow}:${col}${tsRow})`,
      { bold: true }
    )
  }

  bsRows.next(); writeBlankRow(bsSheet)

  // Total L&E
  {
    const tlRow = bsRows.get("totalLiabilities")
    const teRow = bsRows.get("totalEquity")
    writeBSRow(
      "totalLE",
      "Total Liabilities & Equity",
      projected.map((p) => p.totalLiabilitiesAndEquity),
      "currency",
      (_i, col) => `${col}${tlRow}+${col}${teRow}`,
      { bold: true }
    )
    applyDoubleUnderline(bsSheet.lastRow!, 2, totalCols + 1)
  }

  // Balance Check = TA - TLE
  {
    const taRow  = bsRows.get("totalAssets")
    const tleRow = bsRows.get("totalLE")
    writeBSRow(
      "balanceCheck",
      "Balance Check (should be 0)",
      projected.map((p) => p.balanceCheck),
      "currency",
      (_i, col) => `${col}${taRow}-${col}${tleRow}`,
      { indent: 1 }
    )
  }

  // =========================================================================
  // PATCH: BS Historical Seed Values
  // Populate the last historical column with estimated seed values so that
  // carry-forward formulas referencing prior-period have proper anchors.
  // Without this, all carry-forward BS items (PPE, goodwill, debt, equity)
  // reference empty cells on recalculation → D1 propagation test failure.
  // =========================================================================

  if (historicals.length > 0) {
    const lastHistCol = 1 + histCount
    const lastHist = historicals[historicals.length - 1]
    const priorRev = lastHist.revenue
    const priorCOGS = lastHist.cogs

    // Compute seeds (matching projection engine bootstrap logic)
    const bsSeeds: Record<string, number> = {}
    bsSeeds.ar = priorRev * 35 / 365
    bsSeeds.prepaid = priorRev * 0.03
    bsSeeds.ppe = priorRev * 0.05
    bsSeeds.capsw = priorRev * 0.08
    bsSeeds.sti = 0
    bsSeeds.goodwill = 0
    bsSeeds.intangibles = 0
    bsSeeds.onca = 0
    bsSeeds.ap = priorCOGS * 30 / 365
    bsSeeds.accrued = priorRev * 0.06
    bsSeeds.defrevC = priorRev * 0.08
    bsSeeds.defrevNC = priorRev * 0.02
    bsSeeds.currentDebt = 0
    bsSeeds.ocl = priorRev * 0.02
    bsSeeds.ltd = 0
    bsSeeds.oncl = 0
    bsSeeds.cs = 0
    bsSeeds.apic = 0
    bsSeeds.ts = 0

    // Compute totals and RE as plug to balance A = L + E
    const totalAssetExCash = bsSeeds.sti + bsSeeds.ar + bsSeeds.prepaid
      + bsSeeds.ppe + bsSeeds.goodwill + bsSeeds.intangibles + bsSeeds.capsw + bsSeeds.onca
    const totalLiab = bsSeeds.ap + bsSeeds.accrued + bsSeeds.defrevC + bsSeeds.currentDebt
      + bsSeeds.ocl + bsSeeds.ltd + bsSeeds.defrevNC + bsSeeds.oncl
    const cashSeed = Math.max(0, totalLiab - totalAssetExCash + priorRev * 0.10)
    bsSeeds.cash = cashSeed
    const totalAssets = cashSeed + totalAssetExCash
    bsSeeds.re = totalAssets - totalLiab - bsSeeds.cs - bsSeeds.apic - bsSeeds.ts

    // Subtotals
    bsSeeds.tca = cashSeed + bsSeeds.sti + bsSeeds.ar + bsSeeds.prepaid
    bsSeeds.tnca = bsSeeds.ppe + bsSeeds.goodwill + bsSeeds.intangibles + bsSeeds.capsw + bsSeeds.onca
    bsSeeds.totalAssets = bsSeeds.tca + bsSeeds.tnca
    bsSeeds.tcl = bsSeeds.ap + bsSeeds.accrued + bsSeeds.defrevC + bsSeeds.currentDebt + bsSeeds.ocl
    bsSeeds.tncl = bsSeeds.ltd + bsSeeds.defrevNC + bsSeeds.oncl
    bsSeeds.totalLiabilities = bsSeeds.tcl + bsSeeds.tncl
    bsSeeds.totalEquity = bsSeeds.cs + bsSeeds.apic + bsSeeds.re + bsSeeds.ts
    bsSeeds.totalLE = bsSeeds.totalLiabilities + bsSeeds.totalEquity
    bsSeeds.balanceCheck = bsSeeds.totalAssets - bsSeeds.totalLE

    // Write seed values into last historical column (blue font = input per Banker Bible B1)
    for (const [key, val] of Object.entries(bsSeeds)) {
      try {
        const rowNum = bsRows.get(key)
        const cell = bsSheet.getRow(rowNum).getCell(lastHistCol)
        cell.value = val
        applyCurrencyFormat(cell)
        cell.font = { size: 10, name: "Calibri", color: { argb: "FF0000CC" } }
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_HIST_BG}` } }
        cell.alignment = { horizontal: "right", vertical: "middle" }
      } catch {
        // Key not registered in RowTracker, skip
      }
    }
  }

  // =========================================================================
  // SHEET 4: Cash Flow
  // =========================================================================

  const cfRows = new RowTracker(1)

  const cfSheet = workbook.addWorksheet("Cash Flow", { properties: { tabColor: { argb: "FFFED7AA" } } })
  setupSheet(cfSheet, allLabels, histCount)

  // Helper: write one CF row
  const writeCFRow = (
    key: string | null,
    label: string,
    projVals_: (number | null)[],
    fmt: "currency" | "percent",
    formulaFn: ((i: number, col: string, aCol: string, priorCol: string) => string) | null,
    opts: { bold?: boolean; indent?: number } = {}
  ): number => {
    if (key) cfRows.next(key); else cfRows.next()

    const cells: (number | { formula: string; result: number | null } | null)[] = [
      ...historicals.map(() => null as null),
      ...projVals_.map((pv, i) => {
        if (formulaFn) {
          const col      = projColLetter(i)
          const aCol     = assumpColForYear(i)
          const priorCol = i === 0 ? colLetter(1 + histCount) : projColLetter(i - 1)
          return { formula: formulaFn(i, col, aCol, priorCol), result: pv }
        }
        return pv
      }),
    ]

    const row = cfSheet.addRow([label, ...cells])
    labelCell(row, label, opts.indent ?? 0)
    for (let c = 2; c <= totalCols + 1; c++) {
      const cell = row.getCell(c)
      if (fmt === "currency") applyCurrencyFormat(cell)
      else applyPercentFormat(cell)
      cell.font = { bold: !!opts.bold, size: 10, name: "Calibri" }
      cell.alignment = { horizontal: "right", vertical: "middle" }
    }
    paintDataRow(row, 2, totalCols + 1, histCount, !!opts.bold)
    row.height = 15
    if (opts.bold) applyTotalStyle(row, 2)
    return cfRows.row
  }

  cfRows.next(); writeBlankRow(cfSheet)
  cfRows.next(); writeSectionHeader(cfSheet, "Operating Activities", totalCols)

  // Net Income
  {
    const niRow = isRows.get("netIncome")
    writeCFRow(
      "cfNI",
      "Net Income",
      projected.map((p) => p.cfNetIncome),
      "currency",
      (_i, col) => `'Income Statement'!${col}${niRow}`,
      { indent: 1 }
    )
  }

  // D&A
  {
    const daRow = isRows.get("da")
    writeCFRow(
      "cfDA",
      "D&A",
      projected.map((p) => p.cfDA),
      "currency",
      (_i, col) => `'Income Statement'!${col}${daRow}`,
      { indent: 1 }
    )
  }

  // SBC
  {
    const sbcRow = isRows.get("sbc")
    writeCFRow(
      "cfSBC",
      "SBC",
      projected.map((p) => p.cfSBC),
      "currency",
      (_i, col) => `'Income Statement'!${col}${sbcRow}`,
      { indent: 1 }
    )
  }

  // Other Non-Cash = 0
  writeCFRow(
    "cfOtherNC",
    "Other Non-Cash",
    projected.map(() => 0),
    "currency",
    () => "0",
    { indent: 1 }
  )

  // Working capital changes — BS delta references
  {
    const arRow      = bsRows.get("ar")
    const prepaidRow = bsRows.get("prepaid")
    const apRow      = bsRows.get("ap")
    const accruedRow = bsRows.get("accrued")
    const defrevCRow = bsRows.get("defrevC")
    const defrevNCRow = bsRows.get("defrevNC")

    writeCFRow(
      "cfChgAR",
      "Change in AR",
      projected.map((p) => p.cfChangeAR),
      "currency",
      (_i, col, _aCol, priorCol) =>
        `-('Balance Sheet'!${col}${arRow}-'Balance Sheet'!${priorCol}${arRow})`,
      { indent: 1 }
    )

    writeCFRow(
      "cfChgPrepaid",
      "Change in Prepaid",
      projected.map((p) => p.cfChangePrepaid),
      "currency",
      (_i, col, _aCol, priorCol) =>
        `-('Balance Sheet'!${col}${prepaidRow}-'Balance Sheet'!${priorCol}${prepaidRow})`,
      { indent: 1 }
    )

    writeCFRow(
      "cfChgAP",
      "Change in AP",
      projected.map((p) => p.cfChangeAP),
      "currency",
      (_i, col, _aCol, priorCol) =>
        `'Balance Sheet'!${col}${apRow}-'Balance Sheet'!${priorCol}${apRow}`,
      { indent: 1 }
    )

    writeCFRow(
      "cfChgAccrued",
      "Change in Accrued Liabilities",
      projected.map((p) => p.cfChangeAccrued),
      "currency",
      (_i, col, _aCol, priorCol) =>
        `'Balance Sheet'!${col}${accruedRow}-'Balance Sheet'!${priorCol}${accruedRow}`,
      { indent: 1 }
    )

    writeCFRow(
      "cfChgDefRev",
      "Change in Deferred Revenue",
      projected.map((p) => p.cfChangeDeferredRev),
      "currency",
      (_i, col, _aCol, priorCol) =>
        `('Balance Sheet'!${col}${defrevCRow}-'Balance Sheet'!${priorCol}${defrevCRow})+('Balance Sheet'!${col}${defrevNCRow}-'Balance Sheet'!${priorCol}${defrevNCRow})`,
      { indent: 1 }
    )

    writeCFRow(
      "cfChgOtherWC",
      "Change in Other Working Capital",
      projected.map(() => 0),
      "currency",
      () => "0",
      { indent: 1 }
    )
  }

  // Total CFO = SUM of operating items
  {
    const niCFRow     = cfRows.get("cfNI")
    const otherWCRow  = cfRows.get("cfChgOtherWC")
    writeCFRow(
      "cfo",
      "Total CFO",
      projected.map((p) => p.cfOperating),
      "currency",
      (_i, col) => `SUM(${col}${niCFRow}:${col}${otherWCRow})`,
      { bold: true }
    )
  }

  cfRows.next(); writeBlankRow(cfSheet)
  cfRows.next(); writeSectionHeader(cfSheet, "Investing Activities", totalCols)

  // CapEx = -(Rev * capexPct), or -(Cost — CapEx tab total) if active
  {
    const revRow = isRows.get("totalRevenue")
    const capexCostTab = costTabRefs.find((r) => r.isMapping === "capex")
    writeCFRow(
      "cfCapex",
      "CapEx",
      projected.map((p) => p.cfCapex),
      "currency",
      capexCostTab
        ? (_i, col) => `-'${capexCostTab.tabName}'!${col}${capexCostTab.totalRow}`
        : (_i, col, aCol) =>
            `-('Income Statement'!${col}${revRow}*'Basic Assumptions'!${aCol}${assumpRows.get("capex")})`,
      { indent: 1 }
    )

    // Cap Software = -(Rev * capSWPct)
    writeCFRow(
      "cfCapSW",
      "Capitalized Software",
      projected.map((p) => p.cfCapSoftware),
      "currency",
      (_i, col, aCol) =>
        `-('Income Statement'!${col}${revRow}*'Basic Assumptions'!${aCol}${assumpRows.get("capsw")})`,
      { indent: 1 }
    )
  }

  writeCFRow(
    "cfOtherInv",
    "Other Investing",
    projected.map(() => 0),
    "currency",
    () => "0",
    { indent: 1 }
  )

  // Total CFI
  {
    const capexRow    = cfRows.get("cfCapex")
    const otherInvRow = cfRows.get("cfOtherInv")
    writeCFRow(
      "cfi",
      "Total CFI",
      projected.map((p) => p.cfInvesting),
      "currency",
      (_i, col) => `SUM(${col}${capexRow}:${col}${otherInvRow})`,
      { bold: true }
    )
  }

  cfRows.next(); writeBlankRow(cfSheet)
  cfRows.next(); writeSectionHeader(cfSheet, "Financing Activities", totalCols)

  writeCFRow(
    "cfNewDebt",
    "New Debt Issuance",
    projected.map((p) => p.cfNewDebt),
    "currency",
    (_i, _col, aCol) => `'Basic Assumptions'!${aCol}${assumpRows.get("newDebt")}`,
    { indent: 1 }
  )

  writeCFRow(
    "cfDebtRepay",
    "Debt Repayments",
    projected.map((p) => p.cfDebtRepayment),
    "currency",
    (_i, _col, aCol) => `-'Basic Assumptions'!${aCol}${assumpRows.get("debtRepay")}`,
    { indent: 1 }
  )

  writeCFRow(
    "cfEquityIss",
    "Equity Issuance",
    projected.map((p) => p.cfEquityIssuance),
    "currency",
    (_i, _col, aCol) => `'Basic Assumptions'!${aCol}${assumpRows.get("equityIss")}`,
    { indent: 1 }
  )

  writeCFRow(
    "cfBuybacks",
    "Share Repurchases",
    projected.map((p) => p.cfShareRepurchases),
    "currency",
    (_i, _col, aCol) => `-'Basic Assumptions'!${aCol}${assumpRows.get("buybacks")}`,
    { indent: 1 }
  )

  writeCFRow(
    "cfDivs",
    "Dividends Paid",
    projected.map((p) => p.cfDividends),
    "currency",
    (_i, _col, aCol) => `-'Basic Assumptions'!${aCol}${assumpRows.get("divs")}`,
    { indent: 1 }
  )

  writeCFRow(
    "cfOtherFin",
    "Other Financing",
    projected.map(() => 0),
    "currency",
    () => "0",
    { indent: 1 }
  )

  // Total CFF
  {
    const newDebtRow  = cfRows.get("cfNewDebt")
    const otherFinRow = cfRows.get("cfOtherFin")
    writeCFRow(
      "cff",
      "Total CFF",
      projected.map((p) => p.cfFinancing),
      "currency",
      (_i, col) => `SUM(${col}${newDebtRow}:${col}${otherFinRow})`,
      { bold: true }
    )
  }

  cfRows.next(); writeBlankRow(cfSheet)

  // Net Cash Change = CFO + CFI + CFF
  {
    const cfoRow = cfRows.get("cfo")
    const cfiRow = cfRows.get("cfi")
    const cffRow = cfRows.get("cff")
    writeCFRow(
      "netChange",
      "Net Cash Change",
      projected.map((p) => p.netCashChange),
      "currency",
      (_i, col) => `${col}${cfoRow}+${col}${cfiRow}+${col}${cffRow}`,
      { bold: true }
    )
  }

  // Beginning Cash = prior BS Cash
  {
    const cashBSRow = bsRows.get("cash")
    writeCFRow(
      "begCash",
      "Beginning Cash",
      projected.map((p) => p.cashBeginning),
      "currency",
      (_i, _col, _aCol, priorCol) => `'Balance Sheet'!${priorCol}${cashBSRow}`,
      { indent: 1 }
    )
  }

  // Ending Cash = Beginning + Net Change
  {
    const begRow    = cfRows.get("begCash")
    const chgRow    = cfRows.get("netChange")
    writeCFRow(
      "endCash",
      "Ending Cash",
      projected.map((p) => p.cashEnding),
      "currency",
      (_i, col) => `${col}${begRow}+${col}${chgRow}`,
      { bold: true }
    )
    applyDoubleUnderline(cfSheet.lastRow!, 2, totalCols + 1)
  }

  cfRows.next(); writeBlankRow(cfSheet)

  // FCF = CFO + CapEx + CapSW
  {
    const cfoRow   = cfRows.get("cfo")
    const capexRow = cfRows.get("cfCapex")
    const capswRow = cfRows.get("cfCapSW")
    const revRow   = isRows.get("totalRevenue")
    writeCFRow(
      "fcf",
      "Free Cash Flow",
      projected.map((p) => p.fcf),
      "currency",
      (_i, col) => `${col}${cfoRow}+${col}${capexRow}+${col}${capswRow}`,
      { bold: true }
    )
    writeCFRow(
      "fcfMargin",
      "FCF Margin %",
      projected.map((p) => p.fcfMargin),
      "percent",
      (_i, col) => `${col}${cfRows.get("fcf")}/'Income Statement'!${col}${revRow}`,
      { indent: 1 }
    )
  }

  // =========================================================================
  // PATCH: BS Cash cells — now that CFS is built, wire in the formula
  // 'Cash Flow'!{endingCashCol}{endCashRow}
  // =========================================================================

  const endCashRow  = cfRows.get("endCash")
  const cashBSRow   = bsRows.get("cash")

  // The BS Cash row needs formulas for projected columns only
  // We need to get the actual ExcelJS row on the BS sheet and patch each projected cell
  const bsCashRowNum = cashBSRow  // 1-based Excel row number on the BS sheet

  for (let i = 0; i < projYears; i++) {
    const col = projColLetter(i)
    const excelRowIdx = bsCashRowNum  // setupSheet adds header at row 1, then rows follow
    const cell = bsSheet.getRow(excelRowIdx).getCell(firstProjCol + i)
    cell.value = {
      formula: `'Cash Flow'!${col}${endCashRow}`,
      result: projected[i]?.cash ?? 0,
    }
    applyCurrencyFormat(cell)
    cell.font = { size: 10, name: "Calibri" }
    cell.alignment = { horizontal: "right", vertical: "middle" }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_PROJ_BG}` } }
  }

  return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>
}

// Helper: formula description per methodology
function getMethodFormulaNote(methodId: string): string {
  const notes: Record<string, string> = {
    volume_price: "Formula: Revenue = SUM(Units_i × ASP_i) for each product line",
    tam: "Formula: Revenue = TAM × (1 + Growth)^t × SAM% × Market Share%",
    sales_capacity: "Formula: Revenue = Productive Reps × Quota × Attainment%. Ramp: new hires × (months ramped / 12)",
    cohort: "Formula: Total Rev = SUM(Cohort_c × Retention^(t-c) × (1 + Expansion)^(t-c))",
    arr_waterfall: "Formula: End ARR = Beg ARR + New + Expansion − Churn − Contraction. Rev ≈ Avg(Beg, End) ARR",
    same_store: "Formula: Rev = Existing × Rev/Store × (1+SSSG) + New Stores × Rev/New × Partial Year",
    backlog: "Formula: Rev = Beg Backlog × Burn Rate + New Awards × In-Period Recognition",
    yield: "Formula: Rev = Earning Assets × NIM + AUM × Mgmt Fee + Non-Interest Income",
    usage: "Formula: Rev = Customers × (1+Growth) × Usage × (1+Usage Growth) × Price × (1−Vol Discount)",
    advertising: "Formula: Ad Rev = DAU × Sessions × Ads × CPM/1000 × 365 + GMV × Take Rate",
    recurring_split: "Formula: Rev = Sub ARR + Maint + (New Cust × PS Attach × PS Avg) + (New Cust × Impl Fee)",
    channel_mix: "Formula: Rev = Direct Deals × ACV + Partner Deals × ACV × (1−Disc) + OEM × ACV × (1−Disc)",
    geo_segment: "Formula: Rev = SUM(Region_r × FX Rate_r) across all geographies",
  }
  return notes[methodId] ?? ""
}

// Helper: build a live Excel formula for a revenue methodology from its input rows
function buildMethodRevenueFormula(
  methodId: string,
  inputRows: Record<string, number>,
  col: string,
): string {
  const r = (key: string) => {
    const row = inputRows[key]
    return row !== undefined ? `${col}${row}` : "0"
  }
  switch (methodId) {
    case "volume_price":
      return `${r("vp_units_1")}*${r("vp_asp_1")}+${r("vp_units_2")}*${r("vp_asp_2")}+${r("vp_units_3")}*${r("vp_asp_3")}`
    case "tam":
      return `${r("tam_total")}*${r("sam_pct")}*${r("som_share")}`
    case "sales_capacity":
      return `(${r("sc_beg_reps")}+${r("sc_new_hires")}-${r("sc_attrition")})*${r("sc_quota")}*${r("sc_attainment")}`
    case "cohort":
      return `${r("coh_new_acv")}*${r("coh_new_logos")}`
    case "arr_waterfall":
      return `(${r("arr_beg")}*2+${r("arr_new")}+${r("arr_expansion")}-${r("arr_churn")}-${r("arr_contraction")})/2`
    case "same_store":
      return `${r("ss_existing")}*${r("ss_rev_per")}*(1+${r("ss_sssg")})+${r("ss_new_stores")}*${r("ss_new_rev")}*${r("ss_partial")}`
    case "backlog":
      return `${r("bl_opening")}*${r("bl_burn_rate")}`
    case "yield":
      return `${r("yld_assets")}*${r("yld_nim")}+${r("yld_aum")}*${r("yld_mgmt_fee")}+${r("yld_nonint")}`
    case "usage":
      return `${r("usg_customers")}*(1+${r("usg_cust_growth")})*${r("usg_avg_usage")}*12*(1+${r("usg_usage_growth")})*${r("usg_price")}*(1-${r("usg_vol_disc")})`
    case "advertising":
      return `${r("ad_dau")}*${r("ad_sessions")}*${r("ad_load")}*${r("ad_cpm")}/1000*365+${r("ad_gmv")}*${r("ad_take_rate")}`
    case "recurring_split":
      return `${r("rnr_sub_arr")}+${r("rnr_sub_arr")}*${r("rnr_maint_rate")}+${r("rnr_new_cust")}*${r("rnr_ps_attach")}*${r("rnr_ps_avg")}+${r("rnr_new_cust")}*${r("rnr_impl")}`
    case "channel_mix":
      return `${r("ch_direct_deals")}*${r("ch_direct_acv")}+${r("ch_partner_deals")}*${r("ch_direct_acv")}*(1-${r("ch_partner_disc")})+${r("ch_oem_deals")}*${r("ch_direct_acv")}*(1-${r("ch_oem_disc")})`
    case "geo_segment":
      return `${r("geo_na_rev")}+${r("geo_eu_rev")}*${r("geo_eu_fx")}+${r("geo_apac_rev")}*${r("geo_apac_fx")}`
    default:
      return "0"
  }
}

// ---------------------------------------------------------------------------
// buildScenarioWorkbook
// ---------------------------------------------------------------------------

export async function buildScenarioWorkbook(
  projection: ScenarioProjection,
  assumptions: ScenarioAssumptions,
  scenarioName: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "ShardCFO"
  workbook.created = new Date()

  const months = projection.months

  // -------------------------------------------------------------------------
  // Tab: Monthly Projections
  // -------------------------------------------------------------------------
  {
    const sheet = workbook.addWorksheet("Monthly Projections")
    const colHeaders = ["Period", "MRR", "ARR", "Revenue", "COGS", "Gross Profit", "Gross Margin %", "Payroll", "Other OpEx", "Total OpEx", "EBITDA", "EBITDA Margin %", "Net Income", "Cash Balance", "Burn Rate", "Headcount"]
    const colWidths = [12, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 12]
    colWidths.forEach((w, i) => { sheet.getColumn(i + 1).width = w })

    const headerRow = sheet.addRow(colHeaders)
    applyHeaderStyle(headerRow)
    headerRow.height = 18
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }]

    for (const [i, m] of months.entries()) {
      const row = sheet.addRow([
        m.period,
        m.mrr,
        m.arr,
        m.revenue,
        m.cogs,
        m.grossProfit,
        m.grossMarginPct,
        m.payrollExpense,
        m.otherOpex,
        m.totalOpex,
        m.ebitda,
        m.ebitdaMarginPct,
        m.netIncome,
        m.cashBalance,
        m.burnRate,
        m.headcount,
      ])
      const bgColor = i % 2 === 0 ? COLOR_HIST_BG : "FFFFFF"
      row.eachCell((cell, colNum) => {
        cell.font = { size: 10, name: "Calibri" }
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${bgColor}` } }
        if (colNum === 1) {
          cell.alignment = { horizontal: "center" }
        } else if (colNum === 7 || colNum === 12) {
          applyPercentFormat(cell)
          cell.alignment = { horizontal: "right" }
        } else if (colNum === 16) {
          cell.alignment = { horizontal: "right" }
        } else {
          applyCurrencyFormat(cell)
          cell.alignment = { horizontal: "right" }
        }
      })
      row.height = 15
    }
  }

  // -------------------------------------------------------------------------
  // Tab: Summary
  // -------------------------------------------------------------------------
  {
    const sheet = workbook.addWorksheet("Summary")
    sheet.getColumn(1).width = 28
    sheet.getColumn(2).width = 18

    const titleRow = sheet.addRow([scenarioName + " — Summary"])
    titleRow.getCell(1).font = { bold: true, size: 14, name: "Calibri", color: { argb: `FF${COLOR_HEADER_BG}` } }
    titleRow.height = 24
    sheet.addRow([]).height = 8

    const headerRow = sheet.addRow(["Metric", "Value"])
    applyHeaderStyle(headerRow)
    headerRow.height = 18

    const last = months[months.length - 1]
    const summaryRows: [string, number | string | null][] = [
      ["End MRR", last?.mrr ?? null],
      ["End ARR", last?.arr ?? null],
      ["End Cash Balance", last?.cashBalance ?? null],
      ["Runway (months)", projection.estimatedRunwayMonths ?? "Cash-flow positive"],
      ["End Gross Margin", last?.grossMarginPct ?? null],
      ["End Headcount", last?.headcount ?? null],
      ["Cash Out Date", projection.estimatedCashOutDate ?? "N/A"],
      ["Projection Months", months.length],
      ["Scenario Name", projection.scenarioName],
      ["Base Period", projection.basePeriod],
    ]

    for (const [i, [label, value]] of summaryRows.entries()) {
      const row = sheet.addRow([label, value])
      const bgColor = i % 2 === 0 ? COLOR_HIST_BG : "FFFFFF"
      row.getCell(1).font = { size: 10, name: "Calibri" }
      row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${bgColor}` } }
      const cell2 = row.getCell(2)
      cell2.font = { bold: true, size: 10, name: "Calibri" }
      cell2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${bgColor}` } }
      if (typeof value === "number" && label.toLowerCase().includes("margin")) {
        applyPercentFormat(cell2)
      } else if (typeof value === "number" && label !== "Runway (months)" && label !== "End Headcount" && label !== "Projection Months") {
        applyCurrencyFormat(cell2)
      }
      cell2.alignment = { horizontal: "right" }
      row.height = 15
    }
  }

  // -------------------------------------------------------------------------
  // Tab: Assumptions
  // -------------------------------------------------------------------------
  {
    const sheet = workbook.addWorksheet("Assumptions")
    sheet.getColumn(1).width = 28
    sheet.getColumn(2).width = 18

    const titleRow = sheet.addRow(["Scenario Assumptions"])
    titleRow.getCell(1).font = { bold: true, size: 14, name: "Calibri", color: { argb: `FF${COLOR_HEADER_BG}` } }
    titleRow.height = 24
    sheet.addRow([]).height = 8

    const headerRow = sheet.addRow(["Parameter", "Value"])
    applyHeaderStyle(headerRow)
    headerRow.height = 18

    const writeRow = (label: string, value: number | string | null, fmt?: "percent" | "currency") => {
      const row = sheet.addRow([label, value])
      row.getCell(1).font = { size: 10, name: "Calibri" }
      row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_PROJ_BG}` } }
      const cell = row.getCell(2)
      cell.font = { size: 10, name: "Calibri" }
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_PROJ_BG}` } }
      cell.alignment = { horizontal: "right" }
      if (fmt === "percent") applyPercentFormat(cell)
      else if (fmt === "currency") applyCurrencyFormat(cell)
      row.height = 15
    }

    writeRow("MRR Growth Rate (MoM)", assumptions.mrrGrowthRate ?? 0, "percent")
    writeRow("COGS %", assumptions.cogsPercentage ?? null, "percent")
    writeRow("Other OpEx Growth Rate", assumptions.otherOpexGrowthRate ?? 0, "percent")
    writeRow("Projection Months", assumptions.projectionMonths ?? 12)
    writeRow("Employer Burden Rate", assumptions.employerBurdenRate ?? 0.15, "percent")

    if (assumptions.hirePlan && assumptions.hirePlan.length > 0) {
      sheet.addRow([]).height = 8
      const hp = sheet.addRow(["Hire Plan"])
      hp.getCell(1).font = { bold: true, size: 11, name: "Calibri", color: { argb: `FF${COLOR_HEADER_BG}` } }
      hp.height = 18
      const hpHeader = sheet.addRow(["Month Offset", "Headcount", "Monthly Salary / Person"])
      applyHeaderStyle(hpHeader)
      hpHeader.height = 16
      for (const hire of assumptions.hirePlan) {
        const row = sheet.addRow([hire.monthOffset, hire.headcount, hire.monthlySalaryPerPerson])
        row.getCell(3).numFmt = '#,##0'
        row.eachCell((cell) => {
          cell.font = { size: 10, name: "Calibri" }
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_PROJ_BG}` } }
        })
        row.height = 15
      }
    }

    if (assumptions.fundraisingEvents && assumptions.fundraisingEvents.length > 0) {
      sheet.addRow([]).height = 8
      const fe = sheet.addRow(["Fundraising Events"])
      fe.getCell(1).font = { bold: true, size: 11, name: "Calibri", color: { argb: `FF${COLOR_HEADER_BG}` } }
      fe.height = 18
      const feHeader = sheet.addRow(["Close Date", "Amount"])
      applyHeaderStyle(feHeader)
      feHeader.height = 16
      for (const event of assumptions.fundraisingEvents) {
        const row = sheet.addRow([event.closeDate, event.amount])
        row.getCell(2).numFmt = '#,##0'
        row.eachCell((cell) => {
          cell.font = { size: 10, name: "Calibri" }
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLOR_PROJ_BG}` } }
        })
        row.height = 15
      }
    }
  }

  return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>
}

// ---------------------------------------------------------------------------
// buildModelEngineWorkbook types
// ---------------------------------------------------------------------------

export interface ModelEnginePeriod {
  label: string
  is: Record<string, number>
  bs: Record<string, number>
  cfs: Record<string, number>
}

export interface ModelEngineDiagnostic {
  id: string
  name: string
  period: string
  severity: string
  passed: boolean
  deviation: number | null
  rootCause: string | null
}

// ---------------------------------------------------------------------------
// buildModelEngineWorkbook
// ---------------------------------------------------------------------------

export async function buildModelEngineWorkbook(
  periods: ModelEnginePeriod[],
  diagnostics: ModelEngineDiagnostic[],
  companyName: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "ShardCFO"
  workbook.company = companyName
  workbook.created = new Date()

  if (periods.length === 0) {
    workbook.addWorksheet("No Data").addRow(["No period data provided."])
    return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>
  }

  const periodLabels = periods.map((p) => p.label)
  const totalCols = periods.length

  const writeEngineTab = (tabName: string, dataKey: keyof Omit<ModelEnginePeriod, "label">) => {
    const sheet = workbook.addWorksheet(tabName)
    sheet.getColumn(1).width = 28
    for (let c = 2; c <= totalCols + 1; c++) {
      sheet.getColumn(c).width = 14
    }

    const headerRow = sheet.addRow(["Line Item", ...periodLabels])
    applyHeaderStyle(headerRow)
    headerRow.height = 18
    sheet.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }]

    const allKeys = Array.from(
      new Set(periods.flatMap((p) => Object.keys(p[dataKey])))
    )

    for (const [rowIdx, key] of allKeys.entries()) {
      const values = periods.map((p) => p[dataKey][key] ?? null)
      const row = sheet.addRow([key, ...values])
      const bgColor = rowIdx % 2 === 0 ? COLOR_HIST_BG : "FFFFFF"
      row.getCell(1).font = { size: 10, name: "Calibri" }
      row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${bgColor}` } }
      for (let c = 2; c <= totalCols + 1; c++) {
        const cell = row.getCell(c)
        cell.font = { size: 10, name: "Calibri" }
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${bgColor}` } }
        applyCurrencyFormat(cell)
        cell.alignment = { horizontal: "right" }
      }
      row.height = 15
    }
  }

  writeEngineTab("Income Statement", "is")
  writeEngineTab("Balance Sheet", "bs")
  writeEngineTab("Cash Flow", "cfs")

  // -------------------------------------------------------------------------
  // Tab: Diagnostics
  // -------------------------------------------------------------------------
  {
    const sheet = workbook.addWorksheet("Diagnostics")
    sheet.getColumn(1).width = 20
    sheet.getColumn(2).width = 30
    sheet.getColumn(3).width = 12
    sheet.getColumn(4).width = 12
    sheet.getColumn(5).width = 10
    sheet.getColumn(6).width = 14
    sheet.getColumn(7).width = 40

    const headers = ["ID", "Name", "Period", "Severity", "Passed", "Deviation", "Root Cause"]
    const headerRow = sheet.addRow(headers)
    applyHeaderStyle(headerRow)
    headerRow.height = 18
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }]

    for (const d of diagnostics) {
      const row = sheet.addRow([
        d.id,
        d.name,
        d.period,
        d.severity,
        d.passed ? "PASS" : "FAIL",
        d.deviation ?? null,
        d.rootCause ?? "",
      ])

      const passCell = row.getCell(5)
      if (d.passed) {
        passCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } }
        passCell.font = { bold: true, color: { argb: "FF065F46" }, size: 10, name: "Calibri" }
      } else {
        passCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } }
        passCell.font = { bold: true, color: { argb: "FF991B1B" }, size: 10, name: "Calibri" }
      }

      row.getCell(6).numFmt = "0.000%"
      row.eachCell({ includeEmpty: false }, (cell, colNum) => {
        if (colNum !== 5) {
          cell.font = { size: 10, name: "Calibri" }
        }
        cell.alignment = { vertical: "middle", wrapText: colNum === 7 }
      })
      row.height = 15
    }
  }

  return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>
}
