import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PeriodSelector } from "@/components/shared/period-selector";
import { BudgetVarianceTable } from "@/components/financials/budget-variance-table";
import { format, subMonths, startOfMonth } from "date-fns";
import type { BudgetVarianceRow } from "@/components/financials/budget-variance-table";
import type { FinancialPeriodRow, AccountRow, LineItemRow } from "@/lib/supabase/types";

type Granularity = "monthly" | "quarterly" | "annual";

function getDateRangeFromParams(searchParams: {
  range?: string;
  granularity?: string;
}): { startDate: Date; endDate: Date; granularity: Granularity } {
  const now = startOfMonth(new Date());
  const months = parseInt(searchParams.range || "12", 10);
  const granularity = (searchParams.granularity as Granularity) || "monthly";
  let startDate: Date;
  if (months === -1) {
    startDate = new Date(now.getFullYear(), 0, 1);
  } else {
    startDate = subMonths(now, months - 1);
  }
  return { startDate, endDate: now, granularity };
}

interface BudgetPageProps {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{
    range?: string;
    granularity?: string;
    threshold?: string;
  }>;
}

async function buildBudgetRows(
  actualPeriods: FinancialPeriodRow[],
  budgetPeriods: FinancialPeriodRow[],
  ytdActualPeriods: FinancialPeriodRow[],
  ytdBudgetPeriods: FinancialPeriodRow[]
): Promise<BudgetVarianceRow[]> {
  const supabase = await createClient();

  const allPeriodIds = [
    ...new Set([
      ...actualPeriods.map((p) => p.id),
      ...budgetPeriods.map((p) => p.id),
      ...ytdActualPeriods.map((p) => p.id),
      ...ytdBudgetPeriods.map((p) => p.id),
    ]),
  ];

  if (allPeriodIds.length === 0) return [];

  const { data: rawLineItems } = await supabase
    .from("line_items")
    .select("period_id, account_id, amount")
    .in("period_id", allPeriodIds);

  const lineItems = (rawLineItems ?? []) as Pick<
    LineItemRow,
    "period_id" | "account_id" | "amount"
  >[];

  // Build sets for quick lookup
  const actualPeriodIds = new Set(actualPeriods.map((p) => p.id));
  const budgetPeriodIds = new Set(budgetPeriods.map((p) => p.id));
  const ytdActualPeriodIds = new Set(ytdActualPeriods.map((p) => p.id));
  const ytdBudgetPeriodIds = new Set(ytdBudgetPeriods.map((p) => p.id));

  // accountId -> { actual, budget, ytdActual, ytdBudget }
  const accountMap = new Map<
    string,
    { actual: number; budget: number; ytdActual: number; ytdBudget: number }
  >();

  for (const item of lineItems) {
    if (!accountMap.has(item.account_id)) {
      accountMap.set(item.account_id, { actual: 0, budget: 0, ytdActual: 0, ytdBudget: 0 });
    }
    const entry = accountMap.get(item.account_id)!;
    if (actualPeriodIds.has(item.period_id)) entry.actual += item.amount;
    if (budgetPeriodIds.has(item.period_id)) entry.budget += item.amount;
    if (ytdActualPeriodIds.has(item.period_id)) entry.ytdActual += item.amount;
    if (ytdBudgetPeriodIds.has(item.period_id)) entry.ytdBudget += item.amount;
  }

  const latestActualPeriod = actualPeriods[actualPeriods.length - 1];
  const latestBudgetPeriod = budgetPeriods[budgetPeriods.length - 1];
  const periodId = latestActualPeriod?.id ?? latestBudgetPeriod?.id ?? "";

  const rows: BudgetVarianceRow[] = [];
  for (const [accountId, entry] of accountMap.entries()) {
    rows.push({
      accountId,
      periodId,
      actual: entry.actual,
      budget: entry.budget,
      ytdActual: entry.ytdActual,
      ytdBudget: entry.ytdBudget,
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

  // Query actual periods in range (period_date falls within range)
  const { data: actualPeriods } = await supabase
    .from("financial_periods")
    .select("*")
    .eq("company_id", companyId)
    .eq("period_type", "actual")
    .gte("period_date", startStr)
    .lte("period_date", endStr)
    .order("period_date", { ascending: true });

  // Query budget periods in range
  const { data: budgetPeriods } = await supabase
    .from("financial_periods")
    .select("*")
    .eq("company_id", companyId)
    .eq("period_type", "budget")
    .gte("period_date", startStr)
    .lte("period_date", endStr)
    .order("period_date", { ascending: true });

  // YTD periods (start of current year up to latest period)
  const yearStart = format(new Date(endDate.getFullYear(), 0, 1), "yyyy-MM-dd");

  const { data: ytdActualPeriods } = await supabase
    .from("financial_periods")
    .select("*")
    .eq("company_id", companyId)
    .eq("period_type", "actual")
    .gte("period_date", yearStart)
    .lte("period_date", endStr)
    .order("period_date", { ascending: true });

  const { data: ytdBudgetPeriods } = await supabase
    .from("financial_periods")
    .select("*")
    .eq("company_id", companyId)
    .eq("period_type", "budget")
    .gte("period_date", yearStart)
    .lte("period_date", endStr)
    .order("period_date", { ascending: true });

  // Active accounts
  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  const safeActualPeriods: FinancialPeriodRow[] = actualPeriods ?? [];
  const safeBudgetPeriods: FinancialPeriodRow[] = budgetPeriods ?? [];
  const safeYtdActualPeriods: FinancialPeriodRow[] = ytdActualPeriods ?? [];
  const safeYtdBudgetPeriods: FinancialPeriodRow[] = ytdBudgetPeriods ?? [];
  const safeAccounts: AccountRow[] = accounts ?? [];

  const latestPeriod =
    safeActualPeriods[safeActualPeriods.length - 1] ??
    safeBudgetPeriods[safeBudgetPeriods.length - 1] ??
    null;

  const budgetRows = await buildBudgetRows(
    safeActualPeriods,
    safeBudgetPeriods,
    safeYtdActualPeriods,
    safeYtdBudgetPeriods
  );

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
              ? `Period: ${latestPeriod.period_date}`
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
