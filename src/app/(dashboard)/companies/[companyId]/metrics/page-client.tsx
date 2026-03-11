"use client";

import { useState } from "react";
import { KpiCard } from "@/components/shared/kpi-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle, PlusCircle } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { saveMetric } from "./actions";
import type { MetricDefinition } from "@/lib/constants";
import type { FinancialPeriodRow } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DisplayMetric {
  slug: string;
  definition: MetricDefinition;
  currentValue: number | null;
  previousValue: number | null;
  sparklineData: number[];
  benchmarkLow: number | null;
  benchmarkMedian: number | null;
  benchmarkHigh: number | null;
  rating: "excellent" | "good" | "fair" | "poor" | "unknown";
}

export interface MetricSection {
  title: string;
  metrics: DisplayMetric[];
}

interface MetricsClientProps {
  sections: MetricSection[];
  companyId: string;
  periods: FinancialPeriodRow[];
  currentPeriodId: string;
  manualEntryMetrics: MetricDefinition[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMetricValue(def: MetricDefinition, value: number | null): string {
  if (value === null) return "—";
  switch (def.unit) {
    case "currency":
      if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
      if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
      return `$${value.toFixed(def.decimalPlaces)}`;
    case "percentage":
      return `${(value * 100).toFixed(def.decimalPlaces)}%`;
    case "ratio":
      return `${value.toFixed(def.decimalPlaces)}x`;
    case "multiple":
      return `${value.toFixed(def.decimalPlaces)}x`;
    case "months":
      return `${Math.round(value)}mo`;
    case "count":
      return value.toLocaleString();
    default:
      return value.toFixed(def.decimalPlaces);
  }
}

function calcTrend(
  current: number | null,
  previous: number | null
): { trend: "up" | "down" | "flat"; change: number | undefined } {
  if (current === null || previous === null || previous === 0) {
    return { trend: "flat", change: undefined };
  }
  const change = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(change) < 0.5) return { trend: "flat", change: undefined };
  return {
    trend: change > 0 ? "up" : "down",
    change: Math.abs(change),
  };
}

const RATING_COLORS: Record<DisplayMetric["rating"], string> = {
  excellent: "bg-green-100 text-green-800",
  good: "bg-blue-100 text-blue-800",
  fair: "bg-yellow-100 text-yellow-800",
  poor: "bg-red-100 text-red-800",
  unknown: "bg-slate-100 text-slate-600",
};

// ---------------------------------------------------------------------------
// Benchmark gauge bar
// ---------------------------------------------------------------------------

function BenchmarkGauge({
  value,
  low,
  median,
  high,
  unit,
  decimalPlaces,
}: {
  value: number | null;
  low: number | null;
  median: number | null;
  high: number | null;
  unit: string;
  decimalPlaces: number;
}) {
  if (value === null || low === null || median === null || high === null) {
    return null;
  }

  const isPercentage = unit === "percentage";
  const display = (v: number) =>
    isPercentage ? `${(v * 100).toFixed(decimalPlaces)}%` : v.toFixed(decimalPlaces);

  // Clamp value position within a generous range (0 to high * 1.5)
  const rangeMax = high * 1.5;
  const rangeMin = Math.min(0, low * 0.5);
  const range = rangeMax - rangeMin;
  const clampedValue = Math.max(rangeMin, Math.min(rangeMax, value));
  const pct = ((clampedValue - rangeMin) / range) * 100;

  return (
    <div className="mt-3 space-y-1">
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Low {display(low)}</span>
        <span>Median {display(median)}</span>
        <span>High {display(high)}</span>
      </div>
      <div className="relative h-2 rounded-full bg-slate-100 overflow-visible">
        {/* low-to-high shaded band */}
        <div
          className="absolute h-full bg-green-100 rounded-full"
          style={{
            left: `${((low - rangeMin) / range) * 100}%`,
            width: `${((high - low) / range) * 100}%`,
          }}
        />
        {/* current value marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-blue-600 border-2 border-white shadow z-10"
          style={{ left: `calc(${pct}% - 6px)` }}
          title={`Current: ${display(value)}`}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric card with expandable trend chart
// ---------------------------------------------------------------------------

function MetricCardExpanded({ metric }: { metric: DisplayMetric }) {
  const [expanded, setExpanded] = useState(false);
  const { definition: def, currentValue, previousValue, sparklineData } = metric;
  const { trend, change } = calcTrend(currentValue, previousValue);

  const chartData = sparklineData.map((v, i) => ({ i, v }));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground truncate">
            {def.shortLabel}
          </span>
          <TooltipProvider delay={200}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="shrink-0 text-muted-foreground/60 hover:text-muted-foreground"
                    aria-label={`How ${def.shortLabel} is calculated`}
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                  </button>
                }
              />
              <TooltipContent side="top" className="max-w-xs text-xs">
                <p className="font-medium mb-0.5">{def.label}</p>
                <p>{def.description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Badge
          className={`shrink-0 text-[10px] px-1.5 py-0 ${RATING_COLORS[metric.rating]}`}
        >
          {metric.rating}
        </Badge>
      </div>

      <KpiCard
        title=""
        value={formatMetricValue(def, currentValue)}
        change={change}
        trend={trend}
        trendIsPositive={def.higherIsBetter}
        sparklineData={sparklineData.length > 1 ? sparklineData : undefined}
        className="shadow-none border-0 p-0"
      />

      <BenchmarkGauge
        value={currentValue}
        low={metric.benchmarkLow}
        median={metric.benchmarkMedian}
        high={metric.benchmarkHigh}
        unit={def.unit}
        decimalPlaces={def.decimalPlaces}
      />

      {sparklineData.length > 1 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[10px] text-blue-600 hover:underline text-left mt-0.5"
        >
          {expanded ? "Hide trend" : "Show trend"}
        </button>
      )}

      {expanded && sparklineData.length > 1 && (
        <div className="h-24 mt-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100" />
              <XAxis dataKey="i" hide />
              <YAxis
                tick={{ fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                width={30}
              />
              <RechartsTooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(val: any) => formatMetricValue(def, val as number)}
                contentStyle={{ fontSize: 11, borderRadius: 6 }}
              />
              <Line
                type="monotone"
                dataKey="v"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manual metric entry dialog
// ---------------------------------------------------------------------------

function ManualEntryDialog({
  open,
  onClose,
  companyId,
  periods,
  currentPeriodId,
  metrics,
}: {
  open: boolean;
  onClose: () => void;
  companyId: string;
  periods: FinancialPeriodRow[];
  currentPeriodId: string;
  metrics: MetricDefinition[];
}) {
  const [selectedPeriodId, setSelectedPeriodId] = useState(currentPeriodId);
  const [selectedSlug, setSelectedSlug] = useState(metrics[0]?.key ?? "");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const fd = new FormData();
    fd.set("companyId", companyId);
    fd.set("periodId", selectedPeriodId);
    fd.set("slug", selectedSlug);
    fd.set("value", value);

    try {
      await saveMetric(fd);
      setValue("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save metric");
    } finally {
      setSaving(false);
    }
  }

  const selectedDef = metrics.find((m) => m.key === selectedSlug);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enter Metric Manually</DialogTitle>
          <DialogDescription>
            Record a metric value that cannot be auto-calculated from your
            financial data (e.g. customer counts, retention rates).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="period">Period</Label>
            <Select
              value={selectedPeriodId}
              onValueChange={(v) => { if (v) setSelectedPeriodId(v); }}
            >
              <SelectTrigger id="period">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {periods.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.period_label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="metric-slug">Metric</Label>
            <Select value={selectedSlug} onValueChange={(v) => { if (v) setSelectedSlug(v); }}>
              <SelectTrigger id="metric-slug">
                <SelectValue placeholder="Select metric" />
              </SelectTrigger>
              <SelectContent>
                {metrics.map((m) => (
                  <SelectItem key={m.key} value={m.key}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedDef && (
              <p className="text-xs text-muted-foreground">
                {selectedDef.description}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="metric-value">
              Value
              {selectedDef && (
                <span className="ml-1 text-xs text-muted-foreground">
                  ({selectedDef.unit === "percentage"
                    ? "as decimal, e.g. 0.15 = 15%"
                    : selectedDef.unit})
                </span>
              )}
            </Label>
            <Input
              id="metric-value"
              type="number"
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save metric"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function MetricsDashboardClient({
  sections,
  companyId,
  periods,
  currentPeriodId,
  manualEntryMetrics,
}: MetricsClientProps) {
  const [manualOpen, setManualOpen] = useState(false);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Metrics are auto-calculated from financial data where possible.
          Use the button to enter values manually.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setManualOpen(true)}
          className="gap-1.5"
        >
          <PlusCircle className="w-4 h-4" />
          Enter metric
        </Button>
      </div>

      {sections.map((section) => (
        <div key={section.title}>
          <h2 className="text-sm font-semibold text-foreground mb-3 pb-1.5 border-b">
            {section.title}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {section.metrics.map((metric) => (
              <Card key={metric.slug} className="overflow-hidden">
                <CardContent className="p-4">
                  <MetricCardExpanded metric={metric} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {sections.every((s) => s.metrics.length === 0) && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No metrics recorded yet. Import financial data or enter metrics
            manually to get started.
          </p>
        </div>
      )}

      <ManualEntryDialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        companyId={companyId}
        periods={periods}
        currentPeriodId={currentPeriodId}
        metrics={manualEntryMetrics}
      />
    </div>
  );
}
