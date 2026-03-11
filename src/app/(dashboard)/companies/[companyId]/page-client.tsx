"use client";

import { Suspense } from "react";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { BurnChart } from "@/components/charts/burn-chart";
import { RunwayChart } from "@/components/charts/runway-chart";
import { ChartSkeleton } from "@/components/shared/loading-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

export interface RevenueDataPoint {
  period: string;
  revenue: number;
  mrr?: number;
}

export interface BurnDataPoint {
  period: string;
  burnRate: number;
  cashBalance: number;
}

export interface RunwayDataPoint {
  period: string;
  projected: number;
  optimistic?: number;
  pessimistic?: number;
  isActual?: boolean;
}

export interface ExpenseCategory {
  label: string;
  amount: number;
  pct: number;
}

export interface ActivityItem {
  id: string;
  description: string;
  timestamp: string;
  action: string;
}

interface CompanyDashboardClientProps {
  revenueData: RevenueDataPoint[];
  burnData: BurnDataPoint[];
  runwayData: RunwayDataPoint[];
  expenseCategories: ExpenseCategory[];
  recentActivity: ActivityItem[];
  currency: string;
}

function formatCurrency(value: number, currency = "USD"): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function ExpenseBreakdown({
  categories,
  currency,
}: {
  categories: ExpenseCategory[];
  currency: string;
}) {
  if (categories.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Expense Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-8 text-center">
            No expense data available for this period.
          </p>
        </CardContent>
      </Card>
    );
  }

  const COLORS = [
    "bg-blue-500",
    "bg-violet-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-emerald-500",
    "bg-slate-400",
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Expense Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {categories.map((cat, idx) => (
            <div key={cat.label}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-sm ${COLORS[idx % COLORS.length]}`}
                    aria-hidden="true"
                  />
                  <span className="text-sm">{cat.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {cat.pct.toFixed(1)}%
                  </span>
                  <span className="text-sm font-medium tabular-nums font-mono">
                    {formatCurrency(cat.amount, currency)}
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${COLORS[idx % COLORS.length]}`}
                  style={{ width: `${Math.min(cat.pct, 100)}%` }}
                  role="progressbar"
                  aria-valuenow={cat.pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RecentActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-6 text-center">
            No recent activity.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-3 before:absolute before:inset-y-0 before:left-[7px] before:w-px before:bg-slate-200">
          {items.map((item) => (
            <li key={item.id} className="pl-6 relative">
              <span className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-slate-300 ring-1 ring-slate-200" />
              <p className="text-sm leading-snug">{item.description}</p>
              <time
                dateTime={item.timestamp}
                className="text-xs text-muted-foreground"
              >
                {format(new Date(item.timestamp), "MMM d, yyyy 'at' h:mm a")}
              </time>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

export function CompanyDashboardClient({
  revenueData,
  burnData,
  runwayData,
  expenseCategories,
  recentActivity,
  currency,
}: CompanyDashboardClientProps) {
  return (
    <div className="space-y-6">
      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Suspense fallback={<ChartSkeleton />}>
          <RevenueChart
            data={revenueData}
            title="Revenue Trend (Trailing 12 Months)"
          />
        </Suspense>
        <Suspense fallback={<ChartSkeleton />}>
          <BurnChart data={burnData} title="Cash & Burn Rate" />
        </Suspense>
      </div>

      {/* Runway projection */}
      <Suspense fallback={<ChartSkeleton />}>
        <RunwayChart
          data={runwayData}
          title="Cash Runway Projection (18 Months)"
        />
      </Suspense>

      {/* Expense breakdown + activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExpenseBreakdown
          categories={expenseCategories}
          currency={currency}
        />
        <RecentActivityFeed items={recentActivity} />
      </div>
    </div>
  );
}
