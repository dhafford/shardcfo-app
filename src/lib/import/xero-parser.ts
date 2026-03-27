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
import {
  MONTH_MAP,
  detectSection,
  isSkipRow,
  parsePeriodHeader,
  extractAccountCode,
  parseAmount,
} from "./parse-utils";

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
