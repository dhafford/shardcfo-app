"use server";

import { requireAuth } from "@/lib/supabase/require-auth";
import { computeCashFlow, type ComputedCashFlow } from "@/lib/computations/cash-flow-engine";

export async function fetchComputedCashFlow(
  companyId: string,
): Promise<ComputedCashFlow> {
  const { supabase } = await requireAuth({ redirect: false });

  // Fetch all actual periods
  const { data: periods } = await supabase
    .from("financial_periods")
    .select("id, period_date")
    .eq("company_id", companyId)
    .eq("period_type", "actual")
    .order("period_date", { ascending: true });

  if (!periods || periods.length < 2) {
    return {
      periods: [],
      operating: { name: "Operating Activities", lines: [], totalLabel: "Total CFO", totalAmounts: {} },
      investing: { name: "Investing Activities", lines: [], totalLabel: "Total CFI", totalAmounts: {} },
      financing: { name: "Financing Activities", lines: [], totalLabel: "Total CFF", totalAmounts: {} },
      netCashChange: {},
      beginningCash: {},
      endingCash: {},
      fcf: {},
      balanceCheck: {},
      warnings: ["Need at least 2 periods with data to compute cash flow."],
    };
  }

  // Fetch all accounts
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, category, subcategory")
    .eq("company_id", companyId)
    .eq("is_active", true);

  // Fetch all line items for these periods
  const periodIds = periods.map((p: { id: string }) => p.id);
  const { data: lineItems } = await supabase
    .from("line_items")
    .select("period_id, account_id, amount")
    .in("period_id", periodIds);

  return computeCashFlow(
    accounts ?? [],
    periods as { id: string; period_date: string }[],
    lineItems ?? [],
  );
}
