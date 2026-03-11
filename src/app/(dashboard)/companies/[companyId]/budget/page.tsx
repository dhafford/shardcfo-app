import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PeriodSelector, getDateRangeFromParams } from "@/components/shared/period-selector";
import { BudgetVarianceTable } from "@/components/financials/budget-variance-table";
import { format } from "date-fns";
import type { BudgetVarianceRow } from "@/components/financials/budget-variance-table";
import type { FinancialPeriodRow, AccountRow, LineItemRow } from "@/lib/supabase/types";

interface BudgetPageProps {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{
    range?: string;
    granularity?: string;
    threshold?: string;
  }>;
}

async function buildBudgetRows(
  companyId: string,
  periods: FinancialPeriodRow[],
  ytdPeriods: FinancialPeriodRow[]
): Promise<BudgetVarianceRow[]> {
  const supabase = await createClient();
  if (periods.length === 0) return [];

  const allPeriodIds = [
    ...new Set([...periods.map((p) => p.id), ...ytdPeriods.map((p) => p.id)]),
  ];

  const { data: rawLineItems } = await supabase
    .from("line_items")
    .select("financial_period_id, account_id, amount, line_item_type")
    .eq("company_id", companyId)
    .in("financial_period_id", allPeriodIds)
    .in("line_item_type", ["actual", "budget"]);

  const lineItems = (rawLineItems ?? []) as Pick<
    LineItemRow,
    "financial_period_id" | "account_id" | "amount" | "line_item_type"
  >[];

  if (!rawLineItems) return [];

  // Build: periodId -> accountId -> { actual, budget }
  const periodAccountMap = new Map<
    string,
    Map<string, { actual: number; budget: number }>
  >();

  for (const item of lineItems) {
    if (!periodAccountMap.has(item.financial_period_id)) {
      periodAccountMap.set(item.financial_period_id, new Map());
    }
    const accMap = periodAccountMap.get(item.financial_period_id)!;
    if (!accMap.has(item.account_id)) {
      accMap.set(item.account_id, { actual: 0, budget: 0 });
    }
    const entry = accMap.get(item.account_id)!;
    if (item.line_item_type === "actual") entry.actual += item.amount;
    else if (item.line_item_type === "budget") entry.budget += item.amount;
  }

  // Latest period is our "current" period
  const latestPeriod = periods[periods.length - 1];

  // Collect all account IDs that have data in the latest period
  const accountIds = new Set<string>();
  for (const [, accMap] of periodAccountMap.entries()) {
    for (const [accId] of accMap.entries()) {
      accountIds.add(accId);
    }
  }

  const rows: BudgetVarianceRow[] = [];
  for (const accountId of accountIds) {
    const current = periodAccountMap.get(latestPeriod.id)?.get(accountId);
    if (!current) continue;

    // YTD: sum across ytdPeriods
    let ytdActual = 0;
    let ytdBudget = 0;
    for (const p of ytdPeriods) {
      const entry = periodAccountMap.get(p.id)?.get(accountId);
      if (entry) {
        ytdActual += entry.actual;
        ytdBudget += entry.budget;
      }
    }

    rows.push({
      accountId,
      periodId: latestPeriod.id,
      actual: current.actual,
      budget: current.budget,
      ytdActual,
      ytdBudget,
    });
  }

  return rows;
}

export default async function BudgetPage({ params, searchParams }: BudgetPageProps) {
  const { companyId } = await params;
  const sp = await searchParams;
  const threshold = parseInt(sp.threshold ?? "10", 10);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { startDate, endDate } = getDateRangeFromParams(sp);
  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");

  // All periods in range
  const { data: periods } = await supabase
    .from("financial_periods")
    .select("*")
    .eq("company_id", companyId)
    .gte("start_date", startStr)
    .lte("end_date", endStr)
    .order("start_date", { ascending: true });

  // YTD periods (start of current year up to latest period)
  const yearStart = format(new Date(endDate.getFullYear(), 0, 1), "yyyy-MM-dd");
  const { data: ytdPeriods } = await supabase
    .from("financial_periods")
    .select("*")
    .eq("company_id", companyId)
    .gte("start_date", yearStart)
    .lte("end_date", endStr)
    .order("start_date", { ascending: true });

  // Active accounts
  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  const safePeriods: FinancialPeriodRow[] = periods ?? [];
  const safeYtdPeriods: FinancialPeriodRow[] = ytdPeriods ?? [];
  const safeAccounts: AccountRow[] = accounts ?? [];

  const latestPeriod = safePeriods[safePeriods.length - 1] ?? null;

  const budgetRows = await buildBudgetRows(companyId, safePeriods, safeYtdPeriods);

  return (
    <div className="flex flex-col gap-0 min-h-full">
      {/* Toolbar */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b bg-white px-6 py-3">
        <PeriodSelector />
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold">Budget vs. Actual</h2>
          <p className="text-sm text-muted-foreground">
            {latestPeriod
              ? `Period: ${latestPeriod.period_label}`
              : "No periods in selected range"}
          </p>
        </div>

        {!latestPeriod ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm rounded-lg border border-dashed bg-white">
            No financial periods found for the selected range. Try a wider date range.
          </div>
        ) : (
          <BudgetVarianceTable
            accounts={safeAccounts}
            period={latestPeriod}
            rows={budgetRows}
            varianceThreshold={isNaN(threshold) ? 10 : threshold}
          />
        )}
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
