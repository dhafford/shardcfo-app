/**
 * Parser for financial statement layouts exported from accounting systems.
 *
 * Unlike the generic xlsx-parser which assumes row 1 is headers,
 * this parser handles the reality of accounting exports:
 *   - Title/metadata rows at the top (company name, report name, period)
 *   - Period dates as column headers (Jan 2024, Feb 2024, ...)
 *   - Section headers interspersed with data (bold text, no amounts)
 *   - Subtotal/total rows to skip
 *   - Hierarchical indentation (section → subsection → line item)
 *   - Merged cells, spacer rows, and varying layouts
 */

import * as XLSX from "xlsx";
import type { SheetClassification } from "./statement-detection";
import type { StatementType } from "./statement-detection";
import {
  parsePeriodHeader,
  parseAmount,
  extractAccountCode,
  isSkipRow,
  detectSection,
} from "./parse-utils";

// ── Types ────────────────────────────────────────────────────────────────────

export interface RawFinancialLineItem {
  rowIndex: number;
  label: string;
  accountCode: string;
  sectionContext: string;
  amounts: Record<string, number>;
  indent: number;
  isSubtotal: boolean;
}

export interface ParsedFinancialSheet {
  sheetName: string;
  statementType: StatementType;
  periods: string[];
  lineItems: RawFinancialLineItem[];
  errors: string[];
}

interface PeriodColumn {
  colIndex: number;
  date: string;
}

// ── Header row detection ─────────────────────────────────────────────────────

/**
 * Scan the first N rows to find the one with the most period-parseable cells.
 * Returns the row index and detected period columns, or -1 if none found.
 */
function findHeaderRow(
  rawData: unknown[][],
  maxScanRows = 20,
): { headerRowIndex: number; periodColumns: PeriodColumn[] } {
  let bestRowIdx = -1;
  let bestPeriods: PeriodColumn[] = [];

  const scanLimit = Math.min(rawData.length, maxScanRows);
  for (let i = 0; i < scanLimit; i++) {
    const row = rawData[i];
    if (!row || row.length < 2) continue;

    const candidatePeriods: PeriodColumn[] = [];
    for (let c = 1; c < row.length; c++) {
      const cell = String(row[c] ?? "").trim();
      if (!cell) continue;
      if (/^total$/i.test(cell)) continue;

      const parsed = parsePeriodHeader(cell);
      if (parsed) {
        candidatePeriods.push({ colIndex: c, date: parsed });
      }
    }

    if (candidatePeriods.length > bestPeriods.length) {
      bestRowIdx = i;
      bestPeriods = candidatePeriods;
    }
  }

  return { headerRowIndex: bestRowIdx, periodColumns: bestPeriods };
}

/**
 * Fallback: try to find a date from metadata/title rows (e.g., "For the year ended 31 March 2024").
 */
function extractFallbackDate(rawData: unknown[][], maxRows = 5): string | null {
  for (let i = 0; i < Math.min(rawData.length, maxRows); i++) {
    const cellText = String(rawData[i]?.[0] ?? "").trim();
    if (!cellText) continue;

    // "For the year ended 31 March 2024" or "1 January 2024 to 31 December 2024"
    const dateMatch = cellText.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s*$/);
    if (dateMatch) {
      const parsed = parsePeriodHeader(`${dateMatch[1]} ${dateMatch[2]} ${dateMatch[3]}`);
      if (parsed) return parsed;
    }

    // "January - December 2024"
    const rangeMatch = cellText.match(/([A-Za-z]+)\s+(\d{4})\s*$/);
    if (rangeMatch) {
      const parsed = parsePeriodHeader(`${rangeMatch[1]} ${rangeMatch[2]}`);
      if (parsed) return parsed;
    }

    // Just a year: "2024"
    const yearMatch = cellText.match(/\b(\d{4})\b/);
    if (yearMatch) {
      return `${yearMatch[1]}-12-01`;
    }
  }
  return null;
}

// ── Row classification ───────────────────────────────────────────────────────

function countLeadingSpaces(text: string): number {
  const match = text.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

function hasNumericValues(row: unknown[], periodColumns: PeriodColumn[]): boolean {
  for (const pc of periodColumns) {
    const cellVal = String(row[pc.colIndex] ?? "").trim();
    if (!cellVal || cellVal === "-" || cellVal === "") continue;
    // Check if it looks numeric (after stripping currency/parens)
    const cleaned = cellVal.replace(/[$€£¥₹(,)\s]/g, "");
    if (cleaned && !isNaN(parseFloat(cleaned))) return true;
  }
  return false;
}

// ── Main parser ──────────────────────────────────────────────────────────────

export function parseFinancialSheet(
  worksheet: XLSX.WorkSheet,
  sheetName: string,
  classification: SheetClassification,
): ParsedFinancialSheet {
  const errors: string[] = [];

  // Get raw 2D data (blankrows: true to preserve row indices for merge detection)
  const rawData = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    blankrows: true,
  }) as unknown[][];

  if (rawData.length === 0) {
    return {
      sheetName,
      statementType: classification.detectedType,
      periods: [],
      lineItems: [],
      errors: ["Sheet is empty."],
    };
  }

  // Step 1: Find the header row with period columns
  let { headerRowIndex, periodColumns } = findHeaderRow(rawData);

  // Fallback: if no period headers found, try single-period from metadata
  if (headerRowIndex === -1 || periodColumns.length === 0) {
    const fallbackDate = extractFallbackDate(rawData);
    if (fallbackDate) {
      // Find the first row that looks like a header (cell[0] empty, cell[1] non-empty)
      for (let i = 0; i < Math.min(rawData.length, 15); i++) {
        const row = rawData[i];
        if (!row || row.length < 2) continue;
        const first = String(row[0] ?? "").trim();
        const second = String(row[1] ?? "").trim();
        if (!first && second) {
          headerRowIndex = i;
          periodColumns = [{ colIndex: 1, date: fallbackDate }];
          break;
        }
      }
      // Last resort: guess row 3 or 4
      if (headerRowIndex === -1) {
        headerRowIndex = Math.min(3, rawData.length - 1);
        periodColumns = [{ colIndex: 1, date: fallbackDate }];
      }
    } else {
      errors.push("Could not detect period columns in this sheet.");
      return {
        sheetName,
        statementType: classification.detectedType,
        periods: [],
        lineItems: [],
        errors,
      };
    }
  }

  // Step 2: Handle merged cells in the header row
  const merges = worksheet["!merges"] || [];
  for (const merge of merges) {
    // If a merge spans the header row and covers period columns, expand
    if (merge.s.r <= headerRowIndex && merge.e.r >= headerRowIndex) {
      // The merged cell's value is in the top-left position
      const value = String(rawData[merge.s.r]?.[merge.s.c] ?? "").trim();
      const parsed = parsePeriodHeader(value);
      if (parsed) {
        // Add all columns in the merge range as having this period
        for (let c = merge.s.c; c <= merge.e.c; c++) {
          if (!periodColumns.some((pc) => pc.colIndex === c)) {
            periodColumns.push({ colIndex: c, date: parsed });
          }
        }
      }
    }
  }

  // Sort period columns by index
  periodColumns.sort((a, b) => a.colIndex - b.colIndex);

  // Deduplicate periods
  const uniquePeriods = [...new Set(periodColumns.map((pc) => pc.date))].sort();

  // Step 3: Detect the label column (usually 0, but might be 1 if col 0 is padding)
  let labelColIndex = 0;
  const headerRowData = rawData[headerRowIndex] || [];
  const col0Header = String(headerRowData[0] ?? "").trim().toLowerCase();
  if (!col0Header || col0Header === "" || col0Header === " ") {
    // Check if column 1 has actual labels below
    let col1HasLabels = false;
    for (let i = headerRowIndex + 1; i < Math.min(rawData.length, headerRowIndex + 10); i++) {
      if (String(rawData[i]?.[1] ?? "").trim()) {
        col1HasLabels = true;
        break;
      }
    }
    // But also check column 0
    let col0HasLabels = false;
    for (let i = headerRowIndex + 1; i < Math.min(rawData.length, headerRowIndex + 10); i++) {
      if (String(rawData[i]?.[0] ?? "").trim()) {
        col0HasLabels = true;
        break;
      }
    }
    // If column 0 has labels (most common), keep 0. If only column 1 has them, use 1.
    if (!col0HasLabels && col1HasLabels) {
      labelColIndex = 1;
    }
  }

  // Step 4: Parse data rows
  let currentSectionContext = "";
  const lineItems: RawFinancialLineItem[] = [];

  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;

    const rawLabel = String(row[labelColIndex] ?? "");
    const trimmedLabel = rawLabel.trim();

    // Skip blank rows
    if (!trimmedLabel) continue;

    const hasNumbers = hasNumericValues(row, periodColumns);

    // Check if this is a section header (text only, no numbers)
    if (!hasNumbers) {
      const section = detectSection(trimmedLabel);
      if (section !== null) {
        currentSectionContext = trimmedLabel.trim();
        continue;
      }
      // Even without a known section, a text-only row might be a subsection header
      // Heuristic: if the label is short (<50 chars) and ALL caps or title-case
      if (trimmedLabel.length < 50 && !trimmedLabel.includes(",")) {
        currentSectionContext = trimmedLabel;
      }
      continue;
    }

    // Check if this is a total/subtotal row
    const subtotal = isSkipRow(trimmedLabel);

    // Extract account code and name
    const { code, name } = extractAccountCode(trimmedLabel);

    // Extract amounts for each period
    const amounts: Record<string, number> = {};
    for (const pc of periodColumns) {
      const rawVal = String(row[pc.colIndex] ?? "");
      const amountStr = parseAmount(rawVal);
      const amount = parseFloat(amountStr);
      if (amount !== 0 && !isNaN(amount)) {
        amounts[pc.date] = (amounts[pc.date] || 0) + amount;
      }
    }

    // Skip if no non-zero amounts
    if (Object.keys(amounts).length === 0) continue;

    // Skip subtotal rows
    if (subtotal) continue;

    const indent = countLeadingSpaces(rawLabel);

    lineItems.push({
      rowIndex: i,
      label: name,
      accountCode: code,
      sectionContext: currentSectionContext,
      amounts,
      indent,
      isSubtotal: false,
    });
  }

  if (lineItems.length === 0) {
    errors.push("No data rows found after parsing.");
  }

  return {
    sheetName,
    statementType: classification.detectedType,
    periods: uniquePeriods,
    lineItems,
    errors,
  };
}

/**
 * Parse all classified sheets from a workbook.
 * Skips sheets classified as supporting_schedule or unknown.
 */
export function parseAllFinancialSheets(
  workbook: XLSX.WorkBook,
  classifications: SheetClassification[],
): ParsedFinancialSheet[] {
  const results: ParsedFinancialSheet[] = [];

  for (const classification of classifications) {
    // Skip non-financial sheets
    if (
      classification.detectedType === "supporting_schedule" ||
      classification.detectedType === "unknown"
    ) {
      continue;
    }

    const worksheet = workbook.Sheets[classification.sheetName];
    if (!worksheet) continue;

    const parsed = parseFinancialSheet(worksheet, classification.sheetName, classification);
    if (parsed.lineItems.length > 0) {
      results.push(parsed);
    }
  }

  return results;
}
