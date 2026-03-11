/**
 * Budget variance analysis.
 *
 * "Variance" is the difference between actual and budgeted amounts.
 * Convention: a positive variance is "favorable" for revenue accounts
 * (actual > budget) and "unfavorable" for expense accounts (actual > budget).
 * The `isFavorable` flag encodes this correctly for each account type.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VarianceAccountType = "revenue" | "expense";

export type VarianceDirection = "favorable" | "unfavorable" | "on_target";

export interface VarianceLine {
  accountId: string;
  accountName: string;
  subcategory: string;
  accountType: VarianceAccountType;
  actual: number;
  budget: number;
  /** actual − budget */
  variance: number;
  /** variance ÷ budget, or null when budget is zero */
  variancePct: number | null;
  direction: VarianceDirection;
}

export interface VarianceReport {
  period: string;
  lines: VarianceLine[];
  totalRevenue: VarianceSummaryRow;
  totalExpenses: VarianceSummaryRow;
  netVariance: VarianceSummaryRow;
}

export interface VarianceSummaryRow {
  label: string;
  actual: number;
  budget: number;
  variance: number;
  variancePct: number | null;
  direction: VarianceDirection;
}

export interface VarianceInput {
  accountId: string;
  accountName: string;
  subcategory: string;
  accountType: VarianceAccountType;
  actual: number;
  budget: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function safePct(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return numerator / denominator;
}

function resolveDirection(
  variance: number,
  accountType: VarianceAccountType
): VarianceDirection {
  if (variance === 0) return "on_target";
  if (accountType === "revenue") {
    return variance > 0 ? "favorable" : "unfavorable";
  }
  // For expenses, spending less than budget is favorable
  return variance < 0 ? "favorable" : "unfavorable";
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Computes a single variance line from actual and budget values.
 */
export function calculateVariance(input: VarianceInput): VarianceLine {
  const variance = input.actual - input.budget;
  const variancePct = safePct(variance, input.budget);
  const direction = resolveDirection(variance, input.accountType);

  return {
    accountId: input.accountId,
    accountName: input.accountName,
    subcategory: input.subcategory,
    accountType: input.accountType,
    actual: input.actual,
    budget: input.budget,
    variance,
    variancePct,
    direction,
  };
}

/**
 * Formats a complete variance report for a given period from an array of
 * actual/budget input pairs.
 *
 * @param period  - "YYYY-MM" period this report covers.
 * @param inputs  - One entry per account containing both actual and budget.
 */
export function formatVarianceReport(
  period: string,
  inputs: VarianceInput[]
): VarianceReport {
  const lines = inputs.map(calculateVariance);

  const revenueLines = lines.filter((l) => l.accountType === "revenue");
  const expenseLines = lines.filter((l) => l.accountType === "expense");

  const sumActual = (arr: VarianceLine[]) =>
    arr.reduce((s, l) => s + l.actual, 0);
  const sumBudget = (arr: VarianceLine[]) =>
    arr.reduce((s, l) => s + l.budget, 0);

  const totalRevenueActual = sumActual(revenueLines);
  const totalRevenueBudget = sumBudget(revenueLines);
  const totalRevenueVariance = totalRevenueActual - totalRevenueBudget;

  const totalExpenseActual = sumActual(expenseLines);
  const totalExpenseBudget = sumBudget(expenseLines);
  const totalExpenseVariance = totalExpenseActual - totalExpenseBudget;

  const netActual = totalRevenueActual - totalExpenseActual;
  const netBudget = totalRevenueBudget - totalExpenseBudget;
  const netVariance = netActual - netBudget;

  const totalRevenue: VarianceSummaryRow = {
    label: "Total Revenue",
    actual: totalRevenueActual,
    budget: totalRevenueBudget,
    variance: totalRevenueVariance,
    variancePct: safePct(totalRevenueVariance, totalRevenueBudget),
    direction: resolveDirection(totalRevenueVariance, "revenue"),
  };

  const totalExpenses: VarianceSummaryRow = {
    label: "Total Expenses",
    actual: totalExpenseActual,
    budget: totalExpenseBudget,
    variance: totalExpenseVariance,
    variancePct: safePct(totalExpenseVariance, totalExpenseBudget),
    direction: resolveDirection(totalExpenseVariance, "expense"),
  };

  const netVarianceSummary: VarianceSummaryRow = {
    label: "Net Income (Actual vs Budget)",
    actual: netActual,
    budget: netBudget,
    variance: netVariance,
    variancePct: safePct(netVariance, Math.abs(netBudget)),
    // Net income: favorable when actual net > budgeted net
    direction:
      netVariance === 0
        ? "on_target"
        : netVariance > 0
          ? "favorable"
          : "unfavorable",
  };

  return {
    period,
    lines,
    totalRevenue,
    totalExpenses,
    netVariance: netVarianceSummary,
  };
}

/**
 * Filters a variance report's line items to only those outside a tolerance band.
 *
 * @param report     - A fully-formed VarianceReport.
 * @param threshold  - Absolute percentage threshold as a decimal (e.g. 0.05 = 5%).
 */
export function filterSignificantVariances(
  report: VarianceReport,
  threshold: number
): VarianceLine[] {
  return report.lines.filter((line) => {
    if (line.variancePct === null) return line.variance !== 0;
    return Math.abs(line.variancePct) >= threshold;
  });
}
