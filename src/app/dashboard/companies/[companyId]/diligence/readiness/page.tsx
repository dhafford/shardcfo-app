import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/supabase/require-auth";
import {
  READINESS_ITEMS,
  autoDetectStatuses,
} from "@/lib/calculations/readiness";
import type {
  ScoredReadinessItem,
  ReadinessStatus,
} from "@/lib/calculations/readiness";
import { ReadinessScorecard } from "@/components/diligence/readiness-scorecard";
import type { CompanyRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export default async function ReadinessPage({ params }: PageProps) {
  const { companyId } = await params;
  const { supabase } = await requireAuth();

  const { data: rawCompany } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();

  if (!rawCompany) notFound();
  const company = rawCompany as CompanyRow;

  // ─── Fetch auto-detect data ───────────────────────────────────────────────

  // Count financial_periods with period_type = 'actual'
  const { count: monthlyPeriodCount } = await supabase
    .from("financial_periods")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("period_type", "actual");

  // Fetch accounts to detect chart of accounts structure
  const { data: rawAccounts } = await supabase
    .from("accounts")
    .select("id, category")
    .eq("company_id", companyId)
    .eq("is_active", true);

  const accounts = (rawAccounts ?? []) as { id: string; category: string }[];
  const accountCategories = new Set(accounts.map((a) => a.category));

  // Count scenarios
  const { count: scenarioCount } = await supabase
    .from("scenarios")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);

  // Count distinct period_dates in metrics
  const { data: rawMetricPeriods } = await supabase
    .from("metrics")
    .select("period_date")
    .eq("company_id", companyId);

  const distinctMetricPeriods = new Set(
    (rawMetricPeriods ?? []).map((m: { period_date: string }) => m.period_date)
  );

  // Count board decks
  const { count: boardDeckCount } = await supabase
    .from("board_decks")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);

  // Fetch latest saved assessment to pre-populate manual statuses
  const { data: latestAssessmentRaw } = await supabase
    .from("dd_assessments")
    .select("overall_score, stage, items")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestAssessment = latestAssessmentRaw as {
    overall_score: number;
    stage: string;
    items: Record<string, { status: ReadinessStatus; notes: string }> | null;
  } | null;

  // ─── Build auto-detect statuses ──────────────────────────────────────────

  const hasAnyFinancials =
    (monthlyPeriodCount ?? 0) > 0 || accounts.length > 0;

  const autoStatuses = autoDetectStatuses({
    monthlyPeriodCount: monthlyPeriodCount ?? 0,
    accountCount: accounts.length,
    hasRevenueAccounts: accountCategories.has("revenue"),
    hasCOGSAccounts: accountCategories.has("cogs"),
    hasOpexAccounts: accountCategories.has("operating_expense"),
    scenarioCount: scenarioCount ?? 0,
    metricsMonthCount: distinctMetricPeriods.size,
    boardDeckCount: boardDeckCount ?? 0,
    hasAnyFinancials,
  });

  // ─── Build scored items ──────────────────────────────────────────────────

  // Previously saved statuses (keyed by item id)
  const savedStatuses: Record<string, { status: ReadinessStatus; notes: string }> =
    latestAssessment?.items ?? {};

  const stage = company.stage ?? "series_a";

  const scoredItems: ScoredReadinessItem[] = READINESS_ITEMS.map((item) => {
    // Auto-detectable items: derive status from auto-detection
    let status: ReadinessStatus = "fail";

    if (item.autoDetectable && item.autoDetectKey) {
      status = autoStatuses[item.autoDetectKey] ?? "fail";
    } else if (savedStatuses[item.id]) {
      // Use previously saved manual status
      status = savedStatuses[item.id].status;
    }

    return {
      ...item,
      status,
      notes: savedStatuses[item.id]?.notes ?? "",
    };
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Readiness Assessment</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          25-point gate check for{" "}
          {stage === "seed"
            ? "Seed"
            : stage === "series_a"
              ? "Series A"
              : stage === "series_b"
                ? "Series B"
                : stage === "series_c"
                  ? "Series C"
                  : "Growth"}{" "}
          stage fundraising diligence readiness.
        </p>
      </div>

      <ReadinessScorecard
        items={scoredItems}
        autoStatuses={autoStatuses}
        stage={stage}
        companyId={companyId}
      />
    </div>
  );
}
