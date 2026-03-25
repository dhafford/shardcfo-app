"use client";

import { useState, useTransition, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Loader2, ArrowLeft, Play, Trash2, Download } from "lucide-react";
import Link from "next/link";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { AssumptionEditor } from "@/components/scenarios/assumption-editor";
import { SensitivityTable } from "@/components/scenarios/sensitivity-table";
import {
  runScenarioProjection,
  deleteScenario,
} from "../actions";
import type { ScenarioAssumptions, ScenarioProjection } from "@/lib/calculations/scenario-engine";

// ---------------------------------------------------------------------------
// Note: This page is a Client Component because the scenario editor requires
// real-time feedback as assumptions change. The initial scenario data is
// fetched via the server action runScenarioProjection.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

// ---------------------------------------------------------------------------
// P&L chart
// ---------------------------------------------------------------------------

function PnlChart({ projection }: { projection: ScenarioProjection }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Projected P&amp;L
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={projection.months}
            margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100" />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={fmt}
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={55}
            />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => fmt(v as number)}
              contentStyle={{ fontSize: 11, borderRadius: 6 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="revenue" name="Revenue" fill="#22c55e" stackId="a" />
            <Bar dataKey="cogs" name="COGS" fill="#f97316" stackId="b" />
            <Bar dataKey="totalOpex" name="OpEx" fill="#3b82f6" stackId="b" />
            <Line
              type="monotone"
              dataKey="ebitda"
              name="EBITDA"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Cash balance chart
// ---------------------------------------------------------------------------

function CashChart({ projection }: { projection: ScenarioProjection }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Projected Cash Balance
          {projection.estimatedCashOutDate && (
            <span className="ml-2 text-xs font-normal text-destructive">
              Cash out: {projection.estimatedCashOutDate}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart
            data={projection.months}
            margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100" />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={fmt}
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={55}
            />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => fmt(v as number)}
              contentStyle={{ fontSize: 11, borderRadius: 6 }}
            />
            <Line
              type="monotone"
              dataKey="cashBalance"
              name="Cash Balance"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="burnRate"
              name="Monthly Burn"
              stroke="#ef4444"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="4 2"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Key metrics summary strip
// ---------------------------------------------------------------------------

function MetricStrip({ projection }: { projection: ScenarioProjection }) {
  const last = projection.months[projection.months.length - 1];
  if (!last) return null;

  const items = [
    { label: "End MRR", value: fmt(last.mrr) },
    { label: "End ARR", value: fmt(last.arr) },
    { label: "End Cash", value: fmt(last.cashBalance) },
    {
      label: "Runway",
      value:
        projection.estimatedRunwayMonths !== null
          ? `${Math.round(projection.estimatedRunwayMonths)}mo`
          : "Cash+ (profitable)",
    },
    {
      label: "End Gross Margin",
      value: `${(last.grossMarginPct * 100).toFixed(1)}%`,
    },
    { label: "End Headcount", value: String(last.headcount) },
  ];

  return (
    <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border bg-white p-3 text-center"
        >
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {item.label}
          </p>
          <p className="mt-1 text-lg font-semibold font-mono tabular-nums">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ScenarioEditorPage() {
  const params = useParams<{ companyId: string; scenarioId: string }>();
  const { companyId, scenarioId } = params;

  const [projection, setProjection] = useState<ScenarioProjection | null>(null);
  const [projError, setProjError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [currentAssumptions, setCurrentAssumptions] =
    useState<ScenarioAssumptions | null>(null);

  const [isExporting, setIsExporting] = useState(false);

  async function exportScenarioToExcel() {
    if (!projection) return;
    setIsExporting(true);
    try {
      const res = await fetch("/api/generate-xlsx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "scenario",
          companyId,
          projection,
          scenarioAssumptions: currentAssumptions,
          scenarioName: `Scenario ${scenarioId.substring(0, 8)}`,
        }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Scenario ${scenarioId.substring(0, 8)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Could add toast
    } finally {
      setIsExporting(false);
    }
  }

  const runProjection = useCallback(() => {
    setProjError(null);
    startTransition(async () => {
      try {
        const json = await runScenarioProjection(companyId, scenarioId);
        setProjection(JSON.parse(json) as ScenarioProjection);
      } catch (err) {
        setProjError(
          err instanceof Error ? err.message : "Projection failed"
        );
      }
    });
  }, [companyId, scenarioId]);

  function handleDelete() {
    if (!confirm("Delete this scenario? This cannot be undone.")) return;
    const fd = new FormData();
    fd.set("companyId", companyId);
    fd.set("scenarioId", scenarioId);
    startTransition(() => deleteScenario(fd));
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel: assumption editor */}
      <aside className="w-72 shrink-0 border-r bg-white overflow-y-auto flex flex-col">
        {/* Back navigation */}
        <div className="px-4 pt-4 pb-2">
          <Link
            href={`/dashboard/companies/${companyId}/scenarios`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All scenarios
          </Link>
        </div>

        <AssumptionEditor
          companyId={companyId}
          scenarioId={scenarioId}
          initialAssumptions={{
            mrrGrowthRate: 0.1,
            cogsPercentage: 0.3,
            otherOpexGrowthRate: 0.02,
            hirePlan: [],
            fundraisingEvents: [],
            projectionMonths: 12,
            employerBurdenRate: 0.15,
          }}
          onAssumptionsChange={setCurrentAssumptions}
        />

        {/* Danger zone */}
        <div className="p-4 border-t mt-auto">
          <button
            type="button"
            onClick={handleDelete}
            className="flex items-center gap-1.5 text-xs text-destructive hover:underline"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete scenario
          </button>
        </div>
      </aside>

      {/* Right panel: projections */}
      <main className="flex-1 overflow-y-auto bg-slate-50 p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Scenario Editor</h1>
            <Badge variant="outline" className="text-xs">
              {scenarioId.substring(0, 8)}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={runProjection}
              disabled={isPending}
              className="gap-1.5"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              Run projection
            </Button>
            {projection && (
              <Button
                size="sm"
                variant="outline"
                onClick={exportScenarioToExcel}
                disabled={isExporting}
                className="gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                {isExporting ? "Exporting…" : "Export"}
              </Button>
            )}
          </div>
        </div>

        {projError && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {projError}
          </div>
        )}

        {!projection && !isPending && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
            <p className="text-sm text-muted-foreground">
              Configure assumptions on the left and click{" "}
              <strong>Run projection</strong> to see results.
            </p>
            <p className="text-xs text-muted-foreground">
              Projections use your most recent financial period as the base.
            </p>
          </div>
        )}

        {projection && (
          <Tabs defaultValue="charts">
            <TabsList className="h-8 text-xs">
              <TabsTrigger value="charts">Charts</TabsTrigger>
              <TabsTrigger value="table">Monthly Table</TabsTrigger>
              <TabsTrigger value="sensitivity">Sensitivity</TabsTrigger>
            </TabsList>

            <TabsContent value="charts" className="mt-4 space-y-4">
              <MetricStrip projection={projection} />
              <PnlChart projection={projection} />
              <CashChart projection={projection} />
            </TabsContent>

            <TabsContent value="table" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Monthly Projections
                  </CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="text-xs w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        {[
                          "Period",
                          "MRR",
                          "Revenue",
                          "COGS",
                          "Gross Profit",
                          "Gross Margin",
                          "Payroll",
                          "Other OpEx",
                          "EBITDA",
                          "Cash",
                          "Burn",
                          "Headcount",
                        ].map((h) => (
                          <th
                            key={h}
                            className="py-2 px-3 text-left font-medium text-muted-foreground whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {projection.months.map((m) => (
                        <tr
                          key={m.period}
                          className="border-b last:border-0 hover:bg-slate-50"
                        >
                          <td className="py-1.5 px-3 font-medium">{m.period}</td>
                          <td className="py-1.5 px-3 font-mono">{fmt(m.mrr)}</td>
                          <td className="py-1.5 px-3 font-mono">{fmt(m.revenue)}</td>
                          <td className="py-1.5 px-3 font-mono">{fmt(m.cogs)}</td>
                          <td className="py-1.5 px-3 font-mono">{fmt(m.grossProfit)}</td>
                          <td className="py-1.5 px-3 font-mono">
                            {(m.grossMarginPct * 100).toFixed(1)}%
                          </td>
                          <td className="py-1.5 px-3 font-mono">
                            {fmt(m.payrollExpense)}
                          </td>
                          <td className="py-1.5 px-3 font-mono">{fmt(m.otherOpex)}</td>
                          <td
                            className={`py-1.5 px-3 font-mono ${
                              m.ebitda >= 0 ? "text-green-700" : "text-red-600"
                            }`}
                          >
                            {fmt(m.ebitda)}
                          </td>
                          <td className="py-1.5 px-3 font-mono">
                            {fmt(m.cashBalance)}
                          </td>
                          <td className="py-1.5 px-3 font-mono text-red-600">
                            {m.burnRate > 0 ? fmt(m.burnRate) : "—"}
                          </td>
                          <td className="py-1.5 px-3 font-mono">{m.headcount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sensitivity" className="mt-4">
              <SensitivityTable
                baseAssumptions={currentAssumptions ?? undefined}
              />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
