"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronRight, ChevronLeft, Settings2, BarChart3, TrendingUp } from "lucide-react";
import { type HistoricalYear, type ProjectedYear, type ProjectionAssumptions } from "@/lib/projections/types";
import { getIndustryBenchmarks } from "@/lib/projections/benchmarks";
import { runProjection } from "@/lib/projections/engine";
import { AssumptionsPanel } from "@/components/projections/assumptions-panel";
import { StatementTable } from "@/components/projections/statement-table";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProjectionsClientProps {
  companyId: string;
  companyName: string;
  industry: string;
  historicals: HistoricalYear[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Wizard steps
// ---------------------------------------------------------------------------

type WizardStep = "review" | "assumptions" | "model";

const STEPS: { id: WizardStep; label: string; icon: React.ReactNode }[] = [
  { id: "review", label: "Review Historicals", icon: <BarChart3 className="w-4 h-4" /> },
  { id: "assumptions", label: "Set Assumptions", icon: <Settings2 className="w-4 h-4" /> },
  { id: "model", label: "3-Statement Model", icon: <TrendingUp className="w-4 h-4" /> },
];

// ---------------------------------------------------------------------------
// Currency formatter
// ---------------------------------------------------------------------------

const fmt = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD",
  minimumFractionDigits: 0, maximumFractionDigits: 0,
});

function formatAmount(n: number): string {
  if (Math.abs(n) < 0.5) return "$0";
  if (n < 0) return `(${fmt.format(Math.abs(n))})`;
  return fmt.format(n);
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ProjectionsClient({
  companyName,
  industry,
  historicals,
  error,
}: ProjectionsClientProps) {
  const [step, setStep] = React.useState<WizardStep>("review");

  // Initialize assumptions from industry benchmarks
  const benchmarks = getIndustryBenchmarks(industry);
  const [assumptions, setAssumptions] = React.useState<ProjectionAssumptions>(
    () => initAssumptions(benchmarks.assumptions, historicals)
  );

  // Run projection whenever assumptions change
  const projected = React.useMemo(
    () => runProjection(historicals, assumptions),
    [historicals, assumptions]
  );

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Error loading financial data: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{companyName} — 3-Statement Model</h2>
          <p className="text-sm text-muted-foreground">
            {historicals.length > 0
              ? `${historicals.length} year${historicals.length > 1 ? "s" : ""} of historicals → ${projected.length} years projected`
              : "No historical data found. Projections use benchmark assumptions only."}
          </p>
        </div>
        <Badge variant="outline" className="capitalize">
          {benchmarks.label}
        </Badge>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            {i > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            <button
              onClick={() => setStep(s.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                step === s.id
                  ? "bg-slate-900 text-white"
                  : i < stepIndex
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {s.icon}
              {s.label}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Review Historicals */}
      {step === "review" && (
        <div className="space-y-4">
          {historicals.length === 0 ? (
            <div className="rounded-lg border bg-amber-50/50 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No historical financial data found. Import data first, or proceed with benchmark assumptions.
              </p>
            </div>
          ) : (
            <HistoricalsTable historicals={historicals} />
          )}
          <div className="flex justify-end">
            <Button onClick={() => setStep("assumptions")}>
              Set Assumptions <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Assumptions */}
      {step === "assumptions" && (
        <div className="space-y-4">
          <AssumptionsPanel
            assumptions={assumptions}
            onChange={setAssumptions}
            historicals={historicals}
          />
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("review")}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <Button onClick={() => setStep("model")} className="bg-emerald-600 hover:bg-emerald-700">
              Generate Model <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Full Model */}
      {step === "model" && (
        <div className="space-y-4">
          <Tabs defaultValue="income_statement">
            <TabsList>
              <TabsTrigger value="income_statement">Income Statement</TabsTrigger>
              <TabsTrigger value="balance_sheet">Balance Sheet</TabsTrigger>
              <TabsTrigger value="cash_flow">Cash Flow</TabsTrigger>
              <TabsTrigger value="kpis">Key KPIs</TabsTrigger>
            </TabsList>
            <TabsContent value="income_statement">
              <StatementTable
                type="income_statement"
                historicals={historicals}
                projected={projected}
              />
            </TabsContent>
            <TabsContent value="balance_sheet">
              <StatementTable
                type="balance_sheet"
                historicals={historicals}
                projected={projected}
              />
            </TabsContent>
            <TabsContent value="cash_flow">
              <StatementTable
                type="cash_flow"
                historicals={historicals}
                projected={projected}
              />
            </TabsContent>
            <TabsContent value="kpis">
              <StatementTable
                type="kpis"
                historicals={historicals}
                projected={projected}
              />
            </TabsContent>
          </Tabs>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("assumptions")}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Edit Assumptions
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Historicals summary table
// ---------------------------------------------------------------------------

function HistoricalsTable({ historicals }: { historicals: HistoricalYear[] }) {
  const rows: { label: string; values: (string | null)[]; bold?: boolean; pct?: boolean }[] = [
    { label: "Revenue", values: historicals.map((h) => formatAmount(h.revenue)), bold: true },
    {
      label: "  YoY Growth",
      values: historicals.map((h, i) =>
        i === 0 ? null : formatPct((h.revenue - historicals[i - 1].revenue) / historicals[i - 1].revenue)
      ),
      pct: true,
    },
    { label: "Cost of Revenue", values: historicals.map((h) => formatAmount(h.cogs)) },
    { label: "Gross Profit", values: historicals.map((h) => formatAmount(h.grossProfit)), bold: true },
    {
      label: "  Gross Margin",
      values: historicals.map((h) => h.revenue > 0 ? formatPct(h.grossProfit / h.revenue) : "—"),
      pct: true,
    },
    { label: "R&D", values: historicals.map((h) => formatAmount(h.rdExpense)) },
    { label: "Sales & Marketing", values: historicals.map((h) => formatAmount(h.smExpense)) },
    { label: "G&A", values: historicals.map((h) => formatAmount(h.gaExpense)) },
    { label: "Total OpEx", values: historicals.map((h) => formatAmount(h.totalOpex)), bold: true },
    { label: "Operating Income", values: historicals.map((h) => formatAmount(h.operatingIncome)), bold: true },
    { label: "Net Income", values: historicals.map((h) => formatAmount(h.netIncome)), bold: true },
  ];

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b">
            <th className="text-left px-4 py-2 font-medium text-slate-600 min-w-[200px] sticky left-0 bg-slate-50">
              Historical Summary
            </th>
            {historicals.map((h) => (
              <th key={h.year} className="text-right px-4 py-2 font-medium text-slate-600 min-w-[100px]">
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className={cn("border-b last:border-b-0", row.bold && "bg-slate-50/60")}>
              <td className={cn("px-4 py-1.5 sticky left-0 bg-white", row.bold && "font-semibold bg-slate-50/60", row.pct && "text-muted-foreground text-xs")}>
                {row.label}
              </td>
              {row.values.map((v, i) => (
                <td
                  key={i}
                  className={cn(
                    "text-right px-4 py-1.5 tabular-nums",
                    row.bold && "font-semibold",
                    row.pct && "text-muted-foreground text-xs",
                    v && v.startsWith("(") && "text-red-600"
                  )}
                >
                  {v ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Initialize assumptions from benchmarks, aligned with historical revenue streams
// ---------------------------------------------------------------------------

function initAssumptions(
  benchmarkAssumptions: ProjectionAssumptions,
  historicals: HistoricalYear[],
): ProjectionAssumptions {
  if (historicals.length === 0) return benchmarkAssumptions;

  const lastYear = historicals[historicals.length - 1];
  const streamNames = Object.keys(lastYear.revenueByStream);

  if (streamNames.length === 0) return benchmarkAssumptions;

  // Map historical revenue stream names to benchmark growth rates
  const revenueStreams = streamNames.map((name, i) => ({
    name,
    growthRates: benchmarkAssumptions.revenueStreams[
      Math.min(i, benchmarkAssumptions.revenueStreams.length - 1)
    ]?.growthRates ?? benchmarkAssumptions.revenueStreams[0].growthRates,
  }));

  return { ...benchmarkAssumptions, revenueStreams };
}
