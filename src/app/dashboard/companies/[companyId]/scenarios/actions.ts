"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/supabase/require-auth";
import {
  projectScenario,
  type BasePeriodActuals,
  type ScenarioAssumptions,
  type HirePlan,
  type FundraisingEvent,
} from "@/lib/calculations/scenario-engine";
import type { Json } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// createScenario
// ---------------------------------------------------------------------------

export async function createScenario(formData: FormData) {
  const { supabase } = await requireAuth({ redirect: false });

  const companyId = formData.get("companyId") as string;
  const name = formData.get("name") as string;
  const description = (formData.get("description") as string) || null;

  if (!companyId || !name) {
    throw new Error("companyId and name are required");
  }

  // Use today's date as the base_period_date (YYYY-MM-DD)
  const today = new Date();
  const basePeriodDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;

  const defaultAssumptions: ScenarioAssumptions = {
    mrrGrowthRate: 0.1,
    cogsPercentage: 0.3,
    otherOpexGrowthRate: 0.02,
    hirePlan: [],
    fundraisingEvents: [],
    projectionMonths: 12,
  };

  const { data, error } = await supabase
    .from("scenarios")
    .insert({
      company_id: companyId,
      name,
      description,
      base_period_date: basePeriodDate,
      is_active: true,
      assumptions: defaultAssumptions as unknown as Json,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create scenario: ${error?.message ?? "unknown error"}`);
  }

  revalidatePath(`/dashboard/companies/${companyId}/scenarios`);
  redirect(`/dashboard/companies/${companyId}/scenarios/${data.id}`);
}

// ---------------------------------------------------------------------------
// updateScenario
// ---------------------------------------------------------------------------

export async function updateScenario(formData: FormData) {
  const { supabase } = await requireAuth({ redirect: false });

  const companyId = formData.get("companyId") as string;
  const scenarioId = formData.get("scenarioId") as string;
  const name = formData.get("name") as string | null;
  const description = formData.get("description") as string | null;
  const assumptionsJson = formData.get("assumptions") as string | null;

  if (!companyId || !scenarioId) {
    throw new Error("companyId and scenarioId are required");
  }

  const updates: Record<string, unknown> = {};
  if (name) updates.name = name;
  if (description !== null) updates.description = description;
  if (assumptionsJson) {
    try {
      updates.assumptions = JSON.parse(assumptionsJson);
    } catch {
      throw new Error("Invalid assumptions JSON");
    }
  }

  const { error } = await supabase
    .from("scenarios")
    .update(updates)
    .eq("id", scenarioId)
    .eq("company_id", companyId);

  if (error) {
    throw new Error(`Failed to update scenario: ${error.message}`);
  }

  revalidatePath(`/dashboard/companies/${companyId}/scenarios`);
  revalidatePath(`/dashboard/companies/${companyId}/scenarios/${scenarioId}`);
}

// ---------------------------------------------------------------------------
// deleteScenario
// ---------------------------------------------------------------------------

export async function deleteScenario(formData: FormData) {
  const { supabase } = await requireAuth({ redirect: false });

  const companyId = formData.get("companyId") as string;
  const scenarioId = formData.get("scenarioId") as string;

  if (!companyId || !scenarioId) {
    throw new Error("companyId and scenarioId are required");
  }

  const { error } = await supabase
    .from("scenarios")
    .delete()
    .eq("id", scenarioId)
    .eq("company_id", companyId);

  if (error) {
    throw new Error(`Failed to delete scenario: ${error.message}`);
  }

  revalidatePath(`/dashboard/companies/${companyId}/scenarios`);
  redirect(`/dashboard/companies/${companyId}/scenarios`);
}

// ---------------------------------------------------------------------------
// runScenarioProjection
// ---------------------------------------------------------------------------

export async function runScenarioProjection(
  companyId: string,
  scenarioId: string
): Promise<string> {
  const { supabase } = await requireAuth({ redirect: false });

  // Fetch the scenario
  const { data: scenarioRaw, error: scenarioError } = await supabase
    .from("scenarios")
    .select("*")
    .eq("id", scenarioId)
    .eq("company_id", companyId)
    .single();

  const scenario = scenarioRaw as import("@/lib/supabase/types").ScenarioRow | null;

  if (scenarioError || !scenario) {
    throw new Error(`Scenario not found: ${scenarioError?.message ?? "unknown"}`);
  }

  // Fetch the most recent actual financial period
  const { data: latestPeriodRaw } = await supabase
    .from("financial_periods")
    .select("id, period_date")
    .eq("company_id", companyId)
    .eq("period_type", "actual")
    .order("period_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestPeriod = latestPeriodRaw as Pick<
    import("@/lib/supabase/types").FinancialPeriodRow,
    "id" | "period_date"
  > | null;

  if (!latestPeriod) {
    throw new Error("No actual financial periods found. Import data first.");
  }

  // Fetch line items for the base period (using period_id, the actual FK)
  const { data: lineItemsRaw } = await supabase
    .from("line_items")
    .select("account_id, amount")
    .eq("period_id", latestPeriod.id);

  const lineItems = (lineItemsRaw ?? []) as Pick<
    import("@/lib/supabase/types").LineItemRow,
    "account_id" | "amount"
  >[];

  // Fetch accounts for categorization (category is the top-level type now)
  const { data: accountsRaw } = await supabase
    .from("accounts")
    .select("id, category, subcategory")
    .eq("company_id", companyId);

  const accounts = (accountsRaw ?? []) as Pick<
    import("@/lib/supabase/types").AccountRow,
    "id" | "category" | "subcategory"
  >[];

  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  let revenue = 0;
  let cogs = 0;
  let payrollExpense = 0;
  let otherOpex = 0;

  for (const item of lineItems ?? []) {
    const account = accountMap.get(item.account_id);
    if (!account) continue;

    if (account.category === "revenue") {
      revenue += item.amount;
    } else if (account.category === "cogs") {
      cogs += item.amount;
    } else if (account.subcategory === "general_administrative") {
      payrollExpense += item.amount;
    } else if (account.category === "operating_expense") {
      otherOpex += item.amount;
    }
  }

  // Fetch MRR and cash balance from stored metrics
  const { data: metricsRaw } = await supabase
    .from("metrics")
    .select("metric_key, metric_value")
    .eq("company_id", companyId)
    .eq("period_date", latestPeriod.period_date)
    .in("metric_key", ["mrr", "monthly_burn_rate", "cash_balance", "runway_months"]);

  const metricsArr = (metricsRaw ?? []) as Pick<
    import("@/lib/supabase/types").MetricRow,
    "metric_key" | "metric_value"
  >[];
  const metricMap = new Map(metricsArr.map((m) => [m.metric_key, m.metric_value]));
  const mrr = metricMap.get("mrr") ?? revenue;
  const cashBalance = metricMap.get("cash_balance") ?? 0;

  // Format base period as YYYY-MM
  const basePeriod = latestPeriod.period_date.substring(0, 7);

  const actuals: BasePeriodActuals = {
    period: basePeriod,
    mrr,
    revenue,
    cogs,
    payrollExpense,
    headcount: 10, // fallback; should come from HR data
    otherOpex,
    cashBalance,
  };

  // Parse assumptions from the scenario's JSONB field
  const raw = scenario.assumptions as Record<string, unknown> | null;
  const assumptions: ScenarioAssumptions = {
    mrrGrowthRate:
      typeof raw?.mrrGrowthRate === "number" ? raw.mrrGrowthRate : 0.1,
    cogsPercentage:
      typeof raw?.cogsPercentage === "number" ? raw.cogsPercentage : undefined,
    otherOpexGrowthRate:
      typeof raw?.otherOpexGrowthRate === "number"
        ? raw.otherOpexGrowthRate
        : 0.02,
    hirePlan: Array.isArray(raw?.hirePlan)
      ? (raw.hirePlan as HirePlan[])
      : [],
    fundraisingEvents: Array.isArray(raw?.fundraisingEvents)
      ? (raw.fundraisingEvents as FundraisingEvent[])
      : [],
    projectionMonths:
      typeof raw?.projectionMonths === "number" ? raw.projectionMonths : 12,
    employerBurdenRate:
      typeof raw?.employerBurdenRate === "number"
        ? raw.employerBurdenRate
        : 0.15,
  };

  const projection = projectScenario(actuals, assumptions, scenario.name);

  return JSON.stringify(projection);
}
