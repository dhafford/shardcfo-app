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
  Loader2,
  AlertCircle,
  CheckCircle2,
  BarChart3,
  Users,
  TrendingUp,
  DollarSign,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import {
  parseCartaExcel,
  type CapTableSummary,
  type CapTableSummaryRow,
  type CapTableStakeholder,
} from "@/lib/import/carta-parser";

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtShares(n: number): string {
  if (n === 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function fmtCurrency(n: number): string {
  if (n === 0) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtPct(n: number): string {
  if (n === 0) return "0.00%";
  return `${(n * 100).toFixed(2)}%`;
}

// ─── Category helpers ─────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  common: "Common",
  preferred: "Preferred",
  warrant: "Warrant",
  convertible: "Convertible",
  option_pool: "Option Pool",
};

const CATEGORY_BADGE_VARIANTS: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  common: "default",
  preferred: "secondary",
  warrant: "outline",
  convertible: "outline",
  option_pool: "outline",
};

// ─── Dropzone ─────────────────────────────────────────────────────────────────

interface DropzoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

function Dropzone({ onFile, disabled }: DropzoneProps) {
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
    // reset so same file can be re-selected
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
        Accepts .xlsx or .xls exported from Carta
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

// ─── Summary stat card ────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
}) {
  return (
    <Card size="sm">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground leading-none">{label}</p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight truncate">
              {value}
            </p>
            {sub && (
              <p className="mt-0.5 text-xs text-muted-foreground truncate">{sub}</p>
            )}
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Share classes table ──────────────────────────────────────────────────────

function ShareClassTable({ classes }: { classes: CapTableSummaryRow[] }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="w-64">Share Class</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Authorized</TableHead>
            <TableHead className="text-right">Outstanding</TableHead>
            <TableHead className="text-right">Fully Diluted</TableHead>
            <TableHead className="text-right">FD Ownership</TableHead>
            <TableHead className="text-right">Cash Raised</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {classes.map((row) => (
            <TableRow key={row.classCode}>
              <TableCell>
                <div>
                  <span className="font-medium">{row.className}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant={CATEGORY_BADGE_VARIANTS[row.category]}
                  className="text-xs"
                >
                  {CATEGORY_LABELS[row.category] ?? row.category}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {fmtShares(row.sharesAuthorized)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {fmtShares(row.sharesOutstanding)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {fmtShares(row.fullyDilutedShares)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.fullyDilutedOwnership > 0
                  ? fmtPct(row.fullyDilutedOwnership)
                  : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {fmtCurrency(row.cashRaised)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Stakeholders table ───────────────────────────────────────────────────────

type SortKey = "name" | "totalFullyDiluted" | "ownershipPercent";
type SortDir = "asc" | "desc";

function StakeholderTable({
  stakeholders,
  maxRows,
}: {
  stakeholders: CapTableStakeholder[];
  maxRows?: number;
}) {
  const [sortKey, setSortKey] = React.useState<SortKey>("totalFullyDiluted");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = React.useMemo(() => {
    const copy = [...stakeholders];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sortKey === "totalFullyDiluted") {
        cmp = a.totalFullyDiluted - b.totalFullyDiluted;
      } else {
        cmp = a.ownershipPercent - b.ownershipPercent;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return maxRows ? copy.slice(0, maxRows) : copy;
  }, [stakeholders, sortKey, sortDir, maxRows]);

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return null;
    return sortDir === "asc" ? (
      <ChevronUp className="ml-1 h-3 w-3 inline-block" />
    ) : (
      <ChevronDown className="ml-1 h-3 w-3 inline-block" />
    );
  }

  function SortTh({
    col,
    children,
    className,
  }: {
    col: SortKey;
    children: React.ReactNode;
    className?: string;
  }) {
    return (
      <TableHead
        className={cn("cursor-pointer select-none hover:text-foreground", className)}
        onClick={() => handleSort(col)}
      >
        {children}
        <SortIcon col={col} />
      </TableHead>
    );
  }

  // Collect all class codes that appear in these stakeholders
  const allCodes = React.useMemo(() => {
    const codes = new Set<string>();
    for (const sh of stakeholders) {
      for (const code of Object.keys(sh.holdings)) codes.add(code);
    }
    return Array.from(codes).sort();
  }, [stakeholders]);

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <SortTh col="name" className="w-48">
              Stakeholder
            </SortTh>
            {allCodes.map((code) => (
              <TableHead key={code} className="text-right">
                {code}
              </TableHead>
            ))}
            <SortTh col="totalFullyDiluted" className="text-right">
              Total FD
            </SortTh>
            <SortTh col="ownershipPercent" className="text-right">
              Ownership
            </SortTh>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((sh) => (
            <TableRow key={sh.id}>
              <TableCell className="font-medium max-w-48 truncate">
                {sh.name}
              </TableCell>
              {allCodes.map((code) => (
                <TableCell key={code} className="text-right tabular-nums text-muted-foreground">
                  {sh.holdings[code] ? fmtShares(sh.holdings[code]) : "—"}
                </TableCell>
              ))}
              <TableCell className="text-right tabular-nums font-medium">
                {fmtShares(sh.totalFullyDiluted)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {fmtPct(sh.ownershipPercent)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Import tab content ───────────────────────────────────────────────────────

type ParseStatus =
  | { state: "idle" }
  | { state: "parsing" }
  | { state: "error"; message: string }
  | { state: "success"; data: CapTableSummary };

interface ImportTabProps {
  onImported: (data: CapTableSummary) => void;
  existingData: CapTableSummary | null;
}

function ImportTab({ onImported, existingData }: ImportTabProps) {
  const [status, setStatus] = React.useState<ParseStatus>({ state: "idle" });
  const [fileName, setFileName] = React.useState<string | null>(null);

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
      const data = await parseCartaExcel(buffer);
      setStatus({ state: "success", data });
    } catch (err) {
      setStatus({
        state: "error",
        message: err instanceof Error ? err.message : "Failed to parse file.",
      });
    }
  }

  function handleImport() {
    if (status.state === "success") {
      onImported(status.data);
    }
  }

  function handleReset() {
    setStatus({ state: "idle" });
    setFileName(null);
  }

  const preview = status.state === "success" ? status.data : null;

  return (
    <div className="space-y-6">
      {/* Instructions card */}
      <Card size="sm">
        <CardHeader>
          <CardTitle>Import Carta Cap Table</CardTitle>
          <CardDescription>
            Export a cap table from Carta as an Excel file (all 3 sheets:
            Summary, Intermediate, and Detailed), then upload it here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Dropzone
            onFile={handleFile}
            disabled={status.state === "parsing"}
          />

          {/* Status feedback */}
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

          {status.state === "success" && preview && (
            <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">
                  Parsed successfully — {fileName}
                </p>
                <p className="text-green-700">
                  {preview.companyName}
                  {preview.asOfDate && ` · as of ${preview.asOfDate}`} ·{" "}
                  {preview.classes.length} share classes ·{" "}
                  {preview.stakeholders.length} stakeholders
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview section */}
      {preview && (
        <>
          {/* Summary stats */}
          <div>
            <h3 className="text-sm font-semibold mb-3 text-slate-700">
              Preview
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <StatCard
                label="Company"
                value={preview.companyName || "Unknown"}
                sub={preview.asOfDate ? `As of ${preview.asOfDate}` : undefined}
                icon={BarChart3}
              />
              <StatCard
                label="Fully Diluted Shares"
                value={fmtShares(preview.totalFullyDilutedShares)}
                sub={`${preview.classes.length} share classes`}
                icon={TrendingUp}
              />
              <StatCard
                label="Total Cash Raised"
                value={fmtCurrency(preview.totalCashRaised)}
                icon={DollarSign}
              />
              <StatCard
                label="Stakeholders"
                value={String(preview.stakeholders.length)}
                sub={
                  preview.optionPool.planName
                    ? preview.optionPool.planName
                    : undefined
                }
                icon={Users}
              />
            </div>
          </div>

          {/* Share class table */}
          <div>
            <h3 className="text-sm font-semibold mb-2 text-slate-700">
              Share Classes
            </h3>
            <ShareClassTable classes={preview.classes} />
          </div>

          {/* Top stakeholders */}
          {preview.stakeholders.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 text-slate-700">
                Top Stakeholders
              </h3>
              <StakeholderTable
                stakeholders={preview.stakeholders}
                maxRows={10}
              />
            </div>
          )}

          {/* Import action */}
          <div className="flex items-center justify-between border-t pt-4 gap-3">
            <Button variant="outline" size="sm" onClick={handleReset}>
              Clear
            </Button>
            <Button size="sm" onClick={handleImport} className="gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              Save to Cap Table
            </Button>
          </div>
        </>
      )}

      {/* Existing data notice */}
      {existingData && status.state === "idle" && (
        <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm text-blue-700">
          A cap table is already loaded ({existingData.companyName}).
          Upload a new file above to replace it.
        </div>
      )}
    </div>
  );
}

// ─── Cap Table tab content ────────────────────────────────────────────────────

function CapTableTab({ data }: { data: CapTableSummary | null }) {
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 px-6 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <FileSpreadsheet className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-600">No cap table data yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Go to the Import Data tab to upload a Carta export.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">{data.companyName}</h2>
          <p className="text-sm text-muted-foreground">
            Cap table{data.asOfDate ? ` · as of ${data.asOfDate}` : ""}
            {data.generatedBy ? ` · via ${data.generatedBy}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.optionPool.planName && (
            <Badge variant="outline" className="text-xs">
              {data.optionPool.planName}
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs">
            {data.classes.length} classes
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {data.stakeholders.length} stakeholders
          </Badge>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Fully Diluted Shares"
          value={fmtShares(data.totalFullyDilutedShares)}
          icon={TrendingUp}
        />
        <StatCard
          label="Total Cash Raised"
          value={fmtCurrency(data.totalCashRaised)}
          icon={DollarSign}
        />
        <StatCard
          label="Option Pool Outstanding"
          value={fmtShares(data.optionPool.outstanding)}
          sub={
            data.optionPool.available > 0
              ? `${fmtShares(data.optionPool.available)} available`
              : undefined
          }
          icon={BarChart3}
        />
        <StatCard
          label="SAFE / Convertible"
          value={fmtCurrency(data.safes.totalAmount)}
          icon={DollarSign}
        />
      </div>

      {/* Share classes */}
      <div>
        <h3 className="text-sm font-semibold mb-2 text-slate-700">
          Share Class Breakdown
        </h3>
        <ShareClassTable classes={data.classes} />
      </div>

      {/* Stakeholders */}
      {data.stakeholders.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2 text-slate-700">
            Stakeholder Table
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              (click column headers to sort)
            </span>
          </h3>
          <StakeholderTable stakeholders={data.stakeholders} />
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DtcAppPage() {
  const [capTable, setCapTable] = React.useState<CapTableSummary | null>(null);
  const [activeTab, setActiveTab] = React.useState("overview");

  function handleImported(data: CapTableSummary) {
    setCapTable(data);
    setActiveTab("cap-table");
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Page heading */}
        <div>
          <h1 className="text-xl font-semibold">DTC App</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Deal terms calculator and cap table analysis
          </p>
        </div>

        {/* Tabbed layout */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="import">Import Data</TabsTrigger>
            <TabsTrigger value="cap-table">
              Cap Table
              {capTable && (
                <Badge
                  variant="secondary"
                  className="ml-1.5 text-[10px] px-1.5 py-0"
                >
                  {capTable.classes.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="waterfall">Waterfall</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setActiveTab("import")}
              >
                <CardHeader>
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                    <Upload className="h-4 w-4" />
                  </div>
                  <CardTitle className="mt-2">Import Data</CardTitle>
                  <CardDescription>
                    Upload a Carta-exported Excel cap table to analyze deal
                    terms, ownership, and dilution.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {capTable ? (
                    <Badge variant="default" className="text-xs">
                      {capTable.companyName} loaded
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      No data yet
                    </Badge>
                  )}
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setActiveTab("cap-table")}
              >
                <CardHeader>
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                    <BarChart3 className="h-4 w-4" />
                  </div>
                  <CardTitle className="mt-2">Cap Table</CardTitle>
                  <CardDescription>
                    View share class breakdown, stakeholder ownership, and
                    fully-diluted share counts.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {capTable ? (
                    <Badge variant="secondary" className="text-xs">
                      {capTable.stakeholders.length} stakeholders ·{" "}
                      {fmtShares(capTable.totalFullyDilutedShares)} FD
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      Import data first
                    </Badge>
                  )}
                </CardContent>
              </Card>

              <Card className="opacity-60">
                <CardHeader>
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <CardTitle className="mt-2">Waterfall</CardTitle>
                  <CardDescription>
                    Model exit proceeds distribution across liquidation
                    preferences and participation rights.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline" className="text-xs">
                    Coming soon
                  </Badge>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Import Data */}
          <TabsContent value="import" className="mt-4">
            <ImportTab onImported={handleImported} existingData={capTable} />
          </TabsContent>

          {/* Cap Table */}
          <TabsContent value="cap-table" className="mt-4">
            <CapTableTab data={capTable} />
          </TabsContent>

          {/* Waterfall */}
          <TabsContent value="waterfall" className="mt-4">
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 px-6 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <TrendingUp className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-600">
                Waterfall analysis coming soon
              </p>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                Model how exit proceeds are distributed across liquidation
                preferences, participation rights, and conversion scenarios.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
