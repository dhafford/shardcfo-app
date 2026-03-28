/**
 * Cash Flow Statement computation engine.
 *
 * Derives a Statement of Cash Flows from imported Income Statement (IS) and
 * Balance Sheet (BS) data using the indirect method, formatted per the
 * banker bible (Section C: three-statement linkage).
 *
 * The SCF is NOT imported — it is computed from:
 *   - Net Income (from the IS)
 *   - Non-cash add-backs: D&A (change in accumulated depreciation on BS)
 *   - Working capital changes: delta of current asset/liability accounts
 *     between consecutive BS periods
 *   - Investing: delta of fixed/long-term asset accounts
 *   - Financing: delta of debt + equity accounts
 *
 * Proof: Operating + Investing + Financing = Net Change in Cash
 *        Beginning Cash + Net Change = Ending Cash (must tie to BS)
 */

import type { AccountRow, LineItemRow, FinancialPeriodRow } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CashFlowLine {
  label: string;
  amounts: Record<string, number>;  // period_date → amount
  indent: number;                   // 0 = section header, 1 = line item
  bold: boolean;
  isSubtotal: boolean;
}

export interface CashFlowSection {
  name: string;
  lines: CashFlowLine[];
  totalLabel: string;
  totalAmounts: Record<string, number>;
}

export interface ComputedCashFlow {
  periods: string[];                 // ordered period dates
  operating: CashFlowSection;
  investing: CashFlowSection;
  financing: CashFlowSection;
  netCashChange: Record<string, number>;
  beginningCash: Record<string, number>;
  endingCash: Record<string, number>;
  fcf: Record<string, number>;
  balanceCheck: Record<string, number>;  // should be 0 for each period
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Account classification helpers
// ---------------------------------------------------------------------------

// Map account names (lowercase) to SCF categories
// These patterns determine how BS accounts flow into the SCF

function classifyBSAccount(
  account: Pick<AccountRow, "name" | "category" | "subcategory">,
): "cash" | "ar" | "inventory" | "prepaid" | "other_current_asset" | "fixed_asset" | "accum_depr" | "other_lt_asset" | "ap" | "accrued" | "deferred_revenue" | "other_current_liability" | "lt_debt" | "other_lt_liability" | "equity" | "retained_earnings" | "skip" {
  const name = account.name.toLowerCase();
  const cat = account.category;

  // Cash accounts
  if (cat === "asset" && (
    name.includes("cash") || name.includes("checking") ||
    name.includes("savings") || name.includes("bank") ||
    name.includes("money market") || name.includes("deposit")
  )) return "cash";

  // AR
  if (cat === "asset" && (name.includes("receivable") || name.includes("a/r"))) return "ar";

  // Inventory
  if (cat === "asset" && name.includes("inventor")) return "inventory";

  // Prepaid
  if (cat === "asset" && (name.includes("prepaid") || name.includes("startup expense"))) return "prepaid";

  // Accumulated depreciation (contra-asset)
  if (cat === "asset" && (name.includes("accumulated") || name.includes("depreciation"))) return "accum_depr";

  // Fixed/long-term assets
  if (cat === "asset" && (
    name.includes("equipment") || name.includes("furniture") ||
    name.includes("vehicle") || name.includes("property") ||
    name.includes("building") || name.includes("leasehold") ||
    name.includes("brand") || name.includes("identity") ||
    name.includes("camper") || name.includes("trademark") ||
    name.includes("intangible") || name.includes("goodwill") ||
    name.includes("security deposit")
  )) return "fixed_asset";

  // Other current asset (catch-all for undeposited funds, etc.)
  if (cat === "asset" && (name.includes("undeposited") || name.includes("other"))) return "other_current_asset";

  // Remaining assets default
  if (cat === "asset") return "other_current_asset";

  // AP
  if (cat === "liability" && (name.includes("payable") && !name.includes("note"))) return "ap";

  // Accrued liabilities
  if (cat === "liability" && (name.includes("accrued") || name.includes("tax payable") || name.includes("comptroller"))) return "accrued";

  // Deferred revenue
  if (cat === "liability" && name.includes("deferred")) return "deferred_revenue";

  // Long-term debt
  if (cat === "liability" && (
    name.includes("note") || name.includes("loan") ||
    name.includes("convertible") || name.includes("debt") ||
    name.includes("long-term") || name.includes("long term")
  )) return "lt_debt";

  // Other current liability
  if (cat === "liability") return "other_current_liability";

  // Retained earnings
  if (cat === "equity" && (name.includes("retained") || name.includes("opening balance"))) return "retained_earnings";

  // Other equity
  if (cat === "equity") return "equity";

  return "skip";
}

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

/**
 * Compute the Statement of Cash Flows from IS and BS data.
 *
 * Requires at least 2 consecutive BS periods to compute deltas.
 * The IS provides Net Income for each period.
 *
 * @param accounts - All accounts for this company
 * @param periods - Actual financial periods, sorted by date
 * @param lineItems - All line items for these periods
 */
export function computeCashFlow(
  accounts: Pick<AccountRow, "id" | "name" | "category" | "subcategory">[],
  periods: Pick<FinancialPeriodRow, "id" | "period_date">[],
  lineItems: Pick<LineItemRow, "period_id" | "account_id" | "amount">[],
): ComputedCashFlow {
  const warnings: string[] = [];

  if (periods.length < 2) {
    warnings.push("Need at least 2 periods to compute cash flow (for balance sheet deltas).");
    return _emptyResult([], warnings);
  }

  // Build lookup maps
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const periodIdToDate = new Map(periods.map((p) => [p.id, p.period_date]));

  // Classify each account
  const accountClass = new Map<string, ReturnType<typeof classifyBSAccount>>();
  for (const acct of accounts) {
    accountClass.set(acct.id, classifyBSAccount(acct));
  }

  // Build period → account → amount matrix
  const matrix = new Map<string, Map<string, number>>();
  for (const p of periods) {
    matrix.set(p.period_date, new Map());
  }
  for (const li of lineItems) {
    const periodDate = periodIdToDate.get(li.period_id);
    if (!periodDate) continue;
    const m = matrix.get(periodDate);
    if (m) m.set(li.account_id, li.amount);
  }

  // Find Net Income account (from IS — category revenue/cogs/operating_expense)
  // Net Income = Revenue - COGS - OpEx + OtherIncome - OtherExpense
  function computeNetIncome(periodDate: string): number {
    const m = matrix.get(periodDate);
    if (!m) return 0;
    let revenue = 0, cogs = 0, opex = 0, oi = 0, oe = 0;
    for (const [acctId, amount] of m) {
      const acct = accountMap.get(acctId);
      if (!acct) continue;
      switch (acct.category) {
        case "revenue": revenue += amount; break;
        case "cogs": cogs += amount; break;
        case "operating_expense": opex += amount; break;
        case "other_income": oi += amount; break;
        case "other_expense": oe += amount; break;
      }
    }
    return revenue - cogs - opex + oi - oe;
  }

  // Helper: get BS balance for an account class in a period
  function sumByClass(periodDate: string, ...classes: string[]): number {
    const m = matrix.get(periodDate);
    if (!m) return 0;
    let total = 0;
    for (const [acctId, amount] of m) {
      const cls = accountClass.get(acctId);
      if (cls && classes.includes(cls)) total += amount;
    }
    return total;
  }

  // Compute for each consecutive pair of periods
  const outputPeriods = periods.slice(1).map((p) => p.period_date);
  const sortedPeriods = periods.map((p) => p.period_date);

  const operating: Record<string, Record<string, number>> = {};
  const investing: Record<string, Record<string, number>> = {};
  const financing: Record<string, Record<string, number>> = {};
  const totals: Record<string, Record<string, number>> = {};

  for (let i = 1; i < sortedPeriods.length; i++) {
    const curr = sortedPeriods[i];
    const prev = sortedPeriods[i - 1];

    const ni = computeNetIncome(curr);

    // D&A = change in accumulated depreciation (it increases, so delta is positive = add-back)
    const daChange = sumByClass(curr, "accum_depr") - sumByClass(prev, "accum_depr");
    // D&A is a negative number on BS (contra-asset), its increase (more negative) = add-back
    const da = -daChange;  // flip sign: accum depr gets more negative → positive add-back

    // Working capital changes (asset increase = cash outflow, liability increase = cash inflow)
    const chgAR = -(sumByClass(curr, "ar") - sumByClass(prev, "ar"));
    const chgInventory = -(sumByClass(curr, "inventory") - sumByClass(prev, "inventory"));
    const chgPrepaid = -(sumByClass(curr, "prepaid") - sumByClass(prev, "prepaid"));
    const chgOtherCA = -(sumByClass(curr, "other_current_asset") - sumByClass(prev, "other_current_asset"));
    const chgAP = sumByClass(curr, "ap") - sumByClass(prev, "ap");
    const chgAccrued = sumByClass(curr, "accrued") - sumByClass(prev, "accrued");
    const chgDefRev = sumByClass(curr, "deferred_revenue") - sumByClass(prev, "deferred_revenue");
    const chgOtherCL = sumByClass(curr, "other_current_liability") - sumByClass(prev, "other_current_liability");

    const cfo = ni + da + chgAR + chgInventory + chgPrepaid + chgOtherCA +
                chgAP + chgAccrued + chgDefRev + chgOtherCL;

    // Investing: change in fixed assets (increase = purchase = outflow)
    const chgFixed = -(sumByClass(curr, "fixed_asset") - sumByClass(prev, "fixed_asset"));
    const chgOtherLTA = -(sumByClass(curr, "other_lt_asset") - sumByClass(prev, "other_lt_asset"));
    const cfi = chgFixed + chgOtherLTA;

    // Financing: change in debt + equity
    const chgDebt = sumByClass(curr, "lt_debt") - sumByClass(prev, "lt_debt");
    const chgEquity = sumByClass(curr, "equity") - sumByClass(prev, "equity");
    // Exclude retained earnings change (that's Net Income, already in CFO)
    const cff = chgDebt + chgEquity;

    const netChange = cfo + cfi + cff;
    const beginCash = sumByClass(prev, "cash");
    const endCash = sumByClass(curr, "cash");

    // Store
    const setVal = (map: Record<string, Record<string, number>>, key: string, val: number) => {
      if (!map[key]) map[key] = {};
      map[key][curr] = val;
    };

    setVal(operating, "Net Income", ni);
    setVal(operating, "Depreciation & Amortization", da);
    setVal(operating, "Change in Accounts Receivable", chgAR);
    setVal(operating, "Change in Inventory", chgInventory);
    setVal(operating, "Change in Prepaid Expenses", chgPrepaid);
    setVal(operating, "Change in Other Current Assets", chgOtherCA);
    setVal(operating, "Change in Accounts Payable", chgAP);
    setVal(operating, "Change in Accrued Liabilities", chgAccrued);
    setVal(operating, "Change in Deferred Revenue", chgDefRev);
    setVal(operating, "Change in Other Current Liabilities", chgOtherCL);
    setVal(operating, "Total CFO", cfo);

    setVal(investing, "Capital Expenditures", chgFixed);
    setVal(investing, "Other Investing", chgOtherLTA);
    setVal(investing, "Total CFI", cfi);

    setVal(financing, "Change in Debt", chgDebt);
    setVal(financing, "Change in Equity", chgEquity);
    setVal(financing, "Total CFF", cff);

    setVal(totals, "netChange", netChange);
    setVal(totals, "beginCash", beginCash);
    setVal(totals, "endCash", endCash);
    setVal(totals, "fcf", cfo + chgFixed); // FCF = CFO + CapEx
    setVal(totals, "balanceCheck", endCash - (beginCash + netChange));

    // Validation
    const drift = Math.abs(endCash - (beginCash + netChange));
    if (drift > 1.0) {
      warnings.push(
        `${curr}: Cash doesn't reconcile. BS Cash (${endCash.toFixed(0)}) ≠ ` +
        `Beginning (${beginCash.toFixed(0)}) + Net Change (${netChange.toFixed(0)}) = ` +
        `${(beginCash + netChange).toFixed(0)} (diff: ${drift.toFixed(2)})`
      );
    }
  }

  // Build structured output
  function buildSection(
    name: string,
    lineKeys: string[],
    totalKey: string,
    data: Record<string, Record<string, number>>,
  ): CashFlowSection {
    const lines: CashFlowLine[] = [];
    for (const key of lineKeys) {
      if (key === totalKey) continue;
      const amounts: Record<string, number> = {};
      for (const pd of outputPeriods) {
        amounts[pd] = data[key]?.[pd] ?? 0;
      }
      // Skip lines that are zero across all periods
      const hasValue = Object.values(amounts).some((v) => Math.abs(v) > 0.01);
      if (!hasValue) continue;
      lines.push({
        label: key,
        amounts,
        indent: 1,
        bold: false,
        isSubtotal: false,
      });
    }

    const totalAmounts: Record<string, number> = {};
    for (const pd of outputPeriods) {
      totalAmounts[pd] = data[totalKey]?.[pd] ?? 0;
    }

    return { name, lines, totalLabel: totalKey, totalAmounts };
  }

  const opSection = buildSection(
    "Operating Activities",
    ["Net Income", "Depreciation & Amortization",
     "Change in Accounts Receivable", "Change in Inventory",
     "Change in Prepaid Expenses", "Change in Other Current Assets",
     "Change in Accounts Payable", "Change in Accrued Liabilities",
     "Change in Deferred Revenue", "Change in Other Current Liabilities", "Total CFO"],
    "Total CFO",
    operating,
  );

  const invSection = buildSection(
    "Investing Activities",
    ["Capital Expenditures", "Other Investing", "Total CFI"],
    "Total CFI",
    investing,
  );

  const finSection = buildSection(
    "Financing Activities",
    ["Change in Debt", "Change in Equity", "Total CFF"],
    "Total CFF",
    financing,
  );

  const netCash: Record<string, number> = {};
  const begCash: Record<string, number> = {};
  const endCash_: Record<string, number> = {};
  const fcf_: Record<string, number> = {};
  const balCheck: Record<string, number> = {};
  for (const pd of outputPeriods) {
    netCash[pd] = totals["netChange"]?.[pd] ?? 0;
    begCash[pd] = totals["beginCash"]?.[pd] ?? 0;
    endCash_[pd] = totals["endCash"]?.[pd] ?? 0;
    fcf_[pd] = totals["fcf"]?.[pd] ?? 0;
    balCheck[pd] = totals["balanceCheck"]?.[pd] ?? 0;
  }

  return {
    periods: outputPeriods,
    operating: opSection,
    investing: invSection,
    financing: finSection,
    netCashChange: netCash,
    beginningCash: begCash,
    endingCash: endCash_,
    fcf: fcf_,
    balanceCheck: balCheck,
    warnings,
  };
}

function _emptyResult(periods: string[], warnings: string[]): ComputedCashFlow {
  return {
    periods,
    operating: { name: "Operating Activities", lines: [], totalLabel: "Total CFO", totalAmounts: {} },
    investing: { name: "Investing Activities", lines: [], totalLabel: "Total CFI", totalAmounts: {} },
    financing: { name: "Financing Activities", lines: [], totalLabel: "Total CFF", totalAmounts: {} },
    netCashChange: {},
    beginningCash: {},
    endingCash: {},
    fcf: {},
    balanceCheck: {},
    warnings,
  };
}
