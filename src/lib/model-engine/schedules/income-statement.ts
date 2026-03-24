/**
 * Income statement schedule — two-phase computation.
 *
 * Phase 1 (computeISOperating): Revenue through EBIT. No circular dependencies.
 *   Called before the working-capital and PP&E schedules write their results.
 *
 * Phase 3 (computeISBelowEBIT): Interest through Net Income. Called inside the
 *   SCC fixed-point loop after the debt schedule has populated
 *   state.schedules.totalInterestExpense and the tax schedule (if any) has
 *   populated state.is.totalTaxExpense.
 */

import type { PeriodState, ModelConfig, Assumptions } from "../types";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Safely index into an array.  If `i` is beyond the last element, returns the
 * last element instead of undefined.  Returns 0 for empty arrays.
 */
function get(arr: number[], i: number): number {
  if (arr.length === 0) return 0;
  return arr[Math.min(i, arr.length - 1)];
}

// ---------------------------------------------------------------------------
// Phase 1 — Revenue through EBIT
// ---------------------------------------------------------------------------

/**
 * Computes all income statement line items from the top of the statement down
 * through operating income (EBIT).  Must run before the SCC loop.
 *
 * Writes to: state.is.revenue, revenueByStream, revenueGrowth (implied),
 *   cogs, grossProfit, rdExpense, smExpense, gaExpense, totalOpex,
 *   ebitda, da (estimate if PPE schedule has not yet run), sbc (estimate if
 *   equity schedule has not yet run), operatingIncome.
 *
 * D&A estimate: when state.is.da === 0 (PPE schedule hasn't run), uses
 *   capexPercent as a steady-state proxy for the D&A rate.
 * SBC estimate: when state.is.sbc === 0, uses sbcPercent from assumptions.
 */
export function computeISOperating(
  state: PeriodState,
  priorState: PeriodState,
  assumptions: Assumptions,
  periodIndex: number,
  _config: ModelConfig
): void {
  const i = periodIndex;
  const { revenueStreams, cogsPercent, rdPercent, smPercent, gaPercent, sbcPercent, capexPercent } =
    assumptions;

  // -------------------------------------------------------------------------
  // Revenue
  // -------------------------------------------------------------------------

  const priorByStream = priorState.is.revenueByStream;
  const priorRevenue = priorState.is.revenue;

  let totalRevenue = 0;
  const revenueByStream: Record<string, number> = {};

  for (const stream of revenueStreams) {
    const priorAmount = priorByStream[stream.name] ?? 0;
    const growthRate = get(stream.growthRates, i);
    const streamRevenue = priorAmount * (1 + growthRate);
    revenueByStream[stream.name] = streamRevenue;
    totalRevenue += streamRevenue;
  }

  // Fallback: if every stream computes to zero but the company had revenue in
  // the prior period, use the primary stream's growth rate on total revenue
  // and distribute proportionally by prior-period stream weights.
  if (totalRevenue === 0 && priorRevenue > 0 && revenueStreams.length > 0) {
    const primaryGrowth = get(revenueStreams[0].growthRates, i);
    totalRevenue = priorRevenue * (1 + primaryGrowth);

    const priorTotal = Object.values(priorByStream).reduce((s, v) => s + v, 0);
    for (const stream of revenueStreams) {
      const weight = priorTotal > 0 ? (priorByStream[stream.name] ?? 0) / priorTotal : 1 / revenueStreams.length;
      revenueByStream[stream.name] = totalRevenue * weight;
    }
  }

  state.is.revenue = totalRevenue;
  state.is.revenueByStream = revenueByStream;

  // -------------------------------------------------------------------------
  // COGS and gross profit
  // -------------------------------------------------------------------------

  const cogs = totalRevenue * get(cogsPercent, i);
  state.is.cogs = cogs;
  state.is.grossProfit = totalRevenue - cogs;

  // -------------------------------------------------------------------------
  // Operating expenses
  // -------------------------------------------------------------------------

  const rdExpense = totalRevenue * get(rdPercent, i);
  const smExpense = totalRevenue * get(smPercent, i);
  const gaExpense = totalRevenue * get(gaPercent, i);
  const totalOpex = rdExpense + smExpense + gaExpense;

  state.is.rdExpense = rdExpense;
  state.is.smExpense = smExpense;
  state.is.gaExpense = gaExpense;
  state.is.totalOpex = totalOpex;

  // -------------------------------------------------------------------------
  // D&A and SBC — defer to schedule outputs when available
  // -------------------------------------------------------------------------

  // The PPE schedule (Phase 2) is the authoritative source for D&A.  It will
  // overwrite state.is.da after this function runs.  If this function is
  // called a second time (re-run inside the SCC loop) the PPE value will
  // already be set and we preserve it.
  if (state.is.da === 0) {
    // Estimate: use capex percent as a steady-state D&A proxy.
    state.is.da = totalRevenue * get(capexPercent, i);
  }

  // The equity/SBC schedule (Phase 2) is authoritative for SBC.
  if (state.is.sbc === 0) {
    state.is.sbc = totalRevenue * get(sbcPercent, i);
  }

  const da = state.is.da;
  const sbc = state.is.sbc;

  // -------------------------------------------------------------------------
  // EBITDA and EBIT
  // -------------------------------------------------------------------------

  // EBITDA = Revenue - COGS - Operating Expenses (before D&A and SBC)
  state.is.ebitda = totalRevenue - cogs - totalOpex;
  state.is.operatingIncome = state.is.ebitda - da - sbc;
}

// ---------------------------------------------------------------------------
// Phase 3 — Interest through Net Income (inside SCC loop)
// ---------------------------------------------------------------------------

/**
 * Computes income statement line items below EBIT: interest, EBT, taxes, net
 * income, and EPS.  Must run inside the SCC fixed-point loop after:
 *   - computeISOperating has set state.is.operatingIncome
 *   - the debt schedule has set state.schedules.totalInterestExpense
 *   - the tax schedule (if any) has set state.is.totalTaxExpense
 *
 * EPS is only computed when the equity schedule has populated
 * state.schedules.basicShares and state.schedules.dilutedShares.
 */
export function computeISBelowEBIT(
  state: PeriodState,
  _priorState: PeriodState,
  assumptions: Assumptions,
  periodIndex: number,
  _config: ModelConfig
): void {
  const i = periodIndex;

  // -------------------------------------------------------------------------
  // Interest expense — sourced from debt schedule
  // -------------------------------------------------------------------------

  state.is.interestExpense = state.schedules.totalInterestExpense;

  // -------------------------------------------------------------------------
  // Interest income and other non-operating items — from assumptions
  // -------------------------------------------------------------------------

  state.is.interestIncome = get(assumptions.interestIncome, i);
  state.is.otherNonOperating = get(assumptions.otherNonOperating, i);

  // -------------------------------------------------------------------------
  // EBT
  // -------------------------------------------------------------------------

  state.is.ebt =
    state.is.operatingIncome +
    state.is.interestIncome -
    state.is.interestExpense +
    state.is.otherNonOperating;

  // -------------------------------------------------------------------------
  // Tax expense — defer to tax schedule when available
  // -------------------------------------------------------------------------

  if (state.is.totalTaxExpense === 0) {
    const ebt = state.is.ebt;
    const estimatedTax = ebt > 0 ? ebt * get(assumptions.taxRate, i) : 0;
    state.is.totalTaxExpense = estimatedTax;
    // Treat the full estimate as current tax; deferred tax remains 0 until
    // the dedicated tax schedule runs.
    state.is.currentTaxExpense = estimatedTax;
    state.is.deferredTaxExpense = 0;
  }

  // -------------------------------------------------------------------------
  // Net income
  // -------------------------------------------------------------------------

  state.is.netIncome = state.is.ebt - state.is.totalTaxExpense;

  // -------------------------------------------------------------------------
  // EPS — only when share counts are available
  // -------------------------------------------------------------------------

  const basicShares = state.schedules.basicShares;
  const dilutedShares = state.schedules.dilutedShares;

  if (basicShares > 0) {
    state.is.basicEPS = state.is.netIncome / basicShares;
  }

  if (dilutedShares > 0) {
    state.is.dilutedEPS = state.is.netIncome / dilutedShares;
  }
}
