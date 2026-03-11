import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/supabase/require-auth";
import { FindingsDashboardClient } from "@/components/diligence/findings-dashboard-client";
import { detectRedFlags, assessGoNoGo } from "@/lib/calculations/red-flags";
import type { CompanyRow, DDFindingRow, MetricRow } from "@/lib/supabase/types";
import type { DetectedFinding, RedFlagInput } from "@/lib/calculations/red-flags";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ companyId: string }>;
}

// Pull the latest value for a given metric key from the sorted metrics array
function latestMetric(
  metrics: MetricRow[],
  key: string
): number | null {
  const matches = metrics
    .filter((m) => m.metric_key === key)
    .sort((a, b) => b.period_date.localeCompare(a.period_date));
  return matches.length > 0 ? matches[0].metric_value : null;
}

export default async function FindingsPage({ params }: PageProps) {
  const { companyId } = await params;
  const { supabase } = await requireAuth();

  // Fetch company (for stage)
  const { data: companyRaw } = await supabase
    .from("companies")
    .select("id, name, stage, status")
    .eq("id", companyId)
    .single();

  const company = companyRaw as CompanyRow | null;
  if (!company) notFound();

  const companyStage = company.stage ?? "series_a";

  // Fetch stored dd_findings
  const { data: findingsRaw } = await supabase
    .from("dd_findings")
    .select("*")
    .eq("company_id", companyId)
    .order("severity", { ascending: true })
    .order("created_at", { ascending: false });

  const storedFindings = (findingsRaw ?? []) as DDFindingRow[];

  // Fetch metrics for red-flag auto-detection
  const { data: metricsRaw } = await supabase
    .from("metrics")
    .select("*")
    .eq("company_id", companyId)
    .order("period_date", { ascending: false });

  const metrics = (metricsRaw ?? []) as MetricRow[];

  // Count financial periods
  const { data: periodsRaw } = await supabase
    .from("financial_periods")
    .select("id")
    .eq("company_id", companyId)
    .eq("period_type", "actual");

  const monthlyPeriodCount = (periodsRaw ?? []).length;

  // Count metrics months (distinct period_dates)
  const metricsMonthCount = new Set(metrics.map((m) => m.period_date)).size;

  // Count accounts
  const { data: accountsRaw } = await supabase
    .from("accounts")
    .select("id")
    .eq("company_id", companyId)
    .eq("is_active", true);

  const accountCount = (accountsRaw ?? []).length;

  // Fetch total revenue and expenses from P&L to pass to red-flag engine
  // Use a simple aggregate from line_items via the existing rpc if available;
  // otherwise fall back to 0 (non-critical for detection logic)
  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), 1);
  const startDate = new Date(endDate);
  startDate.setMonth(startDate.getMonth() - 11);
  const startStr = startDate.toISOString().slice(0, 7) + "-01";
  const endStr = endDate.toISOString().slice(0, 7) + "-01";

  const { data: pnlRaw } = await supabase.rpc("get_pnl_summary", {
    p_company_id: companyId,
    p_start_date: startStr,
    p_end_date: endStr,
  });

  type PnlRow = {
    revenue: number;
    cogs: number;
    opex: number;
  };
  const pnlRows = (pnlRaw ?? []) as unknown as PnlRow[];

  const totalRevenue = pnlRows.reduce((sum, r) => sum + r.revenue, 0);
  const totalExpenses = pnlRows.reduce((sum, r) => sum + r.cogs + r.opex, 0);

  // Build input for red-flag detection
  const redFlagInput: RedFlagInput = {
    stage: companyStage,
    mrr: latestMetric(metrics, "mrr"),
    arr: latestMetric(metrics, "arr"),
    mrrGrowthRate: latestMetric(metrics, "mrr_growth_rate"),
    netDollarRetention: latestMetric(metrics, "net_dollar_retention"),
    grossRevenueRetention: latestMetric(metrics, "gross_revenue_retention"),
    ltvCacRatio: latestMetric(metrics, "ltv_cac_ratio"),
    paybackMonths: latestMetric(metrics, "payback_period_months"),
    burnMultiple: latestMetric(metrics, "burn_multiple"),
    grossMarginPct: latestMetric(metrics, "gross_margin_pct"),
    burnRate: latestMetric(metrics, "monthly_burn_rate"),
    runwayMonths: latestMetric(metrics, "runway_months"),
    totalRevenue,
    totalExpenses,
    cashBalance: 0,
    monthlyPeriodCount,
    metricsMonthCount,
    accountCount,
  };

  const detectedFindings: DetectedFinding[] = detectRedFlags(redFlagInput);

  // Combine stored + detected findings for the go/no-go gate
  const allFindingsForGate: DetectedFinding[] = [
    // Convert stored findings to DetectedFinding shape
    ...storedFindings
      .filter((f) => !f.resolved)
      .map((f) => ({
        category: f.category,
        title: f.title,
        description: f.description ?? "",
        severity: f.severity as DetectedFinding["severity"],
        impact: f.impact ?? "",
        recommendation: f.recommendation ?? "",
      })),
    ...detectedFindings,
  ];

  const goNoGo = assessGoNoGo(allFindingsForGate);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Findings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Auto-detected red flags and manually logged findings for{" "}
          <span className="font-medium">{company.name}</span>.
        </p>
      </div>

      <FindingsDashboardClient
        companyId={companyId}
        storedFindings={storedFindings}
        detectedFindings={detectedFindings}
        goNoGo={goNoGo}
        companyStage={companyStage}
      />
    </div>
  );
}
