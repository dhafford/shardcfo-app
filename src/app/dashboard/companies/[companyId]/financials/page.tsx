import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PeriodSelector } from "@/components/shared/period-selector";
import { PnlTable } from "@/components/financials/pnl-table";
import { FinancialsToolbar } from "@/components/financials/financials-toolbar";
import { format } from "date-fns";
import { getDateRangeFromParams } from "@/lib/date-utils";
import type { PnlDataPoint, ComparisonMode } from "@/components/financials/pnl-table";
import type { FinancialPeriodRow, AccountRow, LineItemRow } from "@/lib/supabase/types";

interface FinancialsPageProps {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{
    range?: string;
    granularity?: string;
    view?: string;
    comparison?: string;
  }>;
}

async function buildPnlData(
  actualPeriods: FinancialPeriodRow[],
  budgetPeriods: FinancialPeriodRow[],
  accounts: AccountRow[]
): Promise<PnlDataPoint[]> {
  const supabase = await createClient();
  if ((actualPeriods.length === 0 && budgetPeriods.length === 0) || accounts.length === 0) return [];

  const actualPeriodIds = actualPeriods.map((p) => p.id);
  const budgetPeriodIds = budgetPeriods.map((p) => p.id);
  const allPeriodIds = [...new Set([...actualPeriodIds, ...budgetPeriodIds])];

  if (allPeriodIds.length === 0) return [];

  const { data: rawLineItems } = await supabase
    .from("line_items")
    .select("period_id, account_id, amount")
    .in("period_id", allPeriodIds);

  const lineItems = (rawLineItems ?? []) as Pick<LineItemRow, "period_id" | "account_id" | "amount">[];

  const actualPeriodIdSet = new Set(actualPeriodIds);
  const budgetPeriodIdSet = new Set(budgetPeriodIds);

  // Map: periodId -> accountId -> { actual, budget }
  // For actual periods, accumulate into an "actual" bucket by the period's date
  // For budget periods, accumulate into a "budget" bucket
  // We key by period_date to align actual vs budget for the same calendar month
  const actualDateToPeriodId = new Map(actualPeriods.map((p) => [p.period_date, p.id]));
  const budgetDateToPeriodId = new Map(budgetPeriods.map((p) => [p.period_date, p.id]));

  // Build: periodDate -> accountId -> { actual, budget }
  const grouped = new Map<string, Map<string, { actual: number; budget: number }>>();

  // Collect all period dates
  const allDates = new Set([
    ...actualPeriods.map((p) => p.period_date),
    ...budgetPeriods.map((p) => p.period_date),
  ]);
  for (const d of allDates) {
    grouped.set(d, new Map());
  }

  for (const item of lineItems) {
    // Find the period date for this period_id
    let periodDate: string | null = null;
    if (actualPeriodIdSet.has(item.period_id)) {
      const period = actualPeriods.find((p) => p.id === item.period_id);
      periodDate = period?.period_date ?? null;
    } else if (budgetPeriodIdSet.has(item.period_id)) {
      const period = budgetPeriods.find((p) => p.id === item.period_id);
      periodDate = period?.period_date ?? null;
    }
    if (!periodDate) continue;

    const periodMap = grouped.get(periodDate)!;
    if (!periodMap.has(item.account_id)) {
      periodMap.set(item.account_id, { actual: 0, budget: 0 });
    }
    const entry = periodMap.get(item.account_id)!;
    if (actualPeriodIdSet.has(item.period_id)) {
      entry.actual += item.amount;
    } else {
      entry.budget += item.amount;
    }
  }

  // Build flat array — use actual period IDs as the canonical periodId
  const points: PnlDataPoint[] = [];
  for (const [periodDate, periodMap] of grouped.entries()) {
    const periodId =
      actualDateToPeriodId.get(periodDate) ??
      budgetDateToPeriodId.get(periodDate) ??
      periodDate;
    for (const [accountId, amounts] of periodMap.entries()) {
      points.push({
        periodId,
        accountId,
        actual: amounts.actual,
        budget: amounts.budget || null,
        priorYear: null,
      });
    }
  }

  return points;
}

export default async function FinancialsPage({ params, searchParams }: FinancialsPageProps) {
  const { companyId } = await params;
  const sp = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch company
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, currency")
    .eq("id", companyId)
    .single();
  if (!company) notFound();

  const hasExplicitRange = !!sp.range;
  const { startDate, endDate } = getDateRangeFromParams(sp);
  let startStr = format(startDate, "yyyy-MM-dd");
  let endStr = format(endDate, "yyyy-MM-dd");

  // When no explicit range is selected, show ALL months that have data
  if (!hasExplicitRange) {
    const { data: earliest } = await supabase
      .from("financial_periods")
      .select("period_date")
      .eq("company_id", companyId)
      .eq("period_type", "actual")
      .order("period_date", { ascending: true })
      .limit(1);
    const { data: latest } = await supabase
      .from("financial_periods")
      .select("period_date")
      .eq("company_id", companyId)
      .eq("period_type", "actual")
      .order("period_date", { ascending: false })
      .limit(1);
    if (earliest?.[0]) {
      const d = (earliest[0] as { period_date: string }).period_date;
      if (d < startStr) startStr = d;
    }
    if (latest?.[0]) {
      const d = (latest[0] as { period_date: string }).period_date;
      if (d > endStr) endStr = d;
    }
  }

  // Fetch actual periods in range (using period_date)
  const { data: actualPeriods } = await supabase
    .from("financial_periods")
    .select("*")
    .eq("company_id", companyId)
    .eq("period_type", "actual")
    .gte("period_date", startStr)
    .lte("period_date", endStr)
    .order("period_date", { ascending: true });

  // Fetch budget periods in range
  const { data: budgetPeriods } = await supabase
    .from("financial_periods")
    .select("*")
    .eq("company_id", companyId)
    .eq("period_type", "budget")
    .gte("period_date", startStr)
    .lte("period_date", endStr)
    .order("period_date", { ascending: true });

  // Fetch all active accounts
  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  const safeActualPeriods: FinancialPeriodRow[] = actualPeriods ?? [];
  const safeBudgetPeriods: FinancialPeriodRow[] = budgetPeriods ?? [];
  const safePeriods: FinancialPeriodRow[] = [
    ...safeActualPeriods,
    ...safeBudgetPeriods.filter((bp) => !safeActualPeriods.find((ap) => ap.period_date === bp.period_date)),
  ].sort((a, b) => a.period_date.localeCompare(b.period_date));
  const safeAccounts: AccountRow[] = accounts ?? [];

  const view = (sp.view ?? "pnl") as "pnl" | "balance_sheet" | "cash_flow";
  const comparison = (sp.comparison ?? "none") as ComparisonMode;

  const pnlData = await buildPnlData(safeActualPeriods, safeBudgetPeriods, safeAccounts);

  const firstPeriod = safePeriods[0];
  const lastPeriod = safePeriods[safePeriods.length - 1];

  return (
    <div className="flex flex-col gap-0 min-h-full">
      {/* Toolbar */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b bg-white px-6 py-3">
        <PeriodSelector />
        <div className="ml-auto flex items-center gap-2">
          <Link
            href={`/dashboard/companies/${companyId}/financials/import`}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 h-8 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Import Data
          </Link>
          <Link
            href={`/dashboard/companies/${companyId}/financials/accounts`}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 h-8 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Accounts
          </Link>
          <FinancialsToolbar
            companyId={companyId}
            currentView={view}
            currentComparison={comparison}
            accounts={safeAccounts}
            periods={safePeriods}
            data={pnlData}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        {view === "pnl" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Profit &amp; Loss</h2>
                <p className="text-sm text-muted-foreground">
                  {safePeriods.length > 0 && firstPeriod && lastPeriod
                    ? `${firstPeriod.period_date} – ${lastPeriod.period_date}`
                    : "No periods in selected range"}
                </p>
              </div>
            </div>
            <PnlTable
              accounts={safeAccounts}
              periods={safePeriods}
              data={pnlData}
              comparisonMode={comparison}
            />
          </div>
        )}

        {view === "balance_sheet" && (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm rounded-lg border border-dashed bg-white">
            Balance Sheet view coming soon.
          </div>
        )}

        {view === "cash_flow" && (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm rounded-lg border border-dashed bg-white">
            Cash Flow view coming soon.
          </div>
        )}
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
