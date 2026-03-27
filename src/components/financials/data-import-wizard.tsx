"use client";

import * as React from "react";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, FileSpreadsheet, X, Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CellValue = string | number | boolean | null;

interface RawSheet {
  name: string;
  rows: CellValue[][];
  colCount: number;
}

interface ParsedFileData {
  fileName: string;
  sheets: RawSheet[];
}

interface DataImportWizardProps {
  className?: string;
  /** Kept for route-level compatibility — unused in the viewer. */
  companyId?: string;
  accounts?: unknown[];
  industry?: string | null;
  onImport?: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip the QuickBooks merged-header block if present.
 * QB exports start with 3 single-cell rows (company, report title, date range)
 * followed by a blank row. Detect that pattern and remove those 4 rows.
 */
function stripQBHeader(rows: CellValue[][]): CellValue[][] {
  if (rows.length < 5) return rows;

  const isSingleCell = (row: CellValue[]) => {
    const filled = row.filter((c) => c !== null && c !== undefined && c !== "");
    return filled.length === 1;
  };
  const isBlank = (row: CellValue[]) =>
    row.length === 0 ||
    row.every((c) => c === null || c === undefined || c === "");

  if (
    isSingleCell(rows[0]) &&
    isSingleCell(rows[1]) &&
    isSingleCell(rows[2]) &&
    isBlank(rows[3])
  ) {
    return rows.slice(4);
  }
  return rows;
}

/** Column index → spreadsheet-style letter (0→A, 25→Z, 26→AA …) */
function colLetter(idx: number): string {
  let result = "";
  let n = idx;
  while (n >= 0) {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Render a cell value for display. Converts Excel date serials → readable dates. */
function formatCell(value: CellValue): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") {
    // Excel date serial range (~1900 to ~2100)
    if (value > 25569 && value < 73050 && XLSX.SSF) {
      const d = XLSX.SSF.parse_date_code(value);
      if (d) return `${MONTHS[d.m - 1]} ${d.y}`;
    }
    return Number.isInteger(value)
      ? value.toLocaleString()
      : value.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// File drop zone
// ---------------------------------------------------------------------------

function FileDropZone({
  onFile,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  onFile: (file: File) => void;
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 transition-colors cursor-pointer",
        isDragging
          ? "border-blue-400 bg-blue-50"
          : "border-slate-300 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/40",
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      aria-label="Upload file"
    >
      <div className="flex items-center justify-center w-14 h-14 rounded-full bg-blue-100">
        <Upload className="w-6 h-6 text-blue-600" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-slate-700">
          Drop your file here, or click to browse
        </p>
        <p className="text-xs text-muted-foreground">
          Supports .csv and .xlsx files up to 10 MB
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DataImportWizard({ className }: DataImportWizardProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [isParsing, setIsParsing] = React.useState(false);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<ParsedFileData | null>(null);
  const [activeSheet, setActiveSheet] = React.useState(0);

  // ---- Parse file ----
  const handleFile = React.useCallback(async (file: File) => {
    setParseError(null);
    setIsParsing(true);
    setData(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });

      const sheets: RawSheet[] = workbook.SheetNames.map((name) => {
        const ws = workbook.Sheets[name];
        const rawRows = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: null,
          blankrows: true,
        }) as CellValue[][];

        let colCount = 0;
        for (const row of rawRows) {
          if (row.length > colCount) colCount = row.length;
        }

        return { name, rows: stripQBHeader(rawRows), colCount };
      }).filter((s) => s.rows.length > 0);

      if (sheets.length === 0) {
        setParseError("The file contains no data.");
        return;
      }

      setData({ fileName: file.name, sheets });
      setActiveSheet(0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to parse file.";
      if (msg.includes("password") || msg.includes("encrypt")) {
        setParseError(
          "This file appears to be password-protected. Please remove the password and re-upload.",
        );
      } else {
        setParseError(msg);
      }
    } finally {
      setIsParsing(false);
    }
  }, []);

  // ---- Drag handlers ----
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const reset = () => {
    setData(null);
    setParseError(null);
    setActiveSheet(0);
  };

  const sheet = data?.sheets[activeSheet];

  // ---- Render ----
  return (
    <div className={cn("space-y-4", className)}>
      {/* Upload state */}
      {!data && !isParsing && (
        <FileDropZone
          onFile={handleFile}
          isDragging={isDragging}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        />
      )}

      {/* Parsing spinner */}
      {isParsing && (
        <div className="flex items-center justify-center gap-2 py-12">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <span className="text-sm text-muted-foreground">Parsing file…</span>
        </div>
      )}

      {/* Error */}
      {parseError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {parseError}
        </div>
      )}

      {/* Data viewer */}
      {data && sheet && (
        <>
          {/* File info + clear button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{data.fileName}</span>
              <span className="text-xs text-muted-foreground">
                {sheet.rows.length} rows &times; {sheet.colCount} columns
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </div>

          {/* Sheet tabs (multi-sheet files only) */}
          {data.sheets.length > 1 && (
            <div className="flex gap-1 border-b">
              {data.sheets.map((s, idx) => (
                <button
                  key={s.name}
                  onClick={() => setActiveSheet(idx)}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium border-b-2 transition-colors",
                    idx === activeSheet
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}

          {/* Raw data table */}
          <div className="rounded-lg border overflow-auto max-h-[600px]">
            <Table>
              <TableHeader className="sticky top-0 bg-slate-50 z-10">
                <TableRow>
                  <TableHead className="w-12 text-center text-xs text-muted-foreground">
                    #
                  </TableHead>
                  {Array.from({ length: sheet.colCount }, (_, i) => (
                    <TableHead key={i} className="text-xs font-semibold text-muted-foreground">
                      {colLetter(i)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sheet.rows.map((row, rowIdx) => {
                  const isEmpty = row.every(
                    (c) => c === null || c === undefined || c === "",
                  );
                  return (
                    <TableRow
                      key={rowIdx}
                      className={isEmpty ? "bg-slate-50/50" : undefined}
                    >
                      <TableCell className="text-center text-xs text-muted-foreground font-mono">
                        {rowIdx + 1}
                      </TableCell>
                      {Array.from({ length: sheet.colCount }, (_, colIdx) => (
                        <TableCell key={colIdx} className="text-sm">
                          {formatCell(row[colIdx] ?? null)}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
