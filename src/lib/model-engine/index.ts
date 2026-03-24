/**
 * Public API for the three-statement financial model engine.
 *
 * Import from this barrel file rather than from individual modules so that
 * internal file paths remain an implementation detail.
 */

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export { runModel } from "./engine";
export { runDiagnostics } from "./diagnostics";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export {
  normalizeHistoricalBS,
  normalizeISData,
  detectSignConvention,
} from "./normalize";

export {
  createDefaultConfig,
  DEFAULT_US_GAAP_FLAGS,
  DEFAULT_IFRS_FLAGS,
} from "./config";

export {
  createEmptyPeriodState,
  createPeriodStateFromHistorical,
} from "./types";

// ---------------------------------------------------------------------------
// DAG (advanced users — dependency graph inspection)
// ---------------------------------------------------------------------------

export { buildModelDAG, getEvaluationPlan } from "./dag";

// ---------------------------------------------------------------------------
// Solver
// ---------------------------------------------------------------------------

export { solveFixedPoint, createSolverParams } from "./solver";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type {
  ModelInput,
  ModelOutput,
  ModelConfig,
  PolicyFlags,
  SolverConfig,
  SolverMetrics,
  PeriodState,
  IncomeStatementState,
  BalanceSheetState,
  CashFlowState,
  ScheduleState,
  DebtTranche,
  DebtTrancheResult,
  NOLVintage,
  NOLVintageResult,
  DiagnosticResult,
  Assumptions,
  HistoricalBalanceSheet,
  EquityInputs,
  RevenueStreamInput,
} from "./types";
