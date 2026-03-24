/**
 * Balance sheet assembly — final aggregation pass (Phase 5).
 *
 * By the time this function runs, every individual schedule has written its
 * outputs directly to state.bs.*, state.cfs.*, and state.schedules.*.
 * This schedule does two things:
 *
 *  1. Plugs cash from the CFS ending balance (THE cash plug).
 *  2. Sums all line items into their sub-total and total fields, then
 *     computes the balance check (Assets - Liabilities&Equity).
 *
 * Fields that are "carried forward" (not driven by a projection assumption)
 * retain the value already written to state from a prior schedule or remain
 * at zero when not applicable for the period.
 *
 * Depends on:
 *  - computeCashFlow (cfs.endingCash)
 *  - computeWorkingCapital (bs.accountsReceivable, inventory, prepaidExpenses,
 *      accountsPayable, accruedLiabilities, deferredRevenueCurrent,
 *      deferredRevenueNonCurrent)
 *  - computePPE (bs.grossPPE, accumulatedDepreciation, netPPE,
 *      capitalizedSoftwareNet)
 *  - computeTax (bs.deferredTaxAsset, deferredTaxLiability, incomeTaxPayable)
 *  - computeDebt (bs.currentPortionLTD, revolverBalance, longTermDebt)
 *  - computeEquity (bs.commonStock, apic, retainedEarnings, aoci, treasuryStock)
 */

import type { PeriodState, ModelConfig } from "../types";

// ---------------------------------------------------------------------------
// computeBalanceSheet
// ---------------------------------------------------------------------------

/**
 * Assembles all balance sheet totals and verifies the accounting equation.
 *
 * @param state      Current period state (mutated in place).
 * @param priorState Prior period state — used for carried-forward items.
 * @param _config    Model configuration (reserved; not used in current pass).
 */
export function computeBalanceSheet(
  state: PeriodState,
  priorState: PeriodState,
  _config: ModelConfig
): void {
  // -------------------------------------------------------------------------
  // Cash — THE balance sheet plug
  //
  // The cash flow statement's ending cash is the authoritative source.
  // -------------------------------------------------------------------------

  state.bs.cash = state.cfs.endingCash;

  // -------------------------------------------------------------------------
  // Carry-forward items
  //
  // These balance sheet positions are not driven by a projection assumption in
  // the current set of schedules, so we carry the prior period's closing value
  // forward. A future schedule (e.g., investments, ROU assets) would overwrite
  // these before this function runs.
  // -------------------------------------------------------------------------

  if (state.bs.shortTermInvestments === 0) {
    state.bs.shortTermInvestments = priorState.bs.shortTermInvestments;
  }

  if (state.bs.otherCurrentAssets === 0) {
    state.bs.otherCurrentAssets = priorState.bs.otherCurrentAssets;
  }

  if (state.bs.goodwill === 0) {
    state.bs.goodwill = priorState.bs.goodwill;
  }

  if (state.bs.intangiblesNet === 0) {
    state.bs.intangiblesNet = priorState.bs.intangiblesNet;
  }

  if (state.bs.rous === 0) {
    state.bs.rous = priorState.bs.rous;
  }

  if (state.bs.otherNonCurrentAssets === 0) {
    state.bs.otherNonCurrentAssets = priorState.bs.otherNonCurrentAssets;
  }

  if (state.bs.otherCurrentLiabilities === 0) {
    state.bs.otherCurrentLiabilities = priorState.bs.otherCurrentLiabilities;
  }

  if (state.bs.otherNonCurrentLiabilities === 0) {
    state.bs.otherNonCurrentLiabilities =
      priorState.bs.otherNonCurrentLiabilities;
  }

  // -------------------------------------------------------------------------
  // Current assets
  // -------------------------------------------------------------------------

  const totalCurrentAssets =
    state.bs.cash +
    state.bs.shortTermInvestments +
    state.bs.accountsReceivable +
    state.bs.inventory +
    state.bs.prepaidExpenses +
    state.bs.otherCurrentAssets;

  state.bs.totalCurrentAssets = totalCurrentAssets;

  // -------------------------------------------------------------------------
  // Non-current assets
  //
  // netPPE is already set by computePPE.
  // capitalizedSoftwareNet is already set by computePPE.
  // deferredTaxAsset is already set by computeTax.
  // -------------------------------------------------------------------------

  const totalNonCurrentAssets =
    state.bs.netPPE +
    state.bs.goodwill +
    state.bs.intangiblesNet +
    state.bs.capitalizedSoftwareNet +
    state.bs.rous +
    state.bs.deferredTaxAsset +
    state.bs.otherNonCurrentAssets;

  state.bs.totalNonCurrentAssets = totalNonCurrentAssets;

  // -------------------------------------------------------------------------
  // Total assets
  // -------------------------------------------------------------------------

  state.bs.totalAssets = totalCurrentAssets + totalNonCurrentAssets;

  // -------------------------------------------------------------------------
  // Current liabilities
  //
  // incomeTaxPayable is set by computeTax.
  // currentPortionLTD is set by computeDebt.
  // revolverBalance is set by computeDebt.
  // accountsPayable, accruedLiabilities, deferredRevenueCurrent are set by
  //   computeWorkingCapital.
  // -------------------------------------------------------------------------

  const totalCurrentLiabilities =
    state.bs.accountsPayable +
    state.bs.accruedLiabilities +
    state.bs.deferredRevenueCurrent +
    state.bs.incomeTaxPayable +
    state.bs.currentPortionLTD +
    state.bs.revolverBalance +
    state.bs.otherCurrentLiabilities;

  state.bs.totalCurrentLiabilities = totalCurrentLiabilities;

  // -------------------------------------------------------------------------
  // Non-current liabilities
  //
  // longTermDebt is set by computeDebt.
  // deferredRevenueNonCurrent is set by computeWorkingCapital.
  // deferredTaxLiability is set by computeTax.
  // -------------------------------------------------------------------------

  const totalNonCurrentLiabilities =
    state.bs.longTermDebt +
    state.bs.deferredRevenueNonCurrent +
    state.bs.deferredTaxLiability +
    state.bs.otherNonCurrentLiabilities;

  state.bs.totalNonCurrentLiabilities = totalNonCurrentLiabilities;

  // -------------------------------------------------------------------------
  // Total liabilities
  // -------------------------------------------------------------------------

  state.bs.totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;

  // -------------------------------------------------------------------------
  // Equity
  //
  // All equity components are written by computeEquity (or carried forward
  // from the historical anchor when the equity schedule has not yet run).
  // -------------------------------------------------------------------------

  const totalEquity =
    state.bs.commonStock +
    state.bs.apic +
    state.bs.retainedEarnings +
    state.bs.aoci +
    state.bs.treasuryStock; // treasuryStock is negative by convention

  state.bs.totalEquity = totalEquity;

  // -------------------------------------------------------------------------
  // Balance check
  //
  // totalLiabilitiesAndEquity should equal totalAssets.
  // balanceCheck must be 0 (within floating-point tolerance) for a valid model.
  // -------------------------------------------------------------------------

  state.bs.totalLiabilitiesAndEquity =
    state.bs.totalLiabilities + state.bs.totalEquity;

  state.bs.balanceCheck =
    state.bs.totalAssets - state.bs.totalLiabilitiesAndEquity;
}
