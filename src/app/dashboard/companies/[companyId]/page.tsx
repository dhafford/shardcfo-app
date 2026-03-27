import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { format, subMonths, addMonths, startOfMonth } from "date-fns";
import { FileText, Settings, PlusCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KpiCard } from "@/components/shared/kpi-card";
import { KpiGridSkeleton, PageSkeleton } from "@/components/shared/loading-skeleton";
import { Button } from "@/components/ui/button";
import {
  CompanyDashboardClient,
  type RevenueDataPoint,
  type BurnDataPoint,
  type RunwayDataPoint,
  type ExpenseCategory,
  type ActivityItem,
} from "./page-client";
import type { CompanyRow, MetricRow, AuditLogRow, LineItemRow, FinancialPeriodRow, AccountRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(value: number | null, currency = "USD"): string {
  if (value === null) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPct(value: number | null): string {
  if (value === null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function formatMonths(value: number | null): string {
  if (value === null) return "—";
  if (value >= 24) return `${(value / 12).toFixed(1)}y`;
  return `${Math.round(value)}mo`;
}

// Determine MoM trend from sparkline data
function computeTrend(
  values: number[]
): "up" | "down" | "flat" {
  if (values.length < 2) return "flat";
  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  if (last > prev) return "up";
  if (last < prev) return "down";
  return "flat";
}

function computeChangePct(values: number[]): number | undefined {
  if (values.length < 2) return undefined;
  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  if (prev === 0) return undefined;
  return ((last - prev) / prev) * 100;
}

// ─── Page ──────────────────────────────────────────────────────────────────────

interface CompanyPageProps {
  params: Promise<{ companyId: string }>;
}

export default async function CompanyDashboardPage({
  params,
}: CompanyPageProps) {
  const { companyId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch company
  const { data: rawCompany } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();

  if (!rawCompany) {
    notFound();
  }

  const company = rawCompany as CompanyRow;

  // Fetch metrics for the last 12 months (use metric_key, not slug)
  const { data: rawMetrics } = await supabase
    .from("metrics")
    .select("*")
    .eq("company_id", companyId)
    .in("metric_key", [
      "mrr",
      "arr",
      "monthly_burn_rate",
      "runway_months",
      "gross_margin_pct",
      "net_dollar_retention",
    ])
    .order("period_date", { ascending: false });

  const metrics = (rawMetrics ?? []) as MetricRow[];

  // Group latest metric value per metric_key
  const latestMetrics = new Map<string, MetricRow>();
  for (const m of metrics) {
    if (!latestMetrics.has(m.metric_key)) {
      latestMetrics.set(m.metric_key, m);
    }
  }

  // Scalar values
  const mrr = latestMetrics.get("mrr")?.metric_value ?? null;
  const arrMetric = latestMetrics.get("arr")?.metric_value ?? null;
  const arr: number | null = arrMetric !== null ? arrMetric : mrr !== null ? mrr * 12 : null;
  const burnRate = latestMetrics.get("monthly_burn_rate")?.metric_value ?? null;
  const runwayMonths = latestMetrics.get("runway_months")?.metric_value ?? null;
  const grossMarginPct = latestMetrics.get("gross_margin_pct")?.metric_value ?? null;
  const ndrPct = latestMetrics.get("net_dollar_retention")?.metric_value ?? null;

  // Sparkline series (most recent values ordered ascending by period_date)
  function buildSparkline(key: string): number[] {
    return metrics
      .filter((m) => m.metric_key === key)
      .sort((a, b) => a.period_date.localeCompare(b.period_date))
      .slice(-12)
      .map((m) => m.metric_value);
  }

  const mrrSparkline = buildSparkline("mrr");
  const burnSparkline = buildSparkline("monthly_burn_rate");

  // MRR trend
  const mrrTrend = computeTrend(mrrSparkline);
  const mrrChangePct = computeChangePct(mrrSparkline);

  // Burn trend (up in burn is bad)
  const burnTrend = computeTrend(burnSparkline);
  const burnChangePct = computeChangePct(burnSparkline);

  // ─── Revenue chart data ─────────────────────────────────────────────────────

  // Fetch actual financial periods for trailing 12 months
  const now = startOfMonth(new Date());
  const twelveMonthsAgo = format(subMonths(now, 11), "yyyy-MM-dd");
  const { data: rawFinancialPeriods } = await supabase
    .from("financial_periods")
    .select("id, period_date")
    .eq("company_id", companyId)
    .eq("period_type", "actual")
    .gte("period_date", twelveMonthsAgo)
    .order("period_date", { ascending: true });

  const financialPeriods = (rawFinancialPeriods ?? []) as Pick<
    FinancialPeriodRow,
    "id" | "period_date"
  >[];

  // Fetch revenue line items for these periods
  const periodIds = financialPeriods.map((p) => p.id);

  let revenueData: RevenueDataPoint[] = [];
  let burnData: BurnDataPoint[] = [];

  if (periodIds.length > 0) {
    const { data: rawAccounts } = await supabase
      .from("accounts")
      .select("id, category, subcategory")
      .eq("company_id", companyId)
      .eq("is_active", true);

    const accounts = (rawAccounts ?? []) as Pick<
      AccountRow,
      "id" | "category" | "subcategory"
    >[];

    const revenueAccountIds = new Set(
      accounts
        .filter((a) => a.category === "revenue")
        .map((a) => a.id)
    );

    const opexAccountIds = new Set(
      accounts
        .filter((a) => a.category === "operating_expense" || a.category === "cogs")
        .map((a) => a.id)
    );

    const { data: rawLineItems } = await supabase
      .from("line_items")
      .select("period_id, account_id, amount")
      .in("period_id", periodIds);

    const lineItems = (rawLineItems ?? []) as Pick<
      LineItemRow,
      "period_id" | "account_id" | "amount"
    >[];

    // Aggregate per period
    const revenueByPeriod = new Map<string, number>();
    const opexByPeriod = new Map<string, number>();

    for (const item of lineItems) {
      const pid = item.period_id;
      if (revenueAccountIds.has(item.account_id)) {
        revenueByPeriod.set(pid, (revenueByPeriod.get(pid) ?? 0) + item.amount);
      }
      if (opexAccountIds.has(item.account_id)) {
        opexByPeriod.set(pid, (opexByPeriod.get(pid) ?? 0) + item.amount);
      }
    }

    for (const fp of financialPeriods) {
      const revenue = revenueByPeriod.get(fp.id) ?? 0;
      const opex = opexByPeriod.get(fp.id) ?? 0;

      revenueData.push({
        period: fp.period_date,
        revenue,
        mrr: revenue, // same for monthly periods
      });

      const burn = Math.max(0, opex - revenue);
      burnData.push({
        period: fp.period_date,
        burnRate: burn,
        cashBalance: 0, // cash balance not tracked in line_items for this view
      });
    }
  }

  // ─── Runway projection ──────────────────────────────────────────────────────

  const runwayData: RunwayDataPoint[] = [];
  const avgBurnRate =
    burnData.length > 0
      ? burnData.map((d) => d.burnRate).reduce((s, v) => s + v, 0) /
        burnData.length
      : (burnRate ?? 0);

  // Use stored runway data if available, otherwise use latest burn rate
  const cashForRunway = runwayMonths !== null && avgBurnRate > 0
    ? runwayMonths * avgBurnRate
    : 0;

  for (let i = 0; i < 18; i++) {
    const periodDate = addMonths(now, i);
    const label = format(periodDate, "MMM yy");
    const projected = Math.max(0, cashForRunway - avgBurnRate * i);
    runwayData.push({
      period: label,
      projected,
      optimistic: Math.max(0, projected * 1.15),
      pessimistic: Math.max(0, projected * 0.85),
      isActual: i === 0,
    });
  }

  // ─── Expense breakdown ──────────────────────────────────────────────────────

  let expenseCategories: ExpenseCategory[] = [];

  if (periodIds.length > 0) {
    const { data: rawExpenseAccounts } = await supabase
      .from("accounts")
      .select("id, name, category, subcategory")
      .eq("company_id", companyId);

    const expenseAccounts = (rawExpenseAccounts ?? []) as Pick<
      AccountRow,
      "id" | "name" | "category" | "subcategory"
    >[];

    const { data: rawRecentLineItems } = await supabase
      .from("line_items")
      .select("account_id, amount")
      .in("period_id", periodIds.slice(-3));

    const recentLineItems = (rawRecentLineItems ?? []) as Pick<
      LineItemRow,
      "account_id" | "amount"
    >[];

    const categoryTotals = new Map<string, number>();
    const accountMap = new Map(
      expenseAccounts.map((a) => [a.id, a])
    );

    for (const item of recentLineItems) {
      const account = accountMap.get(item.account_id);
      if (!account) continue;
      if (account.category !== "operating_expense" && account.category !== "cogs") continue;

      // Use subcategory if available, otherwise fall back to category
      const key = account.subcategory ?? account.category;
      categoryTotals.set(key, (categoryTotals.get(key) ?? 0) + item.amount);
    }

    const totalExpenses = Array.from(categoryTotals.values()).reduce(
      (s, v) => s + v,
      0
    );

    const CATEGORY_LABELS: Record<string, string> = {
      sales_marketing: "Sales & Marketing",
      research_development: "R&D",
      general_administrative: "G&A",
      cogs: "Cost of Revenue",
      opex: "Operating Expenses",
      other: "Other",
    };

    expenseCategories = Array.from(categoryTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key, amount]) => ({
        label: CATEGORY_LABELS[key] ?? key,
        amount,
        pct: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
      }));
  }

  // ─── Recent activity ────────────────────────────────────────────────────────

  const { data: rawAuditRows } = await supabase
    .from("audit_log")
    .select("id, action, entity_type, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(10);

  const auditRows = (rawAuditRows ?? []) as Pick<
    AuditLogRow,
    "id" | "action" | "entity_type" | "created_at"
  >[];

  function describeAuditEvent(
    row: Pick<AuditLogRow, "action" | "entity_type">
  ): string {
    const entity = row.entity_type ?? "record";
    switch (row.action) {
      case "insert":
        return `New ${entity.replace(/_/g, " ")} created`;
      case "update":
        return `${entity.replace(/_/g, " ")} updated`;
      case "delete":
        return `${entity.replace(/_/g, " ")} deleted`;
      case "export":
        return "Data exported";
      default:
        return `${row.action} on ${entity}`;
    }
  }

  const recentActivity: ActivityItem[] = auditRows.map((row) => ({
    id: row.id,
    description: describeAuditEvent(row),
    timestamp: row.created_at,
    action: row.action,
  }));

  // ─── KPI data ───────────────────────────────────────────────────────────────

  const kpiCards = [
    {
      title: "MRR",
      value: formatCurrency(mrr, company.currency),
      change: mrrChangePct,
      changeLabel: "vs last month",
      trend: mrrTrend,
      trendIsPositive: true,
      sparklineData: mrrSparkline,
    },
    {
      title: "ARR",
      value: formatCurrency(arr ?? null, company.currency),
      trend: mrrTrend,
      trendIsPositive: true,
      sparklineData: mrrSparkline.map((v) => v * 12),
    },
    {
      title: "Burn Rate",
      value: formatCurrency(burnRate, company.currency),
      change: burnChangePct,
      changeLabel: "vs last month",
      trend: burnTrend,
      trendIsPositive: false,
      sparklineData: burnSparkline,
    },
    {
      title: "Runway",
      value: formatMonths(runwayMonths),
      trend: "flat" as const,
    },
    {
      title: "Gross Margin",
      value: formatPct(grossMarginPct),
      trend: "flat" as const,
      trendIsPositive: true,
    },
    {
      title: "NDR",
      value: formatPct(ndrPct),
      trend: "flat" as const,
      trendIsPositive: true,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* KPI row */}
      <Suspense fallback={<KpiGridSkeleton count={6} />}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {kpiCards.map((kpi) => (
            <KpiCard key={kpi.title} {...kpi} />
          ))}
        </div>
      </Suspense>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Link href={`/dashboard/companies/${companyId}/financials`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <FileText className="w-4 h-4" />
            View Financials
          </Button>
        </Link>
        <Link href={`/dashboard/companies/${companyId}/metrics`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <PlusCircle className="w-4 h-4" />
            Update Metrics
          </Button>
        </Link>
        <Link href={`/dashboard/companies/${companyId}/board-deck`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Settings className="w-4 h-4" />
            Board Deck
          </Button>
        </Link>
      </div>

      {/* Charts and activity — client component */}
      <Suspense fallback={<PageSkeleton />}>
        <CompanyDashboardClient
          revenueData={revenueData}
          burnData={burnData}
          runwayData={runwayData}
          expenseCategories={expenseCategories}
          recentActivity={recentActivity}
          currency={company.currency}
        />
      </Suspense>
    </div>
  );
}
