/**
 * Tests for qbo-section-mapping.ts
 *
 * Run with: npx tsx src/lib/import/__tests__/qbo-section-mapping.test.ts
 */

import {
  resolveCategory,
  inferBSCategory,
  getCategoryOptionsForReportType,
  parseCategoryOptionValue,
  parseColumnDate,
  isExportableRow,
  collectExportableRows,
  makeRowKey,
} from "../qbo-section-mapping";
import type { QboParsedRow } from "../qbo-section-mapping";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
  }
}

function assertEqual(actual: unknown, expected: unknown, label: string) {
  const match = JSON.stringify(actual) === JSON.stringify(expected);
  if (match) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
    console.error(`    expected: ${JSON.stringify(expected)}`);
    console.error(`    actual:   ${JSON.stringify(actual)}`);
  }
}

// ── resolveCategory ──────────────────────────────────────────────────────────

console.log("resolveCategory:");

assertEqual(resolveCategory("Income")?.category, "revenue", "Income → revenue");
assertEqual(resolveCategory("Revenue")?.category, "revenue", "Revenue → revenue");
assertEqual(resolveCategory("Cost of Goods Sold")?.category, "cogs", "COGS → cogs");
assertEqual(resolveCategory("Expenses")?.category, "operating_expense", "Expenses → operating_expense");
assertEqual(resolveCategory("EXPENSES")?.category, "operating_expense", "EXPENSES (caps) → operating_expense");
assertEqual(resolveCategory("Other Income")?.category, "other_income", "Other Income → other_income");
assertEqual(resolveCategory("Other Expenses")?.category, "other_expense", "Other Expenses → other_expense");
assertEqual(resolveCategory("Assets")?.category, "asset", "Assets → asset");
assertEqual(resolveCategory("Current Assets")?.category, "asset", "Current Assets → asset");
assertEqual(resolveCategory("Liabilities")?.category, "liability", "Liabilities → liability");
assertEqual(resolveCategory("Equity")?.category, "equity", "Equity → equity");
assertEqual(resolveCategory("Stockholders' Equity")?.category, "equity", "Stockholders' Equity → equity");
assertEqual(resolveCategory("Gibberish Section"), null, "Unknown section → null");
assertEqual(resolveCategory(""), null, "Empty → null");

// Subcategory hints
assertEqual(resolveCategory("Expenses")?.subcategory, "general_administrative", "Expenses subcategory → G&A");

// ── inferBSCategory ──────────────────────────────────────────────────────────

console.log("inferBSCategory:");

assertEqual(inferBSCategory(["Liabilities"]), "liability", "Under Liabilities → liability");
assertEqual(inferBSCategory(["Equity"]), "equity", "Under Equity → equity");
assertEqual(inferBSCategory(["Current Liabilities"]), "liability", "Under Current Liabilities → liability");
assertEqual(inferBSCategory(["Total Liabilities", "Current Liabilities"]), "liability", "Nested liabilities → liability");
assertEqual(inferBSCategory(["Equity", "Common Stock"]), "equity", "Under Equity/Common Stock → equity");
assertEqual(inferBSCategory([]), "liability", "No ancestors → liability (default)");

// ── getCategoryOptionsForReportType ──────────────────────────────────────────

console.log("getCategoryOptionsForReportType:");

const pnlOpts = getCategoryOptionsForReportType("profit_and_loss");
assert(pnlOpts.length === 7, "P&L has 7 options");
assert(pnlOpts.some(o => o.category === "revenue"), "P&L includes revenue");
assert(pnlOpts.some(o => o.category === "cogs"), "P&L includes cogs");
assert(pnlOpts.some(o => o.subcategory === "sales_marketing"), "P&L includes S&M subcategory");
assert(pnlOpts.some(o => o.subcategory === "research_development"), "P&L includes R&D subcategory");

const bsOpts = getCategoryOptionsForReportType("balance_sheet");
assert(bsOpts.length === 3, "BS has 3 options");
assert(bsOpts.some(o => o.category === "asset"), "BS includes asset");
assert(bsOpts.some(o => o.category === "liability"), "BS includes liability");
assert(bsOpts.some(o => o.category === "equity"), "BS includes equity");

const scfOpts = getCategoryOptionsForReportType("cash_flow_statement");
assert(scfOpts.length === 0, "SCF has 0 options (no reclassification)");

const unknownOpts = getCategoryOptionsForReportType("unknown");
assert(unknownOpts.length === 0, "Unknown type has 0 options");

// ── parseCategoryOptionValue ─────────────────────────────────────────────────

console.log("parseCategoryOptionValue:");

assertEqual(parseCategoryOptionValue("revenue"), { category: "revenue", subcategory: null }, "revenue");
assertEqual(parseCategoryOptionValue("operating_expense:sales_marketing"), { category: "operating_expense", subcategory: "sales_marketing" }, "opex:sm");
assertEqual(parseCategoryOptionValue("asset"), { category: "asset", subcategory: null }, "asset");

// ── parseColumnDate ──────────────────────────────────────────────────────────

console.log("parseColumnDate:");

assertEqual(parseColumnDate("Jan 2024"), "2024-01-01", "Jan 2024");
assertEqual(parseColumnDate("December 2024"), "2024-12-01", "December 2024");
assertEqual(parseColumnDate("Feb 2019"), "2019-02-01", "Feb 2019");
assertEqual(parseColumnDate("Q1 2024"), "2024-01-01", "Q1 2024");
assertEqual(parseColumnDate("Q2 2024"), "2024-04-01", "Q2 2024");
assertEqual(parseColumnDate("Q3 2024"), "2024-07-01", "Q3 2024");
assertEqual(parseColumnDate("Q4 2024"), "2024-10-01", "Q4 2024");
assertEqual(parseColumnDate("Dec 31, 2024"), "2024-12-01", "Dec 31, 2024 (BS comparative)");
assertEqual(parseColumnDate("December 31, 2024"), "2024-12-01", "December 31, 2024");
assertEqual(parseColumnDate("Total"), null, "Total → null");
assertEqual(parseColumnDate("% of Income"), null, "% of Income → null");
assertEqual(parseColumnDate(""), null, "empty → null");
assertEqual(parseColumnDate("Budget"), null, "Budget → null");

// ── isExportableRow ──────────────────────────────────────────────────────────

console.log("isExportableRow:");

const leaf: QboParsedRow = {
  account_name: "Sales", account_code: "41000", depth: 1,
  amounts: { "Total": 100 }, is_total: false, children: [],
};
assert(isExportableRow(leaf), "Leaf with amounts → exportable");

const totalRow: QboParsedRow = {
  account_name: "Total Income", account_code: "", depth: 0,
  amounts: { "Total": 100 }, is_total: true, children: [],
};
assert(!isExportableRow(totalRow), "Total row → not exportable");

const emptyRow: QboParsedRow = {
  account_name: "Header", account_code: "", depth: 0,
  amounts: { "Total": null }, is_total: false, children: [],
};
assert(!isExportableRow(emptyRow), "Row with all-null amounts → not exportable");

const zeroRow: QboParsedRow = {
  account_name: "Zero Account", account_code: "99", depth: 1,
  amounts: { "Total": 0 }, is_total: false, children: [],
};
assert(isExportableRow(zeroRow), "Row with zero amount → exportable (zero is valid)");

// ── collectExportableRows ────────────────────────────────────────────────────

console.log("collectExportableRows:");

const tree: QboParsedRow[] = [
  {
    account_name: "Payroll", account_code: "60000", depth: 1,
    amounts: { "Total": null }, is_total: false,
    children: [
      { account_name: "Salaries", account_code: "", depth: 2, amounts: { "Total": 50000 }, is_total: false, children: [] },
      { account_name: "Taxes", account_code: "", depth: 2, amounts: { "Total": 5000 }, is_total: false, children: [] },
      { account_name: "Total Payroll", account_code: "60000", depth: 1, amounts: { "Total": 55000 }, is_total: true, children: [] },
    ],
  },
  { account_name: "Rent", account_code: "61000", depth: 1, amounts: { "Total": 12000 }, is_total: false, children: [] },
];

const collected = collectExportableRows(tree);
assert(collected.length === 3, "Collects 3 exportable rows (Salaries, Taxes, Rent — skips Payroll header and Total)");
assertEqual(collected[0].row.account_name, "Salaries", "First is Salaries");
assertEqual(collected[0].ancestorNames, ["Payroll"], "Salaries has Payroll as ancestor");
assertEqual(collected[2].row.account_name, "Rent", "Third is Rent");
assertEqual(collected[2].ancestorNames, [], "Rent has no ancestors");

// ── makeRowKey ───────────────────────────────────────────────────────────────

console.log("makeRowKey:");

assertEqual(
  makeRowKey("Income", leaf),
  "Income::Sales::41000",
  "Row key format",
);

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
