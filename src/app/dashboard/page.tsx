import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Building2, TrendingUp, AlertTriangle, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KpiCard } from "@/components/shared/kpi-card";
import { KpiGridSkeleton } from "@/components/shared/loading-skeleton";
import { PortfolioClient, type CompanySummary } from "./page-client";
import { RecentFiles } from "./recent-files";
import { fetchAllFiles } from "./actions";
import type { CompanyRow, MetricRow, ProfileRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

// ─── Stat bar helpers ──────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatRunway(months: number): string {
  if (months >= 24) return `${Math.round(months / 12)}y`;
  return `${Math.round(months)}mo`;
}

// ─── Data fetching ─────────────────────────────────────────────────────────────

async function buildPortfolioData(
  companies: CompanyRow[],
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<CompanySummary[]> {
  if (companies.length === 0) return [];

  const companyIds = companies.map((c) => c.id);

  // Fetch the most recent metrics for all companies in one query
  const { data: rawMetrics } = await supabase
    .from("metrics")
    .select("*")
    .in("company_id", companyIds)
    .in("metric_key", ["mrr", "arr", "burn_rate", "runway_months"])
    .order("period_date", { ascending: false });

  const metrics = (rawMetrics ?? []) as MetricRow[];

  const metricsMap = new Map<string, Record<string, number>>();
  for (const m of metrics) {
    if (!metricsMap.has(m.company_id)) {
      metricsMap.set(m.company_id, {});
    }
    const entry = metricsMap.get(m.company_id)!;
    // Only keep the first (most recent) value per metric_key per company
    if (!(m.metric_key in entry)) {
      entry[m.metric_key] = m.metric_value;
    }
  }

  return companies.map((company) => {
    const m = metricsMap.get(company.id) ?? {};
    const runwayMonths = m["runway_months"] ?? null;
    const burnRate = m["burn_rate"] ?? null;
    const needsAttention =
      (runwayMonths !== null && runwayMonths < 6) ||
      company.status === "archived";

    return {
      company,
      mrr: m["mrr"] ?? null,
      arr: m["arr"] ?? null,
      burnRate: burnRate !== undefined ? burnRate : null,
      runwayMonths: runwayMonths !== undefined ? runwayMonths : null,
      needsAttention,
    } satisfies CompanySummary;
  });
}

// ─── Stats bar ─────────────────────────────────────────────────────────────────

function PortfolioStats({ summaries }: { summaries: CompanySummary[] }) {
  const activeCount = summaries.filter(
    (s) => s.company.status === "active"
  ).length;

  const arrValues = summaries
    .filter((s) => s.arr !== null)
    .map((s) => s.arr as number);
  const totalArr = arrValues.reduce((sum, v) => sum + v, 0);

  const runwayValues = summaries
    .filter((s) => s.runwayMonths !== null)
    .map((s) => s.runwayMonths as number);
  const avgRunway =
    runwayValues.length > 0
      ? runwayValues.reduce((sum, v) => sum + v, 0) / runwayValues.length
      : null;

  const needsAttentionCount = summaries.filter((s) => s.needsAttention).length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        title="Total Companies"
        value={String(activeCount)}
        trend="flat"
      />
      <KpiCard
        title="Total ARR"
        value={totalArr > 0 ? formatCurrency(totalArr) : "—"}
        trend="flat"
        trendIsPositive
      />
      <KpiCard
        title="Avg Runway"
        value={avgRunway !== null ? formatRunway(avgRunway) : "—"}
        trend="flat"
      />
      <KpiCard
        title="Needs Attention"
        value={String(needsAttentionCount)}
        trend={needsAttentionCount > 0 ? "up" : "flat"}
        trendIsPositive={false}
      />
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function PortfolioDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: rawProfile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  const profile = rawProfile as { id: string; role: string } | null;

  if (!profile) {
    redirect("/login?error=profile_missing");
  }

  let companies: CompanyRow[] = [];

  const { data } = await supabase
    .from("companies")
    .select("*")
    .eq("owner_id", user.id)
    .order("name", { ascending: true });
  companies = (data ?? []) as CompanyRow[];

  const summaries = await buildPortfolioData(companies, supabase);
  const { files: allFiles } = await fetchAllFiles();

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Portfolio</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Overview of all your portfolio companies
          </p>
        </div>
      </div>

      {/* Stats bar */}
      {summaries.length > 0 && (
        <Suspense fallback={<KpiGridSkeleton count={4} />}>
          <PortfolioStats summaries={summaries} />
        </Suspense>
      )}

      {/* Company grid with search/sort/filter */}
      <PortfolioClient companies={summaries} />

      {/* All files across companies */}
      <RecentFiles files={allFiles} />
    </div>
  );
}
