/**
 * Cash runway projection library.
 *
 * Runway is the number of months a company can operate before running out of
 * cash, given its current cash balance and projected burn rates.
 *
 * "Burn rate" is expressed as a positive number representing monthly net cash
 * outflow (expenses − revenue). A zero or negative burn rate means the company
 * is cash-flow neutral or positive.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RunwayResult {
  /** Months of runway remaining. null means the company is cash-flow positive. */
  months: number | null;
  /** Estimated date of cash exhaustion ("YYYY-MM"), or null if not applicable. */
  exhaustionDate: string | null;
  /** Average monthly burn rate used in the calculation. */
  averageBurnRate: number;
}

export interface CashFlowProjectionMonth {
  /** "YYYY-MM" */
  period: string;
  openingBalance: number;
  burnRate: number;
  closingBalance: number;
  /** True if this is the month the company runs out of cash. */
  isCashOut: boolean;
}

export interface CashFlowProjection {
  months: CashFlowProjectionMonth[];
  /** Month index (0-based) when cash runs out, or null if cash survives all periods. */
  cashOutMonthIndex: number | null;
  /** Runway in months, or null if cash-flow positive throughout. */
  runwayMonths: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Adds `n` months to an ISO "YYYY-MM" period string.
 * Handles year-end rollover correctly.
 */
function addMonths(period: string, n: number): string {
  const [yearStr, monthStr] = period.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-based
  const totalMonths = (year * 12 + (month - 1)) + n;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  return `${String(newYear).padStart(4, "0")}-${String(newMonth).padStart(2, "0")}`;
}

/** Returns the current calendar period as "YYYY-MM". */
function currentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Calculates runway given a cash balance and an array of monthly burn rates.
 *
 * If `burnRates` has fewer entries than needed to exhaust cash, the last value
 * is used to fill remaining months (steady-state assumption), up to a
 * practical cap of 120 months (10 years).
 *
 * @param cashBalance  - Current cash on hand (must be >= 0).
 * @param burnRates    - Ordered array of monthly burn rates (positive = burning cash).
 *                       May be empty, in which case steady-state zero burn is assumed.
 */
export function calculateRunway(
  cashBalance: number,
  burnRates: number[]
): RunwayResult {
  if (cashBalance < 0) {
    return {
      months: 0,
      exhaustionDate: currentPeriod(),
      averageBurnRate: 0,
    };
  }

  const MAX_MONTHS = 120;
  const effectiveBurnRates: number[] = [];
  const steadyStateBurn = burnRates.length > 0 ? burnRates[burnRates.length - 1] : 0;

  for (let i = 0; i < MAX_MONTHS; i++) {
    effectiveBurnRates.push(i < burnRates.length ? burnRates[i] : steadyStateBurn);
  }

  const positiveBurns = effectiveBurnRates.filter((r) => r > 0);
  const averageBurnRate =
    positiveBurns.length > 0
      ? positiveBurns.reduce((sum, r) => sum + r, 0) / positiveBurns.length
      : 0;

  if (averageBurnRate <= 0) {
    return { months: null, exhaustionDate: null, averageBurnRate: 0 };
  }

  let remaining = cashBalance;
  for (let i = 0; i < MAX_MONTHS; i++) {
    const burn = effectiveBurnRates[i];
    if (burn <= 0) continue;
    remaining -= burn;
    if (remaining <= 0) {
      const exhaustionDate = addMonths(currentPeriod(), i + 1);
      return { months: i + 1, exhaustionDate, averageBurnRate };
    }
  }

  // Cash survives all projected periods
  return { months: null, exhaustionDate: null, averageBurnRate };
}

/**
 * Projects cash balances month-by-month for `months` periods.
 *
 * @param startingCash       - Cash on hand at the start of the projection.
 * @param monthlyBurnRates   - Per-month burn rates. If shorter than `months`,
 *                             the last value is repeated (steady-state).
 * @param months             - Number of months to project. Capped at 120.
 * @param startPeriod        - Override for the first projected period ("YYYY-MM").
 *                             Defaults to the current month.
 */
export function projectCashFlow(
  startingCash: number,
  monthlyBurnRates: number[],
  months: number,
  startPeriod?: string
): CashFlowProjection {
  const cappedMonths = Math.min(Math.max(0, months), 120);
  const base = startPeriod ?? currentPeriod();
  const steadyStateBurn =
    monthlyBurnRates.length > 0
      ? monthlyBurnRates[monthlyBurnRates.length - 1]
      : 0;

  const projectedMonths: CashFlowProjectionMonth[] = [];
  let cashOutMonthIndex: number | null = null;
  let balance = startingCash;

  for (let i = 0; i < cappedMonths; i++) {
    const period = addMonths(base, i);
    const burnRate =
      i < monthlyBurnRates.length ? monthlyBurnRates[i] : steadyStateBurn;
    const openingBalance = balance;
    balance = openingBalance - burnRate;
    const isCashOut = balance <= 0 && openingBalance > 0;

    projectedMonths.push({
      period,
      openingBalance,
      burnRate,
      closingBalance: balance,
      isCashOut,
    });

    if (isCashOut && cashOutMonthIndex === null) {
      cashOutMonthIndex = i;
    }
  }

  const runwayMonths = cashOutMonthIndex !== null ? cashOutMonthIndex + 1 : null;

  return {
    months: projectedMonths,
    cashOutMonthIndex,
    runwayMonths,
  };
}

/**
 * Convenience function: given a cash balance and a single steady-state
 * monthly burn rate, return a simple runway in months.
 * Returns null when the company is cash-flow neutral or positive.
 */
export function simpleRunwayMonths(
  cashBalance: number,
  monthlyBurnRate: number
): number | null {
  if (monthlyBurnRate <= 0) return null;
  return cashBalance / monthlyBurnRate;
}
