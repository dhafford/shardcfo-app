/**
 * SaaS metrics calculation library.
 *
 * All monetary inputs are assumed to be in the same currency unit (e.g. USD).
 * All rate/percentage outputs are expressed as decimals (0.15 = 15%) unless
 * the function name explicitly says "Pct", in which case it still returns a
 * decimal for consistency — callers multiply by 100 for display.
 *
 * Functions return `null` instead of dividing by zero.
 */

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface MrrSnapshot {
  /** "YYYY-MM" */
  period: string;
  /** Total MRR at end of month */
  mrr: number;
  /** MRR from new customers */
  newMrr: number;
  /** MRR from existing customers increasing spend */
  expansionMrr: number;
  /** MRR lost from existing customers decreasing spend */
  contractionMrr: number;
  /** MRR lost from customers who fully cancelled */
  churnedMrr: number;
  /** MRR from customers that previously churned and came back */
  reactivationMrr: number;
}

export interface CustomerSnapshot {
  /** "YYYY-MM" */
  period: string;
  activeCustomers: number;
  newCustomers: number;
  churnedCustomers: number;
}

export interface CohortData {
  /** Starting MRR of the cohort at month 0 */
  startingMrr: number;
  /** MRR remaining after 12 months (or the most recent available month) */
  currentMrr: number;
  /** Starting customer count */
  startingCustomers: number;
  /** Customers still active */
  currentCustomers: number;
}

export interface FinancingMetricInputs {
  /** Total cash spent acquiring customers in a period */
  salesAndMarketingSpend: number;
  /** New customers acquired in that same period */
  newCustomersAcquired: number;
  /** Average MRR per customer */
  avgMrr: number;
  /** Gross margin as a decimal (e.g. 0.70 for 70%) */
  grossMarginDecimal: number;
  /** Monthly churn rate as a decimal (e.g. 0.03 for 3%) */
  monthlyChurnRate: number;
}

export interface BurnMetricInputs {
  /** Cash consumed (burned) in the period */
  cashBurned: number;
  /** Net new ARR added in the period */
  netNewArr: number;
  /** Total operating expenses (including COGS) */
  totalOpex: number;
  /** Total revenue */
  revenue: number;
  /** YoY revenue growth rate as a decimal */
  revenueGrowthRate: number;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface SaaSMetrics {
  period: string;
  mrr: number;
  arr: number;
  mrrGrowthRate: number | null;
  netDollarRetention: number | null;
  grossRevenueRetention: number | null;
  logoChurnRate: number | null;
  revenueChurnRate: number | null;
  cac: number | null;
  ltv: number | null;
  ltvCacRatio: number | null;
  paybackPeriodMonths: number | null;
  burnMultiple: number | null;
  ruleOf40: number | null;
  magicNumber: number | null;
  grossMarginPct: number | null;
}

// ---------------------------------------------------------------------------
// Individual metric functions
// ---------------------------------------------------------------------------

/** Monthly Recurring Revenue — pass-through for clarity. */
export function calculateMrr(mrr: number): number {
  return mrr;
}

/** Annual Run Rate Revenue: MRR × 12. */
export function calculateArr(mrr: number): number {
  return mrr * 12;
}

/**
 * Month-over-month MRR growth rate.
 * Returns null when prior MRR is zero.
 */
export function calculateMrrGrowthRate(
  currentMrr: number,
  priorMrr: number
): number | null {
  if (priorMrr === 0) return null;
  return (currentMrr - priorMrr) / priorMrr;
}

/**
 * Net Dollar Retention (NDR) — also known as Net Revenue Retention.
 * Measures how much revenue a cohort retains + expands over 12 months.
 * Returns null when startingMrr is zero.
 */
export function calculateNetDollarRetention(
  cohort: CohortData
): number | null {
  if (cohort.startingMrr === 0) return null;
  return cohort.currentMrr / cohort.startingMrr;
}

/**
 * Gross Revenue Retention — capped at 100%; expansion is excluded.
 * Returns null when startingMrr is zero.
 */
export function calculateGrossRevenueRetention(
  cohort: CohortData
): number | null {
  if (cohort.startingMrr === 0) return null;
  const retainedMrr = Math.min(cohort.currentMrr, cohort.startingMrr);
  return retainedMrr / cohort.startingMrr;
}

/**
 * Logo (customer count) churn rate for a single period.
 * Returns null when starting customer count is zero.
 */
export function calculateLogoChurnRate(
  snapshot: CustomerSnapshot,
  priorActiveCustomers: number
): number | null {
  if (priorActiveCustomers === 0) return null;
  return snapshot.churnedCustomers / priorActiveCustomers;
}

/**
 * Revenue churn rate: churned MRR ÷ starting MRR.
 * Returns null when starting MRR is zero.
 */
export function calculateRevenueChurnRate(
  churnedMrr: number,
  startingMrr: number
): number | null {
  if (startingMrr === 0) return null;
  return churnedMrr / startingMrr;
}

/**
 * Customer Acquisition Cost: total S&M spend ÷ new customers acquired.
 * Returns null when no new customers were acquired.
 */
export function calculateCac(inputs: FinancingMetricInputs): number | null {
  if (inputs.newCustomersAcquired === 0) return null;
  return inputs.salesAndMarketingSpend / inputs.newCustomersAcquired;
}

/**
 * Customer Lifetime Value using the simple formula:
 *   LTV = (ARPU × Gross Margin) ÷ Monthly Churn Rate
 * Returns null when churn rate is zero.
 */
export function calculateLtv(inputs: FinancingMetricInputs): number | null {
  if (inputs.monthlyChurnRate === 0) return null;
  return (inputs.avgMrr * inputs.grossMarginDecimal) / inputs.monthlyChurnRate;
}

/**
 * LTV:CAC ratio.
 * Returns null when CAC is zero or cannot be computed.
 */
export function calculateLtvCacRatio(
  inputs: FinancingMetricInputs
): number | null {
  const ltv = calculateLtv(inputs);
  const cac = calculateCac(inputs);
  if (ltv === null || cac === null || cac === 0) return null;
  return ltv / cac;
}

/**
 * CAC Payback Period in months: CAC ÷ (ARPU × Gross Margin).
 * Returns null when inputs produce a zero denominator.
 */
export function calculatePaybackPeriod(
  inputs: FinancingMetricInputs
): number | null {
  const cac = calculateCac(inputs);
  const denominator = inputs.avgMrr * inputs.grossMarginDecimal;
  if (cac === null || denominator === 0) return null;
  return cac / denominator;
}

/**
 * Burn Multiple: net cash burned ÷ net new ARR.
 * Lower is better. Returns null when net new ARR is zero.
 */
export function calculateBurnMultiple(
  cashBurned: number,
  netNewArr: number
): number | null {
  if (netNewArr === 0) return null;
  return cashBurned / netNewArr;
}

/**
 * Rule of 40: revenue growth rate % + EBITDA margin %.
 * Both inputs are decimals; result is also a decimal (0.40 = 40).
 */
export function calculateRuleOf40(
  revenueGrowthRate: number,
  ebitdaMarginDecimal: number
): number {
  return revenueGrowthRate + ebitdaMarginDecimal;
}

/**
 * Magic Number: measures go-to-market efficiency.
 *   Magic Number = Net New ARR ÷ Prior Quarter S&M Spend
 * Returns null when priorSmSpend is zero.
 */
export function calculateMagicNumber(
  netNewArr: number,
  priorSmSpend: number
): number | null {
  if (priorSmSpend === 0) return null;
  return netNewArr / priorSmSpend;
}

/**
 * Gross Margin percentage as a decimal.
 * Returns null when revenue is zero.
 */
export function calculateGrossMarginPct(
  revenue: number,
  cogs: number
): number | null {
  if (revenue === 0) return null;
  return (revenue - cogs) / revenue;
}

/**
 * Monthly Burn Rate — the absolute net cash outflow for the period.
 * Positive value means cash is being consumed.
 */
export function calculateMonthlyBurnRate(
  cashInflows: number,
  cashOutflows: number
): number {
  return Math.max(0, cashOutflows - cashInflows);
}

/**
 * Cash runway in months given current balance and burn rate.
 * Returns null when burn rate is zero (company is break-even or cash-flow positive).
 */
export function calculateRunwayMonths(
  cashBalance: number,
  monthlyBurnRate: number
): number | null {
  if (monthlyBurnRate <= 0) return null;
  return cashBalance / monthlyBurnRate;
}

// ---------------------------------------------------------------------------
// Composite: compute all SaaS metrics for a single snapshot
// ---------------------------------------------------------------------------

export interface SaaSMetricsInput {
  snapshot: MrrSnapshot;
  priorSnapshot: MrrSnapshot | null;
  cohort12m: CohortData | null;
  customerSnapshot: CustomerSnapshot | null;
  priorActiveCustomers: number;
  financingInputs: FinancingMetricInputs | null;
  burnInputs: BurnMetricInputs | null;
  /** Prior quarter S&M spend (for Magic Number) */
  priorQuarterSmSpend: number | null;
  grossMarginRevenue: number | null;
  grossMarginCogs: number | null;
}

/**
 * Computes all SaaS metrics from a set of inputs for a given period.
 */
export function computeSaaSMetrics(input: SaaSMetricsInput): SaaSMetrics {
  const { snapshot, priorSnapshot, cohort12m, customerSnapshot } = input;

  const mrr = calculateMrr(snapshot.mrr);
  const arr = calculateArr(mrr);

  const mrrGrowthRate =
    priorSnapshot !== null
      ? calculateMrrGrowthRate(snapshot.mrr, priorSnapshot.mrr)
      : null;

  const netDollarRetention =
    cohort12m !== null ? calculateNetDollarRetention(cohort12m) : null;

  const grossRevenueRetention =
    cohort12m !== null ? calculateGrossRevenueRetention(cohort12m) : null;

  const logoChurnRate =
    customerSnapshot !== null
      ? calculateLogoChurnRate(customerSnapshot, input.priorActiveCustomers)
      : null;

  const revenueChurnRate =
    priorSnapshot !== null
      ? calculateRevenueChurnRate(snapshot.churnedMrr, priorSnapshot.mrr)
      : null;

  const cac =
    input.financingInputs !== null
      ? calculateCac(input.financingInputs)
      : null;

  const ltv =
    input.financingInputs !== null
      ? calculateLtv(input.financingInputs)
      : null;

  const ltvCacRatio =
    input.financingInputs !== null
      ? calculateLtvCacRatio(input.financingInputs)
      : null;

  const paybackPeriodMonths =
    input.financingInputs !== null
      ? calculatePaybackPeriod(input.financingInputs)
      : null;

  const burnMultiple =
    input.burnInputs !== null
      ? calculateBurnMultiple(
          input.burnInputs.cashBurned,
          input.burnInputs.netNewArr
        )
      : null;

  const ruleOf40 =
    input.burnInputs !== null
      ? calculateRuleOf40(
          input.burnInputs.revenueGrowthRate,
          input.burnInputs.revenue > 0
            ? (input.burnInputs.revenue - input.burnInputs.totalOpex) /
                input.burnInputs.revenue
            : 0
        )
      : null;

  const magicNumber =
    input.burnInputs !== null && input.priorQuarterSmSpend !== null
      ? calculateMagicNumber(
          input.burnInputs.netNewArr,
          input.priorQuarterSmSpend
        )
      : null;

  const grossMarginPct =
    input.grossMarginRevenue !== null && input.grossMarginCogs !== null
      ? calculateGrossMarginPct(input.grossMarginRevenue, input.grossMarginCogs)
      : null;

  return {
    period: snapshot.period,
    mrr,
    arr,
    mrrGrowthRate,
    netDollarRetention,
    grossRevenueRetention,
    logoChurnRate,
    revenueChurnRate,
    cac,
    ltv,
    ltvCacRatio,
    paybackPeriodMonths,
    burnMultiple,
    ruleOf40,
    magicNumber,
    grossMarginPct,
  };
}
