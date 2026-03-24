/**
 * PP&E and capitalized software schedule — dual roll-forward.
 *
 * Phase 2: depends on computeISOperating (state.is.revenue), no circular
 * references.
 *
 * This schedule is the single source of truth for total D&A.  It writes
 * state.is.da so that computeISOperating's estimate is replaced before the
 * SCC loop begins.
 *
 * D&A split convention (matching the existing engine pattern):
 *   40% → PP&E depreciation
 *   60% → capitalized software amortization
 *
 * The total D&A rate is derived from capexPercent, which serves as a
 * steady-state proxy (D&A ≈ CapEx at steady state).
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
// Schedule
// ---------------------------------------------------------------------------

/**
 * Computes the PP&E and capitalized software roll-forwards, derives D&A, and
 * writes investing cash flow items.
 *
 * Reads:
 *   state.is.revenue                           — set by computeISOperating
 *   priorState.bs.grossPPE                     — opening gross PP&E
 *   priorState.bs.accumulatedDepreciation      — opening accumulated depr (negative convention)
 *   priorState.bs.capitalizedSoftwareNet       — opening net cap software
 *   priorState.schedules.grossPPERollForward   — prior roll-forward for continuity
 *   priorState.schedules.accumDeprRollForward  — prior roll-forward for continuity
 *
 * Writes balance sheet:
 *   state.bs.grossPPE, accumulatedDepreciation, netPPE, capitalizedSoftwareNet
 *
 * Writes income statement (single source of truth):
 *   state.is.da  — total D&A (PP&E depr + software amort)
 *
 * Writes schedules (roll-forward detail):
 *   state.schedules.grossPPERollForward
 *   state.schedules.accumDeprRollForward
 *
 * Writes cash flow statement (investing outflows):
 *   state.cfs.cfCapex       — negative (cash outflow)
 *   state.cfs.cfCapSoftware — negative (cash outflow)
 *
 * Also writes state.cfs.cfDA as the non-cash D&A add-back for operating cash flow.
 */
export function computePPE(
  state: PeriodState,
  priorState: PeriodState,
  assumptions: Assumptions,
  periodIndex: number,
  _config: ModelConfig
): void {
  const i = periodIndex;
  const revenue = state.is.revenue;

  // -------------------------------------------------------------------------
  // Capital expenditures and capitalized software spend
  // -------------------------------------------------------------------------

  const capex = revenue * get(assumptions.capexPercent, i);
  const capSoftwareSpend = revenue * get(assumptions.capSoftwarePercent, i);

  // -------------------------------------------------------------------------
  // Total D&A — derived from capexPercent as steady-state proxy
  //
  // Using the same rate as capex produces D&A ≈ CapEx at steady state, which
  // is a standard simplifying assumption for projection models.  The PPE and
  // software splits follow the 40/60 convention.
  // -------------------------------------------------------------------------

  const totalDA = revenue * get(assumptions.capexPercent, i);
  const ppeDepreciation = totalDA * 0.4;
  const softwareAmort = totalDA * 0.6;

  // -------------------------------------------------------------------------
  // PP&E gross roll-forward
  //
  // Opening balance: use the prior period's closing gross PP&E.  For period 0
  // this is the historical balance; for subsequent periods it is last period's
  // roll-forward closing.
  //
  // Note: grossPPERollForward.closing tracks the roll-forward independently
  // from bs.grossPPE.  On period 0 (historical), the roll-forward closing is
  // 0 (no prior roll-forward), so we fall back to priorState.bs.grossPPE.
  // -------------------------------------------------------------------------

  const priorGrossPPERFClosing = priorState.schedules.grossPPERollForward.closing;
  const openingGrossPPE =
    priorGrossPPERFClosing !== 0
      ? priorGrossPPERFClosing
      : priorState.bs.grossPPE;

  const closingGrossPPE = openingGrossPPE + capex;

  state.schedules.grossPPERollForward = {
    opening: openingGrossPPE,
    additions: capex,
    disposals: 0,
    closing: closingGrossPPE,
  };

  // -------------------------------------------------------------------------
  // Accumulated depreciation roll-forward
  //
  // Accumulated depreciation is carried as a negative number on the balance
  // sheet (offsetting gross PP&E), so we subtract the depreciation expense to
  // make it more negative.  The roll-forward tracks the absolute value
  // convention: expense is positive, and closing = opening - expense.
  //
  // For the opening balance we use the absolute value of accumulatedDepreciation
  // from the prior BS (which is stored as negative), so we negate it.
  // -------------------------------------------------------------------------

  const priorAccumDeprRFClosing = priorState.schedules.accumDeprRollForward.closing;
  // Prior BS stores accumulated depreciation as a negative number; convert to
  // positive for roll-forward arithmetic.
  const priorBSAccumDeprAbs = Math.abs(priorState.bs.accumulatedDepreciation);
  const openingAccumDepr =
    priorAccumDeprRFClosing !== 0
      ? priorAccumDeprRFClosing
      : priorBSAccumDeprAbs;

  const closingAccumDepr = openingAccumDepr + ppeDepreciation;

  state.schedules.accumDeprRollForward = {
    opening: openingAccumDepr,
    expense: ppeDepreciation,
    disposals: 0,
    closing: closingAccumDepr,
  };

  // -------------------------------------------------------------------------
  // Balance sheet — PP&E
  //
  // Gross PP&E: positive.
  // Accumulated depreciation: stored as negative per the convention used in
  //   createPeriodStateFromHistorical (netPPE = grossPPE + accumulatedDepreciation).
  // Net PP&E: grossPPE - |accumDepr| = closingGrossPPE - closingAccumDepr.
  // -------------------------------------------------------------------------

  state.bs.grossPPE = closingGrossPPE;
  state.bs.accumulatedDepreciation = -closingAccumDepr; // negative convention
  state.bs.netPPE = closingGrossPPE - closingAccumDepr;

  // -------------------------------------------------------------------------
  // Capitalized software — net roll-forward
  //
  // Floor at 0: net book value cannot go negative.
  // -------------------------------------------------------------------------

  const priorCapSoftwareNet = priorState.bs.capitalizedSoftwareNet;
  const capSoftwareNet = Math.max(0, priorCapSoftwareNet + capSoftwareSpend - softwareAmort);
  state.bs.capitalizedSoftwareNet = capSoftwareNet;

  // -------------------------------------------------------------------------
  // Total D&A — write to IS as single source of truth
  // -------------------------------------------------------------------------

  state.is.da = totalDA;

  // D&A non-cash add-back for the cash flow statement (operating section).
  state.cfs.cfDA = totalDA;

  // -------------------------------------------------------------------------
  // Investing cash outflows
  // -------------------------------------------------------------------------

  state.cfs.cfCapex = -capex;
  state.cfs.cfCapSoftware = -capSoftwareSpend;
}
