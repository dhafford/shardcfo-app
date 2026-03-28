/**
 * Maps QBO parser output (sections/rows) to database account categories
 * and provides helpers for the reclassification and export flow.
 *
 * Builds on the existing SECTION_MAP in parse-utils.ts for the base
 * section-name → category mapping, and adds:
 *   - Subcategory resolution for operating expenses
 *   - Dropdown options per report type (for the reclassification UI)
 *   - Column date parsing (for multi-period exports)
 *   - Exportable-row filtering (skip totals and computed lines)
 */

import type { AccountCategory } from "./report-parser-types";
import { SECTION_MAP } from "./parse-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CategoryMapping {
  category: AccountCategory;
  subcategory: string | null;
}

export interface CategoryOption {
  value: string; // "revenue", "cogs", "operating_expense:sales_marketing", etc.
  label: string;
  category: AccountCategory;
  subcategory: string | null;
}

/** Matches the ParsedRow interface in qbo-import-viewer.tsx */
export interface QboParsedRow {
  account_name: string;
  account_code: string;
  depth: number;
  amounts: Record<string, number | null>;
  is_total: boolean;
  children: QboParsedRow[];
}

// ---------------------------------------------------------------------------
// Section → category resolution
// ---------------------------------------------------------------------------

/**
 * Extended mapping that adds subcategory hints on top of parse-utils SECTION_MAP.
 * Keys are lowercase, stripped of punctuation.
 */
const SUBCATEGORY_HINTS: Record<string, string | null> = {
  // P&L subcategories for operating_expense
  expenses: "general_administrative",
  expense: "general_administrative",
  "operating expenses": "general_administrative",
  // BS: "liabilities and equity" is a combined section — handled specially
  "liabilities and equity": null,
  "liabilities  equity": null,
};

/**
 * Resolve a QBO section name to a database category + subcategory.
 *
 * Uses the existing SECTION_MAP for category resolution and adds
 * subcategory hints where applicable (primarily for operating expenses).
 */
export function resolveCategory(sectionName: string): CategoryMapping | null {
  const normalised = sectionName
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim();

  const category = SECTION_MAP[normalised] ?? null;
  if (!category) return null;

  const subcategory = SUBCATEGORY_HINTS[normalised] ?? null;
  return { category, subcategory };
}

/**
 * For a BS row nested inside "LIABILITIES AND EQUITY", infer whether
 * it's a liability or equity based on the parent row hierarchy.
 *
 * Walks up through ancestor names looking for "liabilit" or "equity".
 * Returns the inferred category, or "liability" as a default.
 */
export function inferBSCategory(
  ancestorNames: string[],
): AccountCategory {
  for (let i = ancestorNames.length - 1; i >= 0; i--) {
    const lower = ancestorNames[i].toLowerCase();
    if (lower.includes("equity")) return "equity";
    if (lower.includes("liabilit")) return "liability";
  }
  return "liability"; // default if ambiguous
}

// ---------------------------------------------------------------------------
// Reclassification dropdown options
// ---------------------------------------------------------------------------

const PNL_OPTIONS: CategoryOption[] = [
  { value: "revenue", label: "Revenue", category: "revenue", subcategory: null },
  { value: "cogs", label: "Cost of Goods Sold", category: "cogs", subcategory: null },
  { value: "operating_expense:sales_marketing", label: "OpEx — Sales & Marketing", category: "operating_expense", subcategory: "sales_marketing" },
  { value: "operating_expense:research_development", label: "OpEx — R&D", category: "operating_expense", subcategory: "research_development" },
  { value: "operating_expense:general_administrative", label: "OpEx — G&A", category: "operating_expense", subcategory: "general_administrative" },
  { value: "other_income", label: "Other Income", category: "other_income", subcategory: null },
  { value: "other_expense", label: "Other Expense", category: "other_expense", subcategory: null },
];

const BS_OPTIONS: CategoryOption[] = [
  { value: "asset", label: "Asset", category: "asset", subcategory: null },
  { value: "liability", label: "Liability", category: "liability", subcategory: null },
  { value: "equity", label: "Equity", category: "equity", subcategory: null },
];

/**
 * Get the reclassification dropdown options for a given report type.
 *
 * Returns an empty array for cash_flow_statement (reclassification
 * is not supported for SCF since it derives from P&L/BS).
 */
export function getCategoryOptionsForReportType(
  reportType: string,
): CategoryOption[] {
  switch (reportType) {
    case "profit_and_loss":
      return PNL_OPTIONS;
    case "balance_sheet":
      return BS_OPTIONS;
    default:
      return []; // SCF and unknown: no reclassification
  }
}

/**
 * Parse a CategoryOption value string back into category + subcategory.
 * Handles both "revenue" and "operating_expense:sales_marketing" formats.
 */
export function parseCategoryOptionValue(
  value: string,
): CategoryMapping {
  const parts = value.split(":");
  return {
    category: parts[0] as AccountCategory,
    subcategory: parts[1] ?? null,
  };
}

// ---------------------------------------------------------------------------
// Column date parsing
// ---------------------------------------------------------------------------

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

/**
 * Parse a QBO column header into a period date (YYYY-MM-01).
 *
 * Handles:
 *   - "Jan 2024" → "2024-01-01"
 *   - "January 2024" → "2024-01-01"
 *   - "Q1 2024" → "2024-01-01"
 *   - "Dec 31, 2024" → "2024-12-01" (BS comparative)
 *   - "Total" → null
 *   - "% of Income" → null
 */
export function parseColumnDate(label: string): string | null {
  const trimmed = label.trim();
  if (!trimmed) return null;

  // Skip known non-date labels
  const lower = trimmed.toLowerCase();
  if (lower === "total" || lower.startsWith("%")) return null;

  // "Jan 2024" or "January 2024"
  const monthYear = trimmed.match(/^(\w+)\s+(\d{4})$/);
  if (monthYear) {
    const month = MONTH_NAMES[monthYear[1].toLowerCase()];
    if (month) {
      return `${monthYear[2]}-${String(month).padStart(2, "0")}-01`;
    }
  }

  // "Dec 31, 2024" or "December 31, 2024" (BS comparative)
  const fullDate = trimmed.match(/^(\w+)\s+\d{1,2},?\s*(\d{4})$/);
  if (fullDate) {
    const month = MONTH_NAMES[fullDate[1].toLowerCase()];
    if (month) {
      return `${fullDate[2]}-${String(month).padStart(2, "0")}-01`;
    }
  }

  // "Q1 2024" → first month of quarter
  const quarter = trimmed.match(/^Q([1-4])\s+(\d{4})$/i);
  if (quarter) {
    const qMonth = (parseInt(quarter[1], 10) - 1) * 3 + 1;
    return `${quarter[2]}-${String(qMonth).padStart(2, "0")}-01`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Exportable row filtering
// ---------------------------------------------------------------------------

/**
 * Returns true if a parsed row is a "leaf" account suitable for export.
 *
 * Filters out:
 *   - Total/subtotal rows (is_total = true)
 *   - Section headers with no amounts
 *   - Rows where every amount is null
 */
export function isExportableRow(row: QboParsedRow): boolean {
  if (row.is_total) return false;

  const hasAnyAmount = Object.values(row.amounts).some(
    (v) => v !== null && v !== undefined,
  );
  return hasAnyAmount;
}

/**
 * Recursively collect all exportable leaf rows from a section's row tree.
 *
 * Returns flat array of { row, ancestorNames } for each leaf.
 * ancestorNames tracks the parent hierarchy (useful for BS category inference).
 */
export function collectExportableRows(
  rows: QboParsedRow[],
  ancestors: string[] = [],
): Array<{ row: QboParsedRow; ancestorNames: string[] }> {
  const result: Array<{ row: QboParsedRow; ancestorNames: string[] }> = [];

  for (const row of rows) {
    if (isExportableRow(row)) {
      result.push({ row, ancestorNames: [...ancestors] });
    }
    if (row.children.length > 0) {
      result.push(
        ...collectExportableRows(row.children, [...ancestors, row.account_name]),
      );
    }
  }

  return result;
}

/**
 * Build a deterministic key for a row to track reclassifications.
 * Format: "sectionName::accountName::accountCode"
 */
export function makeRowKey(
  sectionName: string,
  row: QboParsedRow,
): string {
  return `${sectionName}::${row.account_name}::${row.account_code}`;
}
