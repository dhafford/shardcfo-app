/**
 * What-if scenario projection engine.
 *
 * Takes a set of "base period actuals" plus user-defined assumptions and
 * projects financial statements 12–24 months into the future.
 *
 * Design philosophy:
 *  - Each assumption is optional; when omitted the engine falls back to the
 *    base-period value (no change assumption).
 *  - The engine does NOT call external APIs — all logic is pure functions.
 *  - All monetary values are in the same currency unit as the input.
 */

// ---------------------------------------------------------------------------
// Types: inputs
// ---------------------------------------------------------------------------

export interface BasePeriodActuals {
  /** "YYYY-MM" — the most recent closed accounting month. */
  period: string;
  mrr: number;
  revenue: number;
  cogs: number;
  /** Gross payroll expense (base salaries only, excluding employer taxes/benefits). */
  payrollExpense: number;
  /** Count of full-time-equivalent employees at end of period. */
  headcount: number;
  /** All non-payroll operating expenses. */
  otherOpex: number;
  cashBalance: number;
}

export interface HirePlan {
  /** Month offset from the scenario start (0 = first projected month). */
  monthOffset: number;
  /** Number of new hires starting in that month. */
  headcount: number;
  /** Blended monthly salary (gross, per employee). */
  monthlySalaryPerPerson: number;
}

export interface FundraisingEvent {
  /** "YYYY-MM" — expected close month. */
  closeDate: string;
  /** Gross proceeds from the round. */
  amount: number;
}

export interface ScenarioAssumptions {
  /** Month-over-month MRR growth rate (e.g. 0.10 = 10%). */
  mrrGrowthRate?: number;
  /**
   * COGS as a percentage of revenue (e.g. 0.25 = 25%).
   * When provided, overrides the base-period COGS ratio each month.
   */
  cogsPercentage?: number;
  /**
   * Month-over-month growth rate applied to non-payroll opex.
   * Defaults to 0 (flat costs).
   */
  otherOpexGrowthRate?: number;
  /** Planned hiring schedule. */
  hirePlan?: HirePlan[];
  /**
   * Blended employer burden rate on top of gross salary
   * (payroll taxes, benefits, etc.). Defaults to 0.15.
   */
  employerBurdenRate?: number;
  /** Optional fundraising events to inject into cash balance. */
  fundraisingEvents?: FundraisingEvent[];
  /** Number of months to project. Must be 1–24. Defaults to 12. */
  projectionMonths?: number;
}

// ---------------------------------------------------------------------------
// Types: outputs
// ---------------------------------------------------------------------------

export interface ScenarioMonth {
  /** "YYYY-MM" */
  period: string;
  mrr: number;
  arr: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  payrollExpense: number;
  headcount: number;
  otherOpex: number;
  totalOpex: number;
  ebitda: number;
  ebitdaMarginPct: number;
  netIncome: number;
  cashBalance: number;
  burnRate: number;
  /** Fundraising proceeds received this month */
  fundraiseProceeds: number;
}

export interface ScenarioProjection {
  scenarioName: string;
  basePeriod: string;
  assumptions: ScenarioAssumptions;
  months: ScenarioMonth[];
  /** Estimated runway in months from the end of the projection window. null = cash-flow positive. */
  estimatedRunwayMonths: number | null;
  /** "YYYY-MM" of projected cash exhaustion, or null. */
  estimatedCashOutDate: string | null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Adds `n` months to an ISO "YYYY-MM" string.
 */
function addMonths(period: string, n: number): string {
  const [yearStr, monthStr] = period.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const totalMonths = year * 12 + (month - 1) + n;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  return `${String(newYear).padStart(4, "0")}-${String(newMonth).padStart(2, "0")}`;
}

function safeDivide(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

// ---------------------------------------------------------------------------
// Core engine
// ---------------------------------------------------------------------------

/**
 * Projects financial statements forward from base-period actuals.
 *
 * @param actuals      - Last closed month actuals.
 * @param assumptions  - Growth and operating assumptions.
 * @param scenarioName - Human-readable scenario label (e.g. "Base Case").
 */
export function projectScenario(
  actuals: BasePeriodActuals,
  assumptions: ScenarioAssumptions,
  scenarioName = "Base Case"
): ScenarioProjection {
  const projectionMonths = Math.min(
    Math.max(1, assumptions.projectionMonths ?? 12),
    24
  );

  const mrrGrowthRate = assumptions.mrrGrowthRate ?? 0;
  const cogsRatio =
    assumptions.cogsPercentage ??
    safeDivide(actuals.cogs, actuals.revenue);
  const otherOpexGrowthRate = assumptions.otherOpexGrowthRate ?? 0;
  const employerBurdenRate = assumptions.employerBurdenRate ?? 0.15;
  const hirePlan = assumptions.hirePlan ?? [];
  const fundraisingEvents = assumptions.fundraisingEvents ?? [];

  // Build a map of fundraising proceeds keyed by "YYYY-MM"
  const fundraiseByPeriod = new Map<string, number>();
  for (const event of fundraisingEvents) {
    fundraiseByPeriod.set(
      event.closeDate,
      (fundraiseByPeriod.get(event.closeDate) ?? 0) + event.amount
    );
  }

  // Build incremental payroll from hire plan (cumulative per month)
  // newMonthlyPayroll[i] = gross monthly payroll added starting in month i (0-indexed)
  const newPayrollByMonth = new Array<number>(projectionMonths).fill(0);
  const newHeadcountByMonth = new Array<number>(projectionMonths).fill(0);
  for (const hire of hirePlan) {
    const idx = hire.monthOffset;
    if (idx >= 0 && idx < projectionMonths) {
      newPayrollByMonth[idx] +=
        hire.headcount * hire.monthlySalaryPerPerson;
      newHeadcountByMonth[idx] += hire.headcount;
    }
  }

  const projectedMonths: ScenarioMonth[] = [];
  let currentMrr = actuals.mrr;
  let cumulativeExtraPayroll = 0;
  let cumulativeExtraHeadcount = 0;
  let cashBalance = actuals.cashBalance;
  let currentOtherOpex = actuals.otherOpex;
  let cashOutPeriod: string | null = null;

  for (let i = 0; i < projectionMonths; i++) {
    const period = addMonths(actuals.period, i + 1);

    // MRR grows month-over-month
    currentMrr = currentMrr * (1 + mrrGrowthRate);
    const arr = currentMrr * 12;

    // Revenue = MRR (subscription model; expand here for usage/services billing)
    const revenue = currentMrr;

    // COGS
    const cogs = revenue * cogsRatio;
    const grossProfit = revenue - cogs;
    const grossMarginPct = safeDivide(grossProfit, revenue);

    // Payroll: base + cumulative new hires
    cumulativeExtraPayroll += newPayrollByMonth[i];
    cumulativeExtraHeadcount += newHeadcountByMonth[i];
    const basePayroll = actuals.payrollExpense * (1 + employerBurdenRate);
    const extraPayroll = cumulativeExtraPayroll * (1 + employerBurdenRate);
    const payrollExpense = basePayroll + extraPayroll;
    const headcount = actuals.headcount + cumulativeExtraHeadcount;

    // Non-payroll opex compounds at the specified growth rate
    currentOtherOpex = currentOtherOpex * (1 + otherOpexGrowthRate);
    const otherOpex = currentOtherOpex;

    const totalOpex = payrollExpense + otherOpex;
    const ebitda = grossProfit - totalOpex;
    const ebitdaMarginPct = safeDivide(ebitda, revenue);
    const netIncome = ebitda; // simplified: no D&A, taxes, or interest in projection

    // Cash flow
    const fundraiseProceeds = fundraiseByPeriod.get(period) ?? 0;
    const burnRate = Math.max(0, -netIncome); // cash burned = abs(negative net income)
    cashBalance = cashBalance + netIncome + fundraiseProceeds;

    if (cashBalance <= 0 && cashOutPeriod === null) {
      cashOutPeriod = period;
    }

    projectedMonths.push({
      period,
      mrr: currentMrr,
      arr,
      revenue,
      cogs,
      grossProfit,
      grossMarginPct,
      payrollExpense,
      headcount,
      otherOpex,
      totalOpex,
      ebitda,
      ebitdaMarginPct,
      netIncome,
      cashBalance,
      burnRate,
      fundraiseProceeds,
    });
  }

  // Estimate remaining runway from the end of the projection
  const finalMonth = projectedMonths[projectedMonths.length - 1];
  const avgBurn =
    projectedMonths.filter((m) => m.burnRate > 0).reduce((s, m) => s + m.burnRate, 0) /
    Math.max(1, projectedMonths.filter((m) => m.burnRate > 0).length);

  let estimatedRunwayMonths: number | null = null;
  if (cashOutPeriod !== null) {
    // Runway already exhausted within projection window
    const cashOutIndex = projectedMonths.findIndex(
      (m) => m.period === cashOutPeriod
    );
    estimatedRunwayMonths = cashOutIndex + 1;
  } else if (avgBurn > 0 && finalMonth.cashBalance > 0) {
    estimatedRunwayMonths = projectionMonths + finalMonth.cashBalance / avgBurn;
  }

  return {
    scenarioName,
    basePeriod: actuals.period,
    assumptions,
    months: projectedMonths,
    estimatedRunwayMonths,
    estimatedCashOutDate: cashOutPeriod,
  };
}

/**
 * Runs multiple named scenarios and returns them as an array for comparison.
 *
 * @param actuals    - Shared base period actuals for all scenarios.
 * @param scenarios  - Map of scenario name → assumptions.
 */
export function runScenarioComparison(
  actuals: BasePeriodActuals,
  scenarios: Record<string, ScenarioAssumptions>
): ScenarioProjection[] {
  return Object.entries(scenarios).map(([name, assumptions]) =>
    projectScenario(actuals, assumptions, name)
  );
}
