/**
 * App-wide constants for ShardCFO.
 *
 * Includes SaaS benchmark data by funding stage and metric definitions
 * used across the UI for labels, units, and display logic.
 */

// ---------------------------------------------------------------------------
// Stage benchmarks
// ---------------------------------------------------------------------------

export type FundingStage = "pre_seed" | "seed" | "series_a" | "series_b" | "series_c" | "growth" | "public";

interface BenchmarkRange {
  low: number;
  median: number;
  high: number;
}

interface StageBenchmarks {
  /** Month-over-month MRR growth rate (decimal). */
  mrr_growth_mom: BenchmarkRange;
  /** Net Dollar Retention (decimal). */
  net_dollar_retention: BenchmarkRange;
  /** Gross Revenue Retention (decimal). */
  gross_revenue_retention: BenchmarkRange;
  /** LTV:CAC ratio. */
  ltv_cac_ratio: BenchmarkRange;
  /** CAC Payback Period in months. */
  cac_payback_months: BenchmarkRange;
  /** Gross Margin (decimal). */
  gross_margin: BenchmarkRange;
  /** Rule of 40 score (decimal — e.g. 0.40 = 40). */
  rule_of_40: BenchmarkRange;
  /** Burn Multiple. */
  burn_multiple: BenchmarkRange;
  /** Magic Number. */
  magic_number: BenchmarkRange;
}

/**
 * SaaS benchmark ranges sourced from OpenView Partners, Bessemer,
 * and SaaStr research. All values are approximate industry medians.
 *
 * "low" = bottom quartile, "median" = median, "high" = top quartile.
 */
export const SAAS_BENCHMARKS: Record<FundingStage, StageBenchmarks> = {
  pre_seed: {
    mrr_growth_mom: { low: 0.10, median: 0.20, high: 0.35 },
    net_dollar_retention: { low: 0.85, median: 0.95, high: 1.10 },
    gross_revenue_retention: { low: 0.75, median: 0.85, high: 0.92 },
    ltv_cac_ratio: { low: 1.0, median: 2.0, high: 4.0 },
    cac_payback_months: { low: 3, median: 12, high: 24 },
    gross_margin: { low: 0.50, median: 0.65, high: 0.75 },
    rule_of_40: { low: 0.15, median: 0.35, high: 0.55 },
    burn_multiple: { low: 1.0, median: 2.0, high: 4.0 },
    magic_number: { low: 0.3, median: 0.5, high: 1.0 },
  },
  seed: {
    mrr_growth_mom: { low: 0.08, median: 0.15, high: 0.25 },
    net_dollar_retention: { low: 0.90, median: 1.00, high: 1.15 },
    gross_revenue_retention: { low: 0.80, median: 0.88, high: 0.95 },
    ltv_cac_ratio: { low: 1.5, median: 3.0, high: 5.0 },
    cac_payback_months: { low: 6, median: 18, high: 36 },
    gross_margin: { low: 0.55, median: 0.68, high: 0.78 },
    rule_of_40: { low: 0.20, median: 0.40, high: 0.60 },
    burn_multiple: { low: 0.5, median: 1.5, high: 3.0 },
    magic_number: { low: 0.5, median: 0.75, high: 1.5 },
  },
  series_a: {
    mrr_growth_mom: { low: 0.05, median: 0.10, high: 0.18 },
    net_dollar_retention: { low: 0.95, median: 1.05, high: 1.20 },
    gross_revenue_retention: { low: 0.85, median: 0.90, high: 0.95 },
    ltv_cac_ratio: { low: 2.0, median: 4.0, high: 7.0 },
    cac_payback_months: { low: 9, median: 18, high: 30 },
    gross_margin: { low: 0.60, median: 0.70, high: 0.80 },
    rule_of_40: { low: 0.25, median: 0.45, high: 0.65 },
    burn_multiple: { low: 0.5, median: 1.5, high: 2.5 },
    magic_number: { low: 0.6, median: 1.0, high: 1.8 },
  },
  series_b: {
    mrr_growth_mom: { low: 0.03, median: 0.07, high: 0.12 },
    net_dollar_retention: { low: 1.00, median: 1.10, high: 1.25 },
    gross_revenue_retention: { low: 0.88, median: 0.92, high: 0.97 },
    ltv_cac_ratio: { low: 3.0, median: 5.0, high: 8.0 },
    cac_payback_months: { low: 12, median: 20, high: 30 },
    gross_margin: { low: 0.65, median: 0.72, high: 0.82 },
    rule_of_40: { low: 0.30, median: 0.50, high: 0.70 },
    burn_multiple: { low: 0.3, median: 1.0, high: 2.0 },
    magic_number: { low: 0.75, median: 1.25, high: 2.0 },
  },
  series_c: {
    mrr_growth_mom: { low: 0.02, median: 0.06, high: 0.10 },
    net_dollar_retention: { low: 1.02, median: 1.12, high: 1.25 },
    gross_revenue_retention: { low: 0.90, median: 0.94, high: 0.97 },
    ltv_cac_ratio: { low: 3.5, median: 6.0, high: 10.0 },
    cac_payback_months: { low: 12, median: 18, high: 28 },
    gross_margin: { low: 0.67, median: 0.74, high: 0.83 },
    rule_of_40: { low: 0.32, median: 0.52, high: 0.72 },
    burn_multiple: { low: 0.3, median: 0.9, high: 1.8 },
    magic_number: { low: 0.8, median: 1.3, high: 2.2 },
  },
  growth: {
    mrr_growth_mom: { low: 0.02, median: 0.05, high: 0.08 },
    net_dollar_retention: { low: 1.05, median: 1.15, high: 1.30 },
    gross_revenue_retention: { low: 0.90, median: 0.95, high: 0.98 },
    ltv_cac_ratio: { low: 4.0, median: 7.0, high: 12.0 },
    cac_payback_months: { low: 12, median: 18, high: 24 },
    gross_margin: { low: 0.68, median: 0.75, high: 0.85 },
    rule_of_40: { low: 0.35, median: 0.55, high: 0.75 },
    burn_multiple: { low: 0.25, median: 0.75, high: 1.5 },
    magic_number: { low: 1.0, median: 1.5, high: 2.5 },
  },
  public: {
    mrr_growth_mom: { low: 0.01, median: 0.03, high: 0.06 },
    net_dollar_retention: { low: 1.05, median: 1.15, high: 1.30 },
    gross_revenue_retention: { low: 0.92, median: 0.96, high: 0.99 },
    ltv_cac_ratio: { low: 5.0, median: 8.0, high: 15.0 },
    cac_payback_months: { low: 12, median: 16, high: 22 },
    gross_margin: { low: 0.70, median: 0.78, high: 0.87 },
    rule_of_40: { low: 0.35, median: 0.55, high: 0.80 },
    burn_multiple: { low: 0.2, median: 0.5, high: 1.0 },
    magic_number: { low: 1.0, median: 1.5, high: 3.0 },
  },
};

// ---------------------------------------------------------------------------
// Metric definitions
// ---------------------------------------------------------------------------

export type MetricUnit =
  | "currency"
  | "percentage"
  | "ratio"
  | "months"
  | "count"
  | "multiple";

export interface MetricDefinition {
  key: string;
  label: string;
  shortLabel: string;
  unit: MetricUnit;
  description: string;
  /** True if a higher value is generally considered better. */
  higherIsBetter: boolean;
  /** Decimal places to display in the UI. */
  decimalPlaces: number;
}

export const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  mrr: {
    key: "mrr",
    label: "Monthly Recurring Revenue",
    shortLabel: "MRR",
    unit: "currency",
    description: "Total predictable recurring revenue expected each month.",
    higherIsBetter: true,
    decimalPlaces: 0,
  },
  arr: {
    key: "arr",
    label: "Annual Recurring Revenue",
    shortLabel: "ARR",
    unit: "currency",
    description: "MRR × 12. The annualised run rate of recurring revenue.",
    higherIsBetter: true,
    decimalPlaces: 0,
  },
  mrr_growth_rate: {
    key: "mrr_growth_rate",
    label: "MRR Growth Rate (MoM)",
    shortLabel: "MRR Growth",
    unit: "percentage",
    description: "Month-over-month percentage change in MRR.",
    higherIsBetter: true,
    decimalPlaces: 1,
  },
  net_dollar_retention: {
    key: "net_dollar_retention",
    label: "Net Dollar Retention",
    shortLabel: "NDR",
    unit: "percentage",
    description:
      "Revenue retained + expanded from existing customers over 12 months. Above 100% means expansion offsets churn.",
    higherIsBetter: true,
    decimalPlaces: 1,
  },
  gross_revenue_retention: {
    key: "gross_revenue_retention",
    label: "Gross Revenue Retention",
    shortLabel: "GRR",
    unit: "percentage",
    description:
      "Revenue retained from existing customers (capped at 100%; excludes expansion).",
    higherIsBetter: true,
    decimalPlaces: 1,
  },
  logo_churn_rate: {
    key: "logo_churn_rate",
    label: "Logo Churn Rate",
    shortLabel: "Logo Churn",
    unit: "percentage",
    description: "Percentage of customers lost in a given month.",
    higherIsBetter: false,
    decimalPlaces: 1,
  },
  revenue_churn_rate: {
    key: "revenue_churn_rate",
    label: "Revenue Churn Rate",
    shortLabel: "Rev Churn",
    unit: "percentage",
    description: "MRR lost from cancellations as a percentage of starting MRR.",
    higherIsBetter: false,
    decimalPlaces: 1,
  },
  cac: {
    key: "cac",
    label: "Customer Acquisition Cost",
    shortLabel: "CAC",
    unit: "currency",
    description: "Total S&M spend divided by new customers acquired.",
    higherIsBetter: false,
    decimalPlaces: 0,
  },
  ltv: {
    key: "ltv",
    label: "Customer Lifetime Value",
    shortLabel: "LTV",
    unit: "currency",
    description: "(ARPU × Gross Margin) ÷ Monthly Churn Rate.",
    higherIsBetter: true,
    decimalPlaces: 0,
  },
  ltv_cac_ratio: {
    key: "ltv_cac_ratio",
    label: "LTV:CAC Ratio",
    shortLabel: "LTV:CAC",
    unit: "ratio",
    description: "Lifetime value relative to acquisition cost. 3:1 is a common benchmark.",
    higherIsBetter: true,
    decimalPlaces: 1,
  },
  payback_period_months: {
    key: "payback_period_months",
    label: "CAC Payback Period",
    shortLabel: "Payback",
    unit: "months",
    description: "Months to recover the cost of acquiring a customer.",
    higherIsBetter: false,
    decimalPlaces: 0,
  },
  burn_multiple: {
    key: "burn_multiple",
    label: "Burn Multiple",
    shortLabel: "Burn Multiple",
    unit: "multiple",
    description: "Net cash burned ÷ net new ARR. Measures go-to-market efficiency.",
    higherIsBetter: false,
    decimalPlaces: 1,
  },
  rule_of_40: {
    key: "rule_of_40",
    label: "Rule of 40",
    shortLabel: "Rule of 40",
    unit: "percentage",
    description:
      "Revenue growth rate + EBITDA margin. Scores above 40 are considered healthy.",
    higherIsBetter: true,
    decimalPlaces: 0,
  },
  magic_number: {
    key: "magic_number",
    label: "Magic Number",
    shortLabel: "Magic #",
    unit: "multiple",
    description:
      "Net new ARR ÷ prior quarter S&M spend. Above 0.75 is generally good.",
    higherIsBetter: true,
    decimalPlaces: 2,
  },
  gross_margin_pct: {
    key: "gross_margin_pct",
    label: "Gross Margin",
    shortLabel: "Gross Margin",
    unit: "percentage",
    description: "(Revenue − COGS) ÷ Revenue.",
    higherIsBetter: true,
    decimalPlaces: 1,
  },
  monthly_burn_rate: {
    key: "monthly_burn_rate",
    label: "Monthly Burn Rate",
    shortLabel: "Burn Rate",
    unit: "currency",
    description: "Net cash consumed per month (expenses minus revenue).",
    higherIsBetter: false,
    decimalPlaces: 0,
  },
  runway_months: {
    key: "runway_months",
    label: "Runway",
    shortLabel: "Runway",
    unit: "months",
    description: "Estimated months until cash is exhausted at the current burn rate.",
    higherIsBetter: true,
    decimalPlaces: 0,
  },
};

// ---------------------------------------------------------------------------
// Application-level constants
// ---------------------------------------------------------------------------

export const APP_NAME = "ShardCFO" as const;

export const SUPPORTED_FUNDING_STAGES: { value: FundingStage; label: string }[] = [
  { value: "pre_seed", label: "Pre-Seed" },
  { value: "seed", label: "Seed" },
  { value: "series_a", label: "Series A" },
  { value: "series_b", label: "Series B" },
  { value: "series_c", label: "Series C+" },
  { value: "growth", label: "Growth" },
  { value: "public", label: "Public" },
];

/** Maximum number of months allowed in scenario projections. */
export const MAX_PROJECTION_MONTHS = 24 as const;

/** Default projection window in months. */
export const DEFAULT_PROJECTION_MONTHS = 12 as const;

/** Maximum file size for CSV/Excel imports, in bytes (10 MB). */
export const MAX_IMPORT_FILE_SIZE_BYTES = 10485760 as const;

export const SUPPORTED_IMPORT_MIME_TYPES = [
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

/** ISO 4217 currency codes supported in the app. */
export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_CURRENCY: SupportedCurrency = "USD";

/** Chart color palette used consistently across all visualisations. */
export const CHART_COLORS = {
  primary: "hsl(var(--primary))",
  revenue: "#22c55e",
  cogs: "#f97316",
  opex: "#3b82f6",
  ebitda: "#8b5cf6",
  netIncome: "#06b6d4",
  churn: "#ef4444",
  expansion: "#10b981",
  neutral: "#6b7280",
} as const;

// ---------------------------------------------------------------------------
// Board deck templates & section type definitions
// ---------------------------------------------------------------------------

export type DeckTemplateId = "standard" | "investor_update" | "fundraise_snapshot";

export interface DeckTemplate {
  id: DeckTemplateId;
  name: string;
  description: string;
  sections: string[];
}

export const DECK_TEMPLATES: DeckTemplate[] = [
  {
    id: "standard",
    name: "Standard Board Deck",
    description:
      "Full board deck covering all financial sections — suitable for quarterly board meetings.",
    sections: [
      "title_slide",
      "key_highlights",
      "financial_summary",
      "revenue_breakdown",
      "expense_breakdown",
      "saas_metrics",
      "cash_runway",
      "budget_variance",
      "asks_and_decisions",
      "appendix",
    ],
  },
  {
    id: "investor_update",
    name: "Investor Update",
    description:
      "Condensed format for monthly or quarterly investor updates. Focuses on progress and asks.",
    sections: [
      "title_slide",
      "key_highlights",
      "financial_summary",
      "saas_metrics",
      "cash_runway",
      "asks_and_decisions",
    ],
  },
  {
    id: "fundraise_snapshot",
    name: "Fundraise Snapshot",
    description:
      "Metrics-heavy deck designed for fundraising conversations — leads with traction data.",
    sections: [
      "title_slide",
      "saas_metrics",
      "revenue_breakdown",
      "cash_runway",
      "key_highlights",
    ],
  },
];

export interface SectionTypeDefinition {
  type: string;
  label: string;
  description: string;
  icon: string;
  category: "overview" | "financials" | "metrics" | "narrative";
}

export const SECTION_TYPE_DEFINITIONS: SectionTypeDefinition[] = [
  {
    type: "title_slide",
    label: "Title Slide",
    description: "Company name, presentation title, period, and date.",
    icon: "Presentation",
    category: "overview",
  },
  {
    type: "key_highlights",
    label: "Key Highlights",
    description: "Top wins, risks, and executive narrative for the period.",
    icon: "Star",
    category: "narrative",
  },
  {
    type: "financial_summary",
    label: "Financial Summary",
    description: "P&L snapshot: revenue, gross profit, EBITDA, and net income.",
    icon: "BarChart2",
    category: "financials",
  },
  {
    type: "revenue_breakdown",
    label: "Revenue Breakdown",
    description: "Revenue by stream with period-over-period trend charts.",
    icon: "TrendingUp",
    category: "financials",
  },
  {
    type: "expense_breakdown",
    label: "Expense Breakdown",
    description: "OpEx by department with budget vs. actual comparison.",
    icon: "Receipt",
    category: "financials",
  },
  {
    type: "saas_metrics",
    label: "SaaS Metrics",
    description: "ARR, MRR, churn, NRR, CAC, LTV, and growth rates.",
    icon: "Gauge",
    category: "metrics",
  },
  {
    type: "cash_runway",
    label: "Cash & Runway",
    description: "Cash balance, burn rate, and projected runway in months.",
    icon: "Wallet",
    category: "financials",
  },
  {
    type: "budget_variance",
    label: "Budget Variance",
    description: "Actuals vs. budget with variance explanations.",
    icon: "Scale",
    category: "financials",
  },
  {
    type: "asks_and_decisions",
    label: "Asks & Decisions",
    description: "Action items, decisions needed, and board approvals.",
    icon: "CheckSquare",
    category: "narrative",
  },
  {
    type: "appendix",
    label: "Appendix",
    description: "Supporting data, detailed tables, and supplementary charts.",
    icon: "FileText",
    category: "overview",
  },
];

// ---------------------------------------------------------------------------
// Due Diligence constants
// ---------------------------------------------------------------------------

export type DDCategoryId =
  | "corporate"
  | "financial"
  | "tax"
  | "legal"
  | "hr"
  | "product_tech"
  | "fundraising";

export interface DDCategoryDef {
  id: DDCategoryId;
  label: string;
  folderNumber: string;
}

export const DD_CATEGORIES: DDCategoryDef[] = [
  { id: "corporate", label: "Corporate", folderNumber: "1.0" },
  { id: "financial", label: "Financials", folderNumber: "2.0" },
  { id: "tax", label: "Tax", folderNumber: "3.0" },
  { id: "legal", label: "Legal", folderNumber: "4.0" },
  { id: "hr", label: "Human Resources", folderNumber: "5.0" },
  { id: "product_tech", label: "Product & Technology", folderNumber: "6.0" },
  { id: "fundraising", label: "Fundraising Materials", folderNumber: "7.0" },
];

export interface DataRoomFolder {
  id: string;
  label: string;
  subfolders: { id: string; label: string; requiredStages: FundingStage[] }[];
}

export const DATA_ROOM_STRUCTURE: DataRoomFolder[] = [
  {
    id: "1.0",
    label: "Corporate",
    subfolders: [
      { id: "1.1", label: "Formation Documents", requiredStages: ["seed", "series_a", "series_b", "growth"] },
      { id: "1.2", label: "Board & Stockholder Records", requiredStages: ["series_a", "series_b", "growth"] },
      { id: "1.3", label: "Prior Financing Documents", requiredStages: ["seed", "series_a", "series_b", "growth"] },
      { id: "1.4", label: "Cap Table & Equity", requiredStages: ["seed", "series_a", "series_b", "growth"] },
      { id: "1.5", label: "Corporate Governance", requiredStages: ["series_a", "series_b", "growth"] },
    ],
  },
  {
    id: "2.0",
    label: "Financials",
    subfolders: [
      { id: "2.1", label: "Historical Financial Statements", requiredStages: ["seed", "series_a", "series_b", "growth"] },
      { id: "2.2", label: "Financial Model & Projections", requiredStages: ["series_a", "series_b", "growth"] },
      { id: "2.3", label: "Revenue Detail", requiredStages: ["series_a", "series_b", "growth"] },
      { id: "2.4", label: "KPI Dashboard", requiredStages: ["series_a", "series_b", "growth"] },
      { id: "2.5", label: "Banking & Debt", requiredStages: ["series_a", "series_b", "growth"] },
    ],
  },
  {
    id: "3.0",
    label: "Tax",
    subfolders: [
      { id: "3.1", label: "Federal Returns", requiredStages: ["series_a", "series_b", "growth"] },
      { id: "3.2", label: "State Returns", requiredStages: ["series_a", "series_b", "growth"] },
      { id: "3.3", label: "Sales Tax Filings", requiredStages: ["series_b", "growth"] },
      { id: "3.4", label: "R&D Tax Credit Studies", requiredStages: ["series_b", "growth"] },
    ],
  },
  {
    id: "4.0",
    label: "Legal",
    subfolders: [
      { id: "4.1", label: "Material Contracts", requiredStages: ["series_a", "series_b", "growth"] },
      { id: "4.2", label: "Intellectual Property", requiredStages: ["seed", "series_a", "series_b", "growth"] },
      { id: "4.3", label: "Litigation", requiredStages: ["series_a", "series_b", "growth"] },
      { id: "4.4", label: "Regulatory Compliance", requiredStages: ["series_b", "growth"] },
    ],
  },
  {
    id: "5.0",
    label: "Human Resources",
    subfolders: [
      { id: "5.1", label: "Org Chart", requiredStages: ["series_a", "series_b", "growth"] },
      { id: "5.2", label: "Employee Census & Compensation", requiredStages: ["series_a", "series_b", "growth"] },
      { id: "5.3", label: "Employment Agreements", requiredStages: ["series_a", "series_b", "growth"] },
      { id: "5.4", label: "Employee Handbook", requiredStages: ["series_b", "growth"] },
      { id: "5.5", label: "Payroll Tax Filings", requiredStages: ["series_b", "growth"] },
    ],
  },
  {
    id: "6.0",
    label: "Product & Technology",
    subfolders: [
      { id: "6.1", label: "Product Roadmap", requiredStages: ["series_a", "series_b", "growth"] },
      { id: "6.2", label: "Architecture Diagram", requiredStages: ["series_b", "growth"] },
      { id: "6.3", label: "Security Documentation", requiredStages: ["series_b", "growth"] },
    ],
  },
  {
    id: "7.0",
    label: "Fundraising Materials",
    subfolders: [
      { id: "7.1", label: "Pitch Deck", requiredStages: ["seed", "series_a", "series_b", "growth"] },
      { id: "7.2", label: "Executive Summary", requiredStages: ["series_a", "series_b", "growth"] },
      { id: "7.3", label: "References", requiredStages: ["series_b", "growth"] },
    ],
  },
];

// ARR-range benchmarks from 2025 Bessemer/OpenView/KeyBanc data
export type ARRRange = "early" | "growth_stage" | "scale";

export interface ARRBenchmarkRange {
  low: number;
  median: number;
  high: number;
}

export interface ARRStageBenchmarks {
  label: string;
  arrRange: string;
  arrGrowth: ARRBenchmarkRange;
  netRevenueRetention: ARRBenchmarkRange;
  grossRevenueRetention: ARRBenchmarkRange;
  cacPaybackMonths: ARRBenchmarkRange;
  burnMultiple: ARRBenchmarkRange;
  ruleOf40: ARRBenchmarkRange;
  ltvCacRatio: ARRBenchmarkRange;
  grossMargin: ARRBenchmarkRange;
  arrPerEmployee: ARRBenchmarkRange;
}

export const ARR_BENCHMARKS: Record<ARRRange, ARRStageBenchmarks> = {
  early: {
    label: "Early Stage",
    arrRange: "$1-10M ARR",
    arrGrowth: { low: 0.80, median: 1.00, high: 1.20 },
    netRevenueRetention: { low: 1.00, median: 1.05, high: 1.10 },
    grossRevenueRetention: { low: 0.85, median: 0.88, high: 0.90 },
    cacPaybackMonths: { low: 18, median: 21, high: 24 },
    burnMultiple: { low: 1.0, median: 1.5, high: 2.0 },
    ruleOf40: { low: 0.30, median: 0.40, high: 0.50 },
    ltvCacRatio: { low: 3.0, median: 4.0, high: 5.0 },
    grossMargin: { low: 0.70, median: 0.75, high: 0.80 },
    arrPerEmployee: { low: 100_000, median: 125_000, high: 150_000 },
  },
  growth_stage: {
    label: "Growth",
    arrRange: "$10-50M ARR",
    arrGrowth: { low: 0.40, median: 0.60, high: 0.80 },
    netRevenueRetention: { low: 1.10, median: 1.15, high: 1.20 },
    grossRevenueRetention: { low: 0.88, median: 0.90, high: 0.92 },
    cacPaybackMonths: { low: 12, median: 15, high: 18 },
    burnMultiple: { low: 1.0, median: 1.25, high: 1.5 },
    ruleOf40: { low: 0.30, median: 0.35, high: 0.40 },
    ltvCacRatio: { low: 3.0, median: 4.5, high: 6.0 },
    grossMargin: { low: 0.75, median: 0.80, high: 0.85 },
    arrPerEmployee: { low: 150_000, median: 175_000, high: 200_000 },
  },
  scale: {
    label: "Scale",
    arrRange: "$50M+ ARR",
    arrGrowth: { low: 0.30, median: 0.40, high: 0.50 },
    netRevenueRetention: { low: 1.20, median: 1.25, high: 1.30 },
    grossRevenueRetention: { low: 0.90, median: 0.93, high: 0.95 },
    cacPaybackMonths: { low: 10, median: 12, high: 14 },
    burnMultiple: { low: 0.5, median: 0.75, high: 1.0 },
    ruleOf40: { low: 0.40, median: 0.50, high: 0.60 },
    ltvCacRatio: { low: 5.0, median: 7.0, high: 10.0 },
    grossMargin: { low: 0.75, median: 0.83, high: 0.90 },
    arrPerEmployee: { low: 200_000, median: 250_000, high: 300_000 },
  },
};

// Materiality thresholds by stage for red flag detection
export interface MaterialityThresholds {
  revenueOverstatementDealKiller: number;
  undisclosedLiabilityThreshold: number;
  customerConcentrationWarning: number;
  customerConcentrationCritical: number;
  ltvCacMinimum: number;
  paybackMaxMonths: number;
  burnMultipleMax: number;
}

export const MATERIALITY_THRESHOLDS: Record<string, MaterialityThresholds> = {
  seed: {
    revenueOverstatementDealKiller: 0.50,
    undisclosedLiabilityThreshold: 25_000,
    customerConcentrationWarning: 0.40,
    customerConcentrationCritical: 0.60,
    ltvCacMinimum: 1.0,
    paybackMaxMonths: 36,
    burnMultipleMax: 3.0,
  },
  series_a: {
    revenueOverstatementDealKiller: 0.20,
    undisclosedLiabilityThreshold: 50_000,
    customerConcentrationWarning: 0.30,
    customerConcentrationCritical: 0.50,
    ltvCacMinimum: 2.0,
    paybackMaxMonths: 24,
    burnMultipleMax: 2.0,
  },
  series_b: {
    revenueOverstatementDealKiller: 0.10,
    undisclosedLiabilityThreshold: 100_000,
    customerConcentrationWarning: 0.25,
    customerConcentrationCritical: 0.40,
    ltvCacMinimum: 3.0,
    paybackMaxMonths: 18,
    burnMultipleMax: 1.5,
  },
  growth: {
    revenueOverstatementDealKiller: 0.10,
    undisclosedLiabilityThreshold: 250_000,
    customerConcentrationWarning: 0.20,
    customerConcentrationCritical: 0.30,
    ltvCacMinimum: 3.0,
    paybackMaxMonths: 14,
    burnMultipleMax: 1.0,
  },
};

// QoE adjustment type definitions
export const QOE_ADJUSTMENT_TYPES = [
  { value: "non_recurring", label: "Non-Recurring", description: "One-time legal fees, PPP loan forgiveness, etc." },
  { value: "non_operating", label: "Non-Operating", description: "Investment income/loss, asset sale gains" },
  { value: "out_of_period", label: "Out-of-Period", description: "Year-end true-ups reallocated to proper months" },
  { value: "owner_discretionary", label: "Owner Discretionary", description: "Personal auto, meals, family on payroll" },
  { value: "related_party", label: "Related Party", description: "Related-party transactions adjusted to FMV" },
  { value: "run_rate", label: "Run-Rate", description: "Annualize recent hires, new contracts, price changes" },
] as const;

// FDD report section definitions
export const FDD_REPORT_SECTIONS = [
  { id: "executive_summary", label: "Executive Summary", description: "Scope, risk rating, top findings, recommendation" },
  { id: "company_background", label: "Company Background", description: "Corporate history, ownership, business model" },
  { id: "financial_analysis", label: "Financial Analysis", description: "P&L trending, revenue quality, cost structure" },
  { id: "revenue_analysis", label: "Revenue Analysis", description: "Concentration, cohorts, churn, recognition" },
  { id: "cost_structure", label: "Cost Structure", description: "COGS, gross margin, OpEx by category" },
  { id: "cash_flow_runway", label: "Cash Flow & Runway", description: "Burn rate, cash projections, working capital" },
  { id: "unit_economics", label: "Unit Economics", description: "CAC, LTV, payback, efficiency metrics" },
  { id: "tax_review", label: "Tax Review", description: "Compliance, exposures, structuring" },
  { id: "cap_table_equity", label: "Cap Table & Equity", description: "Ownership, dilution, ESOP, 409A" },
  { id: "risk_recommendations", label: "Risk Assessment & Recommendations", description: "Findings matrix, conditions, remediation" },
] as const;

// Deal-killer criteria
export const DEAL_KILLERS = [
  "Fraud or intentional misrepresentation",
  "Unresolvable IP ownership issues",
  "Active material litigation",
  "Regulatory non-compliance in regulated industries",
  "Founder integrity issues",
  "Revenue misstatement exceeding stage-appropriate threshold",
  "Missing or commingled funds",
] as const;

// Severity colors for UI
export const SEVERITY_CONFIG = {
  critical: { label: "Critical", color: "#ef4444", bgColor: "#fef2f2", borderColor: "#fecaca" },
  significant: { label: "Significant", color: "#f97316", bgColor: "#fff7ed", borderColor: "#fed7aa" },
  moderate: { label: "Moderate", color: "#eab308", bgColor: "#fefce8", borderColor: "#fef08a" },
  observation: { label: "Observation", color: "#6b7280", bgColor: "#f9fafb", borderColor: "#e5e7eb" },
} as const;
