import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { PeriodSelector, getDateRangeFromParams } from "@/components/shared/period-selector";
import { PnlTable } from "@/components/financials/pnl-table";
import { FinancialsToolbar } from "@/components/financials/financials-toolbar";
import { format } from "date-fns";
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
  companyId: string,
  periods: FinancialPeriodRow[],
  accounts: AccountRow[]
): Promise<PnlDataPoint[]> {
  const supabase = await createClient();
  if (periods.length === 0 || accounts.length === 0) return [];

  const periodIds = periods.map((p) => p.id);

  // Fetch actual line items
  const { data: rawActuals } = await supabase
    .from("line_items")
    .select("financial_period_id, account_id, amount, line_item_type")
    .eq("company_id", companyId)
    .in("financial_period_id", periodIds)
    .in("line_item_type", ["actual", "budget"]);

  const actuals = (rawActuals ?? []) as Pick<
    LineItemRow,
    "financial_period_id" | "account_id" | "amount" | "line_item_type"
  >[];

  // Group by period + account + type
  type AmountMap = Map<string, Map<string, { actual: number; budget: number }>>;
  const grouped: AmountMap = new Map();

  for (const item of actuals) {
    if (!grouped.has(item.financial_period_id)) {
      grouped.set(item.financial_period_id, new Map());
    }
    const periodMap = grouped.get(item.financial_period_id)!;
    if (!periodMap.has(item.account_id)) {
      periodMap.set(item.account_id, { actual: 0, budget: 0 });
    }
    const entry = periodMap.get(item.account_id)!;
    if (item.line_item_type === "actual") {
      entry.actual += item.amount;
    } else if (item.line_item_type === "budget") {
      entry.budget += item.amount;
    }
  }

  // Build flat array
  const points: PnlDataPoint[] = [];
  for (const [periodId, periodMap] of grouped.entries()) {
    for (const [accountId, amounts] of periodMap.entries()) {
      points.push({
        periodId,
        accountId,
        actual: amounts.actual,
        budget: amounts.budget || null,
        priorYear: null, // Prior year requires a separate query matching month/day offset
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

  // Fetch company (for access control; layout already fetches but we need it for export)
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, currency")
    .eq("id", companyId)
    .single();
  if (!company) notFound();

  const { startDate, endDate } = getDateRangeFromParams(sp);
  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");

  // Fetch financial periods in range
  const { data: periods } = await supabase
    .from("financial_periods")
    .select("*")
    .eq("company_id", companyId)
    .gte("start_date", startStr)
    .lte("end_date", endStr)
    .order("start_date", { ascending: true });

  // Fetch all active accounts
  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  const safePeriods: FinancialPeriodRow[] = periods ?? [];
  const safeAccounts: AccountRow[] = accounts ?? [];

  const view = (sp.view ?? "pnl") as "pnl" | "balance_sheet" | "cash_flow";
  const comparison = (sp.comparison ?? "none") as ComparisonMode;

  const pnlData = await buildPnlData(companyId, safePeriods, safeAccounts);

  return (
    <div className="flex flex-col gap-0 min-h-full">
      {/* Toolbar */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b bg-white px-6 py-3">
        <PeriodSelector />
        <div className="ml-auto flex items-center gap-2">
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
                  {safePeriods.length > 0
                    ? `${safePeriods[0].period_label} – ${safePeriods[safePeriods.length - 1].period_label}`
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
