/**
 * Default configuration objects for the model engine.
 *
 * Provides ready-made PolicyFlags for US GAAP and IFRS, a default
 * SolverConfig, and a factory that merges caller overrides with defaults.
 */

import type { ModelConfig, PolicyFlags, SolverConfig } from "@/lib/model-engine/types";

// ---------------------------------------------------------------------------
// Default policy flags
// ---------------------------------------------------------------------------

/** US GAAP defaults (ASC 842 leases, no impairment reversal, FIFO inventory). */
export const DEFAULT_US_GAAP_FLAGS: PolicyFlags = {
  accountingStandard: "GAAP",
  cfsInterestPaid: "CFO",
  cfsInterestReceived: "CFO",
  cfsDividendsPaid: "CFF",
  cfsDividendsReceived: "CFO",
  leaseModel: "ASC_842",
  rdAccounting: "EXPENSE_ALL",
  impairmentReversal: "NOT_ALLOWED",
  sbcForfeitureMethod: "AS_OCCUR",
  inventoryMethod: "FIFO",
};

/**
 * IFRS defaults.
 *
 * Key differences from GAAP:
 *  - Development costs capitalized under IAS 38
 *  - Impairment reversals allowed for non-goodwill assets (IAS 36)
 *  - SBC forfeitures estimated at grant date (IFRS 2)
 */
export const DEFAULT_IFRS_FLAGS: PolicyFlags = {
  accountingStandard: "IFRS",
  cfsInterestPaid: "CFO",
  cfsInterestReceived: "CFO",
  cfsDividendsPaid: "CFF",
  cfsDividendsReceived: "CFO",
  leaseModel: "IFRS_16",
  rdAccounting: "CAPITALIZE_DEVELOPMENT",
  impairmentReversal: "ALLOWED_NON_GOODWILL",
  sbcForfeitureMethod: "ESTIMATE_AT_GRANT",
  inventoryMethod: "FIFO",
};

// ---------------------------------------------------------------------------
// Default solver config
// ---------------------------------------------------------------------------

/**
 * Conservative solver defaults.
 *
 * alpha = 0.7 damps the revolver/cash circularity to avoid oscillation.
 * tolerance = 1e-6 is tight enough for financial precision without over-iterating.
 */
export const DEFAULT_SOLVER_CONFIG: SolverConfig = {
  alpha: 0.7,
  tolerance: 1e-6,
  maxIterations: 100,
  breakerMode: false,
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns a complete ModelConfig by merging caller-supplied overrides with
 * US GAAP defaults. Nested objects (policyFlags, solverConfig) are shallow-
 * merged so partial overrides work naturally.
 */
export function createDefaultConfig(overrides?: Partial<ModelConfig>): ModelConfig {
  return {
    policyFlags: {
      ...DEFAULT_US_GAAP_FLAGS,
      ...overrides?.policyFlags,
    },
    solverConfig: {
      ...DEFAULT_SOLVER_CONFIG,
      ...overrides?.solverConfig,
    },
    projectionYears: overrides?.projectionYears ?? 7,
    fiscalYearEndMonth: overrides?.fiscalYearEndMonth ?? 12,
  };
}
