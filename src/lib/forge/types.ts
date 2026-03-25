/**
 * TypeScript types for the PromptForge three-statement financial model.
 *
 * Sign conventions (baked into the schema):
 *   IS:  Revenues/gains positive. Expenses/losses NEGATIVE.
 *   BS:  Assets positive. Liabilities positive. Equity positive.
 *        Contra accounts (accum. depreciation, treasury stock) NEGATIVE.
 *   CFS: Inflows positive. Outflows NEGATIVE.
 */

// ---------------------------------------------------------------------------
// Primitive type
// ---------------------------------------------------------------------------

/** Every line item maps period labels to numeric values (or null if missing). */
export type PeriodValues = Record<string, number | null>;

// ---------------------------------------------------------------------------
// Company metadata
// ---------------------------------------------------------------------------

export interface CompanyInfo {
  name: string;
  /** seed | series_a | series_b | series_c_plus */
  stage: string;
  sector: string;
  /** ISO 4217, e.g. USD */
  currency: string;
  /** thousands | millions | ones */
  units: string;
}

// ---------------------------------------------------------------------------
// Period labels
// ---------------------------------------------------------------------------

export interface Periods {
  /** e.g. ["FY2022", "FY2023"] */
  historical: string[];
  /** e.g. ["Y1", "Y2", "Y3", "Y4", "Y5"] */
  projected: string[];
}

// ---------------------------------------------------------------------------
// Income Statement
// ---------------------------------------------------------------------------

export interface IncomeStatement {
  /** positive */
  revenue: PeriodValues;
  /** negative */
  cogs: PeriodValues;
  /** = revenue + cogs */
  gross_profit: PeriodValues;
  /** negative */
  rd_expense: PeriodValues;
  /** negative */
  sm_expense: PeriodValues;
  /** negative */
  ga_expense: PeriodValues;
  /** negative (non-cash) */
  sbc_expense: PeriodValues;
  /** negative */
  total_opex: PeriodValues;
  /** = gross_profit + total_opex */
  ebit: PeriodValues;
  /** negative (non-cash, may be embedded in opex) */
  da_expense: PeriodValues;
  /** = ebit - da_expense (da is negative so ebitda > ebit) */
  ebitda: PeriodValues;
  /** negative */
  interest_expense: PeriodValues;
  /** positive */
  interest_income: PeriodValues;
  other_income_expense: PeriodValues;
  /** = ebit + interest_expense + interest_income + other */
  ebt: PeriodValues;
  /** negative (or zero/positive if benefit) */
  tax_expense: PeriodValues;
  /** = ebt + tax_expense */
  net_income: PeriodValues;
}

// ---------------------------------------------------------------------------
// Balance Sheet
// ---------------------------------------------------------------------------

export interface BalanceSheet {
  // Assets
  /** = CFS ending_cash */
  cash: PeriodValues;
  accounts_receivable: PeriodValues;
  inventory: PeriodValues;
  prepaid_expenses: PeriodValues;
  other_current_assets: PeriodValues;
  total_current_assets: PeriodValues;
  gross_ppe: PeriodValues;
  /** negative contra-asset */
  accumulated_depreciation: PeriodValues;
  /** = gross_ppe + accumulated_depreciation */
  net_ppe: PeriodValues;
  goodwill: PeriodValues;
  intangible_assets: PeriodValues;
  other_noncurrent_assets: PeriodValues;
  total_assets: PeriodValues;

  // Liabilities
  accounts_payable: PeriodValues;
  accrued_liabilities: PeriodValues;
  deferred_revenue: PeriodValues;
  short_term_debt: PeriodValues;
  current_portion_ltd: PeriodValues;
  other_current_liabilities: PeriodValues;
  total_current_liabilities: PeriodValues;
  long_term_debt: PeriodValues;
  revolver_balance: PeriodValues;
  deferred_tax_liability: PeriodValues;
  other_noncurrent_liabilities: PeriodValues;
  total_liabilities: PeriodValues;

  // Equity
  common_stock: PeriodValues;
  apic: PeriodValues;
  retained_earnings: PeriodValues;
  /** negative contra-equity */
  treasury_stock: PeriodValues;
  aoci: PeriodValues;
  /** SAFE notes, owner contributions, convertible instruments */
  other_equity: PeriodValues;
  total_equity: PeriodValues;
}

// ---------------------------------------------------------------------------
// Cash Flow Statement
// ---------------------------------------------------------------------------

export interface CashFlowStatement {
  // CFO — Operating Activities
  /** = IS net_income */
  cf_net_income: PeriodValues;
  /** positive (reverses IS da_expense) */
  cf_da_addback: PeriodValues;
  /** positive (reverses IS sbc_expense) */
  cf_sbc_addback: PeriodValues;
  cf_deferred_tax: PeriodValues;
  cf_other_noncash: PeriodValues;
  /** -(AR_t - AR_t-1) */
  cf_change_ar: PeriodValues;
  /** -(Inv_t - Inv_t-1) */
  cf_change_inventory: PeriodValues;
  /** -(Prepaid_t - Prepaid_t-1) */
  cf_change_prepaid: PeriodValues;
  /** +(AP_t - AP_t-1) */
  cf_change_ap: PeriodValues;
  /** +(AccLiab_t - AccLiab_t-1) */
  cf_change_accrued_liab: PeriodValues;
  /** +(DefRev_t - DefRev_t-1) */
  cf_change_deferred_rev: PeriodValues;
  cf_other_wc: PeriodValues;
  cfo_total: PeriodValues;

  // CFI — Investing Activities
  /** negative */
  cf_capex: PeriodValues;
  /** negative */
  cf_acquisitions: PeriodValues;
  /** positive */
  cf_proceeds_asset_sales: PeriodValues;
  cf_other_investing: PeriodValues;
  cfi_total: PeriodValues;

  // CFF — Financing Activities
  /** positive */
  cf_debt_issuance: PeriodValues;
  /** negative */
  cf_debt_repayment: PeriodValues;
  /** draw positive, repay negative */
  cf_revolver_net: PeriodValues;
  /** positive */
  cf_equity_issuance: PeriodValues;
  /** negative */
  cf_share_repurchases: PeriodValues;
  /** negative */
  cf_dividends_paid: PeriodValues;
  cf_other_financing: PeriodValues;
  cff_total: PeriodValues;

  // Reconciliation
  cf_fx_effect: PeriodValues;
  /** = cfo + cfi + cff + fx */
  net_change_cash: PeriodValues;
  beginning_cash: PeriodValues;
  /** = beginning + net_change; must = BS cash */
  ending_cash: PeriodValues;
}

// ---------------------------------------------------------------------------
// Assumptions
// ---------------------------------------------------------------------------

export interface Assumptions {
  revenue_growth_pct: PeriodValues;
  gross_margin_pct: PeriodValues;
  rd_pct_revenue: PeriodValues;
  sm_pct_revenue: PeriodValues;
  ga_pct_revenue: PeriodValues;
  da_pct_revenue: PeriodValues;
  dso_days: PeriodValues;
  dio_days: PeriodValues;
  dpo_days: PeriodValues;
  capex_pct_revenue: PeriodValues;
  effective_tax_rate: PeriodValues;
  interest_rate: PeriodValues;
}

// ---------------------------------------------------------------------------
// Top-level model
// ---------------------------------------------------------------------------

export interface FinancialModel {
  company_info: CompanyInfo;
  periods: Periods;
  income_statement: IncomeStatement;
  balance_sheet: BalanceSheet;
  cash_flow_statement: CashFlowStatement;
  assumptions: Assumptions;
  /** Optional revenue build schedule (ARR waterfall, volume × price, etc.) */
  revenue_build?: Record<string, unknown>;
  /** Optional expense build schedule by category */
  expense_build?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Validation result types
// ---------------------------------------------------------------------------

export type Severity = "critical" | "error" | "warning";

export interface CheckResult {
  check_id: string;
  passed: boolean;
  severity: Severity;
  message: string;
  period?: string;
  expected?: number;
  actual?: number;
}

export interface ValidationReport {
  results: CheckResult[];
  total: number;
  passed: number;
  failed: number;
  score: number;
  weighted_score: number;
  critical_failures: CheckResult[];
  error_failures: CheckResult[];
  warning_failures: CheckResult[];
  summary(): string;
  failure_report_for_refiner(): string;
}
