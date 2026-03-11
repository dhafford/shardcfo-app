/**
 * Parser for QuickBooks Online report exports (CSV / XLSX).
 *
 * QBO P&L and Balance Sheet exports follow this structure:
 *
 *   Row 0:  "Company Name"
 *   Row 1:  "Profit and Loss"  (or "Balance Sheet")
 *   Row 2:  "January - December 2024"
 *   Row 3:  (blank)
 *   Row 4:  "", "Jan 2024", "Feb 2024", ..., "Total"
 *   Row 5+: Data rows — section headers, indented accounts, totals
 *
 * Section headers (no amounts):  "Income", "Cost of Goods Sold", "Expenses",
 *   "Other Income", "Other Expenses", "Assets", "Liabilities", "Equity"
 *
 * Account rows: "  4000 Sales", "10000.00", "12000.00", ...
 *   — Leading whitespace indicates depth in the chart of accounts
 *   — Optional account number prefix before the name
 *
 * Total rows: "Total Income", "Gross Profit", "Net Operating Income", "Net Income"
 *   — These are skipped
 */

import Papa from "papaparse";
import type { ParsedReport, AccountCategory } from "./report-parser-types";
import { REPORT_HEADERS } from "./report-parser-types";

// ── Section detection ────────────────────────────────────────────────────────

const SECTION_MAP: Record<string, AccountCategory> = {
  income: "revenue",
  revenue: "revenue",
  "operating revenue": "revenue",
  "sales revenue": "revenue",
  "cost of goods sold": "cogs",
  "cost of sales": "cogs",
  cogs: "cogs",
  expenses: "operating_expense",
  "operating expenses": "operating_expense",
  expense: "operating_expense",
  "other income": "other_income",
  "other revenue": "other_income",
  "other expenses": "other_expense",
  "other expense": "other_expense",
  assets: "asset",
  "current assets": "asset",
  "fixed assets": "asset",
  "other assets": "asset",
  liabilities: "liability",
  "current liabilities": "liability",
  "long-term liabilities": "liability",
  "other current liabilities": "liability",
  equity: "equity",
  "stockholders equity": "equity",
  "shareholders equity": "equity",
  "owner's equity": "equity",
};

const SKIP_PATTERNS = [
  /^total\s/i,
  /^net\s(income|loss|operating|profit)/i,
  /^gross\sprofit/i,
  /^net\sother/i,
  /^operating\s(income|loss)/i,
  /^ebitda$/i,
];

function isSkipRow(label: string): boolean {
  const trimmed = label.trim();
  return SKIP_PATTERNS.some((p) => p.test(trimmed));
}

function detectSection(label: string): AccountCategory | null {
  const normalised = label.trim().toLowerCase().replace(/[^a-z\s]/g, "").trim();
  return SECTION_MAP[normalised] ?? null;
}

// ── Period header parsing ────────────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
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

/**
 * Parse a QBO period column header like "Jan 2024" or "January 2024"
 * into "2024-01-01".
 */
function parsePeriodHeader(header: string): string | null {
  const trimmed = header.trim();

  // "Jan 2024" / "January 2024"
  const monthYear = trimmed.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthYear) {
    const m = MONTH_MAP[monthYear[1].toLowerCase()];
    if (m) return `${monthYear[2]}-${m}-01`;
  }

  // "Jan-24" / "Jan 24"
  const shortYear = trimmed.match(/^([A-Za-z]+)[\s-]+(\d{2})$/);
  if (shortYear) {
    const m = MONTH_MAP[shortYear[1].toLowerCase()];
    if (m) {
      const y = parseInt(shortYear[2], 10);
      const fullYear = y >= 50 ? 1900 + y : 2000 + y;
      return `${fullYear}-${m}-01`;
    }
  }

  // "Q1 2024" etc — use first month of quarter
  const quarter = trimmed.match(/^Q([1-4])\s+(\d{4})$/i);
  if (quarter) {
    const qMonth = String(((parseInt(quarter[1], 10) - 1) * 3) + 1).padStart(2, "0");
    return `${quarter[2]}-${qMonth}-01`;
  }

  // Full year "2024"
  const yearOnly = trimmed.match(/^(\d{4})$/);
  if (yearOnly) {
    return `${yearOnly[1]}-01-01`;
  }

  return null;
}

// ── Account number extraction ────────────────────────────────────────────────

/**
 * QBO often prefixes account names with the account number:
 *   "4000 Sales" or "4000-00 Sales Revenue"
 * Extract the code and the clean name.
 */
function extractAccountCode(raw: string): { code: string; name: string } {
  const trimmed = raw.trim();

  // Pattern: digits (optional dash digits) then space then name
  const match = trimmed.match(/^(\d[\d-]*)\s+(.+)$/);
  if (match) {
    return { code: match[1], name: match[2].trim() };
  }

  return { code: "", name: trimmed };
}

// ── Amount parsing ───────────────────────────────────────────────────────────

function parseAmount(raw: string): string {
  if (!raw || !raw.trim()) return "0";
  let cleaned = raw.trim();
  // Handle parenthetical negatives: (1,234.56)
  const isNeg = cleaned.startsWith("(") && cleaned.endsWith(")");
  cleaned = cleaned.replace(/[($,)]/g, "").trim();
  if (!cleaned || cleaned === "-") return "0";
  const num = parseFloat(cleaned);
  if (isNaN(num)) return "0";
  return isNeg ? String(-Math.abs(num)) : String(num);
}

// ── Main parser ──────────────────────────────────────────────────────────────

export function parseQuickBooksReport(file: File): Promise<ParsedReport> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: false,
      complete: (results) => {
        const rawRows = results.data as string[][];
        const errors: string[] = [];

        if (rawRows.length < 5) {
          resolve({
            headers: [...REPORT_HEADERS],
            rows: [],
            rowCount: 0,
            errors: ["File too short to be a QuickBooks report export."],
            source: "quickbooks",
          });
          return;
        }

        // ── Step 1: Find the period header row ──────────────────────
        // It's the first row where most cells parse as valid periods
        let periodRowIdx = -1;
        const periods: { colIdx: number; date: string }[] = [];

        for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
          const row = rawRows[i];
          if (!row || row.length < 2) continue;

          const candidatePeriods: { colIdx: number; date: string }[] = [];
          for (let c = 1; c < row.length; c++) {
            const cell = (row[c] ?? "").trim();
            if (!cell) continue;
            // Skip "Total" column
            if (/^total$/i.test(cell)) continue;
            const parsed = parsePeriodHeader(cell);
            if (parsed) candidatePeriods.push({ colIdx: c, date: parsed });
          }

          // Need at least 1 period column to consider this the header row
          if (candidatePeriods.length >= 1) {
            periodRowIdx = i;
            periods.push(...candidatePeriods);
            break;
          }
        }

        if (periodRowIdx === -1 || periods.length === 0) {
          // Fallback: treat as single-period report
          // Try to extract a date from the metadata rows
          let fallbackDate: string | null = null;
          for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
            const cellText = (rawRows[i]?.[0] ?? "").trim();
            // "January - December 2024" or "January 2024" etc.
            const yearMatch = cellText.match(/(\d{4})/);
            if (yearMatch) {
              // Try to parse as a period range end date
              const monthMatch = cellText.match(/(\w+)\s+\d{4}\s*$/);
              if (monthMatch) {
                const m = MONTH_MAP[monthMatch[1].toLowerCase()];
                if (m) {
                  fallbackDate = `${yearMatch[1]}-${m}-01`;
                  break;
                }
              }
              fallbackDate = `${yearMatch[1]}-12-01`;
              break;
            }
          }

          if (!fallbackDate) {
            resolve({
              headers: [...REPORT_HEADERS],
              rows: [],
              rowCount: 0,
              errors: [
                "Could not detect period columns. Make sure this is a QuickBooks P&L or Balance Sheet export with month/quarter headers.",
              ],
              source: "quickbooks",
            });
            return;
          }

          // Single-period: look for the header row with "" in first col
          periodRowIdx = -1;
          for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
            const row = rawRows[i];
            if (!row || row.length < 2) continue;
            const firstCell = (row[0] ?? "").trim().toLowerCase();
            if (firstCell === "" || firstCell === " ") {
              // Check if second cell has a non-empty, non-numeric value
              const secondCell = (row[1] ?? "").trim();
              if (secondCell && isNaN(parseFloat(secondCell.replace(/[$,()]/g, "")))) {
                periodRowIdx = i;
                periods.push({ colIdx: 1, date: fallbackDate });
                break;
              }
            }
          }

          if (periodRowIdx === -1) {
            periodRowIdx = 3; // best guess
            periods.push({ colIdx: 1, date: fallbackDate });
          }
        }

        // ── Step 2: Parse data rows ─────────────────────────────────
        let currentCategory: AccountCategory = "revenue"; // default
        const flatRows: Record<string, string>[] = [];

        for (let i = periodRowIdx + 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || row.length === 0) continue;

          const label = (row[0] ?? "").toString();
          const trimmedLabel = label.trim();

          // Skip blank rows
          if (!trimmedLabel) continue;

          // Check if this is a section header
          const section = detectSection(trimmedLabel);
          if (section !== null) {
            currentCategory = section;
            continue;
          }

          // Skip total / summary rows
          if (isSkipRow(trimmedLabel)) continue;

          // Extract account code and name
          const { code, name } = extractAccountCode(trimmedLabel);

          // Check if this row has any numeric values in the period columns
          let hasValues = false;
          for (const p of periods) {
            const cellVal = (row[p.colIdx] ?? "").toString().trim();
            if (cellVal && cellVal !== "" && cellVal !== "-") {
              hasValues = true;
              break;
            }
          }

          if (!hasValues) {
            // Could be a sub-section header, try detecting
            const subSection = detectSection(trimmedLabel);
            if (subSection !== null) {
              currentCategory = subSection;
            }
            continue;
          }

          // Create one flat row per period
          for (const p of periods) {
            const rawVal = (row[p.colIdx] ?? "").toString();
            const amount = parseAmount(rawVal);

            // Skip zero amounts
            if (amount === "0") continue;

            flatRows.push({
              account_code: code,
              account_name: name,
              account_type: currentCategory,
              amount,
              date: p.date,
            });
          }
        }

        if (flatRows.length === 0) {
          errors.push(
            "No account data found. Verify this is a QuickBooks P&L or Balance Sheet export."
          );
        }

        resolve({
          headers: [...REPORT_HEADERS],
          rows: flatRows,
          rowCount: flatRows.length,
          errors,
          source: "quickbooks",
        });
      },
      error: (err) => {
        resolve({
          headers: [...REPORT_HEADERS],
          rows: [],
          rowCount: 0,
          errors: [err.message],
          source: "quickbooks",
        });
      },
    });
  });
}
