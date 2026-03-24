/**
 * Tax schedule — computes current and deferred tax expense, manages NOL
 * vintage utilization, and populates deferred tax asset / liability balances.
 *
 * Entry point: computeTax
 *
 * Depends on:
 *  - state.is.ebt (EBT must already be set by the IS schedule)
 *  - priorState.bs.deferredTaxAsset / deferredTaxLiability (for deferred
 *    tax expense calculation)
 *  - priorState.schedules.nolVintages (NOL roll-forward)
 */

import {
  PeriodState,
  ModelConfig,
  NOLVintage,
  NOLVintageResult,
  Assumptions,
} from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const get = (arr: number[], i: number): number =>
  arr[Math.min(i, arr.length - 1)] ?? 0;

// ---------------------------------------------------------------------------
// NOL vintage initialisation
// ---------------------------------------------------------------------------

/**
 * Converts input NOL vintages to opening NOLVintageResult objects for period 0.
 * In subsequent periods the vintages are carried forward from priorState.
 */
function initNOLVintages(nolVintages: NOLVintage[]): NOLVintageResult[] {
  return nolVintages.map((v) => ({
    vintageYear: v.vintageYear,
    opening: v.originalAmount - v.utilizedToDate,
    utilized: 0,
    expired: 0,
    closing: v.originalAmount - v.utilizedToDate,
  }));
}

/**
 * Loads NOL vintages for the current period.
 * Uses prior period's closing balances when available; otherwise seeds from
 * the raw input (first projection period behaviour).
 */
function loadOpeningVintages(
  priorState: PeriodState,
  nolVintages: NOLVintage[]
): Array<{ vintageYear: number; opening: number; limitationRate: number; expirationYear: number | null }> {
  const priorResults = priorState.schedules.nolVintages;

  if (priorResults.length > 0) {
    // Carry forward prior closing balances; metadata (limitation, expiry) comes
    // from the original input keyed by vintageYear
    return priorResults
      .filter((r) => r.closing > 0)
      .map((r) => {
        const input = nolVintages.find(
          (v) => v.vintageYear === r.vintageYear
        );
        return {
          vintageYear: r.vintageYear,
          opening: r.closing,
          limitationRate: input?.limitationRate ?? 1.0,
          expirationYear: input?.expirationYear ?? null,
        };
      });
  }

  // First projection period — seed from raw input
  return nolVintages
    .map((v) => ({
      vintageYear: v.vintageYear,
      opening: v.originalAmount - v.utilizedToDate,
      limitationRate: v.limitationRate,
      expirationYear: v.expirationYear,
    }))
    .filter((v) => v.opening > 0);
}

// ---------------------------------------------------------------------------
// computeTax
// ---------------------------------------------------------------------------

/**
 * Computes current tax, deferred tax, and NOL roll-forward for a single
 * projection period.
 *
 * @param state         Current period state (mutated in place).
 * @param priorState    Prior period state (read-only).
 * @param nolVintages   Raw NOL vintage inputs from ModelInput.
 * @param periodIndex   0-based projection period index.
 * @param _config       Model configuration (reserved for future policy flags).
 * @param assumptions   Projection assumptions (taxRate array required).
 */
export function computeTax(
  state: PeriodState,
  priorState: PeriodState,
  nolVintages: NOLVintage[],
  periodIndex: number,
  _config: ModelConfig,
  assumptions: Assumptions
): void {
  const currentYear = state.year;
  const statutoryRate = get(assumptions.taxRate, periodIndex);

  // ------------------------------------------------------------------
  // 1. Taxable income before NOL
  // ------------------------------------------------------------------

  const ebt = state.is.ebt;
  // Placeholder for future permanent difference adjustments
  const permanentDifferences = 0;
  const taxableIncomePreNOL = ebt + permanentDifferences;

  // ------------------------------------------------------------------
  // 2. NOL vintage roll-forward
  // ------------------------------------------------------------------

  const openingVintages = loadOpeningVintages(priorState, nolVintages);
  const vintageResults: NOLVintageResult[] = [];

  let totalNOLUtilized = 0;
  let remainingIncome = Math.max(0, taxableIncomePreNOL);

  if (taxableIncomePreNOL > 0) {
    // Iterate oldest-first to consume NOLs in FIFO order
    const sorted = [...openingVintages].sort(
      (a, b) => a.vintageYear - b.vintageYear
    );

    for (const vintage of sorted) {
      const isExpired =
        vintage.expirationYear !== null &&
        currentYear > vintage.expirationYear;

      if (isExpired || vintage.opening <= 0) {
        vintageResults.push({
          vintageYear: vintage.vintageYear,
          opening: vintage.opening,
          utilized: 0,
          expired: isExpired ? vintage.opening : 0,
          closing: isExpired ? 0 : vintage.opening,
        });
        continue;
      }

      // Maximum utilization subject to Section 382 / TCJA limitation
      // limitationRate of 0.8 = 80% income cap (post-TCJA);
      // limitationRate of 1.0 = no cap (pre-TCJA).
      const maxUtilization =
        vintage.limitationRate * taxableIncomePreNOL - totalNOLUtilized;

      const utilized = Math.min(
        vintage.opening,
        Math.max(0, maxUtilization),
        remainingIncome
      );

      totalNOLUtilized += utilized;
      remainingIncome -= utilized;

      vintageResults.push({
        vintageYear: vintage.vintageYear,
        opening: vintage.opening,
        utilized,
        expired: 0,
        closing: vintage.opening - utilized,
      });
    }
  } else {
    // No taxable income — carry forward all vintages unchanged; if the
    // period generated a loss, create a new vintage for it.
    for (const vintage of openingVintages) {
      const isExpired =
        vintage.expirationYear !== null &&
        currentYear > vintage.expirationYear;

      vintageResults.push({
        vintageYear: vintage.vintageYear,
        opening: vintage.opening,
        utilized: 0,
        expired: isExpired ? vintage.opening : 0,
        closing: isExpired ? 0 : vintage.opening,
      });
    }

    // New loss vintage for this period (if any)
    const currentYearLoss = -Math.min(0, taxableIncomePreNOL);
    if (currentYearLoss > 0) {
      vintageResults.push({
        vintageYear: currentYear,
        opening: 0,
        utilized: 0,
        expired: 0,
        closing: currentYearLoss,
      });
    }
  }

  // ------------------------------------------------------------------
  // 3. Current tax expense
  // ------------------------------------------------------------------

  const taxableIncomeAfterNOL = Math.max(
    0,
    taxableIncomePreNOL - totalNOLUtilized
  );
  const currentTaxExpense = taxableIncomeAfterNOL * statutoryRate;

  // ------------------------------------------------------------------
  // 4. Deferred tax balances and expense
  // ------------------------------------------------------------------

  // DTA from remaining NOL carryforwards
  const totalRemainingNOL = vintageResults.reduce(
    (sum, v) => sum + v.closing,
    0
  );
  const currentDtaNOL = totalRemainingNOL * statutoryRate;

  // Simplified: no other temporary differences modelled here.
  // DTL from depreciation timing is left at 0 pending a dedicated
  // depreciation schedule.
  const currentDTL = 0;
  const currentDTA = currentDtaNOL;

  const priorDTA = priorState.bs.deferredTaxAsset;
  const priorDTL = priorState.bs.deferredTaxLiability;

  // Deferred tax expense = increase in DTL less increase in DTA
  // (positive = expense; negative = benefit)
  const deferredTaxExpense =
    (currentDTL - priorDTL) - (currentDTA - priorDTA);

  // ------------------------------------------------------------------
  // 5. Total tax expense
  // ------------------------------------------------------------------

  const totalTaxExpense = currentTaxExpense + deferredTaxExpense;

  // ------------------------------------------------------------------
  // Write results to state
  // ------------------------------------------------------------------

  // Income statement
  state.is.currentTaxExpense = currentTaxExpense;
  state.is.deferredTaxExpense = deferredTaxExpense;
  state.is.totalTaxExpense = totalTaxExpense;

  // Balance sheet
  state.bs.deferredTaxAsset = currentDTA;
  state.bs.deferredTaxLiability = currentDTL;
  // Income tax payable = current period cash taxes owed (simplified: equal to
  // current tax expense; a more detailed model would track estimated payments)
  state.bs.incomeTaxPayable = Math.max(0, currentTaxExpense);

  // Cash flow statement — deferred tax is a non-cash add-back / charge
  // A positive deferredTaxExpense (additional charge) means less cash paid,
  // so it is added back in CFO (sign convention: add-back is positive in CFS).
  state.cfs.cfDeferredTax = -deferredTaxExpense;

  // Schedules
  state.schedules.nolVintages = vintageResults;
}
