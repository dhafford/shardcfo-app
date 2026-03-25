"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Zap,
  Upload,
  Play,
  Copy,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileJson,
  Settings,
  FileText,
  Loader2,
  FileSpreadsheet,
  Download,
  BarChart3,
  RotateCcw,
} from "lucide-react";
import { validate, type ValidationReport } from "@/lib/forge/validator";
import { parseXLSX } from "@/lib/import/xlsx-parser";
import { ingestFinancials, type IngestResult } from "@/lib/forge/ingest";
import {
  classifyBusiness,
  type ClassificationResult,
} from "@/lib/forge/builds";
import type { FinancialModel } from "@/lib/forge/types";

// ─── Pipeline state machine ───────────────────────────────────────────────────

type PipelineState =
  | { step: "upload" }
  | {
      step: "ingested";
      result: IngestResult;
      classification: ClassificationResult;
      fileName: string;
    }
  | { step: "generating"; result: IngestResult; classification: ClassificationResult; fileName: string }
  | {
      step: "complete";
      model: FinancialModel;
      rawValidation: ValidationReport;
      cleanValidation: ValidationReport;
      classification: ClassificationResult;
      result: IngestResult;
      fileName: string;
    }
  | { step: "error"; message: string };

// ─── Validate tab types ───────────────────────────────────────────────────────

type ValidateStatus =
  | { state: "idle" }
  | { state: "running" }
  | { state: "error"; message: string }
  | { state: "done"; report: ValidationReport };

// ─── Shared helpers ───────────────────────────────────────────────────────────

function categoryFromCheckId(checkId: string): string {
  const prefix = checkId.split("-").slice(0, 2).join("-");
  const MAP: Record<string, string> = {
    "DIAG-BS": "Balance Sheet",
    "DIAG-CFS": "Cash Flow Statement",
    "DIAG-RE": "Retained Earnings",
    "DIAG-WC": "Working Capital",
    "DIAG-IS": "Income Statement",
    "LINK-BS": "BS Links",
    "LINK-CFS": "CFS Links",
    "LINK-IS": "IS Links",
    "SANITY-IS": "IS Sanity",
    "SANITY-BS": "BS Sanity",
    "SANITY-CFS": "CFS Sanity",
    "HIST-IS": "Historical IS",
    "HIST-BS": "Historical BS",
    "HIST-CFS": "Historical CFS",
  };
  return MAP[prefix] ?? prefix;
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function SeverityBadge({ severity, passed }: { severity: string; passed: boolean }) {
  if (passed) {
    return (
      <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
        PASS
      </Badge>
    );
  }
  if (severity === "critical") {
    return (
      <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-800 border-red-200 hover:bg-red-100">
        CRITICAL
      </Badge>
    );
  }
  if (severity === "error") {
    return (
      <Badge className="text-[10px] px-1.5 py-0 bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100">
        ERROR
      </Badge>
    );
  }
  return (
    <Badge className="text-[10px] px-1.5 py-0 bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100">
      WARNING
    </Badge>
  );
}

function ScoreBar({ score, label }: { score: number; label: string }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 90 ? "bg-green-500" : pct >= 70 ? "bg-yellow-500" : "bg-red-500";
  const textColor =
    pct >= 90 ? "text-green-700" : pct >= 70 ? "text-yellow-700" : "text-red-700";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-600">{label}</p>
        <span className={cn("text-sm font-semibold tabular-nums", textColor)}>
          {pct}%
        </span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

interface CheckResultItem {
  check_id: string;
  passed: boolean;
  severity: string;
  message: string;
  period?: string;
  expected?: number;
  actual?: number;
}

function ResultsGroup({
  category,
  results,
  defaultOpen,
}: {
  category: string;
  results: CheckResultItem[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const passCount = results.filter((r) => r.passed).length;
  const failCount = results.length - passCount;

  return (
    <div className="rounded-lg border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between bg-slate-50 px-4 py-2.5 text-sm font-medium hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          )}
          <span>{category}</span>
          <span className="text-xs text-muted-foreground font-normal">
            {results.length} checks
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {passCount > 0 && (
            <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
              {passCount} pass
            </Badge>
          )}
          {failCount > 0 && (
            <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-800 border-red-200 hover:bg-red-100">
              {failCount} fail
            </Badge>
          )}
        </div>
      </button>

      {open && (
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50">
              <TableHead className="w-20">Status</TableHead>
              <TableHead className="w-36">Check ID</TableHead>
              <TableHead className="w-24">Period</TableHead>
              <TableHead>Message</TableHead>
              <TableHead className="text-right w-24">Expected</TableHead>
              <TableHead className="text-right w-24">Actual</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((r, i) => (
              <TableRow
                key={i}
                className={cn(
                  !r.passed && r.severity === "critical" && "bg-red-50/40",
                  !r.passed && r.severity === "error" && "bg-orange-50/40",
                  !r.passed && r.severity === "warning" && "bg-yellow-50/20"
                )}
              >
                <TableCell>
                  <SeverityBadge severity={r.severity} passed={r.passed} />
                </TableCell>
                <TableCell className="font-mono text-xs text-slate-600">
                  {r.check_id}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground tabular-nums">
                  {r.period ?? "—"}
                </TableCell>
                <TableCell className="text-xs">{r.message}</TableCell>
                <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                  {r.expected !== null && r.expected !== undefined
                    ? r.expected.toFixed(2)
                    : "—"}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                  {r.actual !== null && r.actual !== undefined
                    ? r.actual.toFixed(2)
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ─── Dropzone ─────────────────────────────────────────────────────────────────

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
        Drop your financial data here, or{" "}
        <span className="text-blue-600">browse</span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Accepts .xlsx, .xls, or .csv exported from QuickBooks, Xero, or any
        accounting system
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}

// ─── Ingest stat card ─────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "green" | "blue" | "slate";
}) {
  const bg =
    accent === "green"
      ? "bg-green-50/60 border-green-100"
      : accent === "blue"
        ? "bg-blue-50/60 border-blue-100"
        : "bg-slate-50/60 border-slate-100";
  const textColor =
    accent === "green"
      ? "text-green-700"
      : accent === "blue"
        ? "text-blue-700"
        : "text-slate-800";

  return (
    <div className={cn("rounded-lg border px-3 py-2.5", bg)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-lg font-semibold tabular-nums", textColor)}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepBadge({
  num,
  label,
  active,
  done,
}: {
  num: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          done
            ? "bg-green-500 text-white"
            : active
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-400"
        )}
      >
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : num}
      </div>
      <span
        className={cn(
          "text-sm font-medium",
          active ? "text-slate-900" : done ? "text-slate-600" : "text-slate-400"
        )}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Generate tab (main pipeline) ────────────────────────────────────────────

function GenerateTab() {
  const [pipeline, setPipeline] = React.useState<PipelineState>({
    step: "upload",
  });
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [rawJsonOpen, setRawJsonOpen] = React.useState(false);
  const [extraPrompt, setExtraPrompt] = React.useState("");

  // Derive step number for the step indicators
  const currentStep =
    pipeline.step === "upload"
      ? 1
      : pipeline.step === "ingested"
        ? 2
        : pipeline.step === "generating"
          ? 3
          : pipeline.step === "complete"
            ? 4
            : 1;

  async function handleFile(file: File) {
    try {
      const parsed = await parseXLSX(file);
      if (parsed.errors.length > 0) {
        setPipeline({ step: "error", message: parsed.errors.join(" ") });
        return;
      }
      const result = ingestFinancials(parsed.headers, parsed.rows, file.name);
      const classification = classifyBusiness(result.financialText);
      setPipeline({
        step: "ingested",
        result,
        classification,
        fileName: file.name,
      });
    } catch (err) {
      setPipeline({
        step: "error",
        message:
          err instanceof Error ? err.message : "Failed to parse the file.",
      });
    }
  }

  async function handleGenerate() {
    if (pipeline.step !== "ingested") return;
    const { result, classification, fileName } = pipeline;
    setPipeline({ step: "generating", result, classification, fileName });

    try {
      const res = await fetch("/api/forge/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          financialText: result.financialText,
          prompt: extraPrompt || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setPipeline({
          step: "error",
          message:
            (body as { error?: string }).error ??
            `API error ${res.status}: ${res.statusText}`,
        });
        return;
      }

      const body = (await res.json()) as {
        model: FinancialModel;
        raw_model?: FinancialModel;
        meta?: Record<string, unknown>;
      };

      const model = body.model;
      const rawModel = body.raw_model ?? model;

      const rawValidation = validate(rawModel, result.financialText);
      const cleanValidation = validate(model, result.financialText);

      setPipeline({
        step: "complete",
        model,
        rawValidation,
        cleanValidation,
        classification,
        result,
        fileName,
      });
    } catch (err) {
      setPipeline({
        step: "error",
        message:
          err instanceof Error ? err.message : "Failed to call generate API.",
      });
    }
  }

  function handleDownload() {
    if (pipeline.step !== "complete") return;
    const json = JSON.stringify(pipeline.model, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const name =
      pipeline.model.company_info?.name?.toLowerCase().replace(/\s+/g, "-") ??
      "model";
    a.download = `${name}-financial-model.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleReset() {
    setPipeline({ step: "upload" });
    setPreviewOpen(false);
    setRawJsonOpen(false);
    setExtraPrompt("");
  }

  // Grouped validation results for the complete state
  const validationGroups = React.useMemo(() => {
    if (pipeline.step !== "complete") return {};
    const out: Record<string, CheckResultItem[]> = {};
    for (const r of pipeline.cleanValidation.results) {
      const cat = categoryFromCheckId(r.check_id);
      if (!out[cat]) out[cat] = [];
      out[cat].push(r);
    }
    return out;
  }, [pipeline]);

  const sortedValidationCategories = React.useMemo(() => {
    return Object.keys(validationGroups).sort((a, b) => {
      const aFails = validationGroups[a].filter((r) => !r.passed).length;
      const bFails = validationGroups[b].filter((r) => !r.passed).length;
      if (aFails !== bFails) return bFails - aFails;
      return a.localeCompare(b);
    });
  }, [validationGroups]);

  const isUploaded =
    pipeline.step === "ingested" ||
    pipeline.step === "generating" ||
    pipeline.step === "complete";
  const isClassified = isUploaded;
  const isGenerated =
    pipeline.step === "generating" || pipeline.step === "complete";
  const isComplete = pipeline.step === "complete";

  return (
    <div className="space-y-5">
      {/* Step indicators */}
      <div className="flex items-center gap-4 flex-wrap">
        <StepBadge
          num={1}
          label="Upload"
          active={currentStep === 1}
          done={isUploaded}
        />
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
        <StepBadge
          num={2}
          label="Classify"
          active={currentStep === 2}
          done={isClassified && currentStep > 2}
        />
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
        <StepBadge
          num={3}
          label="Generate"
          active={currentStep === 3}
          done={isGenerated && currentStep > 3}
        />
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
        <StepBadge
          num={4}
          label="Validate & Export"
          active={currentStep === 4}
          done={false}
        />

        {pipeline.step !== "upload" && pipeline.step !== "error" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="ml-auto gap-1.5 text-muted-foreground hover:text-slate-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        )}
      </div>

      {/* Error banner */}
      {pipeline.step === "error" && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <p className="font-medium">Pipeline error</p>
            <p>{pipeline.message}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="shrink-0 text-red-700 hover:text-red-900 hover:bg-red-100 h-7"
          >
            Start over
          </Button>
        </div>
      )}

      {/* ── Step 1: Upload ── */}
      <Card size="sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  isUploaded
                    ? "bg-green-500 text-white"
                    : "bg-slate-900 text-white"
                )}
              >
                {isUploaded ? <CheckCircle2 className="h-3 w-3" /> : "1"}
              </div>
              <CardTitle>Upload Financial Data</CardTitle>
            </div>
            {isUploaded && "fileName" in pipeline && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span className="max-w-48 truncate">{pipeline.fileName}</span>
                </div>
              )}
          </div>
          <CardDescription>
            Upload your Excel or CSV export. The ingester will detect periods,
            line items, and statement sections automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pipeline.step === "upload" && (
            <Dropzone onFile={handleFile} />
          )}

          {isUploaded && "result" in pipeline && (
            <div className="space-y-3">
              {/* Ingest stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  label="Company"
                  value={pipeline.result.companyName}
                  accent="slate"
                />
                <StatCard
                  label="Periods"
                  value={pipeline.result.periods.length}
                  sub={pipeline.result.periods.slice(0, 2).join(", ")}
                  accent="blue"
                />
                <StatCard
                  label="Line Items"
                  value={pipeline.result.lineItemCount}
                  accent="slate"
                />
                <StatCard
                  label="Statements"
                  value={[
                    pipeline.result.hasIncomeStatement ? "IS" : null,
                    pipeline.result.hasBalanceSheet ? "BS" : null,
                    pipeline.result.hasCashFlow ? "CFS" : null,
                  ]
                    .filter(Boolean)
                    .join(" / ") || "None"}
                  accent={
                    pipeline.result.hasIncomeStatement &&
                    pipeline.result.hasBalanceSheet &&
                    pipeline.result.hasCashFlow
                      ? "green"
                      : "slate"
                  }
                />
              </div>

              {/* Warnings */}
              {pipeline.result.warnings.length > 0 && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 space-y-1">
                  <p className="text-xs font-medium text-yellow-800 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Ingest warnings
                  </p>
                  {pipeline.result.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-yellow-700">
                      {w}
                    </p>
                  ))}
                </div>
              )}

              {/* Financial text preview */}
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setPreviewOpen((o) => !o)}
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  {previewOpen ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  Financial Input Preview
                </button>
                {previewOpen && (
                  <Textarea
                    readOnly
                    value={pipeline.result.financialText}
                    className="font-mono text-xs min-h-52 resize-y bg-slate-50"
                  />
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Step 2: Classify (auto-runs after ingest) ── */}
      {isClassified && "classification" in pipeline && (
        <Card size="sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500 text-white text-[10px] font-bold">
                <CheckCircle2 className="h-3 w-3" />
              </div>
              <CardTitle>Business Classification</CardTitle>
            </div>
            <CardDescription>
              Automatically detected from financial keywords — determines the
              revenue build methodology used in generation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-start gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Business Type</p>
                <div className="flex items-center gap-2">
                  <p className="text-base font-semibold text-slate-800 capitalize">
                    {pipeline.classification.businessType.replace(/_/g, " ")}
                  </p>
                  <Badge
                    className={cn(
                      "text-[10px] px-1.5 py-0",
                      pipeline.classification.confidence >= 0.5
                        ? "bg-green-100 text-green-800 border-green-200 hover:bg-green-100"
                        : pipeline.classification.confidence >= 0.25
                          ? "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100"
                          : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    {Math.round(pipeline.classification.confidence * 100)}%
                    confidence
                  </Badge>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Revenue Methodology
                </p>
                <p className="text-base font-semibold text-slate-800">
                  {pipeline.classification.methodologyName}
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Key Drivers</p>
                <div className="flex flex-wrap gap-1.5">
                  {pipeline.classification.methodology.drivers
                    .slice(0, 6)
                    .map((d) => (
                      <Badge
                        key={d.key}
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 font-normal"
                      >
                        {d.label}
                      </Badge>
                    ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Generate ── */}
      {isClassified && (
        <Card size="sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  isComplete
                    ? "bg-green-500 text-white"
                    : isGenerated
                      ? "bg-blue-500 text-white"
                      : "bg-slate-900 text-white"
                )}
              >
                {isComplete ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : isGenerated ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "3"
                )}
              </div>
              <CardTitle>Generate Three-Statement Model</CardTitle>
            </div>
            <CardDescription>
              Sends the ingested financials to the AI model generator. The raw
              output is post-processed and validated automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Optional extra prompt — only show when not yet generating */}
            {pipeline.step === "ingested" && (
              <div className="space-y-1.5">
                <Label htmlFor="extra-prompt">
                  Additional Instructions{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <Textarea
                  id="extra-prompt"
                  value={extraPrompt}
                  onChange={(e) => setExtraPrompt(e.target.value)}
                  placeholder="E.g. 'Assume 30% revenue growth in Y1' or 'Focus on SaaS ARR waterfall methodology'..."
                  className="text-xs min-h-16 resize-y"
                />
              </div>
            )}

            {/* Generate button or loading state */}
            {pipeline.step === "ingested" && (
              <Button
                onClick={handleGenerate}
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                size="sm"
              >
                <Zap className="h-4 w-4" />
                Generate Model
              </Button>
            )}

            {pipeline.step === "generating" && (
              <div className="flex items-center gap-3 rounded-lg border bg-blue-50 px-4 py-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-800">
                    Generating three-statement model...
                  </p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    Running AI inference, post-processing, and validation
                  </p>
                </div>
              </div>
            )}

            {/* Results after completion */}
            {pipeline.step === "complete" && (
              <div className="space-y-4">
                {/* Score bars side by side */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border p-4 bg-slate-50/50">
                  <div className="flex items-start gap-2">
                    <BarChart3 className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div className="flex-1 space-y-3">
                      <ScoreBar
                        score={pipeline.rawValidation.weighted_score}
                        label="Raw Score (before post-processing)"
                      />
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <BarChart3 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <div className="flex-1 space-y-3">
                      <ScoreBar
                        score={pipeline.cleanValidation.weighted_score}
                        label="Clean Score (after post-processing)"
                      />
                    </div>
                  </div>
                </div>

                {/* Failure count stat cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border bg-red-50/50 px-3 py-2.5">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 text-red-500" />
                      Critical Failures
                    </p>
                    <p className="mt-1 text-xl font-semibold tabular-nums text-red-700">
                      {pipeline.cleanValidation.critical_failures.length}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-orange-50/50 px-3 py-2.5">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-orange-500" />
                      Error Failures
                    </p>
                    <p className="mt-1 text-xl font-semibold tabular-nums text-orange-700">
                      {pipeline.cleanValidation.error_failures.length}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-yellow-50/50 px-3 py-2.5">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-yellow-500" />
                      Warnings
                    </p>
                    <p className="mt-1 text-xl font-semibold tabular-nums text-yellow-700">
                      {pipeline.cleanValidation.warning_failures.length}
                    </p>
                  </div>
                </div>

                {/* Raw JSON expandable + download */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setRawJsonOpen((o) => !o)}
                      className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
                    >
                      {rawJsonOpen ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                      View Raw JSON
                    </button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownload}
                      className="gap-1.5"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download JSON
                    </Button>
                  </div>
                  {rawJsonOpen && (
                    <pre className="rounded-lg border bg-slate-900 text-slate-100 p-4 text-xs overflow-auto max-h-96 font-mono">
                      {JSON.stringify(pipeline.model, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Step 4: Validate (auto-runs after generate) ── */}
      {isComplete && pipeline.step === "complete" && (
        <Card size="sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500 text-white text-[10px] font-bold">
                  <CheckCircle2 className="h-3 w-3" />
                </div>
                <CardTitle>Validation Results</CardTitle>
              </div>
              <div className="flex items-center gap-1.5">
                {pipeline.cleanValidation.critical_failures.length === 0 &&
                  pipeline.cleanValidation.error_failures.length === 0 && (
                    <Badge className="text-xs bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Clean
                    </Badge>
                  )}
                {pipeline.cleanValidation.critical_failures.length > 0 && (
                  <Badge className="text-xs bg-red-100 text-red-800 border-red-200 hover:bg-red-100">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {pipeline.cleanValidation.critical_failures.length} critical
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground tabular-nums">
                  {pipeline.cleanValidation.passed}/
                  {pipeline.cleanValidation.total} checks passed
                </span>
              </div>
            </div>
            <CardDescription>
              All {pipeline.cleanValidation.total} diagnostic, link, and sanity
              checks run against the post-processed model.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sortedValidationCategories.map((cat) => (
                <ResultsGroup
                  key={cat}
                  category={cat}
                  results={validationGroups[cat]}
                  defaultOpen={validationGroups[cat].some((r) => !r.passed)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Validate tab (standalone) ────────────────────────────────────────────────

function ValidateTab() {
  const [modelJson, setModelJson] = React.useState("");
  const [financialInput, setFinancialInput] = React.useState("");
  const [status, setStatus] = React.useState<ValidateStatus>({ state: "idle" });
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result;
      if (typeof text === "string") setModelJson(text);
    };
    reader.readAsText(file);
  }

  function handleRunValidation() {
    if (!modelJson.trim()) {
      setStatus({ state: "error", message: "Paste or upload a model JSON first." });
      return;
    }
    setStatus({ state: "running" });
    setTimeout(() => {
      try {
        const parsed = JSON.parse(modelJson);
        const report = validate(parsed, financialInput || undefined);
        setStatus({ state: "done", report });
      } catch (err) {
        setStatus({
          state: "error",
          message:
            err instanceof Error
              ? err.message
              : "Failed to parse or validate model JSON.",
        });
      }
    }, 0);
  }

  const report = status.state === "done" ? status.report : null;

  const grouped = React.useMemo<Record<string, CheckResultItem[]>>(() => {
    if (!report) return {};
    const out: Record<string, CheckResultItem[]> = {};
    for (const r of report.results) {
      const cat = categoryFromCheckId(r.check_id);
      if (!out[cat]) out[cat] = [];
      out[cat].push(r);
    }
    return out;
  }, [report]);

  const sortedCategories = React.useMemo(() => {
    return Object.keys(grouped).sort((a, b) => {
      const aFails = grouped[a].filter((r) => !r.passed).length;
      const bFails = grouped[b].filter((r) => !r.passed).length;
      if (aFails !== bFails) return bFails - aFails;
      return a.localeCompare(b);
    });
  }, [grouped]);

  const scorePct =
    report && report.total > 0
      ? Math.round((report.passed / report.total) * 100)
      : 0;
  const weightedPct = report ? Math.round(report.weighted_score * 100) : 0;

  return (
    <div className="space-y-4">
      <Card size="sm">
        <CardHeader>
          <CardTitle>Validate Model JSON</CardTitle>
          <CardDescription>
            Paste the raw JSON output from a three-statement model generation, or
            upload a .json file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Model JSON</Label>
            <Textarea
              value={modelJson}
              onChange={(e) => setModelJson(e.target.value)}
              placeholder='Paste model JSON here... { "company_info": { ... }, "income_statement": { ... }, ... }'
              className="font-mono text-xs min-h-48 resize-y"
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              Financial Input{" "}
              <span className="text-muted-foreground font-normal">
                (optional — used for historical accuracy checks)
              </span>
            </Label>
            <Textarea
              value={financialInput}
              onChange={(e) => setFinancialInput(e.target.value)}
              placeholder="Paste raw financial input text here..."
              className="text-xs min-h-20 resize-y"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5"
            >
              <FileJson className="h-4 w-4" />
              Upload JSON
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />

            <Button
              size="sm"
              onClick={handleRunValidation}
              disabled={status.state === "running"}
              className="gap-1.5"
            >
              {status.state === "running" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Run Validation
            </Button>

            {(status.state === "done" || status.state === "error") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStatus({ state: "idle" })}
                className="text-muted-foreground"
              >
                Clear results
              </Button>
            )}
          </div>

          {status.state === "error" && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium">Validation error</p>
                <p>{status.message}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {report && (
        <div className="space-y-4">
          <Card size="sm">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle>Validation Results</CardTitle>
                <div className="flex items-center gap-1.5">
                  {report.critical_failures.length === 0 &&
                    report.error_failures.length === 0 && (
                      <Badge className="text-xs bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Clean
                      </Badge>
                    )}
                  {report.critical_failures.length > 0 && (
                    <Badge className="text-xs bg-red-100 text-red-800 border-red-200 hover:bg-red-100">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {report.critical_failures.length} critical
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <p className="text-2xl font-semibold tabular-nums">
                    {scorePct}
                    <span className="text-base font-normal text-muted-foreground">
                      /100
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {report.passed}/{report.total} checks &middot;{" "}
                    <span className="font-medium text-foreground">
                      Weighted: {weightedPct}%
                    </span>
                  </p>
                </div>
                <div className="relative h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      scorePct >= 90
                        ? "bg-green-500"
                        : scorePct >= 70
                          ? "bg-yellow-500"
                          : "bg-red-500"
                    )}
                    style={{ width: `${scorePct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {scorePct}% unweighted &middot; {weightedPct}% weighted
                  (critical checks count 10×, errors 3×)
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border bg-red-50/50 px-3 py-2.5">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 text-red-500" />
                    Critical Failures
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-red-700">
                    {report.critical_failures.length}
                  </p>
                </div>
                <div className="rounded-lg border bg-orange-50/50 px-3 py-2.5">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-orange-500" />
                    Error Failures
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-orange-700">
                    {report.error_failures.length}
                  </p>
                </div>
                <div className="rounded-lg border bg-yellow-50/50 px-3 py-2.5">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-yellow-500" />
                    Warnings
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-yellow-700">
                    {report.warning_failures.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-700">
              Check Details
            </h3>
            {sortedCategories.map((cat) => (
              <ResultsGroup
                key={cat}
                category={cat}
                results={grouped[cat]}
                defaultOpen={grouped[cat].some((r) => !r.passed)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Prompt tab ───────────────────────────────────────────────────────────────

function PromptTab() {
  const [promptText, setPromptText] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const wordCount = promptText.trim() ? promptText.trim().split(/\s+/).length : 0;
  const charCount = promptText.length;

  async function handleCopy() {
    if (!promptText) return;
    await navigator.clipboard.writeText(promptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleFileLoad(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result;
      if (typeof text === "string") setPromptText(text);
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-4">
      <Card size="sm">
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Prompt Viewer</CardTitle>
              <CardDescription>
                Load or paste a prompt to inspect it. Use the buttons below to
                load the seed prompt or the current best prompt from a run.
              </CardDescription>
            </div>
            {promptText && (
              <div className="text-xs text-muted-foreground tabular-nums text-right shrink-0">
                <span>{wordCount.toLocaleString()} words</span>
                <span className="mx-1.5 text-slate-300">&middot;</span>
                <span>{charCount.toLocaleString()} chars</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5"
            >
              <Upload className="h-4 w-4" />
              Load Seed Prompt
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5"
            >
              <FileText className="h-4 w-4" />
              Load Best Prompt
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.txt,.text"
              onChange={handleFileLoad}
              className="hidden"
            />
            <div className="ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                disabled={!promptText}
                className="gap-1.5"
              >
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? "Copied!" : "Copy to Clipboard"}
              </Button>
            </div>
          </div>

          <div className="relative">
            <Textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Paste a prompt here, or use the buttons above to load from a file..."
              className="font-mono text-xs min-h-96 resize-y bg-slate-50"
            />
            {!promptText && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-40">
                <FileText className="h-8 w-8 text-slate-400" />
                <p className="text-sm text-slate-500">No prompt loaded</p>
              </div>
            )}
          </div>

          {promptText && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-3">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
              <span>
                Prompt loaded &mdash; {wordCount.toLocaleString()} words,{" "}
                {charCount.toLocaleString()} characters
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Configure tab ────────────────────────────────────────────────────────────

function ConfigureTab() {
  const [maxRounds, setMaxRounds] = React.useState(20);
  const [targetScore, setTargetScore] = React.useState(1.0);
  const [staleRounds, setStaleRounds] = React.useState(5);
  const [budgetUsd, setBudgetUsd] = React.useState(200);
  const [scenarioMode, setScenarioMode] = React.useState(false);
  const [maxWorkers, setMaxWorkers] = React.useState(6);
  const [cliCopied, setCliCopied] = React.useState(false);

  const cliCommand = `promptforge engine --max-rounds ${maxRounds} --target-score ${targetScore} --budget ${budgetUsd}`;

  async function handleCliCopy() {
    await navigator.clipboard.writeText(cliCommand);
    setCliCopied(true);
    setTimeout(() => setCliCopied(false), 1500);
  }

  return (
    <div className="space-y-4">
      <Card size="sm">
        <CardHeader>
          <CardTitle>Forge Engine Configuration</CardTitle>
          <CardDescription>
            Configure parameters for the prompt optimization run. Launch the
            engine via CLI — the UI run button is coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="max-rounds">Max Rounds</Label>
              <Input
                id="max-rounds"
                type="number"
                min={1}
                max={100}
                value={maxRounds}
                onChange={(e) => setMaxRounds(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Maximum optimization iterations before stopping.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="target-score">Target Score (0–1)</Label>
              <Input
                id="target-score"
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={targetScore}
                onChange={(e) => setTargetScore(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Stop when weighted score reaches this threshold.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="stale-rounds">Stale Rounds</Label>
              <Input
                id="stale-rounds"
                type="number"
                min={1}
                max={20}
                value={staleRounds}
                onChange={(e) => setStaleRounds(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Stop early if score doesn&apos;t improve for this many rounds.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="budget-usd">Budget (USD)</Label>
              <Input
                id="budget-usd"
                type="number"
                min={1}
                max={1000}
                value={budgetUsd}
                onChange={(e) => setBudgetUsd(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Hard spend cap — engine stops when cumulative cost exceeds this.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="max-workers">Max Workers</Label>
              <Input
                id="max-workers"
                type="number"
                min={1}
                max={20}
                value={maxWorkers}
                onChange={(e) => setMaxWorkers(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Concurrent API calls per evaluation batch.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Scenario Mode</Label>
              <div className="flex items-center gap-3 h-8">
                <button
                  type="button"
                  role="switch"
                  aria-checked={scenarioMode}
                  onClick={() => setScenarioMode((v) => !v)}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    scenarioMode ? "bg-slate-900" : "bg-slate-200"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg transition-transform",
                      scenarioMode ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
                <span className="text-sm text-muted-foreground">
                  {scenarioMode ? "Enabled" : "Disabled"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Run scenario stress tests alongside base case validation.
              </p>
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <div>
              <p className="text-xs font-medium text-slate-700 mb-1.5">
                CLI Command
              </p>
              <div className="flex items-center gap-2 rounded-lg border bg-slate-50 px-3 py-2">
                <code className="flex-1 text-xs font-mono text-slate-700 break-all">
                  {cliCommand}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCliCopy}
                  className="shrink-0 h-7 px-2 gap-1"
                >
                  {cliCopied ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Button
                      size="sm"
                      disabled
                      className="gap-1.5 cursor-not-allowed pointer-events-none"
                    >
                      <Zap className="h-4 w-4" />
                      Start Forge Run
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Coming soon — run via CLI using the command above
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <p className="text-xs text-muted-foreground">
                UI-triggered runs are coming soon. Use the CLI command above.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ForgePage() {
  const [activeTab, setActiveTab] = React.useState("generate");

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Page heading */}
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">
              Forge — Three-Statement Model Pipeline
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Upload financials &rarr; Classify business &rarr; Generate model
              &rarr; Validate &amp; Export
            </p>
          </div>
        </div>

        {/* Tabbed layout */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="generate" className="gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              Generate
            </TabsTrigger>
            <TabsTrigger value="validate" className="gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Validate
            </TabsTrigger>
            <TabsTrigger value="prompt" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Prompt
            </TabsTrigger>
            <TabsTrigger value="configure" className="gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              Configure
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="mt-4">
            <GenerateTab />
          </TabsContent>

          <TabsContent value="validate" className="mt-4">
            <ValidateTab />
          </TabsContent>

          <TabsContent value="prompt" className="mt-4">
            <PromptTab />
          </TabsContent>

          <TabsContent value="configure" className="mt-4">
            <ConfigureTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
