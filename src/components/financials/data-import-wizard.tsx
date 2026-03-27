"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  FileSpreadsheet,
  X,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { parseCSV } from "@/lib/import/csv-parser";
import { parseXLSX, type ParsedSheet } from "@/lib/import/xlsx-parser";
import { detectColumns } from "@/lib/import/csv-parser";
import { validateData } from "@/lib/import/csv-parser";
import { parseQuickBooksReport } from "@/lib/import/quickbooks-parser";
import { parseXeroReport } from "@/lib/import/xero-parser";
import { organizeIntoTemplate, TEMPLATE_TO_DB_CATEGORY, type ReviewLineItem, type OrganizedStatement } from "@/lib/import/industry-templates";
import { ImportTemplateReview } from "@/components/financials/import-template-review";
import type { AccountRow } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Import source types
// ---------------------------------------------------------------------------

export type ImportSource = "generic" | "quickbooks" | "xero";

const IMPORT_SOURCES: { value: ImportSource; label: string; description: string }[] = [
  { value: "generic", label: "Generic CSV / Excel", description: "Standard spreadsheet with columns for account, amount, and date" },
  { value: "quickbooks", label: "QuickBooks Online", description: "P&L or Balance Sheet exported from QuickBooks" },
  { value: "xero", label: "Xero", description: "P&L or Balance Sheet exported from Xero" },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WizardStep = "upload" | "preview" | "mapping" | "review" | "import";

interface ParsedFile {
  name: string;
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
  errors: string[];
  sheets?: ParsedSheet[];
}

interface ColumnMapping {
  [importHeader: string]: string; // maps import column -> app field
}

const APP_FIELDS = [
  { value: "", label: "— Ignore —" },
  { value: "account_code", label: "Account Code" },
  { value: "account_name", label: "Account Name" },
  { value: "account_type", label: "Account Type" },
  { value: "amount", label: "Amount" },
  { value: "date", label: "Date / Period" },
  { value: "period_date", label: "Period Date (YYYY-MM)" },
  { value: "period_label", label: "Period Label" },
  { value: "debit", label: "Debit" },
  { value: "credit", label: "Credit" },
  { value: "notes", label: "Notes" },
];

interface DataImportWizardProps {
  companyId: string;
  accounts: AccountRow[];
  industry: string | null;
  onImport: (data: {
    rows: Record<string, string>[];
    mapping: ColumnMapping;
    companyId: string;
  }) => Promise<{ success: boolean; imported: number; failed: number; errors: string[]; periodsCreated?: number }>;
  className?: string;
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEPS: { key: WizardStep; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "preview", label: "Preview" },
  { key: "mapping", label: "Mapping" },
  { key: "review", label: "Review" },
  { key: "import", label: "Import" },
];

function StepIndicator({ current }: { current: WizardStep }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center gap-0 mb-6">
      {STEPS.map((step, idx) => (
        <React.Fragment key={step.key}>
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                "flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold border-2 transition-colors",
                idx < currentIdx
                  ? "bg-blue-600 border-blue-600 text-white"
                  : idx === currentIdx
                  ? "border-blue-600 text-blue-600 bg-white"
                  : "border-slate-300 text-slate-400 bg-white"
              )}
            >
              {idx < currentIdx ? <CheckCircle className="w-4 h-4" /> : idx + 1}
            </div>
            <span
              className={cn(
                "text-sm font-medium",
                idx === currentIdx ? "text-blue-600" : idx < currentIdx ? "text-slate-700" : "text-slate-400"
              )}
            >
              {step.label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <ChevronRight className="w-4 h-4 text-slate-300 mx-2" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drop Zone
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
          : "border-slate-300 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/40"
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      aria-label="Upload financial data file"
    >
      <div className="flex items-center justify-center w-14 h-14 rounded-full bg-blue-100">
        <Upload className="w-6 h-6 text-blue-600" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-slate-700">
          Drop your file here, or click to browse
        </p>
        <p className="text-xs text-muted-foreground">
          Supports .csv and .xlsx files up to 10MB
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
// Main wizard
// ---------------------------------------------------------------------------

export function DataImportWizard({
  companyId,
  accounts: _accounts,
  industry,
  onImport,
  className,
}: DataImportWizardProps) {
  const [step, setStep] = React.useState<WizardStep>("upload");
  const [importSource, setImportSource] = React.useState<ImportSource>("generic");
  const [isDragging, setIsDragging] = React.useState(false);
  const [parsedFile, setParsedFile] = React.useState<ParsedFile | null>(null);
  const [isParsing, setIsParsing] = React.useState(false);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [columnMapping, setColumnMapping] = React.useState<ColumnMapping>({});
  const [validationErrors, setValidationErrors] = React.useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = React.useState<string[]>([]);
  const [organizedData, setOrganizedData] = React.useState<OrganizedStatement | null>(null);
  const [approvedItems, setApprovedItems] = React.useState<ReviewLineItem[] | null>(null);
  const [activeSheetTab, setActiveSheetTab] = React.useState<string>("__all__");
  const [importState, setImportState] = React.useState<{
    running: boolean;
    progress: number;
    result: { success: boolean; imported: number; failed: number; errors: string[]; periodsCreated?: number } | null;
  }>({ running: false, progress: 0, result: null });

  // ---------------------------------------------------------------------------
  // File handling
  // ---------------------------------------------------------------------------

  const handleFile = React.useCallback(async (file: File) => {
    setParseError(null);
    setIsParsing(true);
    setParsedFile(null);

    try {
      let parsed: ParsedFile;

      if (importSource === "quickbooks") {
        // QuickBooks report parser — transforms hierarchical report into flat rows
        const result = await parseQuickBooksReport(file);
        parsed = { name: file.name, ...result };
      } else if (importSource === "xero") {
        // Xero report parser — transforms hierarchical report into flat rows
        const result = await parseXeroReport(file);
        parsed = { name: file.name, ...result };
      } else if (file.name.endsWith(".csv")) {
        const result = await parseCSV(file);
        parsed = { name: file.name, ...result };
      } else {
        const result = await parseXLSX(file);
        parsed = { name: file.name, headers: result.headers, rows: result.rows, rowCount: result.rowCount, errors: result.errors, sheets: result.sheets };
      }

      if (parsed.errors.length > 0 && parsed.rowCount === 0) {
        setParseError(parsed.errors.join("\n"));
        setIsParsing(false);
        return;
      }

      setParsedFile(parsed);

      // Auto-detect column mappings
      const detected = detectColumns(parsed.headers, parsed.rows.slice(0, 10));
      const autoMapping: ColumnMapping = {};
      for (const col of detected) {
        if (col.suggestedField && col.confidence >= 0.7) {
          autoMapping[col.originalName] = col.suggestedField;
        }
      }

      // For QBO/Xero, columns are already standardised — pre-fill all mappings
      if (importSource === "quickbooks" || importSource === "xero") {
        for (const header of parsed.headers) {
          if (!autoMapping[header]) {
            // Direct match: header names match app field names exactly
            const directMatch = APP_FIELDS.find((f) => f.value === header);
            if (directMatch) {
              autoMapping[header] = directMatch.value;
            }
          }
        }
      }

      setColumnMapping(autoMapping);
      setStep("preview");
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to parse file.");
    } finally {
      setIsParsing(false);
    }
  }, [importSource]);

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

  // ---------------------------------------------------------------------------
  // Step transitions
  // ---------------------------------------------------------------------------

  const goToMapping = () => {
    setStep("mapping");
  };

  const goToReview = () => {
    if (!parsedFile) return;
    const validation = validateData(parsedFile.rows, columnMapping);
    setValidationErrors(validation.errors);
    setValidationWarnings(validation.warnings);
    if (validation.isValid) {
      // Organize data into template sections for review
      const organized = organizeIntoTemplate({
        rows: parsedFile.rows,
        mapping: columnMapping,
        industry,
      });
      setOrganizedData(organized);
      setStep("review");
    }
  };

  const handleReviewApprove = (items: ReviewLineItem[]) => {
    setApprovedItems(items);

    // Update rows with user-approved categories before import
    if (parsedFile) {
      const reverseMap: Record<string, string> = {};
      for (const [header, field] of Object.entries(columnMapping)) {
        if (field) reverseMap[field] = header;
      }

      const accountTypeHeader = reverseMap["account_type"];
      const accountNameHeader = reverseMap["account_name"];
      const accountCodeHeader = reverseMap["account_code"];

      // Build a lookup from account key → DB-compatible category
      const categoryLookup = new Map<string, string>();
      for (const item of items) {
        categoryLookup.set(item.key, TEMPLATE_TO_DB_CATEGORY[item.category] || item.category);
      }

      // Create a set of approved row indices
      const approvedRowIndices = new Set<number>();
      for (const item of items) {
        for (const idx of item.rowIndices) {
          approvedRowIndices.add(idx);
        }
      }

      // Filter rows to only approved items, and update categories
      const updatedRows = parsedFile.rows.filter((_, i) => approvedRowIndices.has(i));

      // If there's an account_type header, update category values
      if (accountTypeHeader) {
        for (const row of updatedRows) {
          const name = (accountNameHeader ? row[accountNameHeader] : "").trim();
          const code = (accountCodeHeader ? row[accountCodeHeader] : "").trim();
          const key = (name || code).toLowerCase().replace(/\s+/g, " ");
          const approvedCategory = categoryLookup.get(key);
          if (approvedCategory) {
            row[accountTypeHeader] = approvedCategory;
          }
        }
      } else {
        // No account_type column — add one via a virtual header
        const newHeader = "__approved_category__";
        for (const row of updatedRows) {
          const name = (accountNameHeader ? row[accountNameHeader] : "").trim();
          const code = (accountCodeHeader ? row[accountCodeHeader] : "").trim();
          const key = (name || code).toLowerCase().replace(/\s+/g, " ");
          row[newHeader] = categoryLookup.get(key) || "";
        }
        // Add the virtual header to the mapping
        setColumnMapping((prev) => ({ ...prev, [newHeader]: "account_type" }));
      }

      setParsedFile({ ...parsedFile, rows: updatedRows, rowCount: updatedRows.length });
    }

    setStep("import");
  };

  const runImport = async () => {
    if (!parsedFile) return;
    setImportState({ running: true, progress: 0, result: null });

    // Simulate progress ticks while the actual import runs
    const interval = setInterval(() => {
      setImportState((prev) => ({
        ...prev,
        progress: Math.min(prev.progress + 10, 85),
      }));
    }, 300);

    try {
      const result = await onImport({
        rows: parsedFile.rows,
        mapping: columnMapping,
        companyId,
      });
      clearInterval(interval);
      setImportState({ running: false, progress: 100, result });
    } catch (err) {
      clearInterval(interval);
      setImportState({
        running: false,
        progress: 0,
        result: {
          success: false,
          imported: 0,
          failed: parsedFile.rowCount,
          errors: [err instanceof Error ? err.message : "Unknown error"],
        },
      });
    }
  };

  const reset = () => {
    setStep("upload");
    setParsedFile(null);
    setColumnMapping({});
    setValidationErrors([]);
    setValidationWarnings([]);
    setOrganizedData(null);
    setApprovedItems(null);
    setImportState({ running: false, progress: 0, result: null });
    setParseError(null);
    setImportSource("generic");
    setActiveSheetTab("__all__");
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className={cn("space-y-6", className)}>
      <StepIndicator current={step} />

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="space-y-4">
          {/* Source selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Import Source</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {IMPORT_SOURCES.map((source) => (
                <button
                  key={source.value}
                  type="button"
                  onClick={() => setImportSource(source.value)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg border-2 p-3 text-left transition-colors",
                    importSource === source.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  )}
                >
                  <span className={cn(
                    "text-sm font-semibold",
                    importSource === source.value ? "text-blue-700" : "text-slate-700"
                  )}>
                    {source.label}
                  </span>
                  <span className="text-xs text-muted-foreground leading-snug">
                    {source.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <FileDropZone
            onFile={handleFile}
            isDragging={isDragging}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          />

          {importSource !== "generic" && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
              <p className="font-medium">
                {importSource === "quickbooks" ? "QuickBooks" : "Xero"} report import
              </p>
              <p className="mt-1 text-blue-600">
                Export a P&L or Balance Sheet report from {importSource === "quickbooks" ? "QuickBooks Online" : "Xero"} as
                CSV, then upload it here. Account categories will be detected automatically from the report structure.
              </p>
            </div>
          )}

          {isParsing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Parsing {importSource === "generic" ? "file" : `${importSource === "quickbooks" ? "QuickBooks" : "Xero"} report`}...
            </div>
          )}
          {parseError && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <pre className="whitespace-pre-wrap font-sans">{parseError}</pre>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Preview */}
      {step === "preview" && parsedFile && (() => {
        const sheets = parsedFile.sheets ?? [];
        const hasMultipleSheets = sheets.length > 1;

        // Determine which data to show based on active tab
        let displayHeaders: string[];
        let displayRows: Record<string, string>[];
        let displayRowCount: number;

        if (!hasMultipleSheets || activeSheetTab === "__all__") {
          displayHeaders = parsedFile.headers;
          displayRows = parsedFile.rows;
          displayRowCount = parsedFile.rowCount;
        } else {
          const sheet = sheets.find((s) => s.name === activeSheetTab);
          displayHeaders = sheet?.headers ?? parsedFile.headers;
          displayRows = sheet?.rows ?? parsedFile.rows;
          displayRowCount = sheet?.rowCount ?? parsedFile.rowCount;
        }

        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-md border bg-slate-50 px-3 py-1.5">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium">{parsedFile.name}</span>
                <Badge variant="secondary">{parsedFile.rowCount.toLocaleString()} rows</Badge>
                {hasMultipleSheets && (
                  <Badge variant="outline">{sheets.length} sheets</Badge>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={reset}
                className="ml-auto"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Remove
              </Button>
            </div>

            {parsedFile.errors.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 space-y-1">
                <p className="font-medium">Parse warnings:</p>
                {parsedFile.errors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}

            {/* Sheet tabs */}
            {hasMultipleSheets && (
              <div className="flex items-center gap-1 border-b">
                <button
                  type="button"
                  onClick={() => setActiveSheetTab("__all__")}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                    activeSheetTab === "__all__"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-slate-300"
                  )}
                >
                  All Sheets
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    ({parsedFile.rowCount.toLocaleString()})
                  </span>
                </button>
                {sheets.map((sheet) => (
                  <button
                    key={sheet.name}
                    type="button"
                    onClick={() => setActiveSheetTab(sheet.name)}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                      activeSheetTab === sheet.name
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-slate-300"
                    )}
                  >
                    {sheet.name}
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      ({sheet.rowCount.toLocaleString()})
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-xs font-medium text-muted-foreground w-10">#</TableHead>
                    {hasMultipleSheets && activeSheetTab === "__all__" && (
                      <TableHead className="text-xs font-medium text-blue-600">Sheet</TableHead>
                    )}
                    {displayHeaders.map((h) => (
                      <TableHead key={h} className="text-xs font-medium">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayRows.slice(0, 50).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      {hasMultipleSheets && activeSheetTab === "__all__" && (
                        <TableCell className="text-xs font-medium text-blue-600 whitespace-nowrap">
                          {row["__sheet__"] || "—"}
                        </TableCell>
                      )}
                      {displayHeaders.map((h) => (
                        <TableCell key={h} className="text-sm max-w-[140px] truncate">
                          {row[h] || (
                            <span className="text-muted-foreground/50 text-xs italic">empty</span>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {displayRowCount > 50 && (
                    <TableRow>
                      <TableCell
                        colSpan={displayHeaders.length + (hasMultipleSheets && activeSheetTab === "__all__" ? 2 : 1)}
                        className="text-center text-xs text-muted-foreground py-3"
                      >
                        ... and {(displayRowCount - 50).toLocaleString()} more rows
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={reset}>
                Back
              </Button>
              <Button onClick={goToMapping}>
                Continue to Mapping
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        );
      })()}

      {/* Step 3: Account Mapping */}
      {step === "mapping" && parsedFile && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Map each column in your file to the corresponding field in ShardCFO.
            Auto-detected mappings are pre-filled.
          </p>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs uppercase tracking-wider">Your Column</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Sample Values</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Maps To</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedFile.headers.map((header) => {
                  const samples = parsedFile.rows
                    .slice(0, 3)
                    .map((r) => r[header])
                    .filter(Boolean)
                    .join(", ");
                  const currentMapping = columnMapping[header] ?? "";

                  return (
                    <TableRow key={header}>
                      <TableCell className="font-medium text-sm">{header}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {samples || <span className="italic text-xs">no data</span>}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={currentMapping}
                          onValueChange={(val: string | null) =>
                            setColumnMapping((prev) => ({ ...prev, [header]: val ?? "" }))
                          }
                        >
                          <SelectTrigger className="w-[180px] h-8 text-sm">
                            <SelectValue placeholder="— Ignore —" />
                          </SelectTrigger>
                          <SelectContent>
                            {APP_FIELDS.map((f) => (
                              <SelectItem key={f.value} value={f.value}>
                                {f.label}
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

          {validationErrors.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 space-y-1">
              <p className="text-sm font-medium text-red-700">Please fix these issues:</p>
              {validationErrors.map((e, i) => (
                <p key={i} className="text-sm text-red-600">{e}</p>
              ))}
            </div>
          )}
          {validationWarnings.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-1">
              {validationWarnings.map((w, i) => (
                <p key={i} className="text-sm text-amber-700">{w}</p>
              ))}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep("preview")}>
              Back
            </Button>
            <Button onClick={goToReview}>
              Validate &amp; Review
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Template Review */}
      {step === "review" && organizedData && (
        <ImportTemplateReview
          organized={organizedData}
          onApprove={handleReviewApprove}
          onBack={() => setStep("mapping")}
        />
      )}

      {/* Step 5: Import Execution */}
      {step === "import" && parsedFile && (
        <div className="space-y-6">
          <div className="rounded-md border bg-slate-50 p-4 space-y-2">
            <p className="text-sm font-medium">Ready to import</p>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <span><strong className="text-foreground">{parsedFile.rowCount.toLocaleString()}</strong> rows</span>
              <span>
                <strong className="text-foreground">
                  {Object.values(columnMapping).filter(Boolean).length}
                </strong>{" "}
                columns mapped
              </span>
              <span className="font-medium text-foreground">{parsedFile.name}</span>
            </div>
          </div>

          {/* Progress bar */}
          {(importState.running || importState.progress > 0) && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {importState.running ? "Importing..." : "Done"}
                </span>
                <span className="font-mono text-muted-foreground">
                  {importState.progress}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    importState.result?.success === false
                      ? "bg-red-500"
                      : "bg-blue-600"
                  )}
                  style={{ width: `${importState.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Result summary */}
          {importState.result && (
            <div
              className={cn(
                "rounded-md border p-4 space-y-2",
                importState.result.success
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50"
              )}
            >
              <div className="flex items-center gap-2">
                {importState.result.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                )}
                <p className="font-medium text-sm">
                  {importState.result.success ? "Import complete" : "Import failed"}
                </p>
              </div>
              <div className="flex flex-wrap gap-6 text-sm">
                <span className="text-green-700">
                  <strong>{importState.result.imported}</strong> rows imported
                </span>
                {importState.result.failed > 0 && (
                  <span className="text-red-700">
                    <strong>{importState.result.failed}</strong> rows failed
                  </span>
                )}
                {(importState.result.periodsCreated ?? 0) > 0 && (
                  <span className="text-blue-700">
                    <strong>{importState.result.periodsCreated}</strong> periods auto-created
                  </span>
                )}
              </div>
              {importState.result.errors.length > 0 && (
                <ul className="space-y-0.5 text-sm text-red-700">
                  {importState.result.errors.slice(0, 5).map((e, i) => (
                    <li key={i}>· {e}</li>
                  ))}
                  {importState.result.errors.length > 5 && (
                    <li className="text-muted-foreground">
                      ...and {importState.result.errors.length - 5} more
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-between pt-2">
            {!importState.result ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setStep("review")}
                  disabled={importState.running}
                >
                  Back
                </Button>
                <Button onClick={runImport} disabled={importState.running}>
                  {importState.running && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {importState.running ? "Importing..." : "Run Import"}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={reset}>
                Import another file
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
