/**
 * Cash flow statement schedule — indirect method.
 *
 * Assembles the CFS from values already written to state by upstream schedules:
 *  - IS net income (computeISBelowEBIT)
 *  - Non-cash add-backs: D&A (computePPE), SBC (equity/IS schedule),
 *    deferred tax (computeTax), PIK (computeDebt)
 *  - Working capital changes (computeWorkingCapital)
 *  - Investing outflows: capex, cap software (computePPE)
 *  - Financing: debt issuances/repayments/revolver (computeDebt),
 *    equity issuances, buybacks, dividends (equityInputs)
 *
 * GAAP/IFRS routing: when policy flags direct interest paid to CFF (IFRS
 * allowed), total cash interest is moved out of CFO into CFF.
 *
 * The ending cash balance from this schedule is the plug for the balance sheet.
 */

import type {
  PeriodState,
  ModelConfig,
  Assumptions,
  EquityInputs,
  DebtTranche,
} from "../types";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function get(arr: number[], i: number): number {
  if (arr.length === 0) return 0;
  return arr[Math.min(i, arr.length - 1)];
}

// ---------------------------------------------------------------------------
// computeCashFlow
// ---------------------------------------------------------------------------

/**
 * Constructs the indirect-method cash flow statement for the current period.
 *
 * Must be called after all of the following have run for the period:
 *  - computeISOperating + computeISBelowEBIT (net income, interest expense)
 *  - computePPE (cfDA, cfCapex, cfCapSoftware)
 *  - computeWorkingCapital (WC change items)
 *  - computeTax (cfDeferredTax)
 *  - computeDebt (debtTranche results, revolver balance)
 *  - computeEquity (equity inputs reflected in state)
 *
 * Writes all cfs.* fields and sets cfs.endingCash (the balance-sheet cash plug).
 *
 * @param state         Current period state (mutated in place).
 * @param priorState    Prior period state — provides beginningCash.
 * @param assumptions   Projection assumptions (equityInputs embedded via caller).
 * @param periodIndex   0-based projection period index.
 * @param config        Model configuration — used for GAAP/IFRS policy routing.
 * @param equityInputs  Equity inputs for dividends, buybacks, and issuances.
 * @param debtTranches  Full list of debt tranches for revolver net identification.
 */
export function computeCashFlow(
  state: PeriodState,
  priorState: PeriodState,
  assumptions: Assumptions,
  periodIndex: number,
  config: ModelConfig,
  equityInputs?: EquityInputs,
  debtTranches?: DebtTranche[]
): void {
  const { policyFlags } = config;

  // -------------------------------------------------------------------------
  // CFO — Net income
  // -------------------------------------------------------------------------

  const cfNetIncome = state.is.netIncome;

  // -------------------------------------------------------------------------
  // CFO — Non-cash add-backs
  //
  // cfDA and cfCapex/cfCapSoftware are written by computePPE.
  // cfDeferredTax is written by computeTax (sign: positive = addback).
  // cfPIK is the total PIK accrual from all debt tranches.
  // -------------------------------------------------------------------------

  const cfDA = state.cfs.cfDA; // already set by PPE schedule
  const cfSBC = state.is.sbc; // SBC is always a non-cash IS charge
  const cfDeferredTax = state.cfs.cfDeferredTax; // set by tax schedule
  const cfPIK = state.schedules.totalPIK;

  // Placeholders for items not yet modelled
  const cfImpairment = 0;
  const cfAmortDebtCosts = 0;
  const cfGainLossDisposals = 0;
  const cfOtherNonCash = 0;

  // -------------------------------------------------------------------------
  // CFO — Working capital changes (already set by computeWorkingCapital)
  // -------------------------------------------------------------------------

  const cfChangeAR = state.cfs.cfChangeAR;
  const cfChangeInventory = state.cfs.cfChangeInventory;
  const cfChangePrepaid = state.cfs.cfChangePrepaid;
  const cfChangeAP = state.cfs.cfChangeAP;
  const cfChangeAccrued = state.cfs.cfChangeAccrued;
  const cfChangeDeferredRev = state.cfs.cfChangeDeferredRev;
  const cfChangeOtherWC = state.cfs.cfChangeOtherWC; // carried through (set to 0 if untouched)

  // -------------------------------------------------------------------------
  // CFO — Base total before GAAP/IFRS routing adjustments
  // -------------------------------------------------------------------------

  let cfOperating =
    cfNetIncome +
    cfDA +
    cfSBC +
    cfDeferredTax +
    cfPIK +
    cfImpairment +
    cfAmortDebtCosts +
    cfGainLossDisposals +
    cfOtherNonCash +
    cfChangeAR +
    cfChangeInventory +
    cfChangePrepaid +
    cfChangeAP +
    cfChangeAccrued +
    cfChangeDeferredRev +
    cfChangeOtherWC;

  // -------------------------------------------------------------------------
  // CFI — Investing activities
  //
  // cfCapex and cfCapSoftware are negative values written by computePPE.
  // -------------------------------------------------------------------------

  const cfCapex = state.cfs.cfCapex;
  const cfCapSoftware = state.cfs.cfCapSoftware;
  const cfAssetSales = 0;
  const cfAcquisitions = 0;
  const cfOtherInvesting = 0;

  const cfInvesting =
    cfCapex + cfCapSoftware + cfAssetSales + cfAcquisitions + cfOtherInvesting;

  // -------------------------------------------------------------------------
  // CFF — Financing activities
  // -------------------------------------------------------------------------

  // Debt issuances: sum of issuances across all non-revolver tranches
  let cfDebtIssuances = 0;
  // Debt repayments: sum of mandatory amort + optional prepay (negative)
  let cfDebtRepayments = 0;
  // Revolver: net draw (+) or sweep (-)
  let cfRevolverNet = 0;

  for (const trancheResult of state.schedules.debtTranches) {
    // Identify whether this tranche is the revolver
    const isRevolver =
      debtTranches?.find((t) => t.id === trancheResult.trancheId)
        ?.isRevolver ?? false;

    if (isRevolver) {
      cfRevolverNet = trancheResult.revolverDraw - trancheResult.revolverSweep;
    } else {
      cfDebtIssuances += trancheResult.issuances;
      cfDebtRepayments -= trancheResult.mandatoryAmort + trancheResult.optionalPrepay;
    }
  }

  // Equity issuances (from equity inputs or assumptions)
  const cfEquityIssuances = 0; // placeholder; equity schedule populates when implemented

  // Share repurchases and dividends: prefer values already written by the
  // equity schedule (computeEquity), which are the authoritative source.
  // Fall back to computing from equityInputs if the equity schedule has not
  // yet run (e.g. a partial pass during early SCC iterations).
  const cfShareRepurchases =
    state.cfs.cfShareRepurchases !== 0
      ? state.cfs.cfShareRepurchases
      : equityInputs
      ? -get(equityInputs.buybackBudget, periodIndex)
      : 0;

  const cfDividends =
    state.cfs.cfDividends !== 0
      ? state.cfs.cfDividends
      : equityInputs
      ? -(equityInputs.dividendPerShare * state.schedules.basicShares)
      : 0;

  const cfDebtIssuanceCosts = 0;
  const cfOtherFinancing = 0;

  let cfFinancing =
    cfDebtIssuances +
    cfDebtRepayments +
    cfRevolverNet +
    cfEquityIssuances +
    cfShareRepurchases +
    cfDividends +
    cfDebtIssuanceCosts +
    cfOtherFinancing;

  // -------------------------------------------------------------------------
  // GAAP / IFRS policy routing
  //
  // Under US GAAP, interest paid is always CFO. Under IFRS, entities may
  // elect to classify interest paid in CFF and dividends paid in CFF.
  // When the policy flags direct these items to non-default sections, we
  // reclassify them by shifting the amount between cfOperating and cfFinancing.
  //
  // Note: totalCashInterest is already embedded in cfNetIncome (via interest
  // expense reducing net income), so we must add it back to CFO and then
  // subtract it from CFF (or vice versa) to achieve the reclassification.
  // -------------------------------------------------------------------------

  if (
    policyFlags.accountingStandard === "IFRS" &&
    policyFlags.cfsInterestPaid === "CFF"
  ) {
    // Under IFRS with interest in CFF: remove interest from CFO add-back,
    // add to CFF as an explicit outflow.
    const totalCashInterest = state.schedules.totalCashInterest;
    cfOperating -= totalCashInterest;
    cfFinancing += -totalCashInterest; // outflow in CFF
  }

  if (
    policyFlags.accountingStandard === "IFRS" &&
    policyFlags.cfsDividendsPaid === "CFO"
  ) {
    // Reclassify dividends from CFF to CFO (unusual but allowed under IFRS)
    cfOperating += cfDividends;
    cfFinancing -= cfDividends;
  }

  // -------------------------------------------------------------------------
  // Totals
  // -------------------------------------------------------------------------

  const fxEffect = 0;
  const netCashChange = cfOperating + cfInvesting + cfFinancing + fxEffect;
  const beginningCash = priorState.bs.cash;
  const endingCash = beginningCash + netCashChange;

  // Free cash flow = CFO + capex + cap software spend
  const fcf = cfOperating + cfCapex + cfCapSoftware;

  // -------------------------------------------------------------------------
  // Write all CFS fields to state
  // -------------------------------------------------------------------------

  state.cfs.cfNetIncome = cfNetIncome;
  state.cfs.cfDA = cfDA;
  state.cfs.cfSBC = cfSBC;
  state.cfs.cfDeferredTax = cfDeferredTax;
  state.cfs.cfPIK = cfPIK;
  state.cfs.cfImpairment = cfImpairment;
  state.cfs.cfAmortDebtCosts = cfAmortDebtCosts;
  state.cfs.cfGainLossDisposals = cfGainLossDisposals;
  state.cfs.cfOtherNonCash = cfOtherNonCash;

  // WC changes already written by computeWorkingCapital; re-affirm for clarity
  state.cfs.cfChangeAR = cfChangeAR;
  state.cfs.cfChangeInventory = cfChangeInventory;
  state.cfs.cfChangePrepaid = cfChangePrepaid;
  state.cfs.cfChangeAP = cfChangeAP;
  state.cfs.cfChangeAccrued = cfChangeAccrued;
  state.cfs.cfChangeDeferredRev = cfChangeDeferredRev;
  state.cfs.cfChangeOtherWC = cfChangeOtherWC;

  state.cfs.cfOperating = cfOperating;

  state.cfs.cfCapex = cfCapex;
  state.cfs.cfCapSoftware = cfCapSoftware;
  state.cfs.cfAssetSales = cfAssetSales;
  state.cfs.cfAcquisitions = cfAcquisitions;
  state.cfs.cfOtherInvesting = cfOtherInvesting;
  state.cfs.cfInvesting = cfInvesting;

  state.cfs.cfDebtIssuances = cfDebtIssuances;
  state.cfs.cfDebtRepayments = cfDebtRepayments;
  state.cfs.cfRevolverNet = cfRevolverNet;
  state.cfs.cfEquityIssuances = cfEquityIssuances;
  state.cfs.cfShareRepurchases = cfShareRepurchases;
  state.cfs.cfDividends = cfDividends;
  state.cfs.cfDebtIssuanceCosts = cfDebtIssuanceCosts;
  state.cfs.cfOtherFinancing = cfOtherFinancing;
  state.cfs.cfFinancing = cfFinancing;

  state.cfs.fxEffect = fxEffect;
  state.cfs.netCashChange = netCashChange;
  state.cfs.beginningCash = beginningCash;
  state.cfs.endingCash = endingCash;
  state.cfs.fcf = fcf;
}
