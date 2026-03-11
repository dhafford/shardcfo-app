import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FDDReportClient } from "@/components/diligence/fdd-report-client";
import { detectRedFlags, assessGoNoGo } from "@/lib/calculations/red-flags";
import type { CompanyRow, DDFindingRow, QoEAdjustmentRow, MetricRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ companyId: string }>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Returns the ISO date string for N months ago from today. */
function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function FDDReportPage({ params }: PageProps) {
  const { companyId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ─── Company ──────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: companyRaw } = await (supabase as any)
    .from("companies")
    .select("id, name, industry, stage, status")
    .eq("id", companyId)
    .single();

  const company = companyRaw as CompanyRow | null;
  if (!company) notFound();

  // ─── Parallel data fetches ────────────────────────────────────────────────

  const trailingStart = monthsAgo(12);
  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: latestAssessmentRaw },
    { data: findingsRaw },
    { data: qoeRaw },
    { data: metricsRaw },
    { data: pnlRaw, error: pnlError },
    { count: monthlyPeriodCount },
    { count: accountCount },
  ] = await Promise.all([
    // Latest dd_assessment
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("dd_assessments")
      .select("overall_score, stage")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    // All dd_findings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("dd_findings")
      .select("*")
      .eq("company_id", companyId)
      .order("severity", { ascending: true })
      .order("created_at", { ascending: false }),

    // All qoe_adjustments
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("qoe_adjustments")
      .select("*")
      .eq("company_id", companyId)
      .order("period_date", { ascending: false }),

    // Latest metrics — one row per metric_key, most recent period_date
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("metrics")
      .select("metric_key, metric_value, period_date")
      .eq("company_id", companyId)
      .order("period_date", { ascending: false })
      .limit(200),

    // P&L trailing 12 months via RPC
    (supabase as any).rpc("get_pnl_summary", {
      p_company_id: companyId,
      p_start_date: trailingStart,
      p_end_date: today,
    }),

    // Monthly period count for red-flag detection
    supabase
      .from("financial_periods")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("period_type", "actual"),

    // Account count for red-flag detection
    supabase
      .from("accounts")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("is_active", true),
  ]);

  // ─── Type-cast raw data ───────────────────────────────────────────────────

  const latestAssessment = latestAssessmentRaw as {
    overall_score: number;
    stage: string;
  } | null;

  const findings = (findingsRaw ?? []) as DDFindingRow[];
  const qoeAdjustments = (qoeRaw ?? []) as QoEAdjustmentRow[];
  const metricsRows = (metricsRaw ?? []) as Pick<MetricRow, "metric_key" | "metric_value" | "period_date">[];

  // ─── Build metrics map — latest value per key ─────────────────────────────

  const metricsMap: Record<string, number | null> = {};
  for (const row of metricsRows) {
    // Since rows are ordered by period_date DESC, first occurrence wins
    if (!(row.metric_key in metricsMap)) {
      metricsMap[row.metric_key] = row.metric_value ?? null;
    }
  }

  // ─── Build P&L data ───────────────────────────────────────────────────────

  type PnlRow = {
    period: string;
    revenue: number;
    cogs: number;
    opex: number;
    ebitda: number;
    net_income: number;
  };

  const pnlData = pnlError
    ? []
    : ((pnlRaw ?? []) as PnlRow[]).map((r) => ({
        period: r.period,
        revenue: r.revenue ?? 0,
        cogs: r.cogs ?? 0,
        opex: r.opex ?? 0,
        ebitda: r.ebitda ?? 0,
        netIncome: r.net_income ?? 0,
      }));

  // ─── Derived counts for red-flag detection ────────────────────────────────

  const distinctMetricPeriods = new Set(metricsRows.map((m) => m.period_date)).size;

  // Total revenue & expenses from P&L data
  const totalRevenue = pnlData.reduce((sum, r) => sum + r.revenue, 0);
  const totalExpenses = pnlData.reduce((sum, r) => sum + r.cogs + r.opex, 0);

  // ─── Detect automated red flags ──────────────────────────────────────────

  const stage = company.stage ?? "series_a";

  const detectedFindings = detectRedFlags({
    stage,
    mrr: metricsMap["mrr"] ?? null,
    arr: metricsMap["arr"] ?? null,
    mrrGrowthRate: metricsMap["mrr_growth_rate"] ?? null,
    netDollarRetention: metricsMap["net_dollar_retention"] ?? null,
    grossRevenueRetention: metricsMap["gross_revenue_retention"] ?? null,
    ltvCacRatio: metricsMap["ltv_cac_ratio"] ?? null,
    paybackMonths: metricsMap["payback_period_months"] ?? null,
    burnMultiple: metricsMap["burn_multiple"] ?? null,
    grossMarginPct: metricsMap["gross_margin_pct"] ?? null,
    burnRate: metricsMap["monthly_burn_rate"] ?? metricsMap["burn_rate"] ?? null,
    runwayMonths: metricsMap["runway_months"] ?? null,
    totalRevenue,
    totalExpenses,
    cashBalance: 0,
    monthlyPeriodCount: monthlyPeriodCount ?? 0,
    metricsMonthCount: distinctMetricPeriods,
    accountCount: accountCount ?? 0,
  });

  // ─── Go/No-Go assessment ──────────────────────────────────────────────────

  // Combine manual findings + detected findings for the assessment
  const allFindingsForAssessment = [
    ...findings.filter((f) => !f.resolved).map((f) => ({
      category: f.category,
      title: f.title,
      description: f.description ?? "",
      severity: f.severity,
      impact: f.impact ?? "",
      recommendation: f.recommendation ?? "",
    })),
    ...detectedFindings,
  ];

  const goNoGoRaw = assessGoNoGo(allFindingsForAssessment);

  const goNoGoResult = {
    recommendation:
      goNoGoRaw.recommendation === "proceed"
        ? "Proceed"
        : goNoGoRaw.recommendation === "proceed_with_conditions"
          ? "Proceed with Conditions"
          : "Do Not Proceed",
    riskRating:
      goNoGoRaw.riskRating === "low"
        ? "Low"
        : goNoGoRaw.riskRating === "medium"
          ? "Medium"
          : "High",
    criticalCount: goNoGoRaw.criticalCount,
    significantCount: goNoGoRaw.significantCount,
    moderateCount: goNoGoRaw.moderateCount,
    observationCount: goNoGoRaw.observationCount,
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold">FDD Report</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Financial Due Diligence report for {company.name}
        </p>
      </div>

      <FDDReportClient
        companyId={companyId}
        company={{
          name: company.name,
          industry: company.industry ?? null,
          stage: company.stage ?? null,
        }}
        readinessScore={latestAssessment?.overall_score ?? null}
        findings={findings}
        detectedFindings={detectedFindings}
        qoeAdjustments={qoeAdjustments}
        metrics={metricsMap}
        pnlData={pnlData}
        goNoGoResult={goNoGoResult}
      />
    </div>
  );
}
