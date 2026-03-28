/**
 * Shared parsing utilities for financial report imports.
 *
 * Extracted from the QuickBooks and Xero parsers so that the
 * generic financial-layout-parser can reuse the same logic.
 */

import type { AccountCategory } from "./report-parser-types";

// ── Month map ────────────────────────────────────────────────────────────────

export const MONTH_MAP: Record<string, string> = {
  jan: "01", january: "01",
  feb: "02", february: "02",
  mar: "03", march: "03",
  apr: "04", april: "04",
  may: "05",
  jun: "06", june: "06",
  jul: "07", july: "07",
  aug: "08", august: "08",
  sep: "09", september: "09", sept: "09",
  oct: "10", october: "10",
  nov: "11", november: "11",
  dec: "12", december: "12",
};

// ── Section detection ────────────────────────────────────────────────────────

/**
 * Maps normalised section header text to an AccountCategory.
 * Covers QBO, Xero, and generic accounting export conventions.
 */
export const SECTION_MAP: Record<string, AccountCategory> = {
  // Revenue / Income
  income: "revenue",
  revenue: "revenue",
  "trading income": "revenue",
  "operating revenue": "revenue",
  "sales revenue": "revenue",
  // COGS
  "cost of goods sold": "cogs",
  "cost of sales": "cogs",
  "less cost of sales": "cogs",
  cogs: "cogs",
  "direct costs": "cogs",
  // Operating Expenses
  expenses: "operating_expense",
  expense: "operating_expense",
  "operating expenses": "operating_expense",
  "less operating expenses": "operating_expense",
  "administrative expenses": "operating_expense",
  // Other Income / Expense
  "other income": "other_income",
  "other revenue": "other_income",
  "other expenses": "other_expense",
  "other expense": "other_expense",
  // Balance Sheet
  assets: "asset",
  "current assets": "asset",
  "fixed assets": "asset",
  "non-current assets": "asset",
  "other assets": "asset",
  liabilities: "liability",
  "liabilities and equity": "liability",
  "liabilities  equity": "liability",
  "current liabilities": "liability",
  "long-term liabilities": "liability",
  "non-current liabilities": "liability",
  "other current liabilities": "liability",
  equity: "equity",
  "stockholders equity": "equity",
  "shareholders equity": "equity",
  "owners equity": "equity",
  "net assets": "equity",
};

/** Detect a section header from a row label. */
export function detectSection(label: string): AccountCategory | null {
  const normalised = label.trim().toLowerCase().replace(/[^a-z\s]/g, "").trim();
  return SECTION_MAP[normalised] ?? null;
}

// ── Skip / total row detection ───────────────────────────────────────────────

const SKIP_PATTERNS = [
  /^total\s/i,
  /^total$/i,
  /^net\s(income|loss|operating|profit|assets|other)/i,
  /^gross\sprofit/i,
  /^operating\s(income|loss|profit)/i,
  /^ebitda$/i,
];

/** Returns true if the row label is a total / summary row that should be skipped. */
export function isSkipRow(label: string): boolean {
  const trimmed = label.trim();
  return SKIP_PATTERNS.some((p) => p.test(trimmed));
}

// ── Period header parsing ────────────────────────────────────────────────────

/**
 * Parse a period column header into "YYYY-MM-01" format.
 *
 * Handles:
 *   "Jan 2024" / "January 2024"
 *   "Jan-24"   / "Jan 24"   / "Mar-2024"
 *   "Q1 2024"
 *   "2024"
 *   "31 Mar 2024" / "31 March 2024"  (Xero date format)
 *   "FY2024" / "FY 2024"
 */
export function parsePeriodHeader(header: string): string | null {
  const trimmed = header.trim();

  // "Jan 2024" / "January 2024"
  const monthYear = trimmed.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthYear) {
    const m = MONTH_MAP[monthYear[1].toLowerCase()];
    if (m) return `${monthYear[2]}-${m}-01`;
  }

  // "Jan-24" / "Jan 24" / "Mar-2024"
  const shortForm = trimmed.match(/^([A-Za-z]+)[\s-]+(\d{2,4})$/);
  if (shortForm) {
    const m = MONTH_MAP[shortForm[1].toLowerCase()];
    if (m) {
      let y = parseInt(shortForm[2], 10);
      if (y < 100) y = y >= 50 ? 1900 + y : 2000 + y;
      return `${y}-${m}-01`;
    }
  }

  // "Q1 2024" etc — use first month of quarter
  const quarter = trimmed.match(/^Q([1-4])\s+(\d{4})$/i);
  if (quarter) {
    const qMonth = String(((parseInt(quarter[1], 10) - 1) * 3) + 1).padStart(2, "0");
    return `${quarter[2]}-${qMonth}-01`;
  }

  // "FY2024" / "FY 2024"
  const fy = trimmed.match(/^FY\s*(\d{4})$/i);
  if (fy) {
    return `${fy[1]}-01-01`;
  }

  // Full year "2024"
  const yearOnly = trimmed.match(/^(\d{4})$/);
  if (yearOnly) {
    return `${yearOnly[1]}-01-01`;
  }

  // "31 Mar 2024" / "31 March 2024" (Xero date format in titles)
  const dateFull = trimmed.match(/^\d{1,2}\s+([A-Za-z]+)\s+(\d{4})$/);
  if (dateFull) {
    const m = MONTH_MAP[dateFull[1].toLowerCase()];
    if (m) return `${dateFull[2]}-${m}-01`;
  }

  return null;
}

// ── Account code extraction ──────────────────────────────────────────────────

/**
 * Extract an account code and clean name from a label.
 *
 * Handles:
 *   "4000 Sales"               (QBO: number space name)
 *   "4000-00 Sales Revenue"    (QBO: number-sub space name)
 *   "200 - Sales Revenue"      (Xero: number dash name)
 */
export function extractAccountCode(raw: string): { code: string; name: string } {
  const trimmed = raw.trim();

  // Pattern: "200 - Sales Revenue" (Xero dash-separated)
  const dashSep = trimmed.match(/^(\d[\d.-]*)\s*-\s*(.+)$/);
  if (dashSep) {
    return { code: dashSep[1].trim(), name: dashSep[2].trim() };
  }

  // Pattern: digits (optional dash digits) then space then name
  const spaceSep = trimmed.match(/^(\d[\d-]*)\s+(.+)$/);
  if (spaceSep) {
    return { code: spaceSep[1], name: spaceSep[2].trim() };
  }

  return { code: "", name: trimmed };
}

// ── Amount parsing ───────────────────────────────────────────────────────────

/**
 * Parse a raw amount string into a numeric string.
 *
 * Handles:
 *   Parenthetical negatives: "(1,234.56)" → "-1234.56"
 *   Currency symbols: $, €, £, ¥, ₹
 *   Commas as thousand separators
 *   Dashes as zero
 */
export function parseAmount(raw: string): string {
  if (!raw || !raw.trim()) return "0";
  let cleaned = raw.trim();
  // Handle parenthetical negatives: (1,234.56)
  const isNeg = cleaned.startsWith("(") && cleaned.endsWith(")");
  cleaned = cleaned.replace(/[$€£¥₹(,)]/g, "").trim();
  if (!cleaned || cleaned === "-") return "0";
  const num = parseFloat(cleaned);
  if (isNaN(num)) return "0";
  return isNeg ? String(-Math.abs(num)) : String(num);
}
