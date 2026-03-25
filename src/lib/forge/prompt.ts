/**
 * Seed prompt and schema instruction builder for LLM generation.
 *
 * Ported from promptforge/generator.py (_build_schema_instruction) and
 * data/seed_prompt.md.
 */

import { OUTPUT_SCHEMA_DESCRIPTION } from "./schema";
import { buildRevenueExpensePrompt } from "./builds";

// ---------------------------------------------------------------------------
// Seed prompt
// ---------------------------------------------------------------------------

/**
 * Comprehensive system prompt for three-statement model generation.
 * Condensed from data/seed_prompt.md — covers objective, architecture,
 * stage classification, benchmark targets, and assumption engine logic.
 */
export const SEED_PROMPT = `# Three-Statement Financial Model Generator

## Objective
Build a forecasted three-statement financial model (Income Statement, Balance Sheet, Cash Flow Statement) with five years of annual projections. Accept historical financial data as input, apply top-decile benchmark targets, and produce a fully reconciled model.

## Architecture

### Layer 1: Historical Data (Input)
Parse and normalize historical financials (minimum 12 months). Extract:
- Income Statement: Revenue, COGS, Gross Profit, R&D/S&M/G&A (broken out), EBITDA, D&A, EBIT, Interest, Tax, Net Income
- Balance Sheet: Cash, AR, Inventory, Prepaid, PP&E, Intangibles, AP, Accrued Liabilities, Deferred Revenue, Debt, Equity
- Cash Flow: CFO (NI + non-cash + WC changes), CFI (CapEx, acquisitions), CFF (debt, equity, dividends)

### Layer 2: Stage Classification & Benchmarks
Classify the company into one of: Seed ($0-$1M ARR), Series A ($1-$5M), Series B ($5-$20M), Series C+ ($20M+).

Top-decile targets by stage:
| Metric           | Seed   | Series A | Series B | Series C+ |
|-----------------|--------|----------|----------|-----------|
| Revenue Growth  | >300%  | >150%    | >100%    | >60%      |
| Gross Margin    | >75%   | >78%     | >80%     | >82%      |
| Rule of 40      | >40    | >60      | >80      | >80       |
| R&D % Revenue   | 40-60% | 30-45%   | 25-35%   | 20-30%    |
| S&M % Revenue   | 30-50% | 35-50%   | 30-45%   | 25-35%    |
| G&A % Revenue   | 15-25% | 10-20%   | 8-15%    | 6-12%     |

### Layer 2: Assumption Engine
1. **Revenue Growth**: Start from trailing growth, converge toward next-stage benchmark over Y1-Y3, moderate in Y4-Y5.
2. **Margin Expansion**: S&M compresses 3-5 ppts/year; R&D 2-3 ppts/year; G&A 1-2 ppts/year until target band.
3. **Working Capital**: DSO/DPO/DIO held at trailing average; extrapolate improvement at 50% of trailing rate of change.
4. **CapEx**: Hold at trailing % of revenue; step down 0.5 ppt/year for capital-light businesses to a 2% floor.
5. **Tax Rate**: 0% until EBIT turns positive, then 26% effective (21% federal + 5% blended state). Apply NOL carryforward.
6. **Debt/Financing**: No new equity unless cash hits zero (then model a round at 18 months of projected burn).

### Layer 3: Outputs
- Projected IS, BS, CFS for Years 1-5 (annual)
- Balance sheet must balance every period: Assets = Liabilities + Equity
- Cash is the plug: BS.cash := CFS.ending_cash in every period
- RE roll-forward: RE_t = RE_{t-1} + NI_t - |Dividends_t|
- All subtotals must equal sum of their components`;

// ---------------------------------------------------------------------------
// Schema instruction builder
// ---------------------------------------------------------------------------

/**
 * Build a compact schema instruction listing all required keys,
 * sign conventions, and critical rules. Ported from Python
 * generator._build_schema_instruction().
 */
export function buildSchemaInstruction(): string {
  const lines: string[] = [
    "You MUST output ONLY a valid JSON object conforming to this schema.",
    "No markdown, no explanation, no commentary — pure JSON only.",
    "",
    "Sign conventions:",
    "  IS: Revenues positive. ALL expenses NEGATIVE (COGS, OpEx, D&A, Interest, Tax).",
    "  BS: Assets positive. Liabilities positive. Equity positive.",
    "      Contra accounts NEGATIVE (accumulated_depreciation, treasury_stock).",
    "  CFS: Inflows positive. Outflows NEGATIVE (capex, repayments, dividends, buybacks).",
    "",
    "Every line item is a dict mapping period labels to numbers.",
    '  Example: {"FY2023": 1000.0, "Y1": 1200.0, "Y2": 1500.0}',
    "",
    "Required top-level keys:",
  ];

  for (const [sectionName, sectionItems] of Object.entries(OUTPUT_SCHEMA_DESCRIPTION)) {
    lines.push(`\n  ${sectionName}:`);
    if (sectionItems && typeof sectionItems === "object" && !Array.isArray(sectionItems)) {
      for (const key of Object.keys(sectionItems)) {
        lines.push(`    - ${key}`);
      }
    }
  }

  lines.push(
    "",
    "CRITICAL RULES:",
    "1. Balance sheet MUST balance: total_assets = total_liabilities + total_equity",
    "2. CFS ending_cash MUST equal BS cash in every period",
    "3. CFS beginning_cash in period t = CFS ending_cash in period t-1",
    "4. Retained earnings: RE_t = RE_t-1 + net_income_t - |dividends_paid_t|",
    "5. CFS net_income MUST equal IS net_income",
    "6. CFS D&A addback magnitude MUST equal IS D&A expense magnitude",
    "7. Working capital changes on CFS MUST equal BS period-over-period deltas",
    "8. Net PPE_t = Net PPE_t-1 + |CapEx_t| + D&A_t (D&A is negative)",
    "9. If EBT < 0, tax_expense must be 0 (or a positive benefit), not negative",
    "10. All subtotals must be the sum of their components",
    "11. total_equity MUST = common_stock + apic + retained_earnings + treasury_stock + aoci + other_equity",
    "12. Use other_equity for SAFE notes, owner contributions, convertible instruments, etc.",
    "13. BS cash is the PLUG — set it EQUAL to CFS ending_cash. Do NOT compute it independently.",
    "14. If the company has no PP&E, set da_expense = 0 on the IS and cf_da_addback = 0 on CFS",
    "15. Include a 'revenue_build' key with: methodology (slug), business_type, and drivers (each a period→value dict)",
    "16. Include an 'expense_build' key with: categories → {category_slug → {items → {item_key → period→value dict}}}",
    "17. Revenue build drivers MUST tie to IS revenue. Expense build totals MUST tie to IS COGS + OpEx.",
  );

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// System message assembler
// ---------------------------------------------------------------------------

/**
 * Combine the candidate prompt, revenue/expense build methodology prompt,
 * and schema instruction into the final system message for the LLM.
 *
 * Mirrors the Python generator.generate() system_message construction:
 *   f"{candidate_prompt}\n\n---\n\n{build_prompt}\n\n---\n\n## OUTPUT FORMAT REQUIREMENTS\n\n{schema_instruction}"
 */
export function buildSystemMessage(candidatePrompt: string): string {
  const buildPrompt = buildRevenueExpensePrompt();
  const schemaInstruction = buildSchemaInstruction();

  return [
    candidatePrompt,
    "---",
    buildPrompt,
    "---",
    "## OUTPUT FORMAT REQUIREMENTS",
    "",
    schemaInstruction,
  ].join("\n\n");
}
