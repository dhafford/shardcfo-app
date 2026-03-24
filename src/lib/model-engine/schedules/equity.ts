/**
 * Equity schedule — rolls forward all equity components, computes share counts
 * using the Treasury Stock Method, and derives basic and diluted EPS.
 *
 * Entry point: computeEquity
 *
 * Depends on:
 *  - state.is.sbc    (written here; must be called before IS rolls up opex)
 *  - state.is.netIncome (must be set before computeEquity is called)
 *  - priorState.bs.*  (opening equity balances)
 */

import { PeriodState, ModelConfig, EquityInputs } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const get = (arr: number[], i: number): number =>
  arr[Math.min(i, arr.length - 1)] ?? 0;

// ---------------------------------------------------------------------------
// computeEquity
// ---------------------------------------------------------------------------

/**
 * Computes the equity roll-forward, share count, and EPS for the current period.
 *
 * @param state         Current period state (mutated in place).
 * @param priorState    Prior period state (read-only).
 * @param equityInputs  Equity assumptions and inputs from ModelInput.
 * @param periodIndex   0-based projection period index.
 * @param _config       Model configuration (reserved for future policy flags).
 */
export function computeEquity(
  state: PeriodState,
  priorState: PeriodState,
  equityInputs: EquityInputs,
  periodIndex: number,
  _config: ModelConfig
): void {
  // ------------------------------------------------------------------
  // 1. SBC expense
  // ------------------------------------------------------------------
  // SBC is written to IS here. The IS schedule must incorporate this value
  // into totalOpex / EBITDA before netIncome is finalised.
  // (If IS has already been computed, this field was already populated via
  //  the sbcPercent assumption; we do not overwrite it here.)
  // SBC from assumptions is handled by the IS schedule using sbcPercent;
  // here we just confirm the value is present for use in the APIC roll-forward.
  const sbcExpense = state.is.sbc;

  // ------------------------------------------------------------------
  // 2. Equity component roll-forwards
  // ------------------------------------------------------------------

  // Common stock par value — typically unchanged unless shares are newly issued
  const commonStock = priorState.bs.commonStock;

  // APIC — increases by SBC (non-cash compensation settled in equity)
  // Buyback spend reduces APIC only to the extent it exceeds par; simplified
  // here to treat the full buyback as a treasury stock transaction (see below).
  const apic = priorState.bs.apic + sbcExpense;

  // Dividends paid — dividends per share × weighted average shares outstanding.
  // We use the prior period's basic shares as the denominator because the
  // current period's share count is not yet computed.
  const dividendPerShare = equityInputs.dividendPerShare ?? 0;
  const priorBasicShares =
    priorState.schedules.basicShares > 0
      ? priorState.schedules.basicShares
      : equityInputs.basicSharesOutstanding;
  const dividendsPaid = dividendPerShare * priorBasicShares;

  // Retained earnings — increases by net income, decreases by dividends
  const retainedEarnings =
    priorState.bs.retainedEarnings + state.is.netIncome - dividendsPaid;

  // AOCI — simplified: no other comprehensive income items are modelled
  const aoci = priorState.bs.aoci;

  // Treasury stock — share repurchases reduce equity (negative balance grows
  // more negative with each buyback).
  const buybackSpend = get(equityInputs.buybackBudget, periodIndex);
  const treasuryStock = priorState.bs.treasuryStock - buybackSpend;

  // Total equity
  const totalEquity =
    commonStock + apic + retainedEarnings + aoci + treasuryStock;

  // ------------------------------------------------------------------
  // 3. Basic share count roll-forward
  // ------------------------------------------------------------------

  const openingBasicShares =
    priorState.schedules.basicShares > 0
      ? priorState.schedules.basicShares
      : equityInputs.basicSharesOutstanding;

  // Average stock price used to convert buyback spend into share count
  const avgStockPrice = equityInputs.optionPool.avgStockPrice ?? 0;
  const sharesRepurchased =
    avgStockPrice > 0 ? buybackSpend / avgStockPrice : 0;

  // New share issuances — not modelled in the current assumptions spec;
  // placeholder at 0 for forward compatibility
  const newIssuances = 0;

  const basicShares = openingBasicShares - sharesRepurchased + newIssuances;

  // ------------------------------------------------------------------
  // 4. Diluted shares — Treasury Stock Method
  // ------------------------------------------------------------------

  const { optionPool, rsuShares, convertibleDebt } = equityInputs;

  // In-the-money options: dilution = (options × spread) / avg stock price
  // where spread = stock price - exercise price
  let dilutiveFromOptions = 0;
  if (
    avgStockPrice > 0 &&
    avgStockPrice > optionPool.avgExercisePrice &&
    optionPool.shares > 0
  ) {
    const spread = avgStockPrice - optionPool.avgExercisePrice;
    dilutiveFromOptions = (optionPool.shares * spread) / avgStockPrice;
  }

  // RSUs are dilutive in full (no exercise price cost to offset)
  const dilutiveFromRSUs = rsuShares ?? 0;

  // Convertible debt: if-converted method — add shares from assumed conversion
  // (anti-dilution check applied at EPS step below)
  const dilutiveFromConvertibles = convertibleDebt?.shares ?? 0;

  const dilutedShares =
    basicShares +
    dilutiveFromOptions +
    dilutiveFromRSUs +
    dilutiveFromConvertibles;

  // ------------------------------------------------------------------
  // 5. EPS
  // ------------------------------------------------------------------

  const netIncome = state.is.netIncome;

  const basicEPS = basicShares > 0 ? netIncome / basicShares : 0;

  // For diluted EPS numerator: if convertible debt was included in the
  // denominator, add back the after-tax interest saved (if-converted method).
  const interestSavedAfterTax =
    dilutiveFromConvertibles > 0
      ? (convertibleDebt?.interestSaved ?? 0)
      : 0;
  const dilutedNumerator = netIncome + interestSavedAfterTax;
  const rawDilutedEPS = dilutedShares > 0 ? dilutedNumerator / dilutedShares : 0;

  // Anti-dilution: if diluted EPS would be higher than basic EPS (e.g. during
  // a loss period), report basic EPS for both.
  const dilutedEPS =
    netIncome >= 0
      ? Math.min(basicEPS, rawDilutedEPS)
      : Math.max(basicEPS, rawDilutedEPS);

  // ------------------------------------------------------------------
  // Write results to state
  // ------------------------------------------------------------------

  // Balance sheet — equity section
  state.bs.commonStock = commonStock;
  state.bs.apic = apic;
  state.bs.retainedEarnings = retainedEarnings;
  state.bs.aoci = aoci;
  state.bs.treasuryStock = treasuryStock;
  state.bs.totalEquity = totalEquity;

  // Cash flow statement — dividends and share repurchases (financing outflows)
  state.cfs.cfDividends = -dividendsPaid;
  state.cfs.cfShareRepurchases = -buybackSpend;

  // Schedules — share counts
  state.schedules.basicShares = basicShares;
  state.schedules.dilutedShares = Math.max(basicShares, dilutedShares);

  // Income statement — EPS
  state.is.basicEPS = basicEPS;
  state.is.dilutedEPS = dilutedEPS;
}
