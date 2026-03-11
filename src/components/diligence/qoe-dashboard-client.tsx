"use client";

import { useState, useTransition } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QOE_ADJUSTMENT_TYPES } from "@/lib/constants";
import { createQoEAdjustment, deleteQoEAdjustment } from "@/lib/diligence/actions";
import type { QoEAdjustmentRow } from "@/lib/supabase/types";
import type { EBITDABridgeItem, QoESummary } from "@/lib/calculations/qoe";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function qualityColor(quality: "high" | "moderate" | "low"): string {
  if (quality === "high") return "text-green-600";
  if (quality === "moderate") return "text-amber-600";
  return "text-red-600";
}

function qualityBadgeVariant(quality: "high" | "moderate" | "low") {
  if (quality === "high") return "default";
  if (quality === "moderate") return "secondary";
  return "destructive";
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface QoEDashboardClientProps {
  companyId: string;
  reportedEBITDA: number;
  adjustments: QoEAdjustmentRow[];
  bridge: EBITDABridgeItem[];
  qoeSummary: QoESummary;
  monthlyData: { period: string; reportedEBITDA: number; adjustedEBITDA: number }[];
}

// ---------------------------------------------------------------------------
// Bridge chart helpers
// Build a stacked-bar waterfall from the bridge items.
// Each bar has an invisible "base" bar stacked below the visible value bar.
// ---------------------------------------------------------------------------

interface WaterfallBar {
  label: string;
  base: number;
  value: number;
  type: "base" | "adjustment" | "total";
  isPositive: boolean;
}

function buildWaterfallBars(bridge: EBITDABridgeItem[]): WaterfallBar[] {
  let runningTotal = 0;
  return bridge.map((item) => {
    if (item.type === "base") {
      const bar: WaterfallBar = {
        label: item.label,
        base: 0,
        value: item.amount,
        type: "base",
        isPositive: item.amount >= 0,
      };
      runningTotal = item.amount;
      return bar;
    }
    if (item.type === "total") {
      return {
        label: item.label,
        base: 0,
        value: item.amount,
        type: "total",
        isPositive: item.amount >= 0,
      };
    }
    // adjustment
    const base = item.amount >= 0 ? runningTotal : runningTotal + item.amount;
    const bar: WaterfallBar = {
      label: item.label,
      base,
      value: Math.abs(item.amount),
      type: "adjustment",
      isPositive: item.amount >= 0,
    };
    runningTotal += item.amount;
    return bar;
  });
}

function barFill(bar: WaterfallBar): string {
  if (bar.type === "base" || bar.type === "total") return "#3b82f6";
  return bar.isPositive ? "#16a34a" : "#dc2626";
}

// ---------------------------------------------------------------------------
// Add Adjustment Form
// ---------------------------------------------------------------------------

interface AddAdjustmentFormProps {
  companyId: string;
  onClose: () => void;
}

function AddAdjustmentForm({ companyId, onClose }: AddAdjustmentFormProps) {
  const [isPending, startTransition] = useTransition();
  const [periodDate, setPeriodDate] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!periodDate || !adjustmentType || !description || !amount) return;
    const type = adjustmentType;
    startTransition(async () => {
      await createQoEAdjustment(companyId, {
        period_date: periodDate + "-01",
        adjustment_type: type as QoEAdjustmentRow["adjustment_type"],
        description,
        amount: parseFloat(amount),
      });
      onClose();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border rounded-lg p-4 bg-slate-50 space-y-3"
    >
      <p className="text-sm font-medium">Add Adjustment</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="qoe-period" className="text-xs">
            Period
          </Label>
          <Input
            id="qoe-period"
            type="month"
            value={periodDate}
            onChange={(e) => setPeriodDate(e.target.value)}
            required
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="qoe-type" className="text-xs">
            Type
          </Label>
          <Select value={adjustmentType} onValueChange={(v) => setAdjustmentType(v ?? "")}>
            <SelectTrigger id="qoe-type" className="h-8 text-sm">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {QOE_ADJUSTMENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="qoe-desc" className="text-xs">
            Description
          </Label>
          <Input
            id="qoe-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. One-time legal settlement"
            required
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="qoe-amount" className="text-xs">
            Amount (negative to reduce EBITDA)
          </Label>
          <Input
            id="qoe-amount"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 25000 or -12500"
            required
            className="h-8 text-sm"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function QoEDashboardClient({
  companyId,
  reportedEBITDA,
  adjustments,
  bridge,
  qoeSummary,
  monthlyData: _monthlyData,
}: QoEDashboardClientProps) {
  const [showForm, setShowForm] = useState(false);
  const [, startDeleteTransition] = useTransition();

  const adjustedEBITDA = qoeSummary.adjustedEBITDA;
  const delta = adjustedEBITDA - reportedEBITDA;
  const waterfallBars = buildWaterfallBars(bridge);

  function handleDelete(adjustmentId: string) {
    startDeleteTransition(async () => {
      await deleteQoEAdjustment(companyId, adjustmentId);
    });
  }

  return (
    <div className="space-y-6">
      {/* ── Section 1: KPI Summary Cards ──────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Reported EBITDA */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Reported EBITDA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {formatCurrency(reportedEBITDA)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Last 12 months
            </p>
          </CardContent>
        </Card>

        {/* Adjusted EBITDA */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Adjusted EBITDA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-semibold tabular-nums">
                {formatCurrency(adjustedEBITDA)}
              </p>
              {adjustments.length > 0 && (
                <Badge
                  variant={delta >= 0 ? "default" : "destructive"}
                  className="text-xs"
                >
                  {delta >= 0 ? "+" : ""}
                  {formatCurrency(delta)}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {adjustments.length} adjustment{adjustments.length !== 1 ? "s" : ""} applied
            </p>
          </CardContent>
        </Card>

        {/* QoE Quality */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              QoE Quality
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <p
                className={`text-2xl font-semibold capitalize ${qualityColor(qoeSummary.qualityAssessment)}`}
              >
                {qoeSummary.qualityAssessment}
              </p>
              <Badge variant={qualityBadgeVariant(qoeSummary.qualityAssessment) as "default" | "secondary" | "destructive"} className="text-xs">
                {qoeSummary.qualityAssessment === "high"
                  ? "Strong"
                  : qoeSummary.qualityAssessment === "moderate"
                    ? "Review"
                    : "Concern"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              QoE ratio:{" "}
              {qoeSummary.qoeRatio !== null
                ? qoeSummary.qoeRatio.toFixed(2) + "x"
                : "N/A"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Section 2: EBITDA Bridge Chart ────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">EBITDA Bridge</CardTitle>
          <p className="text-xs text-muted-foreground">
            From reported to adjusted EBITDA — green bars increase, red bars
            reduce, blue bars are totals.
          </p>
        </CardHeader>
        <CardContent>
          {bridge.length <= 2 ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground border border-dashed rounded-lg">
              Add adjustments to see the EBITDA bridge.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={waterfallBars}
                margin={{ top: 8, right: 8, bottom: 48, left: 8 }}
              >
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  angle={-35}
                  textAnchor="end"
                  height={64}
                />
                <YAxis
                  tickFormatter={(v: unknown) =>
                    formatCurrency(typeof v === "number" ? v : 0)
                  }
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={60}
                />
                <Tooltip
                  formatter={((value: unknown) => [formatCurrency(typeof value === "number" ? value : 0), "Amount"]) as unknown as undefined}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                  }}
                />
                {/* Invisible base bar to create the floating waterfall effect */}
                <Bar dataKey="base" stackId="a" fill="transparent" />
                <Bar dataKey="value" stackId="a" radius={[4, 4, 0, 0]}>
                  {waterfallBars.map((bar, idx) => (
                    <Cell key={idx} fill={barFill(bar)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Section 3: Adjustments Table & Form ───────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Adjustments</CardTitle>
            {!showForm && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowForm(true)}
              >
                Add Adjustment
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showForm && (
            <AddAdjustmentForm
              companyId={companyId}
              onClose={() => setShowForm(false)}
            />
          )}

          {adjustments.length === 0 && !showForm ? (
            <div className="flex items-center justify-center h-24 text-sm text-muted-foreground border border-dashed rounded-lg">
              No adjustments yet. Add one to start the QoE analysis.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left pb-2 pr-3 font-medium">Period</th>
                    <th className="text-left pb-2 pr-3 font-medium">Type</th>
                    <th className="text-left pb-2 pr-3 font-medium">Description</th>
                    <th className="text-right pb-2 pr-3 font-medium">Amount</th>
                    <th className="pb-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {adjustments.map((adj) => {
                    const typeLabel =
                      QOE_ADJUSTMENT_TYPES.find(
                        (t) => t.value === adj.adjustment_type
                      )?.label ?? adj.adjustment_type;
                    return (
                      <tr
                        key={adj.id}
                        className="border-b last:border-0 hover:bg-slate-50"
                      >
                        <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                          {adj.period_date.slice(0, 7)}
                        </td>
                        <td className="py-2 pr-3">
                          <Badge variant="secondary" className="text-xs">
                            {typeLabel}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3 max-w-xs truncate">
                          {adj.description}
                        </td>
                        <td
                          className={`py-2 pr-3 text-right tabular-nums font-medium ${
                            adj.amount >= 0 ? "text-green-700" : "text-red-700"
                          }`}
                        >
                          {adj.amount >= 0 ? "+" : ""}
                          {formatCurrency(adj.amount)}
                        </td>
                        <td className="py-2 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(adj.id)}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
