"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  FileSpreadsheet,
  X,
  Loader2,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types matching qbo-parser API output
// ---------------------------------------------------------------------------

interface ParsedRow {
  account_name: string;
  account_code: string;
  depth: number;
  amounts: Record<string, number | null>;
  is_total: boolean;
  children: ParsedRow[];
}

interface ParsedSection {
  name: string;
  depth: number;
  rows: ParsedRow[];
  total: Record<string, number | null>;
}

interface ParsedReport {
  report_type: string;
  company_name: string;
  report_basis: string;
  period: { start_date: string; end_date: string };
  columns: string[];
  sections: ParsedSection[];
  validation_warnings: string[];
  warnings: string[];
}

interface SummaryMetrics {
  [key: string]: number | null;
}

interface SummaryResponse {
  report_type: string;
  company_name: string;
  period: { start_date: string; end_date: string };
  column: string;
  metrics: SummaryMetrics;
  validation_warnings: string[];
}

const QBO_API_URL =
  process.env.NEXT_PUBLIC_QBO_PARSER_URL || "/api/qbo";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REPORT_TYPE_LABELS: Record<string, string> = {
  profit_and_loss: "Profit & Loss",
  balance_sheet: "Balance Sheet",
  cash_flow_statement: "Cash Flow",
  unknown: "Unknown",
};

const REPORT_TYPE_COLORS: Record<string, string> = {
  profit_and_loss: "bg-blue-100 text-blue-800",
  balance_sheet: "bg-emerald-100 text-emerald-800",
  cash_flow_statement: "bg-violet-100 text-violet-800",
  unknown: "bg-slate-100 text-slate-800",
};

function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  return `${sign}$${abs.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatPercent(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  return `${(val * 100).toFixed(1)}%`;
}

function formatPeriod(period: { start_date: string; end_date: string }): string {
  if (!period.start_date && period.end_date) return `As of ${period.end_date}`;
  if (period.start_date && period.end_date)
    return `${period.start_date} to ${period.end_date}`;
  return "—";
}

// ---------------------------------------------------------------------------
// File drop zone (reused pattern)
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
          ? "border-violet-400 bg-violet-50"
          : "border-slate-300 bg-slate-50 hover:border-violet-300 hover:bg-violet-50/40",
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      aria-label="Upload file for structured parsing"
    >
      <div className="flex items-center justify-center w-14 h-14 rounded-full bg-violet-100">
        <Upload className="w-6 h-6 text-violet-600" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-slate-700">
          Drop a QuickBooks export here, or click to browse
        </p>
        <p className="text-xs text-muted-foreground">
          Supports .xlsx files — auto-detects P&L, Balance Sheet, and Cash Flow
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
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
// Summary card
// ---------------------------------------------------------------------------

function MetricCard({
  label,
  value,
  format = "currency",
}: {
  label: string;
  value: number | null | undefined;
  format?: "currency" | "percent" | "ratio";
}) {
  const display =
    format === "percent"
      ? formatPercent(value)
      : format === "ratio"
      ? value !== null && value !== undefined
        ? value.toFixed(2)
        : "—"
      : formatCurrency(value);

  const isNeg = typeof value === "number" && value < 0;

  return (
    <div className="flex flex-col gap-0.5 px-3 py-2 rounded-lg bg-slate-50 border">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          isNeg ? "text-red-600" : "text-slate-900",
        )}
      >
        {display}
      </span>
    </div>
  );
}

function SummaryCards({
  reportType,
  metrics,
}: {
  reportType: string;
  metrics: SummaryMetrics;
}) {
  if (reportType === "profit_and_loss") {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCard label="Revenue" value={metrics.total_revenue} />
        <MetricCard label="Gross Profit" value={metrics.gross_profit} />
        <MetricCard label="Expenses" value={metrics.total_expenses} />
        <MetricCard label="Net Income" value={metrics.net_income} />
        <MetricCard label="Gross Margin" value={metrics.gross_margin} format="percent" />
        <MetricCard label="Net Margin" value={metrics.net_margin} format="percent" />
        <MetricCard label="COGS" value={metrics.total_cogs} />
      </div>
    );
  }

  if (reportType === "balance_sheet") {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCard label="Total Assets" value={metrics.total_assets} />
        <MetricCard label="Total Liabilities" value={metrics.total_liabilities} />
        <MetricCard label="Total Equity" value={metrics.total_equity} />
        <MetricCard label="Current Ratio" value={metrics.current_ratio} format="ratio" />
        <MetricCard label="Debt / Equity" value={metrics.debt_to_equity} format="ratio" />
      </div>
    );
  }

  if (reportType === "cash_flow_statement") {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCard label="Operating" value={metrics.operating_cash_flow} />
        <MetricCard label="Investing" value={metrics.investing_cash_flow} />
        <MetricCard label="Financing" value={metrics.financing_cash_flow} />
        <MetricCard label="Net Change" value={metrics.net_change_in_cash} />
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Section tree
// ---------------------------------------------------------------------------

function RowTree({
  rows,
  columns,
  depth = 0,
}: {
  rows: ParsedRow[];
  columns: string[];
  depth?: number;
}) {
  return (
    <>
      {rows.map((row, idx) => (
        <RowNode key={`${depth}-${idx}`} row={row} columns={columns} />
      ))}
    </>
  );
}

function RowNode({ row, columns }: { row: ParsedRow; columns: string[] }) {
  const [expanded, setExpanded] = React.useState(row.depth < 2);
  const hasChildren = row.children.length > 0;
  const indent = row.depth * 16;

  return (
    <>
      <TableRow
        className={cn(
          row.is_total && "bg-slate-50 font-semibold",
          !row.is_total && row.depth === 0 && "bg-slate-100/50",
        )}
      >
        <TableCell
          className="text-sm"
          style={{ paddingLeft: `${indent + 8}px` }}
        >
          <span className="flex items-center gap-1">
            {hasChildren ? (
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-0.5 rounded hover:bg-slate-200"
              >
                {expanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                )}
              </button>
            ) : (
              <span className="w-4.5" />
            )}
            {row.account_code && (
              <span className="text-xs text-muted-foreground font-mono">
                {row.account_code}
              </span>
            )}
            <span className={row.is_total ? "text-slate-700" : ""}>
              {row.account_name}
            </span>
          </span>
        </TableCell>
        {columns.map((col) => {
          const val = row.amounts[col];
          return (
            <TableCell
              key={col}
              className={cn(
                "text-sm text-right tabular-nums",
                row.is_total && "font-semibold",
                val !== null && val !== undefined && val < 0 && "text-red-600",
              )}
            >
              {val !== null && val !== undefined
                ? val.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : ""}
            </TableCell>
          );
        })}
      </TableRow>
      {hasChildren && expanded && (
        <RowTree rows={row.children} columns={columns} depth={row.depth + 1} />
      )}
    </>
  );
}

function SectionTotalRow({
  label,
  total,
  columns,
}: {
  label: string;
  total: Record<string, number | null>;
  columns: string[];
}) {
  return (
    <TableRow className="bg-slate-100 border-t border-slate-200">
      <TableCell className="text-sm font-semibold text-slate-700 py-1.5">
        {label}
      </TableCell>
      {columns.map((col) => {
        const val = total[col];
        return (
          <TableCell
            key={col}
            className={cn(
              "text-sm text-right tabular-nums font-semibold py-1.5",
              val !== null && val !== undefined && val < 0 && "text-red-600",
            )}
          >
            {val !== null && val !== undefined
              ? val.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : ""}
          </TableCell>
        );
      })}
    </TableRow>
  );
}

function SectionRows({
  section,
  columns,
}: {
  section: ParsedSection;
  columns: string[];
}) {
  const [expanded, setExpanded] = React.useState(true);
  const hasTotals = section.total && Object.values(section.total).some((v) => v !== null);

  // Section header row
  const headerRow = (
    <TableRow className="bg-slate-50/80 border-t-2 border-slate-200">
      <TableCell
        colSpan={columns.length + 1}
        className="py-1.5"
      >
        <button
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-slate-900"
          onClick={() => setExpanded(!expanded)}
        >
          {section.rows.length > 0 ? (
            expanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )
          ) : null}
          {section.name}
        </button>
      </TableCell>
    </TableRow>
  );

  // Standalone section (no child rows, just a total — e.g. Gross Profit, Net Income)
  if (section.rows.length === 0 && hasTotals) {
    return (
      <SectionTotalRow
        label={section.name}
        total={section.total}
        columns={columns}
      />
    );
  }

  return (
    <>
      {headerRow}
      {expanded && <RowTree rows={section.rows} columns={columns} />}
      {hasTotals && (
        <SectionTotalRow
          label={`Total ${section.name}`}
          total={section.total}
          columns={columns}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface QboImportViewerProps {
  className?: string;
  companyId?: string;
}

export function QboImportViewer({ className }: QboImportViewerProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [isParsing, setIsParsing] = React.useState(false);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [report, setReport] = React.useState<ParsedReport | null>(null);
  const [summary, setSummary] = React.useState<SummaryResponse | null>(null);
  const [fileName, setFileName] = React.useState("");

  const handleFile = React.useCallback(async (file: File) => {
    setParseError(null);
    setIsParsing(true);
    setReport(null);
    setSummary(null);
    setFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Fire both API calls in parallel
      const [parseRes, summaryRes] = await Promise.all([
        fetch(`${QBO_API_URL}/parse`, { method: "POST", body: formData }),
        (() => {
          const fd2 = new FormData();
          fd2.append("file", file);
          return fetch(`${QBO_API_URL}/parse/summary`, {
            method: "POST",
            body: fd2,
          });
        })(),
      ]);

      if (!parseRes.ok) {
        const err = await parseRes.json().catch(() => null);
        throw new Error(
          err?.detail || `Parser returned ${parseRes.status}`,
        );
      }

      const parseData: ParsedReport = await parseRes.json();
      setReport(parseData);

      if (summaryRes.ok) {
        const summaryData: SummaryResponse = await summaryRes.json();
        setSummary(summaryData);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to parse file.";
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        setParseError(
          `Cannot reach the QBO parser service at ${QBO_API_URL}. ` +
            "The parser API may still be deploying.",
        );
      } else {
        setParseError(msg);
      }
    } finally {
      setIsParsing(false);
    }
  }, []);

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
    setReport(null);
    setSummary(null);
    setParseError(null);
    setFileName("");
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Upload */}
      {!report && !isParsing && (
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
          <Loader2 className="w-5 h-5 animate-spin text-violet-600" />
          <span className="text-sm text-muted-foreground">
            Parsing with QBO engine...
          </span>
        </div>
      )}

      {/* Error */}
      {parseError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {parseError}
        </div>
      )}

      {/* Parsed report */}
      {report && (
        <>
          {/* Header bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{fileName}</span>
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                  REPORT_TYPE_COLORS[report.report_type] || REPORT_TYPE_COLORS.unknown,
                )}
              >
                {REPORT_TYPE_LABELS[report.report_type] || "Unknown"}
              </span>
              {report.report_basis !== "unknown" && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                  {report.report_basis}
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </div>

          {/* Company + Period */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {report.company_name}
            </span>
            <span>{formatPeriod(report.period)}</span>
            <span>
              {report.columns.length} column{report.columns.length !== 1 ? "s" : ""}
              {" / "}
              {report.sections.length} section{report.sections.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Validation status */}
          {report.validation_warnings.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
              <CheckCircle className="w-4 h-4" />
              Accounting identities verified
            </div>
          ) : (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
                <AlertTriangle className="w-4 h-4" />
                Validation warnings
              </div>
              {report.validation_warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-600 pl-6">
                  {w}
                </p>
              ))}
            </div>
          )}

          {/* Summary metrics */}
          {summary && (
            <SummaryCards
              reportType={summary.report_type}
              metrics={summary.metrics}
            />
          )}

          {/* Sections — single table with frozen header */}
          <div className="border rounded-lg overflow-auto max-h-[600px]">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_theme(colors.slate.200)]">
                <TableRow>
                  <TableHead className="text-xs font-semibold min-w-[240px]">
                    Account
                  </TableHead>
                  {report.columns.map((col) => (
                    <TableHead
                      key={col}
                      className="text-xs font-semibold text-right min-w-[100px]"
                    >
                      {col}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.sections.map((section, idx) => (
                  <SectionRows
                    key={idx}
                    section={section}
                    columns={report.columns}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
