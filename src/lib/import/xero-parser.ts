/**
 * Parser for Xero report exports (CSV / XLSX).
 *
 * Xero P&L and Balance Sheet exports follow this structure:
 *
 *   Row 0:  "Demo Company (NZ)"
 *   Row 1:  "Profit and Loss"
 *   Row 2:  "For the year ended 31 March 2024"
 *   Row 3:  (blank)
 *   Row 4:  "", "Mar-24", "Feb-24", ..., (or single period)
 *   Row 5+: Data rows — section headers, account rows, totals
 *
 * Section headers: "Revenue", "Less Cost of Sales", "Less Operating Expenses",
 *   "Other Revenue", "Other Expenses", "Assets", "Liabilities", "Equity"
 *
 * Account rows: "200 - Sales", "10,000.00", "12,000.00", ...
 *   — Account number prefix separated by " - "
 *
 * Total rows: "Total Revenue", "Gross Profit", "Net Profit"
 */

import Papa from "papaparse";
import type { ParsedReport, AccountCategory } from "./report-parser-types";
import { REPORT_HEADERS } from "./report-parser-types";

// ── Section detection ────────────────────────────────────────────────────────

const SECTION_MAP: Record<string, AccountCategory> = {
  revenue: "revenue",
  income: "revenue",
  "trading income": "revenue",
  "operating revenue": "revenue",
  "sales revenue": "revenue",
  "less cost of sales": "cogs",
  "cost of sales": "cogs",
  "cost of goods sold": "cogs",
  "direct costs": "cogs",
  "less operating expenses": "operating_expense",
  "operating expenses": "operating_expense",
  expenses: "operating_expense",
  "administrative expenses": "operating_expense",
  "other revenue": "other_income",
  "other income": "other_income",
  "other expenses": "other_expense",
  "other expense": "other_expense",
  assets: "asset",
  "current assets": "asset",
  "non-current assets": "asset",
  "fixed assets": "asset",
  liabilities: "liability",
  "current liabilities": "liability",
  "non-current liabilities": "liability",
  equity: "equity",
  "net assets": "equity",
};

const SKIP_PATTERNS = [
  /^total\s/i,
  /^net\s(profit|loss|income|assets)/i,
  /^gross\sprofit/i,
  /^operating\sprofit/i,
  /^total$/i,
];

function isSkipRow(label: string): boolean {
  const trimmed = label.trim();
  return SKIP_PATTERNS.some((p) => p.test(trimmed));
}

function detectSection(label: string): AccountCategory | null {
  const normalised = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim();
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
 * Parse a Xero period column header like "Mar-24", "Mar 2024", or "March 2024"
 * into "2024-03-01".
 */
function parsePeriodHeader(header: string): string | null {
  const trimmed = header.trim();

  // "Mar-24" / "Mar-2024" / "Mar 24"
  const shortForm = trimmed.match(/^([A-Za-z]+)[\s-]+(\d{2,4})$/);
  if (shortForm) {
    const m = MONTH_MAP[shortForm[1].toLowerCase()];
    if (m) {
      let y = parseInt(shortForm[2], 10);
      if (y < 100) y = y >= 50 ? 1900 + y : 2000 + y;
      return `${y}-${m}-01`;
    }
  }

  // "March 2024"
  const longForm = trimmed.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (longForm) {
    const m = MONTH_MAP[longForm[1].toLowerCase()];
    if (m) return `${longForm[2]}-${m}-01`;
  }

  // "Q1 2024"
  const quarter = trimmed.match(/^Q([1-4])\s+(\d{4})$/i);
  if (quarter) {
    const qMonth = String((parseInt(quarter[1], 10) - 1) * 3 + 1).padStart(2, "0");
    return `${quarter[2]}-${qMonth}-01`;
  }

  // "2024"
  const yearOnly = trimmed.match(/^(\d{4})$/);
  if (yearOnly) {
    return `${yearOnly[1]}-01-01`;
  }

  // "31 Mar 2024" or "31 March 2024" (Xero date format in titles)
  const dateFull = trimmed.match(/^\d{1,2}\s+([A-Za-z]+)\s+(\d{4})$/);
  if (dateFull) {
    const m = MONTH_MAP[dateFull[1].toLowerCase()];
    if (m) return `${dateFull[2]}-${m}-01`;
  }

  return null;
}

// ── Account code/name extraction ─────────────────────────────────────────────

/**
 * Xero uses "200 - Sales" or "200 Sales" format.
 */
function extractAccountCode(raw: string): { code: string; name: string } {
  const trimmed = raw.trim();

  // Pattern: "200 - Sales Revenue"
  const dashSep = trimmed.match(/^(\d[\d.-]*)\s*-\s*(.+)$/);
  if (dashSep) {
    return { code: dashSep[1].trim(), name: dashSep[2].trim() };
  }

  // Pattern: "200 Sales Revenue"
  const spaceSep = trimmed.match(/^(\d[\d.-]*)\s+(.+)$/);
  if (spaceSep) {
    return { code: spaceSep[1].trim(), name: spaceSep[2].trim() };
  }

  return { code: "", name: trimmed };
}

// ── Amount parsing ───────────────────────────────────────────────────────────

function parseAmount(raw: string): string {
  if (!raw || !raw.trim()) return "0";
  let cleaned = raw.trim();
  const isNeg = cleaned.startsWith("(") && cleaned.endsWith(")");
  cleaned = cleaned.replace(/[($,)]/g, "").trim();
  if (!cleaned || cleaned === "-") return "0";
  const num = parseFloat(cleaned);
  if (isNaN(num)) return "0";
  return isNeg ? String(-Math.abs(num)) : String(num);
}

// ── Main parser ──────────────────────────────────────────────────────────────

export function parseXeroReport(file: File): Promise<ParsedReport> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: false,
      complete: (results) => {
        const rawRows = results.data as string[][];
        const errors: string[] = [];

        if (rawRows.length < 4) {
          resolve({
            headers: [...REPORT_HEADERS],
            rows: [],
            rowCount: 0,
            errors: ["File too short to be a Xero report export."],
            source: "xero",
          });
          return;
        }

        // ── Step 1: Find the period header row ──────────────────────
        let periodRowIdx = -1;
        const periods: { colIdx: number; date: string }[] = [];

        for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
          const row = rawRows[i];
          if (!row || row.length < 2) continue;

          const candidatePeriods: { colIdx: number; date: string }[] = [];
          for (let c = 1; c < row.length; c++) {
            const cell = (row[c] ?? "").trim();
            if (!cell) continue;
            if (/^total$/i.test(cell)) continue;
            const parsed = parsePeriodHeader(cell);
            if (parsed) candidatePeriods.push({ colIdx: c, date: parsed });
          }

          if (candidatePeriods.length >= 1) {
            periodRowIdx = i;
            periods.push(...candidatePeriods);
            break;
          }
        }

        if (periodRowIdx === -1 || periods.length === 0) {
          // Try single-period fallback from metadata rows
          let fallbackDate: string | null = null;
          for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
            const cellText = (rawRows[i]?.[0] ?? "").trim();
            // "For the year ended 31 March 2024"
            // "1 January 2024 to 31 December 2024"
            const dateMatch = cellText.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s*$/);
            if (dateMatch) {
              const m = MONTH_MAP[dateMatch[2].toLowerCase()];
              if (m) {
                fallbackDate = `${dateMatch[3]}-${m}-01`;
                break;
              }
            }
            const yearMatch = cellText.match(/(\d{4})\s*$/);
            if (yearMatch) {
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
                "Could not detect period columns. Make sure this is a Xero P&L or Balance Sheet export.",
              ],
              source: "xero",
            });
            return;
          }

          // Find the data start row
          periodRowIdx = Math.min(4, rawRows.length - 1);
          periods.push({ colIdx: 1, date: fallbackDate });
        }

        // ── Step 2: Parse data rows ─────────────────────────────────
        let currentCategory: AccountCategory = "revenue";
        const flatRows: Record<string, string>[] = [];

        for (let i = periodRowIdx + 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || row.length === 0) continue;

          const label = (row[0] ?? "").toString();
          const trimmedLabel = label.trim();

          if (!trimmedLabel) continue;

          // Check for section header
          const section = detectSection(trimmedLabel);
          if (section !== null) {
            currentCategory = section;
            // Check if this row also has amounts (unlikely for Xero section headers)
            let hasValues = false;
            for (const p of periods) {
              const cellVal = (row[p.colIdx] ?? "").toString().trim();
              if (cellVal && cellVal !== "" && cellVal !== "-") {
                hasValues = true;
                break;
              }
            }
            if (!hasValues) continue;
          }

          // Skip totals
          if (isSkipRow(trimmedLabel)) continue;

          // Extract account info
          const { code, name } = extractAccountCode(trimmedLabel);

          // Check for numeric values
          let hasValues = false;
          for (const p of periods) {
            const cellVal = (row[p.colIdx] ?? "").toString().trim();
            if (cellVal && cellVal !== "" && cellVal !== "-") {
              hasValues = true;
              break;
            }
          }

          if (!hasValues) {
            // Might be a sub-section header
            const subSection = detectSection(trimmedLabel);
            if (subSection !== null) {
              currentCategory = subSection;
            }
            continue;
          }

          // Create flat rows per period
          for (const p of periods) {
            const rawVal = (row[p.colIdx] ?? "").toString();
            const amount = parseAmount(rawVal);

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
            "No account data found. Verify this is a Xero P&L or Balance Sheet export."
          );
        }

        resolve({
          headers: [...REPORT_HEADERS],
          rows: flatRows,
          rowCount: flatRows.length,
          errors,
          source: "xero",
        });
      },
      error: (err) => {
        resolve({
          headers: [...REPORT_HEADERS],
          rows: [],
          rowCount: 0,
          errors: [err.message],
          source: "xero",
        });
      },
    });
  });
}
