/**
 * Debt schedule — computes interest expense, PIK accruals, revolver draws/sweeps,
 * and all debt balance roll-forwards for a single projection period.
 *
 * Two entry points:
 *  - computeDebt: called inside the SCC solver loop; accepts an optional
 *    revolverBalanceGuess so the circular interest / cash dependency can be
 *    iterated to convergence.
 *  - computeRevolverPlug: called after CFS is fully computed for the period;
 *    determines the net revolver draw or sweep and returns the new balance so
 *    the solver can feed it back into the next iteration.
 */

import {
  PeriodState,
  ModelConfig,
  DebtTranche,
  DebtTrancheResult,
} from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const get = (arr: number[], i: number): number =>
  arr[Math.min(i, arr.length - 1)] ?? 0;

/**
 * Resolves the effective all-in interest rate for a tranche.
 * For floating instruments the rate = benchmark spread + contractual spread,
 * subject to an optional rate floor.
 */
function effectiveRate(tranche: DebtTranche): number {
  const raw = tranche.isFloating
    ? tranche.interestRate + tranche.spread
    : tranche.interestRate;
  return tranche.floor > 0 ? Math.max(raw, tranche.floor) : raw;
}

/**
 * Finds the DebtTrancheResult for a given tranche id from the prior period.
 * Returns undefined for period 0 (no prior result exists).
 */
function priorResult(
  priorState: PeriodState,
  trancheId: string
): DebtTrancheResult | undefined {
  return priorState.schedules.debtTranches.find(
    (r) => r.trancheId === trancheId
  );
}

// ---------------------------------------------------------------------------
// computeDebt
// ---------------------------------------------------------------------------

/**
 * Computes all debt tranche balances, interest expense, PIK accruals, and
 * revolver activity for the current period.
 *
 * @param state         Current period state (mutated in place).
 * @param priorState    Prior period state (read-only).
 * @param debtTranches  Full list of debt tranches from ModelInput.
 * @param periodIndex   0-based projection period index.
 * @param config        Model configuration (unused here but kept for symmetry).
 * @param revolverBalanceGuess  Optional revolver closing balance from the
 *                              solver's previous iteration. When absent, the
 *                              function uses the prior period's drawn balance
 *                              as the initial estimate.
 */
export function computeDebt(
  state: PeriodState,
  priorState: PeriodState,
  debtTranches: DebtTranche[],
  periodIndex: number,
  _config: ModelConfig,
  revolverBalanceGuess?: number
): void {
  const results: DebtTrancheResult[] = [];

  let totalCashInterest = 0;
  let totalPIK = 0;
  let totalCommitmentFees = 0;
  let totalLongTermDebt = 0;
  let currentPortionLTD = 0;
  let revolverBalance = 0;

  // We need the next-period mandatory amort to determine current portion of LTD.
  // Pre-index next period amort amounts by tranche id.
  const nextPeriodAmort: Record<string, number> = {};
  for (const tranche of debtTranches) {
    nextPeriodAmort[tranche.id] = get(
      tranche.mandatoryAmortization,
      periodIndex + 1
    );
  }

  for (const tranche of debtTranches) {
    if (tranche.isRevolver) {
      results.push(
        computeRevolverTranche(
          tranche,
          priorState,
          revolverBalanceGuess
        )
      );
    } else {
      results.push(
        computeTermTranche(tranche, priorState, periodIndex)
      );
    }
  }

  // Aggregate across all tranches
  for (const result of results) {
    const tranche = debtTranches.find((t) => t.id === result.trancheId)!;

    totalCashInterest += result.cashInterest;
    totalCashInterest += result.commitmentFee;
    totalPIK += result.pikAccrual;

    if (tranche.isRevolver) {
      revolverBalance = result.closing;
      // Revolver sits in current liabilities; not in LTD buckets
    } else {
      // Current portion = mandatory amort due in the *next* period
      const nextAmort = nextPeriodAmort[tranche.id] ?? 0;
      currentPortionLTD += nextAmort;
      // Long-term = remaining balance beyond current portion
      totalLongTermDebt += Math.max(0, result.closing - nextAmort);
    }

    totalCommitmentFees += result.commitmentFee;
  }

  const totalInterestExpense = totalCashInterest + totalPIK;

  // Write schedule results
  state.schedules.debtTranches = results;
  state.schedules.totalInterestExpense = totalInterestExpense;
  state.schedules.totalCashInterest = totalCashInterest;
  state.schedules.totalPIK = totalPIK;

  // Write IS — interest expense flows to income statement
  state.is.interestExpense = totalInterestExpense;

  // Write BS debt balances
  state.bs.longTermDebt = totalLongTermDebt;
  state.bs.currentPortionLTD = currentPortionLTD;
  state.bs.revolverBalance = revolverBalance;
}

// ---------------------------------------------------------------------------
// Non-revolver tranche computation
// ---------------------------------------------------------------------------

function computeTermTranche(
  tranche: DebtTranche,
  priorState: PeriodState,
  periodIndex: number
): DebtTrancheResult {
  const prior = priorResult(priorState, tranche.id);

  // Opening balance: use prior closing or initial principal on first period
  const opening = prior?.closing ?? tranche.principalBalance;

  const mandatoryAmort = get(tranche.mandatoryAmortization, periodIndex);

  // First-pass closing estimate (PIK not yet known)
  const closingEstimate = opening - mandatoryAmort;

  // Average balance used for interest / PIK calculations
  const avgBalance = (opening + closingEstimate) / 2;

  // PIK accrual (capitalised; does not consume cash)
  const pikAccrual = avgBalance * tranche.pikRate;

  // Cash interest on average balance at effective all-in rate
  const cashInterest = avgBalance * effectiveRate(tranche);

  // True closing balance: PIK is added back, amort reduces principal
  const closing = opening + pikAccrual - mandatoryAmort;

  return {
    trancheId: tranche.id,
    opening,
    issuances: 0,
    mandatoryAmort,
    optionalPrepay: 0,
    pikAccrual,
    closing,
    cashInterest,
    revolverDraw: 0,
    revolverSweep: 0,
    commitmentFee: 0,
  };
}

// ---------------------------------------------------------------------------
// Revolver tranche computation
// ---------------------------------------------------------------------------

function computeRevolverTranche(
  tranche: DebtTranche,
  priorState: PeriodState,
  revolverBalanceGuess?: number
): DebtTrancheResult {
  const prior = priorResult(priorState, tranche.id);

  // Opening = prior period's revolver closing balance (0 at model inception)
  const opening = prior?.closing ?? 0;

  // Use the solver's guess for the target closing balance; fall back to the
  // opening balance (i.e. no net change) for the very first iteration.
  const targetClosing = revolverBalanceGuess ?? opening;

  // Average drawn balance for interest calculation
  const avgDrawn = (opening + targetClosing) / 2;

  // Cash interest on drawn portion
  const cashInterest = avgDrawn * effectiveRate(tranche);

  // Commitment fee on the average undrawn portion
  const commitment = tranche.commitment ?? 0;
  const avgUndrawn = commitment - avgDrawn;
  const commitmentFee =
    Math.max(0, avgUndrawn) * (tranche.commitmentFeeRate ?? 0);

  // Net draw / sweep relative to prior balance
  const netChange = targetClosing - opening;
  const revolverDraw = Math.max(0, netChange);
  const revolverSweep = Math.max(0, -netChange);

  return {
    trancheId: tranche.id,
    opening,
    issuances: revolverDraw,
    mandatoryAmort: 0,
    optionalPrepay: revolverSweep,
    pikAccrual: 0,
    closing: targetClosing,
    cashInterest,
    revolverDraw,
    revolverSweep,
    commitmentFee,
  };
}

// ---------------------------------------------------------------------------
// computeRevolverPlug
// ---------------------------------------------------------------------------

/**
 * Determines the required revolver draw or sweep after the cash flow statement
 * has been computed for the period.
 *
 * The solver calls this function, feeds the returned balance back into
 * `computeDebt` as `revolverBalanceGuess`, and iterates until convergence.
 *
 * @param state         Current period state — must have `cfs.endingCash` set.
 * @param priorState    Prior period state (read-only).
 * @param debtTranches  Full list of debt tranches from ModelInput.
 * @param _config       Model configuration (reserved for future policy flags).
 * @returns             New revolver closing balance after draw / sweep.
 */
export function computeRevolverPlug(
  state: PeriodState,
  priorState: PeriodState,
  debtTranches: DebtTranche[],
  _config: ModelConfig
): number {
  const revolverTranche = debtTranches.find((t) => t.isRevolver);

  // No revolver in the capital structure — nothing to do
  if (!revolverTranche) {
    return 0;
  }

  const prior = priorResult(priorState, revolverTranche.id);
  const priorDrawn = prior?.closing ?? 0;

  // Cash available before any revolver adjustment
  const prePlugCash = state.cfs.endingCash;

  // Minimum cash balance the model must maintain
  const minCash = revolverTranche.minCash ?? 0;

  // Maximum availability constrained by commitment, borrowing base, and any
  // outstanding letters of credit
  const commitment = revolverTranche.commitment ?? 0;
  const borrowingBase = revolverTranche.borrowingBase ?? Infinity;
  const locOutstanding = revolverTranche.locOutstanding ?? 0;
  const maxAvailability =
    Math.min(commitment, borrowingBase) - locOutstanding;

  let draw = 0;
  let sweep = 0;

  if (prePlugCash < minCash) {
    // Cash is below the floor — draw enough to restore the minimum
    const shortfall = minCash - prePlugCash;
    const unusedCapacity = Math.max(0, maxAvailability - priorDrawn);
    draw = Math.min(unusedCapacity, shortfall);
    draw = Math.max(0, draw);
  } else if (prePlugCash > minCash && priorDrawn > 0) {
    // Excess cash above the floor — sweep down the revolver
    const excess = prePlugCash - minCash;
    sweep = Math.min(priorDrawn, excess);
    sweep = Math.max(0, sweep);
  }

  return priorDrawn + draw - sweep;
}
