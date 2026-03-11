import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/supabase/require-auth";
import { PeriodSelector } from "@/components/shared/period-selector";
import { MetricsDashboardClient } from "./page-client";
import {
  SAAS_BENCHMARKS,
  METRIC_DEFINITIONS,
  type FundingStage,
} from "@/lib/constants";
import type { DisplayMetric, MetricSection } from "./page-client";
import type { MetricRow } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRating(
  value: number | null,
  low: number | null,
  median: number | null,
  high: number | null,
  higherIsBetter: boolean
): DisplayMetric["rating"] {
  if (value === null || low === null || median === null || high === null) {
    return "unknown";
  }

  if (higherIsBetter) {
    if (value >= high) return "excellent";
    if (value >= median) return "good";
    if (value >= low) return "fair";
    return "poor";
  } else {
    // Lower is better (e.g. burn, churn, payback period)
    if (value <= low) return "excellent";
    if (value <= median) return "good";
    if (value <= high) return "fair";
    return "poor";
  }
}

// buildDisplayMetric is superseded by the inline makeMetric closure below.
// Retained here as a type-level utility (unused at runtime).
function _buildDisplayMetric(
  _slug: string,
  _metricsBySlug: Map<string, MetricRow[]>
): void {
  // no-op – see makeMetric in the page component
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ range?: string; granularity?: string }>;
}

export default async function MetricsPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  await searchParams; // consume to satisfy Next.js

  const { supabase } = await requireAuth();

  // Fetch company to get funding stage for benchmarks
  const { data: companyRaw } = await supabase
    .from("companies")
    .select("id, name, settings, status")
    .eq("id", companyId)
    .single();

  const company = companyRaw as import("@/lib/supabase/types").CompanyRow | null;

  if (!company) notFound();

  // Determine funding stage from company metadata JSON
  const metadata = company.metadata as Record<string, unknown> | null;
  const fundingStage: FundingStage =
    (metadata?.funding_stage as FundingStage) ?? "series_a";
  const stageBenchmarks = SAAS_BENCHMARKS[fundingStage];

  // Fetch financial periods (actual) for the period selector and dropdowns
  const { data: periodsRaw } = await supabase
    .from("financial_periods")
    .select("id, period_date, period_type")
    .eq("company_id", companyId)
    .eq("period_type", "actual")
    .order("period_date", { ascending: false })
    .limit(24);

  const periodsData = (periodsRaw ?? []) as import("@/lib/supabase/types").FinancialPeriodRow[];
  const currentPeriod = periodsData[0] ?? null;
  const currentPeriodDate = currentPeriod?.period_date ?? "";

  // Fetch all metrics for this company (last 24 months)
  const { data: metricsRaw } = await supabase
    .from("metrics")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  const metricsData = (metricsRaw ?? []) as MetricRow[];

  // Group metrics by metric_key
  const metricsByKey = new Map<string, MetricRow[]>();
  for (const m of metricsData) {
    const existing = metricsByKey.get(m.metric_key) ?? [];
    existing.push(m);
    metricsByKey.set(m.metric_key, existing);
  }

  // Build display metrics per section
  type BenchmarkKey = keyof typeof stageBenchmarks;

  function makeMetric(
    slug: string,
    benchmarkKey: BenchmarkKey | null
  ): DisplayMetric | null {
    const def = METRIC_DEFINITIONS[slug];
    if (!def) return null;

    const allValues = metricsByKey.get(slug) ?? [];
    const currentMetric =
      allValues.find((m) => m.period_date === currentPeriodDate) ?? null;

    const sparklineData = allValues
      .slice()
      .sort((a, b) => a.period_date.localeCompare(b.period_date))
      .map((m) => m.metric_value);

    const currentValue = currentMetric?.metric_value ?? null;
    const previousValue =
      sparklineData.length >= 2
        ? sparklineData[sparklineData.length - 2]
        : null;

    const bRange = benchmarkKey ? stageBenchmarks[benchmarkKey] : null;

    return {
      slug,
      definition: def,
      currentValue,
      previousValue,
      sparklineData,
      benchmarkLow: bRange?.low ?? null,
      benchmarkMedian: bRange?.median ?? null,
      benchmarkHigh: bRange?.high ?? null,
      rating: getRating(
        currentValue,
        bRange?.low ?? null,
        bRange?.median ?? null,
        bRange?.high ?? null,
        def.higherIsBetter
      ),
    };
  }

  const sections: MetricSection[] = [
    {
      title: "Revenue",
      metrics: [
        makeMetric("mrr", null),
        makeMetric("arr", null),
        makeMetric("mrr_growth_rate", "mrr_growth_mom"),
        makeMetric("revenue_per_employee", null),
      ].filter(Boolean) as DisplayMetric[],
    },
    {
      title: "Retention",
      metrics: [
        makeMetric("gross_revenue_retention", "gross_revenue_retention"),
        makeMetric("net_dollar_retention", "net_dollar_retention"),
        makeMetric("logo_churn_rate", null),
        makeMetric("revenue_churn_rate", null),
      ].filter(Boolean) as DisplayMetric[],
    },
    {
      title: "Unit Economics",
      metrics: [
        makeMetric("cac", null),
        makeMetric("ltv", null),
        makeMetric("ltv_cac_ratio", "ltv_cac_ratio"),
        makeMetric("payback_period_months", "cac_payback_months"),
      ].filter(Boolean) as DisplayMetric[],
    },
    {
      title: "Efficiency",
      metrics: [
        makeMetric("burn_multiple", "burn_multiple"),
        makeMetric("rule_of_40", "rule_of_40"),
        makeMetric("magic_number", "magic_number"),
        makeMetric("gross_margin_pct", "gross_margin"),
      ].filter(Boolean) as DisplayMetric[],
    },
    {
      title: "Cash",
      metrics: [
        makeMetric("monthly_burn_rate", null),
        makeMetric("cash_balance", null),
        makeMetric("runway_months", null),
        makeMetric("implied_runway_growth", null),
      ].filter(Boolean) as DisplayMetric[],
    },
  ];

  // Manual entry is appropriate for metrics not derived from line items
  const manualEntryMetrics = [
    METRIC_DEFINITIONS.mrr,
    METRIC_DEFINITIONS.net_dollar_retention,
    METRIC_DEFINITIONS.gross_revenue_retention,
    METRIC_DEFINITIONS.logo_churn_rate,
    METRIC_DEFINITIONS.revenue_churn_rate,
    METRIC_DEFINITIONS.cac,
    METRIC_DEFINITIONS.ltv,
    METRIC_DEFINITIONS.ltv_cac_ratio,
    METRIC_DEFINITIONS.payback_period_months,
    METRIC_DEFINITIONS.monthly_burn_rate,
    METRIC_DEFINITIONS.runway_months,
  ].filter(Boolean);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">SaaS Metrics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Key performance indicators benchmarked against{" "}
            <span className="font-medium capitalize">
              {fundingStage.replace("_", " ")}
            </span>{" "}
            stage companies.
          </p>
        </div>
        <PeriodSelector />
      </div>

      <MetricsDashboardClient
        sections={sections}
        companyId={companyId}
        periods={periodsData}
        currentPeriodId={currentPeriodDate}
        manualEntryMetrics={manualEntryMetrics}
      />
    </div>
  );
}

export const dynamic = "force-dynamic";
