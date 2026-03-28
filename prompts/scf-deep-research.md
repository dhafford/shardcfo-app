# Deep Research: Statement of Cash Flows — Derivation Logic from BS & IS

## Role

You are a senior financial modeling engineer working on the ShardCFO three-statement model engine. Your task is to produce a comprehensive, implementation-ready analysis of every rule, edge case, and linkage involved in deriving a Statement of Cash Flows (SCF) from a Balance Sheet (BS) and Income Statement (IS) using the indirect method.

## Context: What Already Exists

ShardCFO has two SCF computation paths:

### Path 1 — Imported Actuals (`src/lib/computations/cash-flow-engine.ts`)
- Derives SCF from imported IS/BS line items (QuickBooks, Xero, CSV uploads)
- Classifies BS accounts by name-matching (`classifyBSAccount()`) into categories: cash, ar, inventory, prepaid, fixed_asset, accum_depr, lt_debt, equity, retained_earnings, etc.
- Computes deltas between consecutive BS periods to get WC changes, investing flows, and financing flows
- Net Income is calculated inline from IS accounts (revenue - cogs - opex + other_income - other_expense)
- D&A is inferred from change in accumulated depreciation (flipped sign)
- FCF = CFO + CapEx
- Balance check: ending cash (from BS) vs. beginning cash + net change

### Path 2 — Projected Model (`src/lib/model-engine/schedules/cash-flow.ts`)
- Runs inside the three-statement engine after upstream schedules: IS (operating + below-EBIT), PPE, working capital, tax, debt, equity
- Reads pre-computed values from `PeriodState` (e.g., `state.cfs.cfDA` set by PPE schedule, `state.cfs.cfChangeAR` set by WC schedule)
- Handles GAAP/IFRS routing for interest paid and dividends paid (reclassification between CFO/CFF)
- Ending cash = beginning cash + net change → plugs into BS cash line
- Has placeholder zeros for: asset sales, acquisitions, impairment, debt issuance cost amortization, gain/loss on disposals, FX effects

### Type System (`src/lib/model-engine/types.ts`)
```typescript
CashFlowState {
  // CFO
  cfNetIncome, cfDA, cfSBC, cfDeferredTax, cfPIK,
  cfImpairment, cfAmortDebtCosts, cfGainLossDisposals, cfOtherNonCash,
  cfChangeAR, cfChangeInventory, cfChangePrepaid,
  cfChangeAP, cfChangeAccrued, cfChangeDeferredRev, cfChangeOtherWC,
  cfOperating,
  // CFI
  cfCapex, cfCapSoftware, cfAssetSales, cfAcquisitions, cfOtherInvesting,
  cfInvesting,
  // CFF
  cfDebtIssuances, cfDebtRepayments, cfRevolverNet,
  cfEquityIssuances, cfShareRepurchases, cfDividends,
  cfDebtIssuanceCosts, cfOtherFinancing,
  cfFinancing,
  // Totals
  fxEffect, netCashChange, beginningCash, endingCash, fcf
}
```

### Supporting Schedules Already Built
- **Debt schedule** (`debt.ts`): tranche-by-tranche amortization, PIK, revolver mechanics, cash sweep
- **PPE schedule** (`ppe.ts`): gross PPE roll-forward, accumulated depreciation, D&A expense, capex
- **Tax schedule** (`tax.ts`): current + deferred tax, NOL carryforwards (post-TCJA 80% limit)
- **Equity schedule** (`equity.ts`): share count, SBC, buybacks, dividends
- **Working capital schedule** (`working-capital.ts`): DSO/DIO/DPO drivers → AR/inventory/AP deltas
- **Fixed-point solver** (`solver.ts`): resolves interest-cash-revolver circularity via damped Gauss-Seidel

### Database Schema
- `accounts` table: id, company_id, name, category (asset/liability/equity/revenue/cogs/operating_expense/other_income/other_expense), subcategory
- `line_items` table: period_id, account_id, amount
- `financial_periods` table: period_date, period_type (actual/budget/forecast)
- PostgreSQL function `get_cash_flow_summary()` returns asset/liability/equity deltas

---

## Banker Bible Compliance Requirements

All SCF output must satisfy these standards from the Banker Bible (`banker_bible.md`):

### Section A — Gating Criteria (Must Pass)

**A1. Balance Sheet & Statement Integrity:**
- `ROUND(Total Assets - Total Liabilities - Total Equity, 5) ≠ 0` → FAIL
- Ending cash on CFS must equal cash on BS for every period
- Beginning cash in period T must equal ending cash in period T-1
- Net income on line 1 of CFS must equal net income on IS

**A3. Circular Reference Management:**
- The interest → net income → cash flow → debt balance → interest circularity must be managed via one of: circuit breaker toggle, beginning-of-period interest, or iterative calculation (max 100 iterations, max change 0.001)
- ShardCFO uses the iterative approach (damped Gauss-Seidel in `solver.ts`)

**A4. No Hardcoded Values:**
- Every constant must reference a labeled input. `=Revenue * 0.35` → FAIL. All assumptions flow from `ModelInput.assumptions`

**A6. Negative Numbers:**
- Display with parentheses: `(1,234)` not `-1,234`
- Format string: `#,##0_);(#,##0)`

### Section B — Scored Criteria

**B2. Number Formatting:**
- Financial figures: 0 decimals, commas
- Percentages: 1 decimal, italicized, % suffix
- Zero values: display as dash (—)
- Currency signs: top and bottom of each schedule only
- Units labeled: $, $mm, $B, %, x

**B4. Model Architecture:**
- Historical on left (blue font), projections on right (black font)
- "A" (Actual) vs "E" (Estimated) column labels
- Sign convention documented and consistent throughout

**B5. Roll-Forward Schedules:**
- Every BS supporting schedule uses corkscrew: `Beginning + Additions - Subtractions = Ending`
- Closing balance links to BS; change feeds CFS
- Beginning balance in period T = ending balance in period T-1

### Section C1 — Three-Statement Linkage Chain

Every link must be a formula reference, never a hardcoded match:

| From | To |
|---|---|
| Net income (IS) | Retained earnings (BS) AND first line of CFS |
| D&A (IS) | CFS add-back AND PP&E schedule |
| CapEx | CFS investing section AND PP&E additions |
| Working capital changes | CFS operating section AND BS current assets/liabilities |
| Debt repayments | CFS financing section AND debt schedule ending balances |
| Interest expense (IS) | Debt schedule interest calculation |

**Working capital modeling rules:**
- AR driven by DSO: `AR / Revenue × 365`
- Inventory driven by DIO: `Inventory / COGS × 365`
- AP driven by DPO: `AP / COGS × 365`
- Change in NWC feeds CFS operating section
- NWC excludes cash and short-term debt (both are financing items)

### Section D — AI-Generated Model Checks

**D1. Propagation Test:** Change one input (e.g., revenue growth) → verify it flows through IS → BS → CFS correctly
**D2. Zero-Input Test:** Set all inputs to zero → no nonzero values should remain in computation cells
**D5. Inter-Tab Link Verification:** Every BS item must have exactly one corresponding CFS entry via formula reference, not coincidentally matching values

---

## Research Questions

Produce a thorough, structured analysis covering ALL of the following:

### 1. Indirect Method — Complete Derivation Logic

Map out every step of the indirect method SCF derivation with:
- The exact mathematical relationship between each BS/IS line and its CFS counterpart
- Sign conventions: which BS changes produce positive vs. negative CFS entries, and why
- The complete list of non-cash items that must be added back to net income (not just D&A and SBC — include ALL items per GAAP/IFRS: loss on disposal, impairment, deferred taxes, PIK interest, amortization of debt issuance costs, unrealized FX, changes in fair value, bad debt provisions, etc.)
- Why the indirect method starts with net income rather than revenue, and what the direct method alternative looks like for reference

### 2. Working Capital — Deep Mechanics

- Derive the exact formula chain: DSO assumption → AR balance → change in AR → CFS operating line
- Same for DIO → inventory, DPO → AP, prepaid, accrued liabilities, deferred revenue, other current items
- Explain why an increase in a current asset is a cash outflow (not obvious to non-accountants)
- Explain why an increase in a current liability is a cash inflow
- Address: what happens when a company has negative working capital (common in SaaS with deferred revenue)?
- Edge case: what if AR goes negative (customer prepayments)? How should the engine classify that?

### 3. The BS-as-Plug Problem — Cash Reconciliation

- Why cash is the "plug" on the BS in a three-statement model
- The mathematical proof that: Beginning Cash + CFO + CFI + CFF = Ending Cash = BS Cash
- What breaks this identity and common causes of cash not reconciling:
  - Missing accounts in the BS that don't have a CFS counterpart
  - Retained earnings not linking properly to net income
  - Dividends declared vs. dividends paid timing
  - Foreign currency translation adjustments
  - Reclassifications between current/non-current
- How the existing `balanceCheck` field works and what a nonzero value means diagnostically

### 4. The Circularity Problem — Interest/Cash/Debt

- Full explanation of the interest expense → net income → cash flow → available cash → revolver draw → interest expense loop
- Why this circularity exists (interest depends on debt balance, which depends on cash, which depends on interest)
- Three resolution methods per the banker bible (A3):
  1. Circuit breaker toggle
  2. Beginning-of-period interest (eliminates circularity entirely)
  3. Iterative calculation (how ShardCFO's damped Gauss-Seidel works)
- Convergence properties: when does the solver fail? What does alpha (damping factor) control? What's the right tolerance?
- How the revolver draw/sweep adds another layer of circularity (revolver drawn when cash falls short, swept when surplus)

### 5. GAAP vs. IFRS Classification Differences

- Which CFS items can be reclassified under IFRS but not GAAP?
- Interest paid: GAAP = always CFO; IFRS = CFO or CFF (election)
- Interest received: GAAP = always CFO; IFRS = CFO or CFI
- Dividends paid: GAAP = always CFF; IFRS = CFO or CFF
- Dividends received: GAAP = always CFO; IFRS = CFO or CFI
- How the `PolicyFlags` in the model engine should drive these reclassifications
- Impact on FCF calculation when interest is reclassified

### 6. Deriving SCF from Imported Actuals (Path 1 Gaps)

Analyze the existing `cash-flow-engine.ts` and identify:
- Classification gaps: BS accounts that don't match any `classifyBSAccount()` pattern and silently fall through to defaults
- Missing non-cash add-backs: the imported path only captures D&A (from accum depr change). It misses SBC, deferred tax, impairment, PIK, debt cost amort. How could these be inferred from BS/IS data without explicit schedule data?
- The retained earnings problem: `cff` currently includes equity changes but deliberately excludes retained earnings change (since that's net income in CFO). But what if dividends were paid? Then retained earnings change ≠ net income, and the dividends aren't captured.
- Inter-company transactions, minority interests, equity method investments — what BS accounts produce CFS entries the engine doesn't handle?
- Unrealized gains/losses that sit in AOCI (accumulated other comprehensive income) — these are BS equity changes that should NOT flow through the CFS operating section

### 7. Edge Cases and Failure Modes

- Period-0 bootstrapping: how to handle the first historical period when there's no "prior" BS
- Fiscal year changes: what happens when periods aren't exactly 12 months apart?
- Partial periods: quarterly vs. annual mixing (e.g., imported monthly actuals that must be annualized before the projection engine can use them as an anchor period)
- Negative cash scenarios: when ending cash goes negative, should the model flag this or allow it?
- Acquisition accounting: how does purchased goodwill, fair value step-ups, and acquired working capital hit the CFS?
- Deferred revenue unwinding: both a WC change (operating) and sometimes a purchase-price allocation item
- Lease obligations (ASC 842 / IFRS 16): operating lease payments that are now partially financing on the BS
- Capitalized software: sits on BS as intangible but the spend is an investing outflow
- **Missing accumulated depreciation:** When imported historicals carry fixed assets at gross cost with no accumulated depreciation tracked (common in small-company QBO books), the reclassification engine should bootstrap a depreciation schedule. Default policy: 10-year straight-line from the asset's recorded date (or period-0 if unknown), computing an initial `accumulatedDepreciation` balance and ongoing D&A expense for the PPE schedule. This ensures the CFS has a non-zero D&A add-back and the BS reflects net PPE rather than perpetual gross cost.

### 8. Output Formatting Per Banker Bible

Specify exactly how the SCF should be formatted in the exported Excel workbook:
- Section headers: bold, left-aligned
- Line items: indented, normal weight
- Subtotals: bold, single top border
- Grand totals: bold, double bottom border
- Negative values: parentheses format `(1,234)` per A6
- Zero values: em-dash (—) per B2
- Column headers: period labels with "A" or "E" suffix per B4
- Units label at top: "$ in thousands" or "$ in millions"
- Sign convention documentation: where to place the note (e.g., footer: "Cash outflows shown in parentheses")
- Row ordering within each section (standardized line item order)
- FCF calculation shown below the three sections with its own subtotal

### 9. Validation & Diagnostics

Define the complete set of validation checks the engine should perform:
- A1 tie-outs: BS balance check, CFS cash = BS cash, beginning cash continuity, net income match
- Cross-statement integrity: every BS delta has exactly one CFS counterpart (D5)
- Proof: CFO + CFI + CFF + FX = Net Change in Cash
- Cash reconciliation: Beginning Cash + Net Change = Ending Cash = BS Cash
- Retained earnings proof: Beginning RE + Net Income - Dividends = Ending RE
- Working capital reasonableness: DSO/DIO/DPO within industry bounds
- Warning vs. error severity levels (which failures are gating per Section A vs. scored per Section B)

### 10. Historical Reclassification for Projections

The projection engine (`engine.ts`) expects a pre-structured `HistoricalBalanceSheet` (22 typed fields) and flat `historicalIS` as its anchor period. But imported actuals live as raw `accounts[]` + `line_items[]` in the database with arbitrary names and granularity. There is currently NO code path that bridges these.

Analyze and specify:

**Account aggregation mapping:**
- Define the complete many-to-one mapping from `classifyBSAccount()` categories to `HistoricalBalanceSheet` fields
- Identify accounts that fall through both classifiers (not matched by name patterns AND not mapped to a `HistoricalBalanceSheet` field)
- How should "Undeposited Funds" (an asset that acts like cash-in-transit) be classified? (Treat as cash — it represents collected but not-yet-deposited funds.)
- How should "Opening Balance Equity" (a QBO artifact from initial book setup) be handled? (Roll into retained earnings — it is not a real equity instrument, just a QBO balancing entry from day-one setup. The reclassification engine should detect accounts matching "opening balance equity" and merge their balance into `retainedEarnings`.)

**IS reclassification for run-rate normalization:**
- The projection engine drives expenses as `% of revenue` from the anchor period. If historical IS contains non-recurring items (litigation, restructuring, asset impairment, gain/loss on sale), they get projected forward at a fixed margin — producing nonsensical results.
- Define a reclassification framework: which IS line items should be stripped from the anchor period before computing projection driver ratios?
- How should the engine handle the "adjusted EBITDA" concept (add-backs for SBC, one-time items) vs. GAAP EBITDA for CFS purposes?
- Where should the adjustment schedule live (separate from the raw historicals, preserving auditability per banker bible B6)?

**Period aggregation (monthly/quarterly → annual):**
- Imported actuals often arrive as monthly or quarterly data (e.g., 7 months of P&L). The projection engine expects annualized figures for the anchor period. The reclassification engine must:
  - Detect the period granularity from the imported data
  - For IS (flow statement): sum all available periods, then annualize if partial year (e.g., 7 months × 12/7)
  - For BS (point-in-time): use the most recent period's balances, not a sum
  - For driver ratio computation (DSO, DIO, DPO, expense %s): compute from the annualized IS and most-recent BS, with the option to use trailing averages across available periods for more stable ratios
- Address how seasonality affects annualization — a CPG brand with summer-heavy revenue will produce misleading annualized figures from Jan–May data vs. Jan–Jul data

**Sign convention bridging:**
- `normalize.ts` covers 16 fields. The `HistoricalBalanceSheet` has 22 fields. Which fields are missing sign normalization (e.g., `deferredTaxAsset`, `capitalizedSoftwareNet`, `intangiblesNet`, `aoci`)?
- When QBO exports liabilities as negative (debit/credit convention), but the model expects them positive, what's the correct detection and correction logic?

**The bridge function itself:**
- Specify the signature and logic for a `reclassifyHistoricals(accounts, lineItems, periods) → ModelInput` function
- How should it handle multiple historical periods (take the most recent BS snapshot; aggregate and annualize IS flow data; compute trailing-average driver ratios across available periods for stability)
- Should it auto-derive `Assumptions` driver ratios (DSO, DIO, DPO, expense %s) from the historicals, or leave those for the user?
- How does this interact with the `account-mapper.ts` mapping that already happens at import time?

**Default reclassification policies (applied automatically unless overridden):**
- "Opening Balance Equity" → roll into `retainedEarnings`
- "Undeposited Funds" → classify as `cash`
- Fixed assets with no accumulated depreciation → bootstrap 10-year straight-line depreciation schedule from asset recording date (or period-0 if unknown)
- These defaults should be surfaced to the user for review but applied without requiring manual intervention

### 11. Recommended Implementation Improvements

Based on the research above, propose:
- Specific line items to add to `CashFlowState` (with types and sign conventions)
- New account classification patterns for `classifyBSAccount()` that are currently missing
- How to bridge the gap between Path 1 (imported actuals) and Path 2 (projections) so that the engine can handle mixed actual + projected periods seamlessly
- How the `get_cash_flow_summary()` PostgreSQL function should be updated to support any new line items
- Any changes to `ComputedCashFlow` interface for richer diagnostic output

---

## Output Format

Structure your response as a numbered research document matching the 11 sections above. For each section:
1. State the accounting principle or rule
2. Show the mathematical formula or derivation
3. Map it to the specific ShardCFO code path (file, function, field)
4. Note any gaps between the principle and the current implementation
5. Where the banker bible specifies a formatting or validation rule, quote the exact requirement

Use tables for mappings. Use code blocks for formulas and TypeScript signatures. Flag all current gaps with `[GAP]` tags so they can be searched programmatically.

Do not summarize or abbreviate — this document will be used as the authoritative reference for building and auditing the SCF engine.
