"use server";

import { createClient } from "@/lib/supabase/server";
import { type HistoricalYear } from "@/lib/projections/types";

/**
 * Fetch historical annual financial data for the projection model.
 * Aggregates monthly line items into fiscal years, grouped by account category.
 */
export async function fetchHistoricals(companyId: string): Promise<{
  historicals: HistoricalYear[];
  error?: string;
}> {
  const supabase = await createClient();

  // Get accounts for this company
  const { data: accounts, error: accErr } = await (supabase as any)
    .from("accounts")
    .select("id, name, category, subcategory")
    .eq("company_id", companyId)
    .eq("is_active", true);

  if (accErr || !accounts) {
    return { historicals: [], error: accErr?.message || "Failed to load accounts" };
  }

  const accountMap = new Map<string, { name: string; category: string; subcategory: string | null }>();
  for (const acc of accounts as { id: string; name: string; category: string; subcategory: string | null }[]) {
    accountMap.set(acc.id, { name: acc.name, category: acc.category, subcategory: acc.subcategory });
  }

  // Get actual periods
  const { data: periods, error: perErr } = await (supabase as any)
    .from("financial_periods")
    .select("id, period_date")
    .eq("company_id", companyId)
    .eq("period_type", "actual")
    .order("period_date", { ascending: true });

  if (perErr || !periods) {
    return { historicals: [], error: perErr?.message || "Failed to load periods" };
  }

  if ((periods as { id: string; period_date: string }[]).length === 0) {
    return { historicals: [] };
  }

  const periodIds = (periods as { id: string; period_date: string }[]).map((p) => p.id);

  // Get all line items for these periods
  const { data: lineItems, error: liErr } = await (supabase as any)
    .from("line_items")
    .select("period_id, account_id, amount")
    .in("period_id", periodIds);

  if (liErr || !lineItems) {
    return { historicals: [], error: liErr?.message || "Failed to load line items" };
  }

  // Map period_id → year
  const periodToYear = new Map<string, number>();
  for (const p of periods as { id: string; period_date: string }[]) {
    const yr = new Date(p.period_date).getFullYear();
    periodToYear.set(p.id, yr);
  }

  // Aggregate by year
  const yearData = new Map<number, {
    revenue: number;
    revenueByStream: Record<string, number>;
    cogs: number;
    rdExpense: number;
    smExpense: number;
    gaExpense: number;
    otherIncome: number;
    otherExpense: number;
  }>();

  for (const li of lineItems as { period_id: string; account_id: string; amount: number }[]) {
    const yr = periodToYear.get(li.period_id);
    if (!yr) continue;
    const acc = accountMap.get(li.account_id);
    if (!acc) continue;
    const amount = Number(li.amount) || 0;

    if (!yearData.has(yr)) {
      yearData.set(yr, {
        revenue: 0, revenueByStream: {},
        cogs: 0, rdExpense: 0, smExpense: 0, gaExpense: 0,
        otherIncome: 0, otherExpense: 0,
      });
    }
    const yd = yearData.get(yr)!;

    switch (acc.category) {
      case "revenue":
        yd.revenue += amount;
        yd.revenueByStream[acc.name] = (yd.revenueByStream[acc.name] || 0) + amount;
        break;
      case "cogs":
        yd.cogs += Math.abs(amount);
        break;
      case "operating_expense":
        // Route to R&D/S&M/G&A based on subcategory or account name
        if (isRD(acc.name, acc.subcategory)) {
          yd.rdExpense += Math.abs(amount);
        } else if (isSM(acc.name, acc.subcategory)) {
          yd.smExpense += Math.abs(amount);
        } else {
          yd.gaExpense += Math.abs(amount);
        }
        break;
      case "other_income":
        yd.otherIncome += amount;
        break;
      case "other_expense":
        yd.otherExpense += Math.abs(amount);
        break;
    }
  }

  // Build result
  const historicals: HistoricalYear[] = [];
  const years = Array.from(yearData.keys()).sort();

  for (const yr of years) {
    const yd = yearData.get(yr)!;
    const grossProfit = yd.revenue - yd.cogs;
    const totalOpex = yd.rdExpense + yd.smExpense + yd.gaExpense;
    const operatingIncome = grossProfit - totalOpex;
    const netIncome = operatingIncome + yd.otherIncome - yd.otherExpense;

    historicals.push({
      label: `FY ${yr}A`,
      year: yr,
      revenue: yd.revenue,
      revenueByStream: yd.revenueByStream,
      cogs: yd.cogs,
      rdExpense: yd.rdExpense,
      smExpense: yd.smExpense,
      gaExpense: yd.gaExpense,
      otherIncome: yd.otherIncome,
      otherExpense: yd.otherExpense,
      grossProfit,
      totalOpex,
      operatingIncome,
      netIncome,
      ebitda: operatingIncome, // simplified — D&A not tracked separately in historicals
    });
  }

  return { historicals };
}

// ---------------------------------------------------------------------------
// Helpers to classify operating expenses
// ---------------------------------------------------------------------------

function isRD(name: string, subcategory: string | null): boolean {
  if (subcategory === "research_development") return true;
  const lower = name.toLowerCase();
  return /\b(r&d|research|development|engineering|dev.?ops|software tools|cloud dev|compute|data infrastructure)\b/.test(lower);
}

function isSM(name: string, subcategory: string | null): boolean {
  if (subcategory === "sales_marketing") return true;
  const lower = name.toLowerCase();
  return /\b(sales|marketing|advertising|customer acquisition|demand|events|conferences|partner|channel|brand|advocacy)\b/.test(lower);
}
