import * as XLSX from "xlsx";
import type { DetectedColumn } from "./csv-parser";
import { detectColumns } from "./csv-parser";

export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
}

export interface ParsedXLSX {
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
  sheetNames: string[];
  sheets: ParsedSheet[];
  errors: string[];
  /** Retained workbook for advanced financial statement parsing. */
  workbook?: XLSX.WorkBook;
}

function parseSheetData(
  worksheet: XLSX.WorkSheet,
  sheetName: string
): ParsedSheet {
  const rawData = (XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    blankrows: false,
  }) as unknown) as unknown[][];

  if (rawData.length === 0) {
    return { name: sheetName, headers: [], rows: [], rowCount: 0 };
  }

  // First row is headers
  const headers = (rawData[0] as unknown[])
    .map((h) => String(h ?? "").trim())
    .filter(Boolean);

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < rawData.length; i++) {
    const raw = rawData[i] as unknown[];
    const row: Record<string, string> = {};
    let hasValue = false;
    headers.forEach((header, idx) => {
      const cell = raw[idx];
      // Handle Excel date serial numbers
      let value = "";
      if (typeof cell === "number" && XLSX.SSF) {
        // Check if it looks like a date serial (between 1900 and 2100)
        if (cell > 25569 && cell < 73050) {
          const date = XLSX.SSF.parse_date_code(cell);
          if (date) {
            value = `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
          } else {
            value = String(cell);
          }
        } else {
          value = String(cell);
        }
      } else {
        value = String(cell ?? "").trim();
      }
      row[header] = value;
      if (value) hasValue = true;
    });
    if (hasValue) rows.push(row);
  }

  return { name: sheetName, headers, rows, rowCount: rows.length };
}

export function parseXLSX(file: File): Promise<ParsedXLSX> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          resolve({ headers: [], rows: [], rowCount: 0, sheetNames: [], sheets: [], errors: ["Failed to read file."] });
          return;
        }

        const workbook = XLSX.read(data, { type: "array" });
        const sheetNames = workbook.SheetNames;

        if (sheetNames.length === 0) {
          resolve({ headers: [], rows: [], rowCount: 0, sheetNames: [], sheets: [], errors: ["Workbook contains no sheets."] });
          return;
        }

        // Parse every sheet
        const sheets: ParsedSheet[] = [];
        for (const name of sheetNames) {
          const ws = workbook.Sheets[name];
          const parsed = parseSheetData(ws, name);
          if (parsed.rowCount > 0 || parsed.headers.length > 0) {
            sheets.push(parsed);
          }
        }

        if (sheets.length === 0) {
          resolve({ headers: [], rows: [], rowCount: 0, sheetNames, sheets: [], errors: ["All sheets are empty."] });
          return;
        }

        // Build combined headers (union of all sheet headers, preserving order of first appearance)
        const headerSet = new Set<string>();
        const combinedHeaders: string[] = [];
        for (const sheet of sheets) {
          for (const h of sheet.headers) {
            if (!headerSet.has(h)) {
              headerSet.add(h);
              combinedHeaders.push(h);
            }
          }
        }

        // Combine all rows, filling missing columns with empty string
        const combinedRows: Record<string, string>[] = [];
        for (const sheet of sheets) {
          for (const row of sheet.rows) {
            const combined: Record<string, string> = {};
            for (const h of combinedHeaders) {
              combined[h] = row[h] ?? "";
            }
            combined["__sheet__"] = sheet.name;
            combinedRows.push(combined);
          }
        }

        resolve({
          headers: combinedHeaders,
          rows: combinedRows,
          rowCount: combinedRows.length,
          sheetNames,
          sheets,
          errors: [],
          workbook,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to parse Excel file.";
        // SheetJS throws on password-protected files
        const isPasswordProtected =
          message.includes("password") ||
          message.includes("encrypt") ||
          message.includes("ECMA-376 Encrypted");
        resolve({
          headers: [],
          rows: [],
          rowCount: 0,
          sheetNames: [],
          sheets: [],
          errors: [
            isPasswordProtected
              ? "This file appears to be password-protected. Please remove the password and re-upload."
              : message,
          ],
        });
      }
    };

    reader.onerror = () => {
      resolve({
        headers: [],
        rows: [],
        rowCount: 0,
        sheetNames: [],
        sheets: [],
        errors: ["FileReader error while reading the file."],
      });
    };

    reader.readAsArrayBuffer(file);
  });
}

export { detectColumns };
export type { DetectedColumn };
