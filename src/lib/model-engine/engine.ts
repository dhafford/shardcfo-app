/**
 * Model engine orchestrator — three-statement financial model.
 *
 * runModel is the single public entry point.  It drives a per-period loop
 * that sequences all schedule computations in the correct evaluation order,
 * using a fixed-point solver (damped Gauss-Seidel) to resolve the
 * Interest-Cash-Revolver strongly connected component.
 *
 * Evaluation order per period
 * ----------------------------
 *  Phase 1  IS operating (revenue → EBIT)
 *  Phase 2  Working capital, PP&E, equity/SBC (non-circular supporting schedules)
 *           ↳ Update IS with authoritative D&A from PP&E
 *  Phase 3+ SCC iteration:
 *           computeDebt → computeISBelowEBIT → computeTax
 *           → net income update → computeEquity
 *           → computeCashFlow → computeBalanceSheet
 *           → computeRevolverPlug  (returns new revolver guess)
 *  Post     Finalize period, append to output array
 *
 * If no revolver is present the SCC loop runs exactly once (no iteration needed).
 */

import type {
  ModelInput,
  ModelConfig,
  ModelOutput,
  PeriodState,
  SolverMetrics,
} from "./types";
import { createEmptyPeriodState, createPeriodStateFromHistorical } from "./types";
import { createDefaultConfig } from "./config";
import { solveFixedPoint } from "./solver";
import { runDiagnostics } from "./diagnostics";

// Schedules
import { computeISOperating, computeISBelowEBIT } from "./schedules/income-statement";
import { computeWorkingCapital } from "./schedules/working-capital";
import { computePPE } from "./schedules/ppe";
import { computeDebt, computeRevolverPlug } from "./schedules/debt";
import { computeTax } from "./schedules/tax";
import { computeCashFlow } from "./schedules/cash-flow";
import { computeBalanceSheet } from "./schedules/balance-sheet";
import { computeEquity } from "./schedules/equity";

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

function validateInput(input: ModelInput): void {
  if (!input.historicalIS || input.historicalIS.revenue <= 0) {
    throw new Error(
      "ModelInput.historicalIS.revenue must be a positive number. " +
        `Received: ${input.historicalIS?.revenue}`
    );
  }

  if (!Array.isArray(input.debtTranches)) {
    throw new Error("ModelInput.debtTranches must be an array (can be empty).");
  }

  if (!input.assumptions) {
    throw new Error("ModelInput.assumptions is required.");
  }

  if (
    !Array.isArray(input.assumptions.revenueStreams) ||
    input.assumptions.revenueStreams.length === 0
  ) {
    throw new Error(
      "ModelInput.assumptions.revenueStreams must be a non-empty array."
    );
  }
}

// ---------------------------------------------------------------------------
// runModel
// ---------------------------------------------------------------------------

/**
 * Runs the three-statement financial model for all projection periods.
 *
 * @param input          Complete model input (historical IS/BS, assumptions, debt, etc.)
 * @param configOverrides Optional partial overrides merged onto the default config.
 * @returns              Complete ModelOutput with periods, diagnostics, and solver metrics.
 */
export function runModel(
  input: ModelInput,
  configOverrides?: Partial<ModelConfig>
): ModelOutput {
  // -------------------------------------------------------------------------
  // 1. Validate and configure
  // -------------------------------------------------------------------------

  validateInput(input);
  const config = createDefaultConfig(configOverrides);

  // -------------------------------------------------------------------------
  // 2. Build the anchor (historical) period — period index -1
  // -------------------------------------------------------------------------

  const anchorLabel = `FY ${input.historicalIS.lastFiscalYear}A`;
  const anchorState = createPeriodStateFromHistorical(
    input.historicalBS,
    input.historicalIS,
    anchorLabel,
    input.historicalIS.lastFiscalYear
  );

  // -------------------------------------------------------------------------
  // 3. Projection loop
  // -------------------------------------------------------------------------

  const periods: PeriodState[] = [];
  const solverMetrics: SolverMetrics[] = [];

  const hasRevolver = input.debtTranches.some((t) => t.isRevolver);

  for (let t = 0; t < config.projectionYears; t++) {
    const year = input.historicalIS.lastFiscalYear + t + 1;
    const label = `FY ${year}E`;
    const state = createEmptyPeriodState(label, year, t);
    const priorState: PeriodState = t === 0 ? anchorState : periods[t - 1];

    // -----------------------------------------------------------------------
    // Phase 1: IS operating — revenue through EBIT
    // -----------------------------------------------------------------------

    computeISOperating(state, priorState, input.assumptions, t, config);

    // -----------------------------------------------------------------------
    // Phase 2: Supporting schedules (non-SCC)
    // -----------------------------------------------------------------------

    computeWorkingCapital(state, priorState, input.assumptions, t, config);
    computePPE(state, priorState, input.assumptions, t, config);

    // computePPE is the single source of truth for D&A; it writes state.is.da
    // directly.  Recompute operatingIncome so it is consistent with the
    // authoritative D&A figure before the SCC loop begins.
    state.is.operatingIncome = state.is.ebitda - state.is.da - state.is.sbc;

    // -----------------------------------------------------------------------
    // Phase 3–5: SCC iteration (Interest → Cash → Revolver)
    // -----------------------------------------------------------------------

    if (hasRevolver) {
      const initialGuess = priorState.bs.revolverBalance;

      const solverParams = {
        alpha: config.solverConfig.alpha,
        tolerance: config.solverConfig.tolerance,
        maxIterations: config.solverConfig.maxIterations,
        breakerMode: config.solverConfig.breakerMode,
      };

      const solverResult = solveFixedPoint(
        solverParams,
        initialGuess,
        (revolverGuess: number): number => {
          // Reset IS fields that are re-derived inside the SCC loop so that
          // each iteration starts from a clean state for the SCC-dependent
          // portion.  Non-SCC fields (revenue, EBIT, WC, PPE) are left
          // intact — they do not change across iterations.
          state.is.interestExpense = 0;
          state.is.ebt = 0;
          state.is.currentTaxExpense = 0;
          state.is.deferredTaxExpense = 0;
          state.is.totalTaxExpense = 0;
          state.is.netIncome = 0;

          // Phase 3a: Debt — derives interest expense from revolver guess
          computeDebt(
            state,
            priorState,
            input.debtTranches,
            t,
            config,
            revolverGuess
          );

          // Phase 3b: IS below EBIT — interest through EBT (tax estimated)
          computeISBelowEBIT(state, priorState, input.assumptions, t, config);

          // Phase 3c: Tax — replaces IS tax estimate with NOL-aware computation
          computeTax(
            state,
            priorState,
            input.nolVintages,
            t,
            config,
            input.assumptions
          );

          // Finalize net income with actual (not estimated) tax expense
          state.is.netIncome = state.is.ebt - state.is.totalTaxExpense;

          // Phase 3d: Equity — retained earnings, share counts, buybacks
          computeEquity(
            state,
            priorState,
            input.equityInputs,
            t,
            config
          );

          // Phase 4: Cash flow statement
          computeCashFlow(
            state,
            priorState,
            input.assumptions,
            t,
            config,
            input.equityInputs,
            input.debtTranches
          );

          // Phase 5: Balance sheet assembly (plug cash from CFS)
          computeBalanceSheet(state, priorState, config);

          // Return the new revolver balance for the next iteration
          return computeRevolverPlug(
            state,
            priorState,
            input.debtTranches,
            config
          );
        }
      );

      solverMetrics.push({
        converged: solverResult.converged,
        iterations: solverResult.iterations,
        finalResidual: solverResult.finalResidual,
      });
    } else {
      // No revolver — SCC loop runs exactly once, no iteration needed

      computeDebt(state, priorState, input.debtTranches, t, config);
      computeISBelowEBIT(state, priorState, input.assumptions, t, config);
      computeTax(
        state,
        priorState,
        input.nolVintages,
        t,
        config,
        input.assumptions
      );

      state.is.netIncome = state.is.ebt - state.is.totalTaxExpense;

      computeEquity(state, priorState, input.equityInputs, t, config);
      computeCashFlow(
        state,
        priorState,
        input.assumptions,
        t,
        config,
        input.equityInputs,
        input.debtTranches
      );
      computeBalanceSheet(state, priorState, config);

      solverMetrics.push({
        converged: true,
        iterations: 1,
        finalResidual: 0,
      });
    }

    periods.push(state);
  }

  // -------------------------------------------------------------------------
  // 4. Diagnostics
  // -------------------------------------------------------------------------

  const partialOutput: ModelOutput = {
    periods,
    diagnostics: [],
    solverMetrics,
  };

  const diagnostics = runDiagnostics(partialOutput);

  return {
    periods,
    diagnostics,
    solverMetrics,
  };
}
