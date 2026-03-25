/**
 * Schema helpers for the PromptForge three-statement financial model.
 *
 * Ported from promptforge/schema.py.
 */

import type { FinancialModel } from "./types";

// ---------------------------------------------------------------------------
// OUTPUT_SCHEMA_DESCRIPTION — key lists for each statement
// ---------------------------------------------------------------------------

export const OUTPUT_SCHEMA_DESCRIPTION = {
  company_info: {
    name: "str",
    stage: "str  // seed | series_a | series_b | series_c_plus",
    sector: "str",
    currency: "str  // ISO 4217, e.g. USD",
    units: "str  // thousands | millions",
  },
  periods: {
    historical: ["str  // e.g. FY2022, FY2023"],
    projected: ["str  // e.g. Y1, Y2, Y3, Y4, Y5"],
  },

  // INCOME STATEMENT
  income_statement: {
    revenue: "PeriodValues  // positive",
    cogs: "PeriodValues  // negative",
    gross_profit: "PeriodValues  // = revenue + cogs",
    rd_expense: "PeriodValues  // negative",
    sm_expense: "PeriodValues  // negative",
    ga_expense: "PeriodValues  // negative",
    sbc_expense: "PeriodValues  // negative (non-cash)",
    total_opex: "PeriodValues  // negative",
    ebit: "PeriodValues  // = gross_profit + total_opex",
    da_expense: "PeriodValues  // negative (non-cash, may be embedded in opex)",
    ebitda: "PeriodValues  // = ebit - da_expense (da is negative so ebitda > ebit)",
    interest_expense: "PeriodValues  // negative",
    interest_income: "PeriodValues  // positive",
    other_income_expense: "PeriodValues",
    ebt: "PeriodValues  // = ebit + interest_expense + interest_income + other",
    tax_expense: "PeriodValues  // negative (or zero/positive if benefit)",
    net_income: "PeriodValues  // = ebt + tax_expense",
  },

  // BALANCE SHEET
  balance_sheet: {
    cash: "PeriodValues  // = CFS ending_cash",
    accounts_receivable: "PeriodValues",
    inventory: "PeriodValues",
    prepaid_expenses: "PeriodValues",
    other_current_assets: "PeriodValues",
    total_current_assets: "PeriodValues",
    gross_ppe: "PeriodValues",
    accumulated_depreciation: "PeriodValues  // negative contra-asset",
    net_ppe: "PeriodValues  // = gross_ppe + accumulated_depreciation",
    goodwill: "PeriodValues",
    intangible_assets: "PeriodValues",
    other_noncurrent_assets: "PeriodValues",
    total_assets: "PeriodValues",
    accounts_payable: "PeriodValues",
    accrued_liabilities: "PeriodValues",
    deferred_revenue: "PeriodValues",
    short_term_debt: "PeriodValues",
    current_portion_ltd: "PeriodValues",
    other_current_liabilities: "PeriodValues",
    total_current_liabilities: "PeriodValues",
    long_term_debt: "PeriodValues",
    revolver_balance: "PeriodValues",
    deferred_tax_liability: "PeriodValues",
    other_noncurrent_liabilities: "PeriodValues",
    total_liabilities: "PeriodValues",
    common_stock: "PeriodValues",
    apic: "PeriodValues",
    retained_earnings: "PeriodValues",
    treasury_stock: "PeriodValues  // negative contra-equity",
    aoci: "PeriodValues",
    other_equity: "PeriodValues  // SAFE notes, owner contributions, convertible instruments",
    total_equity: "PeriodValues",
  },

  // CASH FLOW STATEMENT
  cash_flow_statement: {
    cf_net_income: "PeriodValues  // = IS net_income",
    cf_da_addback: "PeriodValues  // positive (reverses IS da_expense)",
    cf_sbc_addback: "PeriodValues  // positive (reverses IS sbc_expense)",
    cf_deferred_tax: "PeriodValues",
    cf_other_noncash: "PeriodValues",
    cf_change_ar: "PeriodValues  // -(AR_t - AR_t-1)",
    cf_change_inventory: "PeriodValues  // -(Inv_t - Inv_t-1)",
    cf_change_prepaid: "PeriodValues  // -(Prepaid_t - Prepaid_t-1)",
    cf_change_ap: "PeriodValues  // +(AP_t - AP_t-1)",
    cf_change_accrued_liab: "PeriodValues  // +(AccLiab_t - AccLiab_t-1)",
    cf_change_deferred_rev: "PeriodValues  // +(DefRev_t - DefRev_t-1)",
    cf_other_wc: "PeriodValues",
    cfo_total: "PeriodValues",
    cf_capex: "PeriodValues  // negative",
    cf_acquisitions: "PeriodValues  // negative",
    cf_proceeds_asset_sales: "PeriodValues  // positive",
    cf_other_investing: "PeriodValues",
    cfi_total: "PeriodValues",
    cf_debt_issuance: "PeriodValues  // positive",
    cf_debt_repayment: "PeriodValues  // negative",
    cf_revolver_net: "PeriodValues  // draw positive, repay negative",
    cf_equity_issuance: "PeriodValues  // positive",
    cf_share_repurchases: "PeriodValues  // negative",
    cf_dividends_paid: "PeriodValues  // negative",
    cf_other_financing: "PeriodValues",
    cff_total: "PeriodValues",
    cf_fx_effect: "PeriodValues",
    net_change_cash: "PeriodValues  // = cfo + cfi + cff + fx",
    beginning_cash: "PeriodValues",
    ending_cash: "PeriodValues  // = beginning + net_change; must = BS cash",
  },

  // ASSUMPTIONS
  assumptions: {
    revenue_growth_pct: "PeriodValues",
    gross_margin_pct: "PeriodValues",
    rd_pct_revenue: "PeriodValues",
    sm_pct_revenue: "PeriodValues",
    ga_pct_revenue: "PeriodValues",
    da_pct_revenue: "PeriodValues",
    dso_days: "PeriodValues",
    dio_days: "PeriodValues",
    dpo_days: "PeriodValues",
    capex_pct_revenue: "PeriodValues",
    effective_tax_rate: "PeriodValues",
    interest_rate: "PeriodValues",
  },
} as const;

// ---------------------------------------------------------------------------
// Helper functions (ported from schema.py)
// ---------------------------------------------------------------------------

/** Return ordered list of all period labels (historical + projected). */
export function getAllPeriods(model: FinancialModel): string[] {
  return [
    ...(model.periods?.historical ?? []),
    ...(model.periods?.projected ?? []),
  ];
}

/** Return just the projected period labels. */
export function getProjectedPeriods(model: FinancialModel): string[] {
  return model.periods?.projected ?? [];
}

/**
 * Safely extract a single value from the model output.
 * Returns null if the path doesn't exist.
 */
export function getValue(
  model: FinancialModel,
  statement: keyof Omit<FinancialModel, "company_info" | "periods" | "revenue_build" | "expense_build">,
  lineItem: string,
  period: string,
): number | null {
  const stmt = model[statement] as unknown as Record<string, Record<string, number | null>> | undefined;
  if (!stmt) return null;
  const item = stmt[lineItem];
  if (item == null || typeof item !== "object") return null;
  const val = item[period];
  return val ?? null;
}
