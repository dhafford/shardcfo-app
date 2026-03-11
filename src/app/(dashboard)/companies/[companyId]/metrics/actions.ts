"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { METRIC_DEFINITIONS } from "@/lib/constants";
import type { MetricCategory } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// saveMetric
// ---------------------------------------------------------------------------

/**
 * Saves a manually entered metric value for a given company and period.
 * Upserts based on (company_id, financial_period_id, slug).
 */
export async function saveMetric(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const companyId = formData.get("companyId") as string;
  const periodId = formData.get("periodId") as string;
  const slug = formData.get("slug") as string;
  const rawValue = formData.get("value") as string;

  if (!companyId || !periodId || !slug || !rawValue) {
    throw new Error("Missing required fields: companyId, periodId, slug, value");
  }

  const value = parseFloat(rawValue);
  if (isNaN(value)) {
    throw new Error("Value must be a valid number");
  }

  const def = METRIC_DEFINITIONS[slug];
  if (!def) {
    throw new Error(`Unknown metric slug: ${slug}`);
  }

  const categoryMap: Record<string, MetricCategory> = {
    mrr: "growth",
    arr: "growth",
    mrr_growth_rate: "growth",
    net_dollar_retention: "retention",
    gross_revenue_retention: "retention",
    logo_churn_rate: "retention",
    revenue_churn_rate: "retention",
    cac: "sales",
    ltv: "sales",
    ltv_cac_ratio: "sales",
    payback_period_months: "sales",
    burn_multiple: "efficiency",
    rule_of_40: "efficiency",
    magic_number: "efficiency",
    gross_margin_pct: "profitability",
    monthly_burn_rate: "efficiency",
    runway_months: "efficiency",
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("metrics") as any).upsert(
    {
      company_id: companyId,
      financial_period_id: periodId,
      name: def.label,
      slug,
      value,
      unit: def.unit,
      category: categoryMap[slug] ?? "other",
      is_computed: false,
      scenario_id: null,
    },
    { onConflict: "company_id,financial_period_id,slug" }
  );

  if (error) {
    throw new Error(`Failed to save metric: ${error.message}`);
  }

  revalidatePath(
    `/dashboard/companies/${companyId}/metrics`
  );
}

// ---------------------------------------------------------------------------
// calculateAndStoreMetrics
// ---------------------------------------------------------------------------

/**
 * Derives computable SaaS metrics from line items in the financial data and
 * upserts them into the metrics table for the given company and period.
 *
 * This function is designed to be called server-side after new financial data
 * is imported or updated.
 */
export async function calculateAndStoreMetrics(
  companyId: string,
  periodDate: string
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch the financial period matching the date
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: periodRaw, error: periodError } = await (supabase as any)
    .from("financial_periods")
    .select("id, start_date, end_date, period_label")
    .eq("company_id", companyId)
    .lte("start_date", periodDate)
    .gte("end_date", periodDate)
    .eq("period_type", "monthly")
    .single();

  const period = periodRaw as Pick<
    import("@/lib/supabase/types").FinancialPeriodRow,
    "id" | "start_date" | "end_date" | "period_label"
  > | null;

  if (periodError || !period) {
    throw new Error(
      `No monthly period found for ${periodDate}: ${periodError?.message ?? "not found"}`
    );
  }

  // Fetch all accounts for this company to identify categories
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: accountsRaw } = await (supabase as any)
    .from("accounts")
    .select("id, category, account_type")
    .eq("company_id", companyId);

  const accounts = (accountsRaw ?? []) as Pick<
    import("@/lib/supabase/types").AccountRow,
    "id" | "category" | "account_type"
  >[];

  if (accounts.length === 0) return;

  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  // Fetch line items for the current period
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lineItemsRaw } = await (supabase as any)
    .from("line_items")
    .select("account_id, amount, line_item_type")
    .eq("company_id", companyId)
    .eq("financial_period_id", period.id)
    .eq("line_item_type", "actual")
    .is("scenario_id", null);

  const lineItems = (lineItemsRaw ?? []) as Pick<
    import("@/lib/supabase/types").LineItemRow,
    "account_id" | "amount" | "line_item_type"
  >[];

  if (lineItems.length === 0) return;

  // Aggregate amounts by account category
  let revenueTotal = 0;
  let cogsTotal = 0;
  let salesMarketingTotal = 0;

  for (const item of lineItems) {
    const account = accountMap.get(item.account_id);
    if (!account) continue;

    if (account.account_type === "revenue") {
      revenueTotal += item.amount;
    } else if (account.account_type === "cogs") {
      cogsTotal += item.amount;
    } else if (account.category === "sales_marketing") {
      salesMarketingTotal += item.amount;
    }
  }

  const grossProfit = revenueTotal - cogsTotal;
  const grossMarginPct =
    revenueTotal > 0 ? grossProfit / revenueTotal : null;

  // Fetch existing stored metrics (to get MRR for ARR and MRR growth)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: storedMetricsRaw } = await (supabase as any)
    .from("metrics")
    .select("slug, value")
    .eq("company_id", companyId)
    .eq("financial_period_id", period.id)
    .is("scenario_id", null);

  const storedMetrics = (storedMetricsRaw ?? []) as Pick<
    import("@/lib/supabase/types").MetricRow,
    "slug" | "value"
  >[];

  const mrrMetric = storedMetrics.find((m) => m.slug === "mrr");
  const mrr = mrrMetric?.value ?? null;

  const computedMetrics: Array<{
    slug: string;
    value: number;
    category: MetricCategory;
  }> = [];

  if (mrr !== null) {
    computedMetrics.push({ slug: "arr", value: mrr * 12, category: "growth" });
  }

  if (grossMarginPct !== null) {
    computedMetrics.push({
      slug: "gross_margin_pct",
      value: grossMarginPct,
      category: "profitability",
    });
  }

  // Burn rate = opex - revenue (if negative ebitda)
  if (revenueTotal > 0 || cogsTotal > 0 || salesMarketingTotal > 0) {
    const burnRate = Math.max(0, cogsTotal + salesMarketingTotal - revenueTotal);
    computedMetrics.push({
      slug: "monthly_burn_rate",
      value: burnRate,
      category: "efficiency",
    });
  }

  if (computedMetrics.length === 0) return;

  const upsertRows = computedMetrics.map(({ slug, value, category }) => {
    const def = METRIC_DEFINITIONS[slug];
    return {
      company_id: companyId,
      financial_period_id: period.id,
      name: def?.label ?? slug,
      slug,
      value,
      unit: def?.unit ?? null,
      category,
      is_computed: true,
      scenario_id: null,
    };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: upsertError } = await (supabase as any)
    .from("metrics")
    .upsert(upsertRows, { onConflict: "company_id,financial_period_id,slug" });

  if (upsertError) {
    throw new Error(`Failed to store computed metrics: ${upsertError.message}`);
  }

  revalidatePath(`/dashboard/companies/${companyId}/metrics`);
}
