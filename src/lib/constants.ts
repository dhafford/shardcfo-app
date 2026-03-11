/**
 * App-wide constants for ShardCFO.
 *
 * Includes SaaS benchmark data by funding stage and metric definitions
 * used across the UI for labels, units, and display logic.
 */

// ---------------------------------------------------------------------------
// Stage benchmarks
// ---------------------------------------------------------------------------

export type FundingStage = "seed" | "series_a" | "series_b" | "growth";

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
  { value: "seed", label: "Seed" },
  { value: "series_a", label: "Series A" },
  { value: "series_b", label: "Series B" },
  { value: "growth", label: "Growth" },
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
