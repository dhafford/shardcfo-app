"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  projectScenario,
  type BasePeriodActuals,
  type ScenarioAssumptions,
} from "@/lib/calculations/scenario-engine";

// ---------------------------------------------------------------------------
// Variable definitions
// ---------------------------------------------------------------------------

interface VariableDef {
  key: string;
  label: string;
  values: number[];
  format: (v: number) => string;
}

const VARIABLES: VariableDef[] = [
  {
    key: "mrrGrowthRate",
    label: "MRR Growth Rate (MoM)",
    values: [0.03, 0.05, 0.08, 0.10, 0.15, 0.20, 0.25],
    format: (v) => `${(v * 100).toFixed(0)}%`,
  },
  {
    key: "cogsPercentage",
    label: "COGS %",
    values: [0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50],
    format: (v) => `${(v * 100).toFixed(0)}%`,
  },
  {
    key: "otherOpexGrowthRate",
    label: "OpEx Growth Rate (MoM)",
    values: [0, 0.01, 0.02, 0.03, 0.05, 0.07, 0.10],
    format: (v) => `${(v * 100).toFixed(0)}%`,
  },
  {
    key: "projectionMonths",
    label: "Projection Months",
    values: [3, 6, 9, 12, 15, 18, 24],
    format: (v) => `${v}mo`,
  },
];

// ---------------------------------------------------------------------------
// Outcome definitions
// ---------------------------------------------------------------------------

interface OutcomeDef {
  key: string;
  label: string;
  format: (v: number) => string;
}

const OUTCOMES: OutcomeDef[] = [
  {
    key: "endMrr",
    label: "Ending MRR",
    format: (v) => v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${(v / 1e3).toFixed(0)}K`,
  },
  {
    key: "endCash",
    label: "Ending Cash",
    format: (v) => v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${(v / 1e3).toFixed(0)}K`,
  },
  {
    key: "runway",
    label: "Runway (mo)",
    format: (v) => v >= 999 ? "Cash+" : `${Math.round(v)}mo`,
  },
  {
    key: "totalBurn",
    label: "Total Burn",
    format: (v) => v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${(v / 1e3).toFixed(0)}K`,
  },
];

// ---------------------------------------------------------------------------
// Heatmap color scale: green (good/high) to red (bad/low)
// Based on normalized position in the value range.
// ---------------------------------------------------------------------------

function heatmapColor(
  value: number,
  min: number,
  max: number,
  higherIsBetter: boolean
): string {
  if (max === min) return "bg-slate-100";
  const ratio = (value - min) / (max - min);
  const normalized = higherIsBetter ? ratio : 1 - ratio;

  if (normalized >= 0.8) return "bg-green-100 text-green-900";
  if (normalized >= 0.6) return "bg-green-50 text-green-800";
  if (normalized >= 0.4) return "bg-yellow-50 text-yellow-800";
  if (normalized >= 0.2) return "bg-orange-50 text-orange-800";
  return "bg-red-50 text-red-800";
}

const OUTCOME_HIGHER_IS_BETTER: Record<string, boolean> = {
  endMrr: true,
  endCash: true,
  runway: true,
  totalBurn: false,
};

// ---------------------------------------------------------------------------
// Compute outcome value for a given set of assumptions
// ---------------------------------------------------------------------------

function computeOutcome(
  actuals: BasePeriodActuals,
  baseAssumptions: ScenarioAssumptions,
  rowKey: string,
  rowValue: number,
  colKey: string,
  colValue: number,
  outcomeKey: string
): number {
  const assumptions: ScenarioAssumptions = {
    ...baseAssumptions,
    [rowKey]: rowValue,
    [colKey]: colValue,
  };

  const projection = projectScenario(actuals, assumptions, "sensitivity");
  const last = projection.months[projection.months.length - 1];

  switch (outcomeKey) {
    case "endMrr":
      return last?.mrr ?? 0;
    case "endCash":
      return last?.cashBalance ?? 0;
    case "runway":
      return projection.estimatedRunwayMonths ?? 999;
    case "totalBurn":
      return projection.months.reduce((s, m) => s + m.burnRate, 0);
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Default placeholder actuals (used when no base period is provided)
// ---------------------------------------------------------------------------

const PLACEHOLDER_ACTUALS: BasePeriodActuals = {
  period: "2025-01",
  mrr: 50000,
  revenue: 50000,
  cogs: 15000,
  payrollExpense: 80000,
  headcount: 10,
  otherOpex: 20000,
  cashBalance: 1_500_000,
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface SensitivityTableProps {
  baseAssumptions?: ScenarioAssumptions;
  actuals?: BasePeriodActuals;
}

export function SensitivityTable({
  baseAssumptions,
  actuals = PLACEHOLDER_ACTUALS,
}: SensitivityTableProps) {
  const [rowVar, setRowVar] = useState<string>("mrrGrowthRate");
  const [colVar, setColVar] = useState<string>("cogsPercentage");
  const [outcomeKey, setOutcomeKey] = useState<string>("endMrr");
  const [matrix, setMatrix] = useState<number[][] | null>(null);
  const [computing, setComputing] = useState(false);

  const rowDef = VARIABLES.find((v) => v.key === rowVar)!;
  const colDef = VARIABLES.find((v) => v.key === colVar)!;
  const outcomeDef = OUTCOMES.find((o) => o.key === outcomeKey)!;

  function runAnalysis() {
    setComputing(true);

    const base: ScenarioAssumptions = {
      mrrGrowthRate: 0.1,
      cogsPercentage: 0.3,
      otherOpexGrowthRate: 0.02,
      projectionMonths: 12,
      hirePlan: [],
      fundraisingEvents: [],
      employerBurdenRate: 0.15,
      ...baseAssumptions,
    };

    // Build matrix: rows = rowVar values, cols = colVar values
    const result: number[][] = rowDef.values.map((rowVal) =>
      colDef.values.map((colVal) =>
        computeOutcome(actuals, base, rowVar, rowVal, colVar, colVal, outcomeKey)
      )
    );

    setMatrix(result);
    setComputing(false);
  }

  // Determine min/max for heatmap
  const allValues = matrix ? matrix.flat() : [];
  const minVal = allValues.length > 0 ? Math.min(...allValues) : 0;
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : 1;
  const higherIsBetter = OUTCOME_HIGHER_IS_BETTER[outcomeKey] ?? true;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Sensitivity Analysis</CardTitle>
        <CardDescription>
          See how the outcome metric changes across combinations of two
          assumption variables.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Row variable</Label>
            <Select value={rowVar} onValueChange={(v) => { if (v) setRowVar(v); }}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VARIABLES.filter((v) => v.key !== colVar).map((v) => (
                  <SelectItem key={v.key} value={v.key}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Column variable</Label>
            <Select value={colVar} onValueChange={(v) => { if (v) setColVar(v); }}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VARIABLES.filter((v) => v.key !== rowVar).map((v) => (
                  <SelectItem key={v.key} value={v.key}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Outcome metric</Label>
            <Select value={outcomeKey} onValueChange={(v) => { if (v) setOutcomeKey(v); }}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTCOMES.map((o) => (
                  <SelectItem key={o.key} value={o.key}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          size="sm"
          onClick={runAnalysis}
          disabled={computing || rowVar === colVar}
          className="gap-1.5"
        >
          {computing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Run analysis
        </Button>

        {rowVar === colVar && (
          <p className="text-xs text-destructive">
            Row and column variables must be different.
          </p>
        )}

        {/* Matrix */}
        {matrix && (
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse w-full">
              <thead>
                <tr>
                  {/* corner cell */}
                  <th className="border border-slate-200 bg-slate-50 p-2 text-left font-medium text-muted-foreground">
                    {rowDef.label}
                    <span className="mx-1 text-slate-300">/</span>
                    {colDef.label}
                  </th>
                  {colDef.values.map((colVal) => (
                    <th
                      key={colVal}
                      className="border border-slate-200 bg-slate-50 p-2 font-medium text-center whitespace-nowrap"
                    >
                      {colDef.format(colVal)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rowDef.values.map((rowVal, ri) => (
                  <tr key={rowVal}>
                    <td className="border border-slate-200 bg-slate-50 p-2 font-medium whitespace-nowrap">
                      {rowDef.format(rowVal)}
                    </td>
                    {colDef.values.map((colVal, ci) => {
                      const cellVal = matrix[ri][ci];
                      const colorClass = heatmapColor(
                        cellVal,
                        minVal,
                        maxVal,
                        higherIsBetter
                      );
                      return (
                        <td
                          key={colVal}
                          className={`border border-slate-200 p-2 text-center font-mono ${colorClass}`}
                        >
                          {outcomeDef.format(cellVal)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Legend */}
            <div className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-red-50 border border-red-200" />
                <span>{higherIsBetter ? "Low" : "High"} (unfavorable)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-yellow-50 border border-yellow-200" />
                <span>Mid</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-100 border border-green-200" />
                <span>{higherIsBetter ? "High" : "Low"} (favorable)</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
