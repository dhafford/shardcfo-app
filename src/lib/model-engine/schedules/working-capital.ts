/**
 * Working capital schedule — balance sheet current asset / liability drivers
 * and the corresponding cash flow statement change items.
 *
 * Phase 2: depends on computeISOperating (state.is.revenue and state.is.cogs),
 * no circular references.
 *
 * Sign convention for CFS working capital deltas:
 *   Asset increase  → negative (use of cash)
 *   Liability increase → positive (source of cash)
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
 * Computes working capital balance sheet items from revenue/COGS drivers and
 * derives the cash flow statement change deltas.
 *
 * Reads:
 *   state.is.revenue      — set by computeISOperating
 *   state.is.cogs         — set by computeISOperating
 *   priorState.bs.*       — prior-period ending balances
 *
 * Writes balance sheet:
 *   state.bs.accountsReceivable, inventory, prepaidExpenses,
 *   accountsPayable, accruedLiabilities,
 *   deferredRevenueCurrent, deferredRevenueNonCurrent
 *
 * Writes cash flow statement:
 *   state.cfs.cfChangeAR, cfChangeInventory, cfChangePrepaid,
 *   cfChangeAP, cfChangeAccrued, cfChangeDeferredRev
 */
export function computeWorkingCapital(
  state: PeriodState,
  priorState: PeriodState,
  assumptions: Assumptions,
  periodIndex: number,
  _config: ModelConfig
): void {
  const i = periodIndex;
  const revenue = state.is.revenue;
  const cogs = state.is.cogs;

  // -------------------------------------------------------------------------
  // Balance sheet — asset drivers (days-based and percent-of-revenue)
  // -------------------------------------------------------------------------

  const accountsReceivable = revenue * get(assumptions.dso, i) / 365;
  const inventory = cogs * get(assumptions.dio, i) / 365;
  const prepaidExpenses = revenue * get(assumptions.prepaidPercent, i);

  // -------------------------------------------------------------------------
  // Balance sheet — liability drivers
  // -------------------------------------------------------------------------

  const accountsPayable = cogs * get(assumptions.dpo, i) / 365;
  const accruedLiabilities = revenue * get(assumptions.accruedLiabPercent, i);
  const deferredRevenueCurrent = revenue * get(assumptions.deferredRevCurrentPercent, i);
  const deferredRevenueNonCurrent = revenue * get(assumptions.deferredRevNonCurrentPercent, i);

  // Write to balance sheet state
  state.bs.accountsReceivable = accountsReceivable;
  state.bs.inventory = inventory;
  state.bs.prepaidExpenses = prepaidExpenses;
  state.bs.accountsPayable = accountsPayable;
  state.bs.accruedLiabilities = accruedLiabilities;
  state.bs.deferredRevenueCurrent = deferredRevenueCurrent;
  state.bs.deferredRevenueNonCurrent = deferredRevenueNonCurrent;

  // -------------------------------------------------------------------------
  // Cash flow statement — working capital change items
  // -------------------------------------------------------------------------

  // Asset increases consume cash (negative); liability increases provide cash (positive).

  state.cfs.cfChangeAR =
    -(accountsReceivable - priorState.bs.accountsReceivable);

  state.cfs.cfChangeInventory =
    -(inventory - priorState.bs.inventory);

  state.cfs.cfChangePrepaid =
    -(prepaidExpenses - priorState.bs.prepaidExpenses);

  state.cfs.cfChangeAP =
    accountsPayable - priorState.bs.accountsPayable;

  state.cfs.cfChangeAccrued =
    accruedLiabilities - priorState.bs.accruedLiabilities;

  // Deferred revenue spans both current and non-current; combine the delta.
  state.cfs.cfChangeDeferredRev =
    (deferredRevenueCurrent - priorState.bs.deferredRevenueCurrent) +
    (deferredRevenueNonCurrent - priorState.bs.deferredRevenueNonCurrent);
}
