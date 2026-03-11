import * as XLSX from "xlsx";
import type { DetectedColumn } from "./csv-parser";
import { detectColumns } from "./csv-parser";

export interface ParsedXLSX {
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
  sheetNames: string[];
  errors: string[];
}

export function parseXLSX(file: File, sheetIndex = 0): Promise<ParsedXLSX> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          resolve({ headers: [], rows: [], rowCount: 0, sheetNames: [], errors: ["Failed to read file."] });
          return;
        }

        const workbook = XLSX.read(data, { type: "array" });
        const sheetNames = workbook.SheetNames;

        if (sheetNames.length === 0) {
          resolve({ headers: [], rows: [], rowCount: 0, sheetNames: [], errors: ["Workbook contains no sheets."] });
          return;
        }

        const sheetName = sheetNames[Math.min(sheetIndex, sheetNames.length - 1)];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON with header row — `header: 1` makes it return arrays not objects
        const rawData = (XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: "",
          blankrows: false,
        }) as unknown) as unknown[][];

        if (rawData.length === 0) {
          resolve({ headers: [], rows: [], rowCount: 0, sheetNames, errors: ["Sheet is empty."] });
          return;
        }

        // First row is headers
        const headers = (rawData[0] as unknown[]).map((h) =>
          String(h ?? "").trim()
        ).filter(Boolean);

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

        resolve({
          headers,
          rows,
          rowCount: rows.length,
          sheetNames,
          errors: [],
        });
      } catch (err) {
        resolve({
          headers: [],
          rows: [],
          rowCount: 0,
          sheetNames: [],
          errors: [err instanceof Error ? err.message : "Failed to parse Excel file."],
        });
      }
    };

    reader.onerror = () => {
      resolve({
        headers: [],
        rows: [],
        rowCount: 0,
        sheetNames: [],
        errors: ["FileReader error while reading the file."],
      });
    };

    reader.readAsArrayBuffer(file);
  });
}

export { detectColumns };
export type { DetectedColumn };
