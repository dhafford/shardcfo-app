"use client";

import { useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { runScenarioProjection } from "@/app/dashboard/companies/[companyId]/scenarios/actions";
import type { ScenarioRow } from "@/lib/supabase/types";
import type { ScenarioProjection } from "@/lib/calculations/scenario-engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScenarioComparisonProps {
  companyId: string;
  scenarioA: ScenarioRow;
  scenarioB: ScenarioRow;
}

type ProjectionPair = {
  a: ScenarioProjection;
  b: ScenarioProjection;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function fmtPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function summaryMetrics(proj: ScenarioProjection) {
  const last = proj.months[proj.months.length - 1];
  const first = proj.months[0];
  const mrrGrowth =
    first && last && first.mrr > 0
      ? ((last.mrr - first.mrr) / first.mrr) * 100
      : null;

  return {
    endMrr: last?.mrr ?? 0,
    endArr: last?.arr ?? 0,
    endCash: last?.cashBalance ?? 0,
    endEbitda: last?.ebitda ?? 0,
    totalBurn: proj.months.reduce((s, m) => s + m.burnRate, 0),
    runway: proj.estimatedRunwayMonths,
    mrrGrowthPct: mrrGrowth,
    endGrossMargin: last?.grossMarginPct ?? null,
  };
}

// ---------------------------------------------------------------------------
// Comparison table row
// ---------------------------------------------------------------------------

function CompareRow({
  label,
  valueA,
  valueB,
  higherIsBetter,
}: {
  label: string;
  valueA: string;
  valueB: string;
  higherIsBetter: boolean;
}) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-4 text-sm text-muted-foreground whitespace-nowrap">
        {label}
      </td>
      <td className="py-2 pr-4 text-sm font-mono font-medium text-right">
        {valueA}
      </td>
      <td className="py-2 text-sm font-mono font-medium text-right">
        {valueB}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Overlay chart
// ---------------------------------------------------------------------------

function OverlayChart({
  projA,
  projB,
  nameA,
  nameB,
  dataKey,
  title,
  formatter,
}: {
  projA: ScenarioProjection;
  projB: ScenarioProjection;
  nameA: string;
  nameB: string;
  dataKey: keyof ScenarioProjection["months"][0];
  title: string;
  formatter: (v: number) => string;
}) {
  const merged = projA.months.map((m, i) => ({
    period: m.period,
    a: m[dataKey] as number,
    b: projB.months[i]?.[dataKey] as number ?? null,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart
            data={merged}
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
              tickFormatter={formatter}
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={55}
            />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => formatter(v as number)}
              contentStyle={{ fontSize: 11, borderRadius: 6 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="a"
              name={nameA}
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="b"
              name={nameB}
              stroke="#8b5cf6"
              strokeWidth={2}
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
// Main component
// ---------------------------------------------------------------------------

export function ScenarioComparison({
  companyId,
  scenarioA,
  scenarioB,
}: ScenarioComparisonProps) {
  const [projections, setProjections] = useState<ProjectionPair | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function loadProjections() {
    setError(null);
    startTransition(async () => {
      try {
        const [jsonA, jsonB] = await Promise.all([
          runScenarioProjection(companyId, scenarioA.id),
          runScenarioProjection(companyId, scenarioB.id),
        ]);
        setProjections({
          a: JSON.parse(jsonA) as ScenarioProjection,
          b: JSON.parse(jsonB) as ScenarioProjection,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to run projections");
      }
    });
  }

  const metricsA = projections ? summaryMetrics(projections.a) : null;
  const metricsB = projections ? summaryMetrics(projections.b) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-sm font-medium">{scenarioA.name}</span>
            <Badge className="text-[10px]" variant="outline">
              {scenarioA.is_active ? "active" : "inactive"}
            </Badge>
          </div>
          <span className="text-muted-foreground text-sm">vs.</span>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span className="text-sm font-medium">{scenarioB.name}</span>
            <Badge className="text-[10px]" variant="outline">
              {scenarioB.is_active ? "active" : "inactive"}
            </Badge>
          </div>
        </div>
        <Button size="sm" onClick={loadProjections} disabled={isPending}>
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
          ) : null}
          {projections ? "Refresh" : "Run comparison"}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {!projections && !isPending && (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          Click &ldquo;Run comparison&rdquo; to generate side-by-side projections.
        </div>
      )}

      {projections && metricsA && metricsB && (
        <>
          {/* Summary table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                End-of-projection summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 pr-4 text-xs font-medium text-muted-foreground text-left">
                      Metric
                    </th>
                    <th className="py-2 pr-4 text-xs font-medium text-blue-600 text-right">
                      {scenarioA.name}
                    </th>
                    <th className="py-2 text-xs font-medium text-purple-600 text-right">
                      {scenarioB.name}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <CompareRow
                    label="Ending MRR"
                    valueA={fmt(metricsA.endMrr)}
                    valueB={fmt(metricsB.endMrr)}
                    higherIsBetter
                  />
                  <CompareRow
                    label="Ending ARR"
                    valueA={fmt(metricsA.endArr)}
                    valueB={fmt(metricsB.endArr)}
                    higherIsBetter
                  />
                  <CompareRow
                    label="Ending Cash"
                    valueA={fmt(metricsA.endCash)}
                    valueB={fmt(metricsB.endCash)}
                    higherIsBetter
                  />
                  <CompareRow
                    label="Total Burn"
                    valueA={fmt(metricsA.totalBurn)}
                    valueB={fmt(metricsB.totalBurn)}
                    higherIsBetter={false}
                  />
                  <CompareRow
                    label="Runway (mo)"
                    valueA={
                      metricsA.runway !== null
                        ? `${Math.round(metricsA.runway)}mo`
                        : "Cash+ (no burn)"
                    }
                    valueB={
                      metricsB.runway !== null
                        ? `${Math.round(metricsB.runway)}mo`
                        : "Cash+ (no burn)"
                    }
                    higherIsBetter
                  />
                  {metricsA.mrrGrowthPct !== null && (
                    <CompareRow
                      label="MRR growth (total)"
                      valueA={`${metricsA.mrrGrowthPct.toFixed(1)}%`}
                      valueB={
                        metricsB.mrrGrowthPct !== null
                          ? `${metricsB.mrrGrowthPct.toFixed(1)}%`
                          : "—"
                      }
                      higherIsBetter
                    />
                  )}
                  {metricsA.endGrossMargin !== null && (
                    <CompareRow
                      label="End gross margin"
                      valueA={fmtPct(metricsA.endGrossMargin)}
                      valueB={
                        metricsB.endGrossMargin !== null
                          ? fmtPct(metricsB.endGrossMargin)
                          : "—"
                      }
                      higherIsBetter
                    />
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Overlay charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <OverlayChart
              projA={projections.a}
              projB={projections.b}
              nameA={scenarioA.name}
              nameB={scenarioB.name}
              dataKey="mrr"
              title="MRR Projection"
              formatter={fmt}
            />
            <OverlayChart
              projA={projections.a}
              projB={projections.b}
              nameA={scenarioA.name}
              nameB={scenarioB.name}
              dataKey="cashBalance"
              title="Cash Balance"
              formatter={fmt}
            />
            <OverlayChart
              projA={projections.a}
              projB={projections.b}
              nameA={scenarioA.name}
              nameB={scenarioB.name}
              dataKey="ebitda"
              title="EBITDA"
              formatter={fmt}
            />
            <OverlayChart
              projA={projections.a}
              projB={projections.b}
              nameA={scenarioA.name}
              nameB={scenarioB.name}
              dataKey="burnRate"
              title="Monthly Burn Rate"
              formatter={fmt}
            />
          </div>
        </>
      )}
    </div>
  );
}
