/**
 * Sign convention normalization for three-statement financial model inputs.
 *
 * Financial data arrives from diverse sources (QuickBooks exports, Xero, manual
 * Excel entry) with inconsistent sign conventions. This module normalises all
 * line items to the canonical convention used throughout the model engine:
 *
 *   IS  — revenues positive, expenses negative
 *   BS  — assets positive, liabilities positive, contra accounts negative
 *   CFS — inflows positive, outflows negative
 *
 * Call `detectSignConvention` first on imported data, then use the appropriate
 * normalize function before passing data to the model DAG.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SignRule {
  field: string;
  expectedSign: "positive" | "negative" | "any";
  statement: "IS" | "BS" | "CFS";
}

// ---------------------------------------------------------------------------
// Sign rule catalogue
// ---------------------------------------------------------------------------

/**
 * Canonical sign rules for common financial line items.
 * Used by `normalizeSign` and the bulk-normalization helpers.
 */
export const SIGN_RULES: SignRule[] = [
  // --- Income Statement ---
  { field: "revenue",          expectedSign: "positive", statement: "IS" },
  { field: "cogs",             expectedSign: "negative", statement: "IS" },
  { field: "sgaExpenses",      expectedSign: "negative", statement: "IS" },
  { field: "da",               expectedSign: "negative", statement: "IS" },
  { field: "interestExpense",  expectedSign: "negative", statement: "IS" },
  { field: "taxExpense",       expectedSign: "negative", statement: "IS" },

  // --- Balance Sheet ---
  // Assets (positive)
  { field: "cash",                     expectedSign: "positive", statement: "BS" },
  { field: "ar",                       expectedSign: "positive", statement: "BS" },
  { field: "inventory",                expectedSign: "positive", statement: "BS" },
  { field: "ppe",                      expectedSign: "positive", statement: "BS" },
  // Contra-asset (negative)
  { field: "accumulatedDepreciation",  expectedSign: "negative", statement: "BS" },
  // Liabilities (positive)
  { field: "ap",                       expectedSign: "positive", statement: "BS" },
  { field: "debt",                     expectedSign: "positive", statement: "BS" },
  // Contra-equity (negative)
  { field: "treasuryStock",            expectedSign: "negative", statement: "BS" },

  // --- Cash Flow Statement ---
  { field: "daAddback",        expectedSign: "positive", statement: "CFS" },
  { field: "capex",            expectedSign: "negative", statement: "CFS" },
  { field: "debtRepayments",   expectedSign: "negative", statement: "CFS" },
  { field: "shareRepurchases", expectedSign: "negative", statement: "CFS" },
  { field: "dividendsPaid",    expectedSign: "negative", statement: "CFS" },
];

// ---------------------------------------------------------------------------
// Core normalization primitive
// ---------------------------------------------------------------------------

/**
 * Ensures `value` conforms to the sign expectation in `rule`.
 *
 *   'positive' — if value < 0, returns -value (flip to positive)
 *   'negative' — if value > 0, returns -value (flip to negative)
 *   'any'      — returns value unchanged
 */
export function normalizeSign(value: number, rule: SignRule): number {
  if (rule.expectedSign === "positive" && value < 0) return -value;
  if (rule.expectedSign === "negative" && value > 0) return -value;
  return value;
}

// ---------------------------------------------------------------------------
// Bulk normalizers
// ---------------------------------------------------------------------------

/** Build a lookup from field name to rule for efficient bulk normalization. */
function buildRuleMap(statement: "IS" | "BS" | "CFS"): Map<string, SignRule> {
  return new Map(
    SIGN_RULES.filter((r) => r.statement === statement).map((r) => [r.field, r])
  );
}

/**
 * Normalizes a raw balance sheet record to canonical sign conventions.
 * Contra accounts (accumulatedDepreciation, treasuryStock) will be negative;
 * all other recorded asset and liability fields will be positive.
 * Fields not present in SIGN_RULES are passed through unchanged.
 *
 * @param raw - Key/value map of balance sheet line items.
 */
export function normalizeHistoricalBS(
  raw: Record<string, number>
): Record<string, number> {
  const ruleMap = buildRuleMap("BS");
  const result: Record<string, number> = {};

  for (const [field, value] of Object.entries(raw)) {
    const rule = ruleMap.get(field);
    result[field] = rule ? normalizeSign(value, rule) : value;
  }

  return result;
}

/**
 * Normalizes an income statement record so that revenues are positive and all
 * expense line items (COGS, SG&A, D&A, interest expense, tax expense) are
 * negative. Fields not present in SIGN_RULES are passed through unchanged.
 *
 * @param raw - Key/value map of income statement line items.
 */
export function normalizeISData(
  raw: Record<string, number>
): Record<string, number> {
  const ruleMap = buildRuleMap("IS");
  const result: Record<string, number> = {};

  for (const [field, value] of Object.entries(raw)) {
    const rule = ruleMap.get(field);
    result[field] = rule ? normalizeSign(value, rule) : value;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Convention detector
// ---------------------------------------------------------------------------

/**
 * Heuristic to identify the sign convention used by an incoming data source.
 *
 * Samples two key expense fields (COGS and interest expense) that are
 * unambiguously expenses:
 *   - Both negative → data is already in canonical convention
 *   - Both positive → data uses the "all-positive" convention (common in
 *                     accounting exports where debits/credits are implicit)
 *   - Mixed         → data has inconsistent conventions; manual review required
 *
 * Zero values for either field are treated as inconclusive and default to
 * 'canonical' to avoid false positives.
 *
 * @param cogs            - Raw COGS value as imported.
 * @param interestExpense - Raw interest expense value as imported.
 */
export function detectSignConvention(
  cogs: number,
  interestExpense: number
): "canonical" | "all_positive" | "mixed" {
  const cogsNeg = cogs < 0;
  const interestNeg = interestExpense < 0;
  const cogsPos = cogs > 0;
  const interestPos = interestExpense > 0;

  // Both zero — cannot determine, assume canonical
  if (cogs === 0 && interestExpense === 0) return "canonical";

  // Both negative → canonical
  if (cogsNeg && interestNeg) return "canonical";

  // Both positive → all-positive convention
  if (cogsPos && interestPos) return "all_positive";

  // One zero, one negative → assume canonical
  if ((cogs === 0 && interestNeg) || (cogsNeg && interestExpense === 0)) {
    return "canonical";
  }

  // One zero, one positive → assume all_positive
  if ((cogs === 0 && interestPos) || (cogsPos && interestExpense === 0)) {
    return "all_positive";
  }

  // Signs disagree
  return "mixed";
}
