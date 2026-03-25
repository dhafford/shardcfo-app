"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Download,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  parseCartaDetailedOnly,
  type DetailedCapTable,
} from "@/lib/import/carta-parser";

// ─── Constants ───────────────────────────────────────────────────────────────

const CLASSIFICATION_OPTIONS = [
  { value: "primary", label: "Primary Investor" },
  { value: "secondary", label: "Secondary Investor" },
  { value: "founders", label: "Founders / Mgmt" },
] as const;

type Classification = (typeof CLASSIFICATION_OPTIONS)[number]["value"];

const CLASSIFICATION_LABELS: Record<Classification, string> = {
  primary: "Primary Investor",
  secondary: "Secondary Investor",
  founders: "Founders / Mgmt",
};

// ─── Security column options (between Name and Outstanding Shares) ───────────

function getSecurityColumns(headers: string[]): string[] {
  const nameIdx = headers.findIndex((h) => /^name$/i.test(h));
  const outstandingIdx = headers.findIndex((h) =>
    /^outstanding\s*shares$/i.test(h.replace(/\n/g, " "))
  );
  if (nameIdx < 0 || outstandingIdx < 0) return [];
  return headers.slice(nameIdx + 1, outstandingIdx);
}

// ─── Column formatting helpers ───────────────────────────────────────────────

/** Detect column type from its header text for formatting purposes. */
function colType(header: string): "id" | "name" | "pct" | "num" {
  if (/stakeholder id/i.test(header)) return "id";
  if (/^name$/i.test(header)) return "name";
  if (/ownership/i.test(header) || /percentage/i.test(header)) return "pct";
  return "num";
}

function fmtShares(n: number): string {
  if (n === 0) return "—";
  return n.toLocaleString();
}

function fmtPct(n: number): string {
  if (n === 0) return "—";
  return `${(n * 100).toFixed(2)}%`;
}

function formatCell(value: string | number, type: "id" | "name" | "pct" | "num"): string {
  if (type === "id" || type === "name") return String(value);
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(n)) return String(value);
  if (type === "pct") return fmtPct(n);
  return fmtShares(n);
}

// ─── Dropzone ────────────────────────────────────────────────────────────────

function Dropzone({
  onFile,
  disabled,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
}) {
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = "";
  }

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-14 px-6 transition-colors cursor-pointer select-none",
        dragOver
          ? "border-blue-400 bg-blue-50"
          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/60",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <FileSpreadsheet className="h-6 w-6 text-slate-500" />
      </div>
      <p className="text-sm font-medium text-slate-700">
        Drop your Carta cap table here, or{" "}
        <span className="text-blue-600">browse</span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Accepts .xlsx or .xls — reads the Detailed Cap Table sheet
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}

// ─── Detailed table (mirrors Carta output) ───────────────────────────────────

function DetailedTable({
  data,
  classifications,
  onClassify,
  secondarySelections,
  onSecondarySelect,
}: {
  data: DetailedCapTable;
  classifications: Record<string, Classification>;
  onClassify: (name: string, value: Classification) => void;
  secondarySelections: Record<string, string>;
  onSecondarySelect: (name: string, value: string) => void;
}) {
  const types = React.useMemo(() => data.headers.map(colType), [data.headers]);
  const securityColumns = React.useMemo(
    () => getSecurityColumns(data.headers),
    [data.headers]
  );

  return (
    <div className="rounded-lg border overflow-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            {data.headers.map((header, i) => {
              const t = types[i];
              return (
                <TableHead
                  key={i}
                  className={cn(
                    "whitespace-nowrap text-xs",
                    t === "id" && "max-w-24",
                    t === "name" && "min-w-40 sticky left-0 bg-slate-50 z-10",
                    (t === "num" || t === "pct") && "text-right"
                  )}
                >
                  {header}
                </TableHead>
              );
            })}
            <TableHead className="bg-slate-50 z-10 min-w-44 text-xs">
              Classification
            </TableHead>
            <TableHead className="sticky right-0 bg-slate-50 z-10 min-w-52 text-xs">
              Security Class
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.map((row, ri) => {
            const stakeholderName = String(row[1]);
            return (
              <TableRow key={ri}>
                {row.map((cell, ci) => {
                  const t = types[ci];
                  return (
                    <TableCell
                      key={ci}
                      className={cn(
                        "whitespace-nowrap text-xs",
                        t === "id" && "max-w-24 truncate text-muted-foreground font-mono text-[10px]",
                        t === "name" && "font-medium sticky left-0 bg-white z-10",
                        (t === "num" || t === "pct") && "text-right tabular-nums",
                        t === "num" && typeof cell === "number" && cell === 0 && "text-muted-foreground"
                      )}
                    >
                      {formatCell(cell, t)}
                    </TableCell>
                  );
                })}
                <TableCell className="bg-white z-10">
                  <Select
                    value={classifications[stakeholderName] ?? ""}
                    onValueChange={(v) => {
                      if (v) onClassify(stakeholderName, v as Classification);
                    }}
                  >
                    <SelectTrigger size="sm" className="w-44 text-xs">
                      <SelectValue placeholder="Select role…" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLASSIFICATION_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="sticky right-0 bg-white z-10">
                  <Select
                    value={secondarySelections[stakeholderName] ?? ""}
                    onValueChange={(v) => {
                      if (v) onSecondarySelect(stakeholderName, v);
                    }}
                    disabled={classifications[stakeholderName] !== "secondary"}
                  >
                    <SelectTrigger
                      size="sm"
                      className={cn(
                        "w-52 text-xs",
                        classifications[stakeholderName] !== "secondary" &&
                          "opacity-40"
                      )}
                    >
                      <SelectValue placeholder="Select class…" />
                    </SelectTrigger>
                    <SelectContent>
                      {securityColumns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

type ParseStatus =
  | { state: "idle" }
  | { state: "parsing" }
  | { state: "error"; message: string }
  | { state: "success"; data: DetailedCapTable };

export default function DtcAppPage() {
  const [status, setStatus] = React.useState<ParseStatus>({ state: "idle" });
  const [data, setData] = React.useState<DetailedCapTable | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [classifications, setClassifications] = React.useState<
    Record<string, Classification>
  >({});
  const [secondarySelections, setSecondarySelections] = React.useState<
    Record<string, string>
  >({});
  const [exporting, setExporting] = React.useState(false);

  async function handleFile(file: File) {
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setStatus({
        state: "error",
        message: `"${file.name}" is not an Excel file. Please upload a .xlsx or .xls file.`,
      });
      return;
    }
    setFileName(file.name);
    setStatus({ state: "parsing" });

    try {
      const buffer = await file.arrayBuffer();
      const result = await parseCartaDetailedOnly(buffer);
      setStatus({ state: "success", data: result });
    } catch (err) {
      setStatus({
        state: "error",
        message: err instanceof Error ? err.message : "Failed to parse file.",
      });
    }
  }

  function handleImport() {
    if (status.state === "success") {
      setData(status.data);
      setClassifications({});
      setSecondarySelections({});
    }
  }

  function handleClassify(name: string, value: Classification) {
    setClassifications((prev) => ({ ...prev, [name]: value }));
    // Clear secondary selection when switching away from secondary
    if (value !== "secondary") {
      setSecondarySelections((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  }

  function handleSecondarySelect(name: string, value: string) {
    setSecondarySelections((prev) => ({ ...prev, [name]: value }));
  }

  // Every stakeholder must have a classification, and every secondary must
  // also have a security class selected.
  const allClassified = React.useMemo(() => {
    if (!data) return false;
    for (const row of data.rows) {
      const name = String(row[1]);
      const cls = classifications[name];
      if (!cls) return false;
      if (cls === "secondary" && !secondarySelections[name]) return false;
    }
    return true;
  }, [data, classifications, secondarySelections]);

  async function handleExport() {
    if (!data || !allClassified) return;
    setExporting(true);

    try {
      // Fetch the FORMAT.xlsx template
      const res = await fetch("/templates/FORMAT.xlsx");
      if (!res.ok) throw new Error("Failed to load FORMAT.xlsx template");
      const templateBuf = await res.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(templateBuf), { type: "array" });

      // Build the classified Carta data sheet
      const exportHeaders = [
        ...data.headers,
        "Classification",
        "Security Class",
      ];
      const exportRows = data.rows.map((row) => {
        const name = String(row[1]);
        const cls = classifications[name] as Classification;
        return [
          ...row,
          CLASSIFICATION_LABELS[cls],
          cls === "secondary" ? (secondarySelections[name] ?? "") : "",
        ];
      });

      const aoa = [exportHeaders, ...exportRows];
      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // Append the new sheet, then move it to position 0 (leftmost tab)
      const sheetName = "Carta Import";
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      const idx = wb.SheetNames.indexOf(sheetName);
      if (idx > 0) {
        wb.SheetNames.splice(idx, 1);
        wb.SheetNames.unshift(sheetName);
      }

      const exportName = `${data.companyName.replace(/[^a-zA-Z0-9 ]/g, "")} - DTC Model.xlsx`;
      XLSX.writeFile(wb, exportName);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }

  const preview = status.state === "success" ? status.data : null;

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        {/* Page heading */}
        <div>
          <h1 className="text-xl font-semibold">DTC App</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Deal terms calculator — import a Carta detailed cap table and
            classify stakeholders
          </p>
        </div>

        {/* Import section */}
        {!data && (
          <Card size="sm">
            <CardHeader>
              <CardTitle>Import Carta Cap Table</CardTitle>
              <CardDescription>
                Upload a Carta Excel export. Only the Detailed Cap Table sheet is
                used.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Dropzone
                onFile={handleFile}
                disabled={status.state === "parsing"}
              />

              {status.state === "parsing" && (
                <div className="flex items-center gap-2 rounded-lg border bg-slate-50 p-3 text-sm text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  <span>Parsing {fileName}…</span>
                </div>
              )}

              {status.state === "error" && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium">Parse error</p>
                    <p>{status.message}</p>
                  </div>
                </div>
              )}

              {preview && (
                <>
                  <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">
                        Parsed successfully — {fileName}
                      </p>
                      <p className="text-green-700">
                        {preview.companyName}
                        {preview.asOfDate && ` · as of ${preview.asOfDate}`} ·{" "}
                        {preview.rows.length} stakeholders ·{" "}
                        {preview.headers.length} columns
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t pt-4 gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStatus({ state: "idle" });
                        setFileName(null);
                      }}
                    >
                      Clear
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleImport}
                      className="gap-1.5"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Load Cap Table
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Loaded data view */}
        {data && (
          <>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold">{data.companyName}</h2>
                <p className="text-sm text-muted-foreground">
                  Detailed Cap Table
                  {data.asOfDate ? ` · as of ${data.asOfDate}` : ""}
                  {data.generatedBy ? ` · ${data.generatedBy}` : ""} ·{" "}
                  {data.rows.length} stakeholders
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  disabled={!allClassified || exporting}
                  onClick={handleExport}
                  className="gap-1.5"
                >
                  {exporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {exporting ? "Exporting…" : "Export .xlsx"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setData(null);
                    setStatus({ state: "idle" });
                    setFileName(null);
                    setClassifications({});
                    setSecondarySelections({});
                  }}
                >
                  Import new file
                </Button>
              </div>
            </div>

            <DetailedTable
              data={data}
              classifications={classifications}
              onClassify={handleClassify}
              secondarySelections={secondarySelections}
              onSecondarySelect={handleSecondarySelect}
            />

            {!allClassified && (
              <p className="text-xs text-muted-foreground">
                {Object.keys(classifications).length} / {data.rows.length}{" "}
                classified — classify all stakeholders to enable export
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
