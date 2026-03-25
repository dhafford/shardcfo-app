/**
 * Validation engine for three-statement financial models.
 *
 * Ported from promptforge/validator.py.
 *
 * Implements all diagnostic checks, constraint validations, and inter-statement
 * link verifications from the rulebook. Each check is a pure function that takes
 * the FinancialModel and returns an array of CheckResults.
 */

import type { CheckResult, FinancialModel, Severity } from "./types";
import { getAllPeriods, getProjectedPeriods, getValue } from "./schema";

// ---------------------------------------------------------------------------
// Config constants (inlined from config.py)
// ---------------------------------------------------------------------------

export const CRITICAL: Severity = "critical";
export const ERROR: Severity = "error";
export const WARNING: Severity = "warning";

export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 10,
  error: 3,
  warning: 1,
};

export const TOLERANCE = 0.5;

export const TOLERANCE_BY_UNITS: Record<string, number> = {
  thousands: 0.5,
  millions: 0.01,
  ones: 1.0,
};

// ---------------------------------------------------------------------------
// ValidationReport class
// ---------------------------------------------------------------------------

export class ValidationReport {
  results: CheckResult[];

  constructor(results: CheckResult[] = []) {
    this.results = results;
  }

  get total(): number {
    return this.results.length;
  }

  get passed(): number {
    return this.results.filter((r) => r.passed).length;
  }

  get failed(): number {
    return this.total - this.passed;
  }

  /** Unweighted score (backward compat). Passed / total. */
  get score(): number {
    if (this.total === 0) return 0.0;
    return this.passed / this.total;
  }

  /**
   * Severity-weighted score — the real optimization signal.
   *
   * Sum of weights for passing checks / sum of weights for all checks.
   * CRITICAL checks dominate: one CRITICAL failure tanks the score.
   */
  get weighted_score(): number {
    if (this.total === 0) return 0.0;
    const totalWeight = this.results.reduce(
      (acc, r) => acc + (SEVERITY_WEIGHTS[r.severity] ?? 1),
      0,
    );
    const passingWeight = this.results
      .filter((r) => r.passed)
      .reduce((acc, r) => acc + (SEVERITY_WEIGHTS[r.severity] ?? 1), 0);
    return totalWeight > 0 ? passingWeight / totalWeight : 0.0;
  }

  get critical_failures(): CheckResult[] {
    return this.results.filter((r) => !r.passed && r.severity === CRITICAL);
  }

  get error_failures(): CheckResult[] {
    return this.results.filter((r) => !r.passed && r.severity === ERROR);
  }

  get warning_failures(): CheckResult[] {
    return this.results.filter((r) => !r.passed && r.severity === WARNING);
  }

  summary(): string {
    const pct = (this.score * 100).toFixed(1);
    const wpct = (this.weighted_score * 100).toFixed(1);
    const lines: string[] = [
      `Score: ${this.passed}/${this.total} (${pct}%) | Weighted: ${wpct}%`,
      `  Critical failures: ${this.critical_failures.length}`,
      `  Error failures:    ${this.error_failures.length}`,
      `  Warnings:          ${this.warning_failures.length}`,
    ];

    if (this.critical_failures.length > 0) {
      lines.push("\nCritical failures:");
      for (const r of this.critical_failures) {
        const p = r.period ? ` [${r.period}]` : "";
        lines.push(`  ${r.check_id}${p}: ${r.message}`);
      }
    }
    if (this.error_failures.length > 0) {
      lines.push("\nError failures:");
      for (const r of this.error_failures) {
        const p = r.period ? ` [${r.period}]` : "";
        lines.push(`  ${r.check_id}${p}: ${r.message}`);
      }
    }
    return lines.join("\n");
  }

  /** Structured failure report optimized for the prompt refiner LLM. */
  failure_report_for_refiner(): string {
    const failures = this.results.filter((r) => !r.passed);
    if (failures.length === 0) return "ALL CHECKS PASSED.";

    const pct = (this.score * 100).toFixed(1);
    const wpct = (this.weighted_score * 100).toFixed(1);
    const lines: string[] = [
      `VALIDATION SCORE: ${this.passed}/${this.total} (${pct}%)`,
      `WEIGHTED SCORE: ${wpct}%`,
      "",
      "FAILED CHECKS (ordered by severity):",
      "",
    ];

    const sorted = [...failures].sort((a, b) => {
      const severityOrder = (s: Severity) =>
        s === CRITICAL ? 0 : s === ERROR ? 1 : 2;
      const diff = severityOrder(a.severity) - severityOrder(b.severity);
      if (diff !== 0) return diff;
      return a.check_id.localeCompare(b.check_id);
    });

    for (const r of sorted) {
      const p = r.period ? ` in period ${r.period}` : "";
      const exp = r.expected != null ? ` | expected=${r.expected}` : "";
      const act = r.actual != null ? ` | actual=${r.actual}` : "";
      lines.push(
        `  [${r.severity.toUpperCase()}] ${r.check_id}${p}: ${r.message}${exp}${act}`,
      );
    }

    return lines.join("\n");
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get tolerance scaled to the model's units. */
function _getTolerance(model: FinancialModel): number {
  const units = model.company_info?.units ?? "thousands";
  return TOLERANCE_BY_UNITS[units] ?? TOLERANCE;
}

/** Get value from model, defaulting to 0.0 if missing or null. */
function _v(
  model: FinancialModel,
  stmt: keyof Omit<FinancialModel, "company_info" | "periods" | "revenue_build" | "expense_build">,
  item: string,
  period: string,
): number {
  const val = getValue(model, stmt, item, period);
  return val == null ? 0.0 : val;
}

/** Check if two values are within tolerance. */
function _close(a: number, b: number, tol: number = TOLERANCE): boolean {
  return Math.abs(a - b) <= tol;
}

/** Get the previous period label, or null if there is none. */
function _prevPeriod(periods: string[], current: string): string | null {
  const idx = periods.indexOf(current);
  if (idx <= 0) return null;
  return periods[idx - 1];
}

/** Format a number to 1 decimal place. */
function f1(n: number): string {
  return n.toFixed(1);
}

/** Format a number to 2 decimal places. */
function f2(n: number): string {
  return n.toFixed(2);
}

// ---------------------------------------------------------------------------
// DIAGNOSTIC CHECKS — from rulebook error_diagnostics_and_validation
// ---------------------------------------------------------------------------

/** DIAG-BS-001: Assets = Liabilities + Equity in every period. */
export function check_bs_balance(model: FinancialModel): CheckResult[] {
  const results: CheckResult[] = [];
  const tol = _getTolerance(model);

  for (const p of getAllPeriods(model)) {
    const assets = _v(model, "balance_sheet", "total_assets", p);
    const liab = _v(model, "balance_sheet", "total_liabilities", p);
    const equity = _v(model, "balance_sheet", "total_equity", p);
    const diff = assets - (liab + equity);
    results.push({
      check_id: "DIAG-BS-001",
      passed: _close(assets, liab + equity, tol),
      severity: CRITICAL,
      message: `A=${f1(assets)}, L+E=${f1(liab + equity)}, diff=${f2(diff)}`,
      period: p,
      expected: liab + equity,
      actual: assets,
    });
  }
  return results;
}

/** DIAG-CFS-001: CFS ending cash = BS cash in every period. */
export function check_cash_tieout(model: FinancialModel): CheckResult[] {
  const results: CheckResult[] = [];
  const tol = _getTolerance(model);

  for (const p of getAllPeriods(model)) {
    const bsCash = _v(model, "balance_sheet", "cash", p);
    const cfsCash = _v(model, "cash_flow_statement", "ending_cash", p);
    const diff = Math.abs(bsCash - cfsCash);
    results.push({
      check_id: "DIAG-CFS-001",
      passed: _close(bsCash, cfsCash, tol),
      severity: CRITICAL,
      message: `BS cash=${f1(bsCash)}, CFS ending=${f1(cfsCash)}, diff=${f2(diff)}`,
      period: p,
      expected: cfsCash,
      actual: bsCash,
    });
  }
  return results;
}

/** DIAG-RE-001: RE_t = RE_t-1 + NI_t - Dividends_t. */
export function check_re_continuity(model: FinancialModel): CheckResult[] {
  const results: CheckResult[] = [];
  const tol = _getTolerance(model);
  const periods = getAllPeriods(model);

  for (const p of periods) {
    const prev = _prevPeriod(periods, p);
    if (prev === null) continue;

    const rePrev = _v(model, "balance_sheet", "retained_earnings", prev);
    const ni = _v(model, "income_statement", "net_income", p);
    const divs = _v(model, "cash_flow_statement", "cf_dividends_paid", p);
    const reExpected = rePrev + ni - Math.abs(divs); // divs is negative on CFS
    const reActual = _v(model, "balance_sheet", "retained_earnings", p);
    const diff = Math.abs(reActual - reExpected);

    results.push({
      check_id: "DIAG-RE-001",
      passed: _close(reActual, reExpected, tol),
      severity: CRITICAL,
      message: `RE=${f1(reActual)}, expected=${f1(reExpected)} (prev_RE=${f1(rePrev)} + NI=${f1(ni)} - divs=${f1(Math.abs(divs))}), diff=${f2(diff)}`,
      period: p,
      expected: reExpected,
      actual: reActual,
    });
  }
  return results;
}

/** DIAG-WC-001: CFS working capital adjustments = BS deltas. */
export function check_wc_deltas(model: FinancialModel): CheckResult[] {
  const results: CheckResult[] = [];
  const tol = _getTolerance(model);
  const periods = getAllPeriods(model);

  for (const p of periods) {
    const prev = _prevPeriod(periods, p);
    if (prev === null) continue;

    // Sum of WC changes on CFS
    const cfsWc =
      _v(model, "cash_flow_statement", "cf_change_ar", p) +
      _v(model, "cash_flow_statement", "cf_change_inventory", p) +
      _v(model, "cash_flow_statement", "cf_change_prepaid", p) +
      _v(model, "cash_flow_statement", "cf_change_ap", p) +
      _v(model, "cash_flow_statement", "cf_change_accrued_liab", p) +
      _v(model, "cash_flow_statement", "cf_change_deferred_rev", p);

    // BS deltas (using correct sign conventions)
    let bsWc = 0.0;
    for (const assetItem of [
      "accounts_receivable",
      "inventory",
      "prepaid_expenses",
    ]) {
      const curr = _v(model, "balance_sheet", assetItem, p);
      const prevVal = _v(model, "balance_sheet", assetItem, prev);
      bsWc += -(curr - prevVal);
    }
    for (const liabItem of [
      "accounts_payable",
      "accrued_liabilities",
      "deferred_revenue",
    ]) {
      const curr = _v(model, "balance_sheet", liabItem, p);
      const prevVal = _v(model, "balance_sheet", liabItem, prev);
      bsWc += curr - prevVal;
    }

    const diff = Math.abs(cfsWc - bsWc);
    results.push({
      check_id: "DIAG-WC-001",
      passed: _close(cfsWc, bsWc, tol),
      severity: ERROR,
      message: `CFS WC adj=${f1(cfsWc)}, BS delta=${f1(bsWc)}, diff=${f2(diff)}`,
      period: p,
      expected: bsWc,
      actual: cfsWc,
    });
  }
  return results;
}

/** DIAG-DA-001: D&A on IS = D&A addback on CFS. */
export function check_da_consistency(model: FinancialModel): CheckResult[] {
  const results: CheckResult[] = [];
  const tol = _getTolerance(model);

  for (const p of getAllPeriods(model)) {
    const daIs = _v(model, "income_statement", "da_expense", p);
    const daCfs = _v(model, "cash_flow_statement", "cf_da_addback", p);
    const diff = Math.abs(Math.abs(daIs) - Math.abs(daCfs));
    results.push({
      check_id: "DIAG-DA-001",
      passed: _close(Math.abs(daIs), Math.abs(daCfs), tol),
      severity: ERROR,
      message: `|IS D&A|=${f1(Math.abs(daIs))}, |CFS addback|=${f1(Math.abs(daCfs))}, diff=${f2(diff)}`,
      period: p,
      expected: Math.abs(daIs),
      actual: Math.abs(daCfs),
    });
  }
  return results;
}

/** DIAG-PPE-001: Net PPE_t = Net PPE_t-1 + CapEx - Depreciation. */
export function check_ppe_rollforward(model: FinancialModel): CheckResult[] {
  const results: CheckResult[] = [];
  const tol = _getTolerance(model) * 2; // wider tol for disposals
  const periods = getAllPeriods(model);

  for (const p of periods) {
    const prev = _prevPeriod(periods, p);
    if (prev === null) continue;

    const ppePrev = _v(model, "balance_sheet", "net_ppe", prev);
    const capex = _v(model, "cash_flow_statement", "cf_capex", p);
    const da = _v(model, "income_statement", "da_expense", p);
    const ppeExpected = ppePrev + Math.abs(capex) + da; // da is negative
    const ppeActual = _v(model, "balance_sheet", "net_ppe", p);
    const diff = Math.abs(ppeActual - ppeExpected);

    results.push({
      check_id: "DIAG-PPE-001",
      passed: _close(ppeActual, ppeExpected, tol),
      severity: ERROR,
      message: `Net PPE=${f1(ppeActual)}, expected=${f1(ppeExpected)} (prev=${f1(ppePrev)} + capex=${f1(Math.abs(capex))} - D&A=${f1(Math.abs(da))}), diff=${f2(diff)}`,
      period: p,
      expected: ppeExpected,
      actual: ppeActual,
    });
  }
  return results;
}

/** DIAG-DEBT-001: Closing debt = Opening + Issuance - Repayment + Revolver net. */
export function check_debt_rollforward(model: FinancialModel): CheckResult[] {
  const results: CheckResult[] = [];
  const tol = _getTolerance(model) * 2;
  const periods = getAllPeriods(model);

  for (const p of periods) {
    const prev = _prevPeriod(periods, p);
    if (prev === null) continue;

    const openLt = _v(model, "balance_sheet", "long_term_debt", prev);
    const openSt = _v(model, "balance_sheet", "short_term_debt", prev);
    const openRev = _v(model, "balance_sheet", "revolver_balance", prev);
    const openCpltd = _v(model, "balance_sheet", "current_portion_ltd", prev);
    const openTotal = openLt + openSt + openRev + openCpltd;

    const issuance = _v(model, "cash_flow_statement", "cf_debt_issuance", p);
    const repayment = _v(model, "cash_flow_statement", "cf_debt_repayment", p);
    const revolver = _v(model, "cash_flow_statement", "cf_revolver_net", p);

    const closeLt = _v(model, "balance_sheet", "long_term_debt", p);
    const closeSt = _v(model, "balance_sheet", "short_term_debt", p);
    const closeRev = _v(model, "balance_sheet", "revolver_balance", p);
    const closeCpltd = _v(model, "balance_sheet", "current_portion_ltd", p);
    const closeTotal = closeLt + closeSt + closeRev + closeCpltd;

    const expected = openTotal + issuance + repayment + revolver;
    const diff = Math.abs(closeTotal - expected);

    results.push({
      check_id: "DIAG-DEBT-001",
      passed: _close(closeTotal, expected, tol),
      severity: ERROR,
      message: `Closing debt=${f1(closeTotal)}, expected=${f1(expected)}, diff=${f2(diff)}`,
      period: p,
      expected,
      actual: closeTotal,
    });
  }
  return results;
}

/** DIAG-TAX-NEGEBT-001: No positive tax expense when EBT < 0. */
export function check_tax_negative_ebt(model: FinancialModel): CheckResult[] {
  const results: CheckResult[] = [];
  const tol = _getTolerance(model);

  for (const p of getAllPeriods(model)) {
    const ebt = _v(model, "income_statement", "ebt", p);
    const tax = _v(model, "income_statement", "tax_expense", p);

    if (ebt < 0 && tax < -tol) {
      results.push({
        check_id: "DIAG-TAX-NEGEBT-001",
        passed: false,
        severity: ERROR,
        message: `EBT=${f1(ebt)} is negative but tax_expense=${f1(tax)} (should be 0 or benefit)`,
        period: p,
        expected: 0.0,
        actual: tax,
      });
    } else {
      results.push({
        check_id: "DIAG-TAX-NEGEBT-001",
        passed: true,
        severity: ERROR,
        message: `EBT=${f1(ebt)}, tax=${f1(tax)} — consistent`,
        period: p,
      });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// INTER-STATEMENT LINK CHECKS — from rulebook inter_statement_linkage_map
// ---------------------------------------------------------------------------

/** LINK-IS-CFS-001: IS Net Income = CFS starting net income. */
export function check_link_ni_to_cfs(model: FinancialModel): CheckResult[] {
  const results: CheckResult[] = [];
  const tol = _getTolerance(model);

  for (const p of getAllPeriods(model)) {
    const isNi = _v(model, "income_statement", "net_income", p);
    const cfsNi = _v(model, "cash_flow_statement", "cf_net_income", p);
    results.push({
      check_id: "LINK-IS-CFS-001",
      passed: _close(isNi, cfsNi, tol),
      severity: CRITICAL,
      message: `IS NI=${f1(isNi)}, CFS NI=${f1(cfsNi)}`,
      period: p,
      expected: isNi,
      actual: cfsNi,
    });
  }
  return results;
}

/** LINK-IS-CFS-003: IS SBC expense magnitude = CFS SBC addback. */
export function check_link_sbc_addback(model: FinancialModel): CheckResult[] {
  const results: CheckResult[] = [];
  const tol = _getTolerance(model);

  for (const p of getAllPeriods(model)) {
    const isSbc = _v(model, "income_statement", "sbc_expense", p);
    const cfsSbc = _v(model, "cash_flow_statement", "cf_sbc_addback", p);
    results.push({
      check_id: "LINK-IS-CFS-003",
      passed: _close(Math.abs(isSbc), Math.abs(cfsSbc), tol),
      severity: ERROR,
      message: `|IS SBC|=${f1(Math.abs(isSbc))}, |CFS SBC addback|=${f1(Math.abs(cfsSbc))}`,
      period: p,
      expected: Math.abs(isSbc),
      actual: Math.abs(cfsSbc),
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// SIGN CONVENTION CHECKS
// ---------------------------------------------------------------------------

/** Verify sign conventions are correctly applied. Always emits one result per check per period. */
export function check_sign_conventions(model: FinancialModel): CheckResult[] {
  const results: CheckResult[] = [];
  const tol = _getTolerance(model);

  for (const p of getAllPeriods(model)) {
    // Revenue should be positive
    const rev = _v(model, "income_statement", "revenue", p);
    results.push({
      check_id: "SIGN-IS-001",
      passed: rev >= 0,
      severity: ERROR,
      period: p,
      message:
        `Revenue=${f1(rev)}` +
        (rev < 0 ? " is negative — must be positive" : " — OK"),
    });

    // COGS should be negative (or zero)
    const cogs = _v(model, "income_statement", "cogs", p);
    results.push({
      check_id: "SIGN-IS-002",
      passed: cogs <= tol,
      severity: ERROR,
      period: p,
      message:
        `COGS=${f1(cogs)}` +
        (cogs > tol ? " is positive — must be negative" : " — OK"),
    });

    // Total assets should be positive
    const assets = _v(model, "balance_sheet", "total_assets", p);
    results.push({
      check_id: "SIGN-BS-001",
      passed: assets >= 0,
      severity: ERROR,
      period: p,
      message: `Total assets=${f1(assets)}` + (assets < 0 ? " is negative" : " — OK"),
    });

    // Accumulated depreciation should be negative (contra-asset)
    const accumDep = _v(model, "balance_sheet", "accumulated_depreciation", p);
    results.push({
      check_id: "SIGN-BS-002",
      passed: accumDep <= tol,
      severity: WARNING,
      period: p,
      message:
        `Accumulated depreciation=${f1(accumDep)}` +
        (accumDep > tol ? " should be negative" : " — OK"),
    });

    // CapEx should be negative on CFS (outflow)
    const capex = _v(model, "cash_flow_statement", "cf_capex", p);
    results.push({
      check_id: "SIGN-CFS-001",
      passed: capex <= tol,
      severity: ERROR,
      period: p,
      message:
        `CapEx=${f1(capex)}` + (capex > tol ? " should be negative" : " — OK"),
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// INTERNAL CONSISTENCY CHECKS — IS subtotals
// ---------------------------------------------------------------------------

/** Verify IS calculation chain: GP, EBIT, EBITDA, EBT, NI. */
export function check_is_subtotals(model: FinancialModel): CheckResult[] {
  const results: CheckResult[] = [];
  const tol = _getTolerance(model);

  for (const p of getAllPeriods(model)) {
    const rev = _v(model, "income_statement", "revenue", p);
    const cogs = _v(model, "income_statement", "cogs", p);
    const gp = _v(model, "income_statement", "gross_profit", p);
    const gpExpected = rev + cogs;
    results.push({
      check_id: "CALC-IS-GP",
      passed: _close(gp, gpExpected, tol),
      severity: ERROR,
      period: p,
      message: `GP=${f1(gp)}, expected=${f1(gpExpected)} (rev=${f1(rev)} + cogs=${f1(cogs)})`,
      expected: gpExpected,
      actual: gp,
    });

    const ebit = _v(model, "income_statement", "ebit", p);
    const ebitda = _v(model, "income_statement", "ebitda", p);
    const da = _v(model, "income_statement", "da_expense", p);
    const ebitdaExpected = ebit - da; // da is negative, so ebitda > ebit
    results.push({
      check_id: "CALC-IS-EBITDA",
      passed: _close(ebitda, ebitdaExpected, tol),
      severity: ERROR,
      period: p,
      message: `EBITDA=${f1(ebitda)}, expected=${f1(ebitdaExpected)} (EBIT=${f1(ebit)} - DA=${f1(da)})`,
      expected: ebitdaExpected,
      actual: ebitda,
    });

    const intExp = _v(model, "income_statement", "interest_expense", p);
    const intInc = _v(model, "income_statement", "interest_income", p);
    const other = _v(model, "income_statement", "other_income_expense", p);
    const ebt = _v(model, "income_statement", "ebt", p);
    const ebtExpected = ebit + intExp + intInc + other;
    results.push({
      check_id: "CALC-IS-EBT",
      passed: _close(ebt, ebtExpected, tol),
      severity: ERROR,
      period: p,
      message: `EBT=${f1(ebt)}, expected=${f1(ebtExpected)}`,
      expected: ebtExpected,
      actual: ebt,
    });

    const tax = _v(model, "income_statement", "tax_expense", p);
    const ni = _v(model, "income_statement", "net_income", p);
    const niExpected = ebt + tax;
    results.push({
      check_id: "CALC-IS-NI",
      passed: _close(ni, niExpected, tol),
      severity: ERROR,
      period: p,
      message: `NI=${f1(ni)}, expected=${f1(niExpected)} (EBT=${f1(ebt)} + tax=${f1(tax)})`,
      expected: niExpected,
      actual: ni,
    });
  }
  return results;
}

/** Verify CFS ending cash = beginning cash + net change. */
export function check_cfs_reconciliation(model: FinancialModel): CheckResult[] {
  const results: CheckResult[] = [];
  const tol = _getTolerance(model);

  for (const p of getAllPeriods(model)) {
    const cfo = _v(model, "cash_flow_statement", "cfo_total", p);
    const cfi = _v(model, "cash_flow_statement", "cfi_total", p);
    const cff = _v(model, "cash_flow_statement", "cff_total", p);
    const fx = _v(model, "cash_flow_statement", "cf_fx_effect", p);
    const netChange = _v(model, "cash_flow_statement", "net_change_cash", p);
    const beg = _v(model, "cash_flow_statement", "beginning_cash", p);
    const end = _v(model, "cash_flow_statement", "ending_cash", p);

    const ncExpected = cfo + cfi + cff + fx;
    results.push({
      check_id: "CALC-CFS-NETCHANGE",
      passed: _close(netChange, ncExpected, tol),
      severity: CRITICAL,
      period: p,
      message: `Net change=${f1(netChange)}, expected=${f1(ncExpected)} (CFO=${f1(cfo)}+CFI=${f1(cfi)}+CFF=${f1(cff)}+FX=${f1(fx)})`,
      expected: ncExpected,
      actual: netChange,
    });

    const endExpected = beg + netChange;
    results.push({
      check_id: "CALC-CFS-ENDCASH",
      passed: _close(end, endExpected, tol),
      severity: CRITICAL,
      period: p,
      message: `Ending cash=${f1(end)}, expected=${f1(endExpected)} (beg=${f1(beg)} + net=${f1(netChange)})`,
      expected: endExpected,
      actual: end,
    });
  }
  return results;
}

/** Verify BS subtotals add up correctly. */
export function check_bs_subtotals(model: FinancialModel): CheckResult[] {
  const results: CheckResult[] = [];
  const tol = _getTolerance(model);

  for (const p of getAllPeriods(model)) {
    // Current assets
    const caItems = [
      "cash",
      "accounts_receivable",
      "inventory",
      "prepaid_expenses",
      "other_current_assets",
    ];
    const caSum = caItems.reduce(
      (acc, item) => acc + _v(model, "balance_sheet", item, p),
      0,
    );
    const tca = _v(model, "balance_sheet", "total_current_assets", p);
    results.push({
      check_id: "CALC-BS-TCA",
      passed: _close(tca, caSum, tol),
      severity: ERROR,
      period: p,
      message: `Total current assets=${f1(tca)}, sum of items=${f1(caSum)}`,
      expected: caSum,
      actual: tca,
    });

    // Net PPE
    const grossPpe = _v(model, "balance_sheet", "gross_ppe", p);
    const accumDep = _v(model, "balance_sheet", "accumulated_depreciation", p);
    const netPpe = _v(model, "balance_sheet", "net_ppe", p);
    const netPpeExpected = grossPpe + accumDep;
    results.push({
      check_id: "CALC-BS-NETPPE",
      passed: _close(netPpe, netPpeExpected, tol),
      severity: ERROR,
      period: p,
      message: `Net PPE=${f1(netPpe)}, expected=${f1(netPpeExpected)} (gross=${f1(grossPpe)} + accum_dep=${f1(accumDep)})`,
      expected: netPpeExpected,
      actual: netPpe,
    });

    // Total assets
    const ncaItems = [
      "net_ppe",
      "goodwill",
      "intangible_assets",
      "other_noncurrent_assets",
    ];
    const ncaSum = ncaItems.reduce(
      (acc, item) => acc + _v(model, "balance_sheet", item, p),
      0,
    );
    const ta = _v(model, "balance_sheet", "total_assets", p);
    const taExpected = tca + ncaSum;
    results.push({
      check_id: "CALC-BS-TA",
      passed: _close(ta, taExpected, tol),
      severity: ERROR,
      period: p,
      message: `Total assets=${f1(ta)}, expected=${f1(taExpected)} (CA=${f1(tca)} + NCA=${f1(ncaSum)})`,
      expected: taExpected,
      actual: ta,
    });

    // Total current liabilities
    const clItems = [
      "accounts_payable",
      "accrued_liabilities",
      "deferred_revenue",
      "short_term_debt",
      "current_portion_ltd",
      "other_current_liabilities",
    ];
    const clSum = clItems.reduce(
      (acc, item) => acc + _v(model, "balance_sheet", item, p),
      0,
    );
    const tcl = _v(model, "balance_sheet", "total_current_liabilities", p);
    results.push({
      check_id: "CALC-BS-TCL",
      passed: _close(tcl, clSum, tol),
      severity: ERROR,
      period: p,
      message: `Total current liab=${f1(tcl)}, sum=${f1(clSum)}`,
      expected: clSum,
      actual: tcl,
    });

    // Total liabilities
    const nclItems = [
      "long_term_debt",
      "revolver_balance",
      "deferred_tax_liability",
      "other_noncurrent_liabilities",
    ];
    const nclSum = nclItems.reduce(
      (acc, item) => acc + _v(model, "balance_sheet", item, p),
      0,
    );
    const tl = _v(model, "balance_sheet", "total_liabilities", p);
    const tlExpected = tcl + nclSum;
    results.push({
      check_id: "CALC-BS-TL",
      passed: _close(tl, tlExpected, tol),
      severity: ERROR,
      period: p,
      message: `Total liab=${f1(tl)}, expected=${f1(tlExpected)}`,
      expected: tlExpected,
      actual: tl,
    });

    // Total equity
    const eqItems = [
      "common_stock",
      "apic",
      "retained_earnings",
      "treasury_stock",
      "aoci",
      "other_equity",
    ];
    const eqSum = eqItems.reduce(
      (acc, item) => acc + _v(model, "balance_sheet", item, p),
      0,
    );
    const te = _v(model, "balance_sheet", "total_equity", p);
    results.push({
      check_id: "CALC-BS-TE",
      passed: _close(te, eqSum, tol),
      severity: ERROR,
      period: p,
      message: `Total equity=${f1(te)}, sum=${f1(eqSum)}`,
      expected: eqSum,
      actual: te,
    });
  }
  return results;
}

/** CFS beginning cash in period t = CFS ending cash in period t-1. */
export function check_beginning_cash_continuity(
  model: FinancialModel,
): CheckResult[] {
  const results: CheckResult[] = [];
  const tol = _getTolerance(model);
  const periods = getAllPeriods(model);

  for (const p of periods) {
    const prev = _prevPeriod(periods, p);
    if (prev === null) continue;

    const prevEnd = _v(model, "cash_flow_statement", "ending_cash", prev);
    const currBeg = _v(model, "cash_flow_statement", "beginning_cash", p);
    results.push({
      check_id: "LINK-CASH-CONT",
      passed: _close(prevEnd, currBeg, tol),
      severity: CRITICAL,
      period: p,
      message: `Beg cash=${f1(currBeg)}, prev ending=${f1(prevEnd)}`,
      expected: prevEnd,
      actual: currBeg,
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// SANITY CHECKS
// ---------------------------------------------------------------------------

/** Plausibility bounds on key metrics. Always emits results. */
export function check_sanity_bounds(model: FinancialModel): CheckResult[] {
  const results: CheckResult[] = [];
  const tol = _getTolerance(model);

  for (const p of getProjectedPeriods(model)) {
    const rev = _v(model, "income_statement", "revenue", p);
    const ni = _v(model, "income_statement", "net_income", p);

    // Revenue should be non-negative
    results.push({
      check_id: "SANITY-REV",
      passed: rev >= 0,
      severity: WARNING,
      period: p,
      message: `Revenue=${f1(rev)}` + (rev < 0 ? " is negative" : " — OK"),
    });

    // Net margin sanity: between -200% and +100%
    if (rev !== 0) {
      const nm = ni / rev;
      const inBounds = nm >= -2.0 && nm <= 1.0;
      results.push({
        check_id: "SANITY-NM",
        passed: inBounds,
        severity: WARNING,
        period: p,
        message:
          `Net margin=${(nm * 100).toFixed(1)}%` +
          (inBounds ? "" : " is outside [-200%, 100%] bounds"),
      });
    }

    // No negative cash on BS
    const cash = _v(model, "balance_sheet", "cash", p);
    results.push({
      check_id: "SANITY-CASH",
      passed: cash >= -tol,
      severity: WARNING,
      period: p,
      message:
        `Cash=${f1(cash)}` +
        (cash < -tol ? " is negative — should trigger financing" : " — OK"),
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// HISTORICAL ACCURACY CHECKS
// ---------------------------------------------------------------------------

/** Extract labeled numbers from financial input text (best-effort heuristic). */
function _extractNumbersFromText(text: string): Record<string, number[]> {
  const result: Record<string, number[]> = {};
  const lines = text.split("\n");
  const numberPattern = /\$?\s*([\d,]+(?:\.\d+)?)\s*(?:[kKmMbB])?/g;

  const KEYWORDS = [
    "revenue",
    "total revenue",
    "net revenue",
    "sales",
    "cogs",
    "cost of revenue",
    "cost of goods",
    "gross profit",
    "net income",
    "net loss",
    "total assets",
    "total liabilities",
    "total equity",
    "cash",
    "ebitda",
    "operating income",
    "ebit",
  ];

  for (const line of lines) {
    const lineLower = line.toLowerCase().trim();
    if (!lineLower) continue;

    const numbers: number[] = [];
    let match: RegExpExecArray | null;
    numberPattern.lastIndex = 0;
    while ((match = numberPattern.exec(line)) !== null) {
      const n = parseFloat(match[1].replace(/,/g, ""));
      if (!isNaN(n)) numbers.push(n);
    }
    if (numbers.length === 0) continue;

    for (const kw of KEYWORDS) {
      if (lineLower.includes(kw)) {
        if (!result[kw]) result[kw] = [];
        result[kw].push(...numbers);
      }
    }
  }
  return result;
}

const KEYWORD_TO_MODEL_PATH: Record<
  string,
  [
    keyof Omit<FinancialModel, "company_info" | "periods" | "revenue_build" | "expense_build">,
    string,
  ]
> = {
  revenue: ["income_statement", "revenue"],
  "total revenue": ["income_statement", "revenue"],
  "net revenue": ["income_statement", "revenue"],
  sales: ["income_statement", "revenue"],
  "gross profit": ["income_statement", "gross_profit"],
  "net income": ["income_statement", "net_income"],
  "net loss": ["income_statement", "net_income"],
  "total assets": ["balance_sheet", "total_assets"],
  "total liabilities": ["balance_sheet", "total_liabilities"],
  "total equity": ["balance_sheet", "total_equity"],
  ebitda: ["income_statement", "ebitda"],
  "operating income": ["income_statement", "ebit"],
  ebit: ["income_statement", "ebit"],
};

/**
 * Compare the model's historical values against numbers in the input text.
 *
 * Best-effort heuristic: extract obvious dollar figures from the input and verify
 * they appear somewhere in the model's historical periods.
 */
export function check_historical_accuracy(
  model: FinancialModel,
  financialInput: string,
): CheckResult[] {
  const results: CheckResult[] = [];
  const histPeriods = model.periods?.historical ?? [];

  if (histPeriods.length === 0) {
    results.push({
      check_id: "HIST-PERIODS",
      passed: false,
      severity: ERROR,
      message: "No historical periods defined in model output",
    });
    return results;
  }

  // Check that historical periods have non-trivial data
  for (const p of histPeriods) {
    const rev = _v(model, "income_statement", "revenue", p);
    const ta = _v(model, "balance_sheet", "total_assets", p);
    if (rev === 0.0 && ta === 0.0) {
      results.push({
        check_id: "HIST-DATA",
        passed: false,
        severity: ERROR,
        period: p,
        message: `Historical period ${p} has zero revenue and zero assets — likely missing data`,
      });
    } else {
      results.push({
        check_id: "HIST-DATA",
        passed: true,
        severity: ERROR,
        period: p,
        message: `Historical period ${p} has data (rev=${f1(rev)}, assets=${f1(ta)})`,
      });
    }
  }

  if (!financialInput) return results;

  const extracted = _extractNumbersFromText(financialInput);
  if (Object.keys(extracted).length === 0) return results;

  for (const [kw, inputNumbers] of Object.entries(extracted)) {
    if (!(kw in KEYWORD_TO_MODEL_PATH)) continue;
    const [stmt, item] = KEYWORD_TO_MODEL_PATH[kw];

    const modelValues: number[] = [];
    for (const p of histPeriods) {
      const v = _v(model, stmt, item, p);
      if (v !== 0.0) modelValues.push(Math.abs(v));
    }

    if (modelValues.length === 0) continue;

    // Check if any input number matches any model historical value (5% relative tolerance)
    let matched = false;
    outer: for (const inpNum of inputNumbers) {
      if (inpNum === 0) continue;
      for (const modVal of modelValues) {
        if (modVal === 0) continue;
        const relDiff =
          Math.abs(inpNum - modVal) /
          Math.max(Math.abs(inpNum), Math.abs(modVal));
        if (relDiff < 0.05) {
          matched = true;
          break outer;
        }
      }
    }

    if (!matched && inputNumbers.length > 0 && modelValues.length > 0) {
      results.push({
        check_id: "HIST-MATCH",
        passed: false,
        severity: WARNING,
        message: `'${kw}' from input (${inputNumbers.slice(0, 3)}) doesn't match model historicals (${modelValues.slice(0, 3).map((v) => Math.round(v * 10) / 10)})`,
      });
    } else if (matched) {
      results.push({
        check_id: "HIST-MATCH",
        passed: true,
        severity: WARNING,
        message: `'${kw}' input values match model historicals`,
      });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// BUILD TIE-OUT CHECKS — revenue_build and expense_build vs IS
// ---------------------------------------------------------------------------

/** Verify revenue_build drivers tie to IS revenue. */
export function check_revenue_build_tieout(
  model: FinancialModel,
): CheckResult[] {
  const results: CheckResult[] = [];
  const revBuild = model.revenue_build as
    | {
        methodology?: string;
        drivers?: Record<string, Record<string, number | null>>;
      }
    | undefined;

  if (!revBuild) return results; // optional — don't fail if missing

  const methodology = revBuild.methodology ?? "unknown";
  const drivers = revBuild.drivers ?? {};
  const tol = _getTolerance(model);

  for (const p of getAllPeriods(model)) {
    const isRev = _v(model, "income_statement", "revenue", p);

    if (methodology === "arr_waterfall" && "ending_arr" in drivers) {
      const endingArr = drivers["ending_arr"]?.[p];
      const factor = drivers["arr_to_revenue"]?.[p];
      if (endingArr != null && factor != null) {
        const computedRev = endingArr * factor;
        results.push({
          check_id: "BUILD-REV-TIEOUT",
          passed: _close(isRev, computedRev, Math.max(tol, Math.abs(isRev) * 0.02)),
          severity: WARNING,
          period: p,
          message: `Revenue build: ${f1(computedRev)} vs IS revenue: ${f1(isRev)}`,
          expected: computedRev,
          actual: isRev,
        });
      }
    } else if (
      methodology === "volume_x_price" &&
      "units_sold" in drivers &&
      "asp" in drivers
    ) {
      const units = drivers["units_sold"]?.[p];
      const asp = drivers["asp"]?.[p];
      if (units != null && asp != null) {
        const computedRev = units * asp;
        results.push({
          check_id: "BUILD-REV-TIEOUT",
          passed: _close(isRev, computedRev, Math.max(tol, Math.abs(isRev) * 0.02)),
          severity: WARNING,
          period: p,
          message: `Revenue build: ${f1(computedRev)} vs IS revenue: ${f1(isRev)}`,
          expected: computedRev,
          actual: isRev,
        });
      }
    }
  }
  return results;
}

/** Verify expense_build category totals tie to IS COGS + OpEx. */
export function check_expense_build_tieout(
  model: FinancialModel,
): CheckResult[] {
  const results: CheckResult[] = [];
  const expBuild = model.expense_build as
    | {
        categories?: Record<
          string,
          { items?: Record<string, Record<string, number | null>> }
        >;
      }
    | undefined;

  if (!expBuild) return results;

  const categories = expBuild.categories ?? {};
  if (Object.keys(categories).length === 0) return results;

  const tol = _getTolerance(model);

  for (const p of getAllPeriods(model)) {
    let buildTotal = 0.0;

    for (const catData of Object.values(categories)) {
      const items = catData.items ?? {};
      for (const [itemKey, itemValues] of Object.entries(items)) {
        if (itemKey.startsWith("total_") && typeof itemValues === "object") {
          const val = itemValues[p];
          if (val != null) {
            buildTotal += Math.abs(val);
            break;
          }
        }
      }
    }

    if (buildTotal === 0) continue;

    // IS COGS + total opex (both negative, so abs)
    const isCogs = Math.abs(_v(model, "income_statement", "cogs", p));
    const isOpex = Math.abs(_v(model, "income_statement", "total_opex", p));
    const isTotal = isCogs + isOpex;

    results.push({
      check_id: "BUILD-EXP-TIEOUT",
      passed: _close(buildTotal, isTotal, Math.max(tol, isTotal * 0.05)),
      severity: WARNING,
      period: p,
      message: `Expense build total: ${f1(buildTotal)} vs IS COGS+OpEx: ${f1(isTotal)}`,
      expected: isTotal,
      actual: buildTotal,
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// MASTER VALIDATION RUNNER
// ---------------------------------------------------------------------------

type CheckFn = (model: FinancialModel) => CheckResult[];

/** All model-only check functions, in registry order matching the Python source. */
const ALL_CHECKS: CheckFn[] = [
  // Critical diagnostics
  check_bs_balance,
  check_cash_tieout,
  check_re_continuity,
  check_beginning_cash_continuity,
  check_cfs_reconciliation,

  // Inter-statement links
  check_link_ni_to_cfs,
  check_link_sbc_addback,

  // Internal consistency
  check_is_subtotals,
  check_bs_subtotals,

  // Roll-forwards
  check_wc_deltas,
  check_da_consistency,
  check_ppe_rollforward,
  check_debt_rollforward,

  // Tax logic
  check_tax_negative_ebt,

  // Sign conventions
  check_sign_conventions,

  // Sanity / plausibility
  check_sanity_bounds,

  // Build tie-outs
  check_revenue_build_tieout,
  check_expense_build_tieout,
];

/**
 * Run all validation checks against a model output.
 *
 * @param model - The parsed JSON output from the LLM, conforming to the schema.
 * @param financialInput - Optional raw financial input text for historical accuracy checks.
 * @returns ValidationReport with all check results and scoring.
 */
export function validate(
  model: FinancialModel,
  financialInput?: string,
): ValidationReport {
  const allResults: CheckResult[] = [];

  for (const checkFn of ALL_CHECKS) {
    try {
      const results = checkFn(model);
      allResults.push(...results);
    } catch (e) {
      allResults.push({
        check_id: `ERROR-${checkFn.name}`,
        passed: false,
        severity: CRITICAL,
        message: `Check raised exception: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  // Historical accuracy checks (require financialInput)
  if (financialInput) {
    try {
      const results = check_historical_accuracy(model, financialInput);
      allResults.push(...results);
    } catch (e) {
      allResults.push({
        check_id: "ERROR-check_historical_accuracy",
        passed: false,
        severity: CRITICAL,
        message: `Check raised exception: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  return new ValidationReport(allResults);
}
