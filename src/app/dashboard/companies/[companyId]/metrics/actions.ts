"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/supabase/require-auth";
import { METRIC_DEFINITIONS } from "@/lib/constants";
import type { FinancialPeriodRow, AccountRow, LineItemRow, MetricRow } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// saveMetric
// ---------------------------------------------------------------------------

export async function saveMetric(formData: FormData) {
  const { supabase } = await requireAuth({ redirect: false });

  const companyId = formData.get("companyId") as string;
  const periodDate = formData.get("periodDate") as string;
  const metricKey = formData.get("metricKey") as string;
  const rawValue = formData.get("value") as string;

  if (!companyId || !periodDate || !metricKey || !rawValue) {
    throw new Error("Missing required fields: companyId, periodDate, metricKey, value");
  }

  const value = parseFloat(rawValue);
  if (isNaN(value)) {
    throw new Error("Value must be a valid number");
  }

  const def = METRIC_DEFINITIONS[metricKey];
  if (!def) {
    throw new Error(`Unknown metric key: ${metricKey}`);
  }

  const { error } = await supabase.from("metrics").upsert(
    {
      company_id: companyId,
      period_date: periodDate,
      metric_key: metricKey,
      metric_value: value,
      metric_unit: def.unit,
      source: "manual",
    },
    { onConflict: "company_id,period_date,metric_key" }
  );

  if (error) {
    throw new Error(`Failed to save metric: ${error.message}`);
  }

  revalidatePath(`/dashboard/companies/${companyId}/metrics`);
}

// ---------------------------------------------------------------------------
// calculateAndStoreMetrics
// ---------------------------------------------------------------------------

export async function calculateAndStoreMetrics(
  companyId: string,
  periodDate: string
) {
  const { supabase } = await requireAuth({ redirect: false });

  // Fetch the actual financial period matching the date
  const { data: periodRaw, error: periodError } = await supabase
    .from("financial_periods")
    .select("id, period_date")
    .eq("company_id", companyId)
    .eq("period_date", periodDate)
    .eq("period_type", "actual")
    .maybeSingle();

  const period = periodRaw as Pick<FinancialPeriodRow, "id" | "period_date"> | null;

  if (periodError || !period) {
    throw new Error(
      `No actual period found for ${periodDate}: ${periodError?.message ?? "not found"}`
    );
  }

  // Fetch all accounts for this company to identify categories
  const { data: accountsRaw } = await supabase
    .from("accounts")
    .select("id, category, subcategory")
    .eq("company_id", companyId);

  const accounts = (accountsRaw ?? []) as Pick<AccountRow, "id" | "category" | "subcategory">[];

  if (accounts.length === 0) return;

  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  // Fetch line items for the current period
  const { data: lineItemsRaw } = await supabase
    .from("line_items")
    .select("account_id, amount")
    .eq("period_id", period.id);

  const lineItems = (lineItemsRaw ?? []) as Pick<LineItemRow, "account_id" | "amount">[];

  if (lineItems.length === 0) return;

  // Aggregate amounts by account category
  let revenueTotal = 0;
  let cogsTotal = 0;
  let salesMarketingTotal = 0;

  for (const item of lineItems) {
    const account = accountMap.get(item.account_id);
    if (!account) continue;

    if (account.category === "revenue") {
      revenueTotal += item.amount;
    } else if (account.category === "cogs") {
      cogsTotal += item.amount;
    } else if (account.subcategory === "sales_marketing") {
      salesMarketingTotal += item.amount;
    }
  }

  const grossProfit = revenueTotal - cogsTotal;
  const grossMarginPct =
    revenueTotal > 0 ? grossProfit / revenueTotal : null;

  // Fetch existing stored metrics (to get MRR for ARR and MRR growth)
  const { data: storedMetricsRaw } = await supabase
    .from("metrics")
    .select("metric_key, metric_value")
    .eq("company_id", companyId)
    .eq("period_date", periodDate);

  const storedMetrics = (storedMetricsRaw ?? []) as Pick<MetricRow, "metric_key" | "metric_value">[];

  const mrrMetric = storedMetrics.find((m) => m.metric_key === "mrr");
  const mrr = mrrMetric?.metric_value ?? null;

  const computedMetrics: Array<{
    metric_key: string;
    metric_value: number;
    metric_unit: string | null;
  }> = [];

  if (mrr !== null) {
    computedMetrics.push({
      metric_key: "arr",
      metric_value: mrr * 12,
      metric_unit: METRIC_DEFINITIONS["arr"]?.unit ?? null,
    });
  }

  if (grossMarginPct !== null) {
    computedMetrics.push({
      metric_key: "gross_margin_pct",
      metric_value: grossMarginPct,
      metric_unit: METRIC_DEFINITIONS["gross_margin_pct"]?.unit ?? null,
    });
  }

  // Burn rate = opex - revenue (if negative ebitda)
  if (revenueTotal > 0 || cogsTotal > 0 || salesMarketingTotal > 0) {
    const burnRate = Math.max(0, cogsTotal + salesMarketingTotal - revenueTotal);
    computedMetrics.push({
      metric_key: "monthly_burn_rate",
      metric_value: burnRate,
      metric_unit: METRIC_DEFINITIONS["monthly_burn_rate"]?.unit ?? null,
    });
  }

  if (computedMetrics.length === 0) return;

  const upsertRows = computedMetrics.map(({ metric_key, metric_value, metric_unit }) => ({
    company_id: companyId,
    period_date: periodDate,
    metric_key,
    metric_value,
    metric_unit,
    source: "computed",
  }));

  const { error: upsertError } = await supabase
    .from("metrics")
    .upsert(upsertRows, { onConflict: "company_id,period_date,metric_key" });

  if (upsertError) {
    throw new Error(`Failed to store computed metrics: ${upsertError.message}`);
  }

  revalidatePath(`/dashboard/companies/${companyId}/metrics`);
}
