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
import {
  MONTH_MAP,
  detectSection,
  isSkipRow,
  parsePeriodHeader,
  extractAccountCode,
  parseAmount,
} from "./parse-utils";

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
