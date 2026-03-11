/**
 * P&L (Profit & Loss) computation logic.
 *
 * Terminology used throughout:
 *   - lineItem  : a single financial transaction row (debit/credit, amount, account)
 *   - account   : chart-of-accounts entry that classifies a line item
 *   - period    : a calendar month expressed as "YYYY-MM"
 */

// ---------------------------------------------------------------------------
// Core domain types
// ---------------------------------------------------------------------------

export type AccountType =
  | "revenue"
  | "cogs"
  | "operating_expense"
  | "other_income"
  | "other_expense";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  /** Free-form sub-classification, e.g. "salaries", "marketing", "software" */
  subcategory: string;
}

export interface LineItem {
  id: string;
  accountId: string;
  /** ISO 8601 date string */
  date: string;
  /** Always positive; direction is determined by the account type */
  amount: number;
  description: string;
}

// ---------------------------------------------------------------------------
// P&L summary output types
// ---------------------------------------------------------------------------

export interface PnLSummary {
  /** Calendar month in "YYYY-MM" format */
  period: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  /** Amounts keyed by account subcategory */
  operatingExpenses: Record<string, number>;
  totalOpex: number;
  ebitda: number;
  ebitdaMarginPct: number;
  otherIncome: number;
  otherExpense: number;
  netIncome: number;
  netMarginPct: number;
}

export interface PeriodOverPeriodChange {
  period: string;
  priorPeriod: string;
  revenueChange: number;
  revenueChangePct: number | null;
  grossProfitChange: number;
  grossProfitChangePct: number | null;
  ebitdaChange: number;
  ebitdaChangePct: number | null;
  netIncomeChange: number;
  netIncomeChangePct: number | null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Extract "YYYY-MM" from any ISO date string. */
function toPeriod(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function safeDivide(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return numerator / denominator;
}

function pctChange(current: number, prior: number): number | null {
  return safeDivide(current - prior, Math.abs(prior));
}

// ---------------------------------------------------------------------------
// Primary computation functions
// ---------------------------------------------------------------------------

/**
 * Computes a PnLSummary for a single calendar month.
 *
 * @param lineItems - All line items to consider (will be filtered by period).
 * @param accounts  - Full chart of accounts used to classify each line item.
 * @param periodDate - Any date string whose "YYYY-MM" prefix identifies the target month.
 */
export function computePnL(
  lineItems: LineItem[],
  accounts: Account[],
  periodDate: string
): PnLSummary {
  const targetPeriod = toPeriod(periodDate);
  const accountMap = new Map<string, Account>(accounts.map((a) => [a.id, a]));

  // Restrict to items in the target period
  const periodItems = lineItems.filter(
    (item) => toPeriod(item.date) === targetPeriod
  );

  let revenue = 0;
  let cogs = 0;
  const operatingExpenses: Record<string, number> = {};
  let otherIncome = 0;
  let otherExpense = 0;

  for (const item of periodItems) {
    const account = accountMap.get(item.accountId);
    if (!account) continue;

    switch (account.type) {
      case "revenue":
        revenue += item.amount;
        break;
      case "cogs":
        cogs += item.amount;
        break;
      case "operating_expense": {
        const sub = account.subcategory || "other";
        operatingExpenses[sub] = (operatingExpenses[sub] ?? 0) + item.amount;
        break;
      }
      case "other_income":
        otherIncome += item.amount;
        break;
      case "other_expense":
        otherExpense += item.amount;
        break;
    }
  }

  const grossProfit = revenue - cogs;
  const grossMarginPct = safeDivide(grossProfit, revenue) ?? 0;
  const totalOpex = Object.values(operatingExpenses).reduce(
    (sum, v) => sum + v,
    0
  );
  const ebitda = grossProfit - totalOpex;
  const ebitdaMarginPct = safeDivide(ebitda, revenue) ?? 0;
  const netIncome = ebitda + otherIncome - otherExpense;
  const netMarginPct = safeDivide(netIncome, revenue) ?? 0;

  return {
    period: targetPeriod,
    revenue,
    cogs,
    grossProfit,
    grossMarginPct,
    operatingExpenses,
    totalOpex,
    ebitda,
    ebitdaMarginPct,
    otherIncome,
    otherExpense,
    netIncome,
    netMarginPct,
  };
}

/**
 * Aggregates an array of PnLSummary objects into a single consolidated summary.
 * Useful for TTM (trailing twelve months) or YTD roll-ups.
 * The `period` field on the result is set to the last period in the input array.
 */
export function computePnLSummary(data: PnLSummary[]): PnLSummary {
  if (data.length === 0) {
    return {
      period: "",
      revenue: 0,
      cogs: 0,
      grossProfit: 0,
      grossMarginPct: 0,
      operatingExpenses: {},
      totalOpex: 0,
      ebitda: 0,
      ebitdaMarginPct: 0,
      otherIncome: 0,
      otherExpense: 0,
      netIncome: 0,
      netMarginPct: 0,
    };
  }

  const sorted = [...data].sort((a, b) => a.period.localeCompare(b.period));
  const lastPeriod = sorted[sorted.length - 1].period;

  let revenue = 0;
  let cogs = 0;
  const operatingExpenses: Record<string, number> = {};
  let otherIncome = 0;
  let otherExpense = 0;

  for (const row of data) {
    revenue += row.revenue;
    cogs += row.cogs;
    otherIncome += row.otherIncome;
    otherExpense += row.otherExpense;

    for (const [sub, amount] of Object.entries(row.operatingExpenses)) {
      operatingExpenses[sub] = (operatingExpenses[sub] ?? 0) + amount;
    }
  }

  const grossProfit = revenue - cogs;
  const grossMarginPct = safeDivide(grossProfit, revenue) ?? 0;
  const totalOpex = Object.values(operatingExpenses).reduce(
    (sum, v) => sum + v,
    0
  );
  const ebitda = grossProfit - totalOpex;
  const ebitdaMarginPct = safeDivide(ebitda, revenue) ?? 0;
  const netIncome = ebitda + otherIncome - otherExpense;
  const netMarginPct = safeDivide(netIncome, revenue) ?? 0;

  return {
    period: lastPeriod,
    revenue,
    cogs,
    grossProfit,
    grossMarginPct,
    operatingExpenses,
    totalOpex,
    ebitda,
    ebitdaMarginPct,
    otherIncome,
    otherExpense,
    netIncome,
    netMarginPct,
  };
}

/**
 * Computes period-over-period changes between two PnLSummary objects.
 * Percentage changes are null when the prior period value is zero.
 */
export function computePeriodOverPeriodChange(
  current: PnLSummary,
  prior: PnLSummary
): PeriodOverPeriodChange {
  return {
    period: current.period,
    priorPeriod: prior.period,
    revenueChange: current.revenue - prior.revenue,
    revenueChangePct: pctChange(current.revenue, prior.revenue),
    grossProfitChange: current.grossProfit - prior.grossProfit,
    grossProfitChangePct: pctChange(current.grossProfit, prior.grossProfit),
    ebitdaChange: current.ebitda - prior.ebitda,
    ebitdaChangePct: pctChange(current.ebitda, prior.ebitda),
    netIncomeChange: current.netIncome - prior.netIncome,
    netIncomeChangePct: pctChange(current.netIncome, prior.netIncome),
  };
}
