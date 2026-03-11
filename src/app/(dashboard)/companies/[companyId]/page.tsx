import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { format, subMonths, addMonths, startOfMonth } from "date-fns";
import { Upload, FileText, Settings, PlusCircle } from "lucide-react";
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

  // Date range: trailing 12 months
  const now = startOfMonth(new Date());
  const periods: string[] = [];
  for (let i = 11; i >= 0; i--) {
    periods.push(format(subMonths(now, i), "yyyy-MM"));
  }

  // Fetch metrics for all periods
  const { data: rawMetrics } = await supabase
    .from("metrics")
    .select("*")
    .eq("company_id", companyId)
    .in("slug", [
      "mrr",
      "arr",
      "burn_rate",
      "runway_months",
      "gross_margin_pct",
      "ndr_pct",
    ])
    .order("created_at", { ascending: false });

  const metrics = (rawMetrics ?? []) as MetricRow[];

  // Group latest metric value per slug
  const latestMetrics = new Map<string, MetricRow>();
  for (const m of metrics) {
    if (!latestMetrics.has(m.slug)) {
      latestMetrics.set(m.slug, m);
    }
  }

  // Build sparklines per metric: pair metric rows to periods
  const metricsBySlugAndPeriod = new Map<string, Map<string, number>>();
  for (const m of metrics) {
    if (!metricsBySlugAndPeriod.has(m.slug)) {
      metricsBySlugAndPeriod.set(m.slug, new Map());
    }
    // Use financial_period_id as a period key — we just use order for sparkline
    metricsBySlugAndPeriod.get(m.slug)!.set(m.financial_period_id, m.value);
  }

  // Scalar values
  const mrr = latestMetrics.get("mrr")?.value ?? null;
  const arrMetric = latestMetrics.get("arr")?.value ?? null;
  const arr: number | null = arrMetric !== null ? arrMetric : mrr !== null ? mrr * 12 : null;
  const burnRate = latestMetrics.get("burn_rate")?.value ?? null;
  const runwayMonths = latestMetrics.get("runway_months")?.value ?? null;
  const grossMarginPct = latestMetrics.get("gross_margin_pct")?.value ?? null;
  const ndrPct = latestMetrics.get("ndr_pct")?.value ?? null;

  // Sparkline series (most recent values ordered ascending by created_at)
  function buildSparkline(slug: string): number[] {
    const rows = metrics
      .filter((m) => m.slug === slug)
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      .slice(-12)
      .map((m) => m.value);
    return rows;
  }

  const mrrSparkline = buildSparkline("mrr");
  const burnSparkline = buildSparkline("burn_rate");

  // MRR trend
  const mrrTrend = computeTrend(mrrSparkline);
  const mrrChangePct = computeChangePct(mrrSparkline);

  // Burn trend (up in burn is bad)
  const burnTrend = computeTrend(burnSparkline);
  const burnChangePct = computeChangePct(burnSparkline);

  // ─── Revenue chart data ─────────────────────────────────────────────────────

  // Fetch financial periods for trailing 12 months
  const twelveMonthsAgo = format(subMonths(now, 11), "yyyy-MM-dd");
  const { data: rawFinancialPeriods } = await supabase
    .from("financial_periods")
    .select("id, period_label, start_date")
    .eq("company_id", companyId)
    .eq("period_type", "monthly")
    .gte("start_date", twelveMonthsAgo)
    .order("start_date", { ascending: true });

  const financialPeriods = (rawFinancialPeriods ?? []) as Pick<
    FinancialPeriodRow,
    "id" | "period_label" | "start_date"
  >[];

  // Fetch revenue line items for these periods
  const periodIds = financialPeriods.map((p) => p.id);

  let revenueData: RevenueDataPoint[] = [];
  let burnData: BurnDataPoint[] = [];

  if (periodIds.length > 0) {
    const { data: rawAccounts } = await supabase
      .from("accounts")
      .select("id, account_type, category")
      .eq("company_id", companyId)
      .eq("is_active", true);

    const accounts = (rawAccounts ?? []) as Pick<
      AccountRow,
      "id" | "account_type" | "category"
    >[];

    const revenueAccountIds = new Set(
      accounts
        .filter((a) => a.account_type === "revenue")
        .map((a) => a.id)
    );

    const cashAccountIds = new Set(
      accounts
        .filter(
          (a) =>
            a.category === "cash" || a.account_type === "asset"
        )
        .map((a) => a.id)
    );

    const opexAccountIds = new Set(
      accounts
        .filter((a) => a.account_type === "opex" || a.account_type === "cogs")
        .map((a) => a.id)
    );

    const { data: rawLineItems } = await supabase
      .from("line_items")
      .select("financial_period_id, account_id, amount, line_item_type")
      .eq("company_id", companyId)
      .in("financial_period_id", periodIds)
      .eq("line_item_type", "actual");

    const lineItems = (rawLineItems ?? []) as Pick<
      LineItemRow,
      "financial_period_id" | "account_id" | "amount" | "line_item_type"
    >[];

    // Aggregate per period
    const revenueByPeriod = new Map<string, number>();
    const cashByPeriod = new Map<string, number>();
    const opexByPeriod = new Map<string, number>();

    for (const item of lineItems) {
      const pid = item.financial_period_id;
      if (revenueAccountIds.has(item.account_id)) {
        revenueByPeriod.set(pid, (revenueByPeriod.get(pid) ?? 0) + item.amount);
      }
      if (cashAccountIds.has(item.account_id)) {
        cashByPeriod.set(pid, (cashByPeriod.get(pid) ?? 0) + item.amount);
      }
      if (opexAccountIds.has(item.account_id)) {
        opexByPeriod.set(pid, (opexByPeriod.get(pid) ?? 0) + item.amount);
      }
    }

    for (const fp of financialPeriods) {
      const revenue = revenueByPeriod.get(fp.id) ?? 0;
      const cash = cashByPeriod.get(fp.id) ?? 0;
      const opex = opexByPeriod.get(fp.id) ?? 0;

      revenueData.push({
        period: fp.period_label,
        revenue,
        mrr: revenue, // same for monthly periods
      });

      const burnRate = Math.max(0, opex - revenue);
      burnData.push({
        period: fp.period_label,
        burnRate,
        cashBalance: cash,
      });
    }
  }

  // ─── Runway projection ──────────────────────────────────────────────────────

  const runwayData: RunwayDataPoint[] = [];
  const currentCash =
    burnData.length > 0
      ? burnData[burnData.length - 1].cashBalance
      : 0;
  const avgBurnRate =
    burnData.length > 0
      ? burnData.map((d) => d.burnRate).reduce((s, v) => s + v, 0) /
        burnData.length
      : 0;

  for (let i = 0; i < 18; i++) {
    const periodDate = addMonths(now, i);
    const label = format(periodDate, "MMM yy");
    const projected = Math.max(0, currentCash - avgBurnRate * i);
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
      .select("id, name, category, account_type")
      .eq("company_id", companyId);

    const expenseAccounts = (rawExpenseAccounts ?? []) as Pick<
      AccountRow,
      "id" | "name" | "category" | "account_type"
    >[];

    const { data: rawRecentLineItems } = await supabase
      .from("line_items")
      .select("account_id, amount")
      .eq("company_id", companyId)
      .in("financial_period_id", periodIds.slice(-3))
      .eq("line_item_type", "actual");

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
      if (
        account.account_type !== "opex" &&
        account.account_type !== "cogs"
      )
        continue;

      const key = account.category ?? account.account_type;
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
    .select("id, action, table_name, created_at, new_values")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(10);

  const auditRows = (rawAuditRows ?? []) as Pick<
    AuditLogRow,
    "id" | "action" | "table_name" | "created_at" | "new_values"
  >[];

  function describeAuditEvent(
    row: Pick<AuditLogRow, "action" | "table_name">
  ): string {
    const table = row.table_name ?? "record";
    switch (row.action) {
      case "insert":
        return `New ${table.replace(/_/g, " ")} created`;
      case "update":
        return `${table.replace(/_/g, " ")} updated`;
      case "delete":
        return `${table.replace(/_/g, " ")} deleted`;
      case "export":
        return "Data exported";
      default:
        return `${row.action} on ${table}`;
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
        <Link href={`/dashboard/companies/${companyId}/settings`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Upload className="w-4 h-4" />
            Import Data
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
