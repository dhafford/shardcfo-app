/**
 * Post-processor: deterministic reconciliation engine.
 *
 * After the LLM generates a three-statement model, this module enforces
 * the DAG ordering (IS → CFS → BS) and fixes systematic errors that LLMs
 * structurally cannot guarantee.
 *
 * Ported from promptforge/postprocessor.py.
 *
 * Pass 1:  Fix IS subtotals (GP, EBIT, EBITDA, EBT, tax clamp, NI)
 * Pass 2:  Fix CFS links from IS (cf_net_income, cf_da_addback, cf_sbc_addback)
 * Pass 3:  Fix working capital deltas from BS
 * Pass 4:  Fix CFS section totals (CFO, CFI, CFF, net_change)
 * Pass 5:  Cash continuity + ending cash
 * Pass 6:  BS cash = CFS ending cash (THE PLUG)
 * Pass 7:  RE roll-forward
 * Pass 8:  BS subtotals (Net PPE, TCA, TA, TCL, TL, TE)
 * Pass 9:  Balance sheet plug via other_equity
 */

import type { FinancialModel } from "./types";
import { getAllPeriods, getValue } from "./schema";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type StatementKey = keyof Omit<FinancialModel, "company_info" | "periods" | "revenue_build" | "expense_build">;

/** Set a value in the model, creating nested structure as needed. */
function _set(
  model: FinancialModel,
  statement: StatementKey,
  lineItem: string,
  period: string,
  value: number,
): void {
  const stmt = model[statement] as unknown as Record<string, Record<string, number | null>>;
  if (!stmt[lineItem]) {
    stmt[lineItem] = {};
  }
  stmt[lineItem][period] = Math.round(value * 100) / 100;
}

/** Get a value from the model, returning 0 if missing or null. */
function _v(
  model: FinancialModel,
  statement: StatementKey,
  lineItem: string,
  period: string,
): number {
  const val = getValue(model, statement, lineItem, period);
  return val !== null ? Number(val) : 0;
}

// ---------------------------------------------------------------------------
// Main reconcile function
// ---------------------------------------------------------------------------

/**
 * Apply deterministic reconciliation to a generated model.
 *
 * Enforces the DAG: IS → CFS → BS, with cash solved last.
 * Deep-clones the model first, then modifies and returns the clone.
 */
export function reconcile(model: FinancialModel): FinancialModel {
  // Deep clone to avoid mutating the original
  const m: FinancialModel = JSON.parse(JSON.stringify(model));

  const periods = getAllPeriods(m);
  if (periods.length === 0) {
    return m;
  }

  // ── PASS 1: Fix IS subtotals ─────────────────────────────────────────────
  for (const p of periods) {
    const rev = _v(m, "income_statement", "revenue", p);
    const cogs = _v(m, "income_statement", "cogs", p);
    _set(m, "income_statement", "gross_profit", p, rev + cogs);

    const gp = _v(m, "income_statement", "gross_profit", p);
    const opex = _v(m, "income_statement", "total_opex", p);
    const da = _v(m, "income_statement", "da_expense", p);

    // EBIT = Gross Profit + Total OpEx (opex is negative)
    const ebit = gp + opex;
    _set(m, "income_statement", "ebit", p, ebit);

    // EBITDA = EBIT - DA (DA is negative, so EBIT - (-|DA|) = EBIT + |DA|)
    _set(m, "income_statement", "ebitda", p, ebit - da);

    // EBT = EBIT + interest_expense + interest_income + other
    const intExp = _v(m, "income_statement", "interest_expense", p);
    const intInc = _v(m, "income_statement", "interest_income", p);
    const other = _v(m, "income_statement", "other_income_expense", p);
    const ebt = ebit + intExp + intInc + other;
    _set(m, "income_statement", "ebt", p, ebt);

    // Tax clamp: if EBT < 0, tax must be 0 (or positive benefit), not negative
    let tax = _v(m, "income_statement", "tax_expense", p);
    if (ebt < 0 && tax < 0) {
      tax = 0;
      _set(m, "income_statement", "tax_expense", p, 0);
    }

    // Net Income = EBT + Tax (tax is negative for expense)
    _set(m, "income_statement", "net_income", p, ebt + tax);
  }

  // ── PASS 2: Fix CFS links from IS ────────────────────────────────────────
  for (const p of periods) {
    const ni = _v(m, "income_statement", "net_income", p);
    _set(m, "cash_flow_statement", "cf_net_income", p, ni);

    // D&A addback = |IS D&A| (positive on CFS)
    const da = _v(m, "income_statement", "da_expense", p);
    _set(m, "cash_flow_statement", "cf_da_addback", p, Math.abs(da));

    // SBC addback = |IS SBC| (positive on CFS)
    const sbc = _v(m, "income_statement", "sbc_expense", p);
    _set(m, "cash_flow_statement", "cf_sbc_addback", p, Math.abs(sbc));
  }

  // ── PASS 3: Fix working capital deltas from BS ────────────────────────────
  for (let i = 0; i < periods.length; i++) {
    if (i === 0) continue;
    const p = periods[i];
    const prev = periods[i - 1];

    // Assets: increase = use of cash = negative on CFS
    const assetLinks: Array<[string, string]> = [
      ["accounts_receivable", "cf_change_ar"],
      ["inventory", "cf_change_inventory"],
      ["prepaid_expenses", "cf_change_prepaid"],
    ];
    for (const [asset, cfItem] of assetLinks) {
      const curr = _v(m, "balance_sheet", asset, p);
      const prevVal = _v(m, "balance_sheet", asset, prev);
      _set(m, "cash_flow_statement", cfItem, p, -(curr - prevVal));
    }

    // Liabilities: increase = source of cash = positive on CFS
    const liabLinks: Array<[string, string]> = [
      ["accounts_payable", "cf_change_ap"],
      ["accrued_liabilities", "cf_change_accrued_liab"],
      ["deferred_revenue", "cf_change_deferred_rev"],
    ];
    for (const [liab, cfItem] of liabLinks) {
      const curr = _v(m, "balance_sheet", liab, p);
      const prevVal = _v(m, "balance_sheet", liab, prev);
      _set(m, "cash_flow_statement", cfItem, p, curr - prevVal);
    }
  }

  // ── PASS 4: Fix CFS section totals ───────────────────────────────────────
  for (const p of periods) {
    // CFO total
    const cfoItems = [
      "cf_net_income", "cf_da_addback", "cf_sbc_addback",
      "cf_deferred_tax", "cf_other_noncash",
      "cf_change_ar", "cf_change_inventory", "cf_change_prepaid",
      "cf_change_ap", "cf_change_accrued_liab", "cf_change_deferred_rev",
      "cf_other_wc",
    ];
    const cfo = cfoItems.reduce((sum, item) => sum + _v(m, "cash_flow_statement", item, p), 0);
    _set(m, "cash_flow_statement", "cfo_total", p, cfo);

    // CFI total
    const cfiItems = ["cf_capex", "cf_acquisitions", "cf_proceeds_asset_sales", "cf_other_investing"];
    const cfi = cfiItems.reduce((sum, item) => sum + _v(m, "cash_flow_statement", item, p), 0);
    _set(m, "cash_flow_statement", "cfi_total", p, cfi);

    // CFF total
    const cffItems = [
      "cf_debt_issuance", "cf_debt_repayment", "cf_revolver_net",
      "cf_equity_issuance", "cf_share_repurchases", "cf_dividends_paid",
      "cf_other_financing",
    ];
    const cff = cffItems.reduce((sum, item) => sum + _v(m, "cash_flow_statement", item, p), 0);
    _set(m, "cash_flow_statement", "cff_total", p, cff);

    // Net change in cash
    const fx = _v(m, "cash_flow_statement", "cf_fx_effect", p);
    _set(m, "cash_flow_statement", "net_change_cash", p, cfo + cfi + cff + fx);
  }

  // ── PASS 5: Cash continuity + ending cash ────────────────────────────────
  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    let beg: number;

    if (i === 0) {
      // First period: use whatever beginning cash the LLM provided
      beg = _v(m, "cash_flow_statement", "beginning_cash", p);
    } else {
      // Beginning cash = prior period ending cash
      const prev = periods[i - 1];
      beg = _v(m, "cash_flow_statement", "ending_cash", prev);
      _set(m, "cash_flow_statement", "beginning_cash", p, beg);
    }

    const netChange = _v(m, "cash_flow_statement", "net_change_cash", p);
    _set(m, "cash_flow_statement", "ending_cash", p, beg + netChange);
  }

  // ── PASS 6: BS cash = CFS ending cash (THE PLUG) ─────────────────────────
  for (const p of periods) {
    const endingCash = _v(m, "cash_flow_statement", "ending_cash", p);
    _set(m, "balance_sheet", "cash", p, endingCash);
  }

  // ── PASS 7: RE roll-forward ───────────────────────────────────────────────
  for (let i = 0; i < periods.length; i++) {
    if (i === 0) continue;
    const p = periods[i];
    const prev = periods[i - 1];
    const rePrev = _v(m, "balance_sheet", "retained_earnings", prev);
    const ni = _v(m, "income_statement", "net_income", p);
    const divs = Math.abs(_v(m, "cash_flow_statement", "cf_dividends_paid", p));
    _set(m, "balance_sheet", "retained_earnings", p, rePrev + ni - divs);
  }

  // ── PASS 8: BS subtotals ─────────────────────────────────────────────────
  for (const p of periods) {
    // Net PPE = Gross PPE + Accumulated Depreciation (accum_dep is negative)
    const grossPpe = _v(m, "balance_sheet", "gross_ppe", p);
    const accumDep = _v(m, "balance_sheet", "accumulated_depreciation", p);
    _set(m, "balance_sheet", "net_ppe", p, grossPpe + accumDep);

    // Total current assets
    const caItems = ["cash", "accounts_receivable", "inventory", "prepaid_expenses", "other_current_assets"];
    const tca = caItems.reduce((sum, item) => sum + _v(m, "balance_sheet", item, p), 0);
    _set(m, "balance_sheet", "total_current_assets", p, tca);

    // Total assets
    const ncaItems = ["net_ppe", "goodwill", "intangible_assets", "other_noncurrent_assets"];
    const nca = ncaItems.reduce((sum, item) => sum + _v(m, "balance_sheet", item, p), 0);
    _set(m, "balance_sheet", "total_assets", p, tca + nca);

    // Total current liabilities
    const clItems = [
      "accounts_payable", "accrued_liabilities", "deferred_revenue",
      "short_term_debt", "current_portion_ltd", "other_current_liabilities",
    ];
    const tcl = clItems.reduce((sum, item) => sum + _v(m, "balance_sheet", item, p), 0);
    _set(m, "balance_sheet", "total_current_liabilities", p, tcl);

    // Total liabilities
    const nclItems = ["long_term_debt", "revolver_balance", "deferred_tax_liability", "other_noncurrent_liabilities"];
    const ncl = nclItems.reduce((sum, item) => sum + _v(m, "balance_sheet", item, p), 0);
    _set(m, "balance_sheet", "total_liabilities", p, tcl + ncl);

    // Total equity (raw, before plug)
    const eqItems = ["common_stock", "apic", "retained_earnings", "treasury_stock", "aoci", "other_equity"];
    const teRaw = eqItems.reduce((sum, item) => sum + _v(m, "balance_sheet", item, p), 0);

    // ── PASS 9: Balance sheet plug via other_equity ──────────────────────
    // A = L + E must hold. Adjust other_equity to close any gap.
    const ta = _v(m, "balance_sheet", "total_assets", p);
    const tl = _v(m, "balance_sheet", "total_liabilities", p);
    const requiredEquity = ta - tl;
    const gap = requiredEquity - teRaw;

    let te: number;
    if (Math.abs(gap) > 0.01) {
      const currentOtherEq = _v(m, "balance_sheet", "other_equity", p);
      _set(m, "balance_sheet", "other_equity", p, currentOtherEq + gap);
      te = requiredEquity;
    } else {
      te = teRaw;
    }

    _set(m, "balance_sheet", "total_equity", p, te);
  }

  return m;
}
