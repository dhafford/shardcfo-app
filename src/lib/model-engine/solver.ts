/**
 * Fixed-point iteration solver for the Interest-Cash-Revolver circular reference.
 *
 * The three-statement model contains an inherent circularity:
 *   interest expense → net income → cash flow → revolver balance → interest expense
 *
 * This module implements a damped Gauss-Seidel iteration to resolve that loop.
 * The damping factor (alpha) blends the newly computed value with the prior
 * estimate, preventing oscillation in models with high leverage.
 *
 * Typical usage:
 *   const params = createSolverParams({ breakerMode: false });
 *   const result = solveFixedPoint(params, beginningDebt, (x) => computeRevolver(x));
 *   if (!result.converged) console.warn("Solver did not converge", result);
 */

import type { SolverConfig, SolverMetrics } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SolverParams {
  /** Damping factor blending new and old estimates. Range (0, 1]. Default 0.7. */
  alpha: number;
  /** Convergence tolerance — iteration stops when residual < tolerance. Default 1e-6. */
  tolerance: number;
  /** Maximum number of Gauss-Seidel iterations before giving up. Default 100. */
  maxIterations: number;
  /**
   * When true, skip iteration entirely: evaluate once with initialGuess and return.
   * Use for "circuit-breaker" mode where beginning-of-period balances are used
   * to avoid circularity (common in period-0 bootstrapping).
   */
  breakerMode: boolean;
}

export interface SolverResult {
  /** Converged value of the iterated variable. */
  value: number;
  /** Whether the solver reached tolerance before maxIterations. */
  converged: boolean;
  /** Number of iterations performed (1 in breakerMode). */
  iterations: number;
  /** Absolute residual at exit: |x_new - x_old|. 0 in breakerMode. */
  finalResidual: number;
}

// ---------------------------------------------------------------------------
// Core solver
// ---------------------------------------------------------------------------

/**
 * Solves a scalar fixed-point equation x = f(x) using damped Gauss-Seidel
 * iteration.
 *
 * The update rule is:
 *   x_new = alpha * f(x) + (1 - alpha) * x
 *
 * Iteration stops when |x_new - x| < tolerance or maxIterations is reached.
 *
 * If `params.breakerMode` is true the function evaluates `evalFn` once with
 * `initialGuess` and returns immediately — residual is 0 and converged is true.
 *
 * @param params       - Solver configuration (alpha, tolerance, maxIterations, breakerMode).
 * @param initialGuess - Starting estimate for the iterated variable (e.g. beginning debt balance).
 * @param evalFn       - Function that takes the current estimate and returns the next raw value.
 */
export function solveFixedPoint(
  params: SolverParams,
  initialGuess: number,
  evalFn: (currentGuess: number) => number
): SolverResult {
  const { alpha, tolerance, maxIterations, breakerMode } = params;

  // Circuit-breaker mode: run once, no iteration
  if (breakerMode) {
    return {
      value: evalFn(initialGuess),
      converged: true,
      iterations: 1,
      finalResidual: 0,
    };
  }

  let x = initialGuess;
  let finalResidual = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    const rawNext = evalFn(x);
    const dampedNext = alpha * rawNext + (1 - alpha) * x;
    const residual = Math.abs(dampedNext - x);

    x = dampedNext;
    finalResidual = residual;

    if (residual < tolerance) {
      return {
        value: x,
        converged: true,
        iterations: iter + 1,
        finalResidual: residual,
      };
    }
  }

  // Reached maxIterations without converging
  return {
    value: x,
    converged: false,
    iterations: maxIterations,
    finalResidual,
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a SolverParams object with defaults applied for any omitted fields.
 *
 * Defaults:
 *   alpha         = 0.7   (moderate damping; reduce toward 0.3 for highly leveraged models)
 *   tolerance     = 1e-6  (sub-dollar convergence on million-dollar figures)
 *   maxIterations = 100   (sufficient for typical corporate models)
 *   breakerMode   = false (iterative solving enabled)
 */
export function createSolverParams(
  config: {
    alpha?: number;
    tolerance?: number;
    maxIterations?: number;
    breakerMode?: boolean;
  } = {}
): SolverParams {
  return {
    alpha: config.alpha ?? 0.7,
    tolerance: config.tolerance ?? 1e-6,
    maxIterations: config.maxIterations ?? 100,
    breakerMode: config.breakerMode ?? false,
  };
}
