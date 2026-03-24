/**
 * Diagnostic checks for the three-statement financial model.
 *
 * runDiagnostics executes a battery of numerical checks across all projection
 * periods and returns a flat array of DiagnosticResult records.  Each check
 * is assigned a stable ID, a human-readable name, a severity, and pass/fail
 * status with an optional deviation value for numerical checks.
 *
 * Check registry
 * --------------
 *  DIAG-BS-001       Balance sheet equality (Assets = L+E)           CRITICAL
 *  DIAG-CFS-001      Cash tie-out (CFS ending cash = BS cash)        CRITICAL
 *  DIAG-RE-001       Retained earnings continuity                     CRITICAL
 *  DIAG-WC-001       Working capital delta matching                   CRITICAL
 *  DIAG-DA-001       D&A consistency (IS da = CFS cfDA)              HIGH
 *  DIAG-DEBT-001     Debt roll-forward integrity per tranche          HIGH
 *  DIAG-PPE-001      PP&E net book value roll-forward                 HIGH
 *  DIAG-EQUITY-001   Total equity component sum                       HIGH
 *  DIAG-CONVERGENCE-001  Solver convergence                           CRITICAL
 *  DIAG-LIQUIDITY-001    Positive cash balance                        WARNING
 */

import type { ModelOutput, DiagnosticResult, PeriodState } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Absolute tolerance for numerical equality checks (sub-cent on $M figures). */
const TOLERANCE = 1e-6;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResult(
  id: string,
  name: string,
  severity: DiagnosticResult["severity"],
  passed: boolean,
  period: number,
  deviation?: number,
  rootCause?: string,
  fix?: string
): DiagnosticResult {
  return { id, name, severity, passed, period, deviation, rootCause, fix };
}

// ---------------------------------------------------------------------------
// Per-period checks
// ---------------------------------------------------------------------------

function checkBalanceSheet(
  period: PeriodState,
  periodIndex: number
): DiagnosticResult {
  const deviation = Math.abs(
    period.bs.totalAssets - period.bs.totalLiabilitiesAndEquity
  );
  const passed = deviation <= TOLERANCE;
  return makeResult(
    "DIAG-BS-001",
    "Balance Sheet Check",
    "CRITICAL",
    passed,
    periodIndex,
    deviation,
    passed ? undefined : "Assets do not equal Liabilities + Equity",
    passed
      ? undefined
      : "Verify that all balance sheet schedules are writing to the correct state fields"
  );
}

function checkCashTieOut(
  period: PeriodState,
  periodIndex: number
): DiagnosticResult {
  const deviation = Math.abs(period.cfs.endingCash - period.bs.cash);
  const passed = deviation <= TOLERANCE;
  return makeResult(
    "DIAG-CFS-001",
    "Cash Tie-Out",
    "CRITICAL",
    passed,
    periodIndex,
    deviation,
    passed ? undefined : "CFS ending cash does not match BS cash balance",
    passed
      ? undefined
      : "Ensure computeBalanceSheet runs after computeCashFlow and sets bs.cash = cfs.endingCash"
  );
}

function checkRetainedEarnings(
  period: PeriodState,
  priorRE: number,
  periodIndex: number
): DiagnosticResult {
  // Dividends paid are recorded as a negative outflow in cfDividends;
  // the dividend amount is therefore -cfDividends.
  const dividendsPaid = -period.cfs.cfDividends;
  const expected = priorRE + period.is.netIncome - dividendsPaid;
  const deviation = Math.abs(period.bs.retainedEarnings - expected);
  const passed = deviation <= TOLERANCE;
  return makeResult(
    "DIAG-RE-001",
    "Retained Earnings Continuity",
    "CRITICAL",
    passed,
    periodIndex,
    deviation,
    passed
      ? undefined
      : `RE expected ${expected.toFixed(2)}, actual ${period.bs.retainedEarnings.toFixed(2)}`,
    passed
      ? undefined
      : "Check computeEquity: retainedEarnings = priorRE + netIncome - dividends"
  );
}

function checkWorkingCapitalDelta(
  period: PeriodState,
  priorPeriod: PeriodState,
  periodIndex: number
): DiagnosticResult {
  // CFS working capital items
  const cfsWC =
    period.cfs.cfChangeAR +
    period.cfs.cfChangeInventory +
    period.cfs.cfChangePrepaid +
    period.cfs.cfChangeAP +
    period.cfs.cfChangeAccrued +
    period.cfs.cfChangeDeferredRev +
    period.cfs.cfChangeOtherWC;

  // BS delta: NWC = operating CA - operating CL
  // Operating CA (excl. cash and short-term investments)
  const nwcCurrent =
    period.bs.accountsReceivable +
    period.bs.inventory +
    period.bs.prepaidExpenses -
    period.bs.accountsPayable -
    period.bs.accruedLiabilities -
    period.bs.deferredRevenueCurrent;

  const nwcPrior =
    priorPeriod.bs.accountsReceivable +
    priorPeriod.bs.inventory +
    priorPeriod.bs.prepaidExpenses -
    priorPeriod.bs.accountsPayable -
    priorPeriod.bs.accruedLiabilities -
    priorPeriod.bs.deferredRevenueCurrent;

  // Increase in NWC is a use of cash (negative in CFS), so sign flip:
  //   bsWC = -(NWC_t - NWC_{t-1})
  const bsWC = -(nwcCurrent - nwcPrior);

  // Also include non-current deferred revenue delta (part of cfChangeDeferredRev)
  const deferredRevNonCurrentDelta =
    period.bs.deferredRevenueNonCurrent -
    priorPeriod.bs.deferredRevenueNonCurrent;
  const bsWCTotal = bsWC + deferredRevNonCurrentDelta;

  const deviation = Math.abs(cfsWC - bsWCTotal);
  const passed = deviation <= TOLERANCE;
  return makeResult(
    "DIAG-WC-001",
    "Working Capital Delta Matching",
    "CRITICAL",
    passed,
    periodIndex,
    deviation,
    passed
      ? undefined
      : "CFS WC changes do not match BS NWC movements",
    passed
      ? undefined
      : "Verify computeWorkingCapital derives CFS changes directly from BS balance differences"
  );
}

function checkDAConsistency(
  period: PeriodState,
  periodIndex: number
): DiagnosticResult {
  const deviation = Math.abs(period.is.da - period.cfs.cfDA);
  const passed = deviation <= TOLERANCE;
  return makeResult(
    "DIAG-DA-001",
    "D&A Consistency",
    "HIGH",
    passed,
    periodIndex,
    deviation,
    passed
      ? undefined
      : `IS da (${period.is.da.toFixed(2)}) differs from CFS cfDA (${period.cfs.cfDA.toFixed(2)})`,
    passed
      ? undefined
      : "computePPE should write the same totalDA value to both state.is.da and state.cfs.cfDA"
  );
}

function checkDebtRollForward(
  period: PeriodState,
  periodIndex: number
): DiagnosticResult[] {
  const results: DiagnosticResult[] = [];

  for (const tranche of period.schedules.debtTranches) {
    // Roll-forward identity: closing = opening + pikAccrual - mandatoryAmort
    // (optionalPrepay and issuances are separate events; for standard term
    // loans and revolvers the core identity uses mandatory amort only)
    const expected =
      tranche.opening + tranche.pikAccrual - tranche.mandatoryAmort;
    const deviation = Math.abs(tranche.closing - expected);
    const passed = deviation <= TOLERANCE;

    results.push(
      makeResult(
        "DIAG-DEBT-001",
        `Debt Roll-Forward (${tranche.trancheId})`,
        "HIGH",
        passed,
        periodIndex,
        deviation,
        passed
          ? undefined
          : `Tranche ${tranche.trancheId}: closing mismatch (expected ${expected.toFixed(2)}, actual ${tranche.closing.toFixed(2)})`,
        passed
          ? undefined
          : "Check computeDebt closing balance calculation for this tranche"
      )
    );
  }

  return results;
}

function checkPPERollForward(
  period: PeriodState,
  periodIndex: number
): DiagnosticResult {
  // Net PPE on BS should equal gross PP&E roll-forward closing minus
  // accumulated depreciation roll-forward closing.
  // accumDeprRollForward.closing is the absolute (positive) accumulated depr.
  const expectedNetPPE =
    period.schedules.grossPPERollForward.closing -
    period.schedules.accumDeprRollForward.closing;
  const deviation = Math.abs(period.bs.netPPE - expectedNetPPE);
  const passed = deviation <= TOLERANCE;
  return makeResult(
    "DIAG-PPE-001",
    "PP&E Roll-Forward",
    "HIGH",
    passed,
    periodIndex,
    deviation,
    passed
      ? undefined
      : `Net PPE mismatch: expected ${expectedNetPPE.toFixed(2)}, BS has ${period.bs.netPPE.toFixed(2)}`,
    passed
      ? undefined
      : "Verify computePPE sets netPPE = grossRF.closing - accumRF.closing"
  );
}

function checkEquityTotal(
  period: PeriodState,
  periodIndex: number
): DiagnosticResult {
  const expected =
    period.bs.commonStock +
    period.bs.apic +
    period.bs.retainedEarnings +
    period.bs.aoci +
    period.bs.treasuryStock;
  const deviation = Math.abs(period.bs.totalEquity - expected);
  const passed = deviation <= TOLERANCE;
  return makeResult(
    "DIAG-EQUITY-001",
    "Total Equity Composition",
    "HIGH",
    passed,
    periodIndex,
    deviation,
    passed
      ? undefined
      : `totalEquity (${period.bs.totalEquity.toFixed(2)}) != component sum (${expected.toFixed(2)})`,
    passed
      ? undefined
      : "computeBalanceSheet must sum equity components into totalEquity"
  );
}

function checkConvergence(
  metrics: { converged: boolean; iterations: number; finalResidual: number } | undefined,
  periodIndex: number
): DiagnosticResult {
  const passed = metrics?.converged ?? true;
  return makeResult(
    "DIAG-CONVERGENCE-001",
    "Solver Convergence",
    "CRITICAL",
    passed,
    periodIndex,
    metrics?.finalResidual,
    passed
      ? undefined
      : `Solver did not converge after ${metrics?.iterations} iterations (residual: ${metrics?.finalResidual?.toFixed(6)})`,
    passed
      ? undefined
      : "Reduce alpha (damping), increase maxIterations, or check for model instability"
  );
}

function checkPositiveCash(
  period: PeriodState,
  periodIndex: number
): DiagnosticResult {
  const passed = period.bs.cash >= 0;
  return makeResult(
    "DIAG-LIQUIDITY-001",
    "Positive Cash Balance",
    "WARNING",
    passed,
    periodIndex,
    passed ? undefined : Math.abs(period.bs.cash),
    passed ? undefined : `Negative cash: ${period.bs.cash.toFixed(2)}`,
    passed
      ? undefined
      : "Consider increasing the revolver commitment or adjusting capex/dividend assumptions"
  );
}

// ---------------------------------------------------------------------------
// runDiagnostics
// ---------------------------------------------------------------------------

/**
 * Executes all diagnostic checks against the completed model output.
 *
 * @param output - Completed ModelOutput (periods + solverMetrics must be populated).
 * @returns       Flat array of DiagnosticResult records — one or more per check per period.
 */
export function runDiagnostics(output: ModelOutput): DiagnosticResult[] {
  const results: DiagnosticResult[] = [];

  for (let i = 0; i < output.periods.length; i++) {
    const period = output.periods[i];
    const priorPeriod = i > 0 ? output.periods[i - 1] : null;
    const metrics = output.solverMetrics[i];

    // DIAG-BS-001
    results.push(checkBalanceSheet(period, i));

    // DIAG-CFS-001
    results.push(checkCashTieOut(period, i));

    // DIAG-RE-001
    const priorRE = priorPeriod?.bs.retainedEarnings ?? 0;
    results.push(checkRetainedEarnings(period, priorRE, i));

    // DIAG-WC-001
    if (priorPeriod) {
      results.push(checkWorkingCapitalDelta(period, priorPeriod, i));
    }

    // DIAG-DA-001
    results.push(checkDAConsistency(period, i));

    // DIAG-DEBT-001 (one result per tranche)
    results.push(...checkDebtRollForward(period, i));

    // DIAG-PPE-001
    results.push(checkPPERollForward(period, i));

    // DIAG-EQUITY-001
    results.push(checkEquityTotal(period, i));

    // DIAG-CONVERGENCE-001
    results.push(checkConvergence(metrics, i));

    // DIAG-LIQUIDITY-001
    results.push(checkPositiveCash(period, i));
  }

  return results;
}
