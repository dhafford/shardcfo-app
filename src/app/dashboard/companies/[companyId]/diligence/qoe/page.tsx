import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/supabase/require-auth";
import { QoEDashboardClient } from "@/components/diligence/qoe-dashboard-client";
import { calculateQoESummary, buildEBITDABridge } from "@/lib/calculations/qoe";
import type { CompanyRow, QoEAdjustmentRow } from "@/lib/supabase/types";
import type { QoEAdjustment } from "@/lib/calculations/qoe";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export default async function QoEPage({ params }: PageProps) {
  const { companyId } = await params;
  const { supabase } = await requireAuth();

  const { data: companyRaw } = await supabase
    .from("companies")
    .select("id, name, stage, status")
    .eq("id", companyId)
    .single();

  const company = companyRaw as CompanyRow | null;
  if (!company) notFound();

  // Fetch QoE adjustments
  const { data: adjustmentsRaw } = await supabase
    .from("qoe_adjustments")
    .select("*")
    .eq("company_id", companyId)
    .order("period_date", { ascending: false });

  const adjustments = (adjustmentsRaw ?? []) as QoEAdjustmentRow[];

  // Fetch last 12 months of P&L data via the existing SQL function
  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), 1);
  const startDate = new Date(endDate);
  startDate.setMonth(startDate.getMonth() - 11);

  const startStr = startDate.toISOString().slice(0, 7) + "-01";
  const endStr = endDate.toISOString().slice(0, 7) + "-01";

  const { data: pnlRaw } = await supabase.rpc("get_pnl_summary", {
    p_company_id: companyId,
    p_start_date: startStr,
    p_end_date: endStr,
  });

  // get_pnl_summary returns rows with period_date, revenue, cogs, opex, gross_profit, net_income
  type PnlRow = {
    period_date: string;
    revenue: number;
    cogs: number;
    opex: number;
    gross_profit: number;
    net_income: number;
  };
  const pnlRows = (pnlRaw ?? []) as unknown as PnlRow[];

  // Compute monthly EBITDA (revenue - cogs - opex; we ignore D&A as a simplification)
  const monthlyData = pnlRows.map((row) => {
    const reportedEBITDA = row.revenue - row.cogs - row.opex;
    return {
      period: row.period_date.slice(0, 7),
      reportedEBITDA,
      // Adjusted EBITDA for each month: reported + adjustments for that period
      adjustedEBITDA:
        reportedEBITDA +
        adjustments
          .filter((a) => a.period_date.slice(0, 7) === row.period_date.slice(0, 7))
          .reduce((sum, a) => sum + a.amount, 0),
    };
  });

  // Total reported EBITDA across all periods
  const totalReportedEBITDA = monthlyData.reduce(
    (sum, m) => sum + m.reportedEBITDA,
    0
  );

  // Map adjustments to QoEAdjustment shape for calculations
  const qoeAdjustments: QoEAdjustment[] = adjustments.map((a) => ({
    id: a.id,
    periodDate: a.period_date,
    type: a.adjustment_type as unknown as QoEAdjustment["type"],
    description: a.description,
    amount: a.amount,
    category: a.category,
  }));

  // Cash from operations is not available in the P&L function — pass 0 (QoE ratio will be N/A)
  const qoeSummary = calculateQoESummary(totalReportedEBITDA, 0, qoeAdjustments);

  // Override qoeRatio to null since we have no cash flow data
  const summaryWithNullRatio = { ...qoeSummary, qoeRatio: null };

  // Build EBITDA bridge
  const bridge = buildEBITDABridge(totalReportedEBITDA, qoeAdjustments);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold">QoE Analysis</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Quality of earnings adjustments and EBITDA bridge for{" "}
          <span className="font-medium">{company.name}</span>.
        </p>
      </div>

      <QoEDashboardClient
        companyId={companyId}
        reportedEBITDA={totalReportedEBITDA}
        adjustments={adjustments}
        bridge={bridge}
        qoeSummary={summaryWithNullRatio}
        monthlyData={monthlyData}
      />
    </div>
  );
}
