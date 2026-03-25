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
  History,
  Settings,
  FileText,
  Loader2,
} from "lucide-react";
import { validate, type ValidationReport } from "@/lib/forge/validator";

// ─── Types ────────────────────────────────────────────────────────────────────

type ValidateStatus =
  | { state: "idle" }
  | { state: "running" }
  | { state: "error"; message: string }
  | { state: "done"; report: ValidationReport };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derive a display-friendly category label from a check_id prefix. */
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

function severityLabel(severity: string): string {
  if (severity === "critical") return "CRITICAL";
  if (severity === "error") return "ERROR";
  if (severity === "warning") return "WARNING";
  return severity.toUpperCase();
}

// ─── Severity badge ───────────────────────────────────────────────────────────

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

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 90
      ? "bg-green-500"
      : pct >= 70
        ? "bg-yellow-500"
        : "bg-red-500";
  return (
    <div className="relative h-2 w-full rounded-full bg-slate-100 overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── Collapsible results group ────────────────────────────────────────────────

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

// ─── Validate tab ─────────────────────────────────────────────────────────────

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
      if (typeof text === "string") {
        setModelJson(text);
      }
    };
    reader.readAsText(file);
  }

  function handleRunValidation() {
    if (!modelJson.trim()) {
      setStatus({ state: "error", message: "Paste or upload a model JSON first." });
      return;
    }

    setStatus({ state: "running" });

    // Small timeout so the UI updates to "running" before the synchronous work.
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

  // Group results by category for the expandable table
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

  // Categories that have failures come first
  const sortedCategories = React.useMemo(() => {
    return Object.keys(grouped).sort((a, b) => {
      const aFails = grouped[a].filter((r) => !r.passed).length;
      const bFails = grouped[b].filter((r) => !r.passed).length;
      if (aFails !== bFails) return bFails - aFails;
      return a.localeCompare(b);
    });
  }, [grouped]);

  const scorePct =
    report && report.total > 0 ? Math.round((report.passed / report.total) * 100) : 0;
  const weightedPct =
    report ? Math.round(report.weighted_score * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Input area */}
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
              placeholder="Paste raw financial input text here (e.g. the user prompt that included historical figures)..."
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

          {/* Error state */}
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

      {/* Results panel — only shown after validation */}
      {report && (
        <div className="space-y-4">
          {/* Score summary */}
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
              {/* Score display */}
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
                <ScoreBar score={report.passed / report.total} />
                <p className="text-xs text-muted-foreground">
                  {scorePct}% unweighted &middot; {weightedPct}% weighted (critical
                  checks count 10×, errors 3×)
                </p>
              </div>

              {/* Stat cards */}
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

          {/* Results table grouped by category */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-700">Check Details</h3>
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

  const wordCount = promptText.trim()
    ? promptText.trim().split(/\s+/).length
    : 0;
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
                Load or paste a prompt to inspect it. Use the buttons below to load
                the seed prompt or the current best prompt from a run.
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
          {/* Action buttons */}
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

          {/* Prompt display — editable paste area acting as a code view */}
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
            Configure parameters for the prompt optimization run. Launch the engine
            via CLI — the UI run button is coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Parameter grid */}
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
                    <Button size="sm" disabled className="gap-1.5 cursor-not-allowed pointer-events-none">
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

// ─── History tab ──────────────────────────────────────────────────────────────

function HistoryTab() {
  const runsPath = "~/Desktop/Projects/promptforge/runs/";

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 px-6 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <History className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-600">No run history yet</p>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm">
          Run history will appear here after running the forge engine via CLI.
          Start a run using the Configure tab, then check back.
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-lg border bg-slate-50 px-3 py-2">
          <code className="text-xs font-mono text-muted-foreground">
            {runsPath}
          </code>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ForgePage() {
  const [activeTab, setActiveTab] = React.useState("validate");

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Page heading */}
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Forge — Prompt Optimizer</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Optimize prompts for three-statement financial model generation.
              Validate model outputs, refine prompts, and track optimization runs.
            </p>
          </div>
        </div>

        {/* Tabbed layout */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
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
            <TabsTrigger value="history" className="gap-1.5">
              <History className="h-3.5 w-3.5" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="validate" className="mt-4">
            <ValidateTab />
          </TabsContent>

          <TabsContent value="prompt" className="mt-4">
            <PromptTab />
          </TabsContent>

          <TabsContent value="configure" className="mt-4">
            <ConfigureTab />
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <HistoryTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
