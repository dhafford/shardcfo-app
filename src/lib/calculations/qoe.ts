/**
 * Quality of Earnings (QoE) calculations.
 *
 * Provides adjusted EBITDA bridge computation, QoE ratio, and
 * non-recurring item identification for FDD analysis.
 */

export type AdjustmentType =
  | "non_recurring"
  | "non_operating"
  | "out_of_period"
  | "owner_discretionary"
  | "related_party"
  | "run_rate";

export interface QoEAdjustment {
  id: string;
  periodDate: string;
  type: AdjustmentType;
  description: string;
  amount: number;
  category: string | null;
}

export interface EBITDABridgeItem {
  label: string;
  amount: number;
  type: "base" | "adjustment" | "total";
  adjustmentType?: AdjustmentType;
}

export interface QoESummary {
  reportedEBITDA: number;
  totalAdjustments: number;
  adjustedEBITDA: number;
  adjustmentsByType: Record<AdjustmentType, number>;
  bridge: EBITDABridgeItem[];
  qoeRatio: number | null;
  qualityAssessment: "high" | "moderate" | "low";
}

export interface MonthlyQoEData {
  period: string;
  reportedRevenue: number;
  reportedEBITDA: number;
  adjustedEBITDA: number;
  cashFromOperations: number;
}

/**
 * Builds the EBITDA adjustment bridge from reported to adjusted EBITDA.
 */
export function buildEBITDABridge(
  reportedEBITDA: number,
  adjustments: QoEAdjustment[]
): EBITDABridgeItem[] {
  const bridge: EBITDABridgeItem[] = [
    { label: "Reported EBITDA", amount: reportedEBITDA, type: "base" },
  ];

  const byType: Record<AdjustmentType, QoEAdjustment[]> = {
    non_recurring: [],
    non_operating: [],
    out_of_period: [],
    owner_discretionary: [],
    related_party: [],
    run_rate: [],
  };

  for (const adj of adjustments) {
    byType[adj.type].push(adj);
  }

  const typeLabels: Record<AdjustmentType, string> = {
    non_recurring: "Non-Recurring Items",
    non_operating: "Non-Operating Items",
    out_of_period: "Out-of-Period Adjustments",
    owner_discretionary: "Owner/Discretionary Items",
    related_party: "Related Party Adjustments",
    run_rate: "Run-Rate Adjustments",
  };

  for (const [type, items] of Object.entries(byType) as [AdjustmentType, QoEAdjustment[]][]) {
    if (items.length === 0) continue;
    const total = items.reduce((sum, i) => sum + i.amount, 0);
    bridge.push({
      label: typeLabels[type],
      amount: total,
      type: "adjustment",
      adjustmentType: type,
    });
  }

  const totalAdj = adjustments.reduce((sum, a) => sum + a.amount, 0);
  bridge.push({
    label: "Adjusted EBITDA",
    amount: reportedEBITDA + totalAdj,
    type: "total",
  });

  return bridge;
}

/**
 * Calculates the full QoE summary.
 *
 * @param reportedEBITDA - EBITDA from P&L
 * @param cashFromOperations - Actual cash flow from operations
 * @param adjustments - QoE adjustments to apply
 */
export function calculateQoESummary(
  reportedEBITDA: number,
  cashFromOperations: number,
  adjustments: QoEAdjustment[]
): QoESummary {
  const totalAdjustments = adjustments.reduce((sum, a) => sum + a.amount, 0);
  const adjustedEBITDA = reportedEBITDA + totalAdjustments;

  const adjustmentsByType: Record<AdjustmentType, number> = {
    non_recurring: 0,
    non_operating: 0,
    out_of_period: 0,
    owner_discretionary: 0,
    related_party: 0,
    run_rate: 0,
  };

  for (const adj of adjustments) {
    adjustmentsByType[adj.type] += adj.amount;
  }

  // QoE Ratio = Cash from Operations / Net Income (using EBITDA as proxy)
  const netIncome = adjustedEBITDA; // simplified; in practice includes D&A and taxes
  const qoeRatio =
    netIncome !== 0 ? cashFromOperations / Math.abs(netIncome) : null;

  // Quality assessment
  let qualityAssessment: "high" | "moderate" | "low" = "moderate";
  if (qoeRatio !== null) {
    if (qoeRatio >= 1.0) qualityAssessment = "high";
    else if (qoeRatio >= 0.7) qualityAssessment = "moderate";
    else qualityAssessment = "low";
  }

  const bridge = buildEBITDABridge(reportedEBITDA, adjustments);

  return {
    reportedEBITDA,
    totalAdjustments,
    adjustedEBITDA,
    adjustmentsByType,
    bridge,
    qoeRatio,
    qualityAssessment,
  };
}

/**
 * Identifies potential non-recurring items from line item data.
 *
 * Flags items that appear in only one period or have amounts significantly
 * different from the category average.
 */
export function identifyNonRecurringItems(
  lineItems: { accountId: string; period: string; amount: number; description: string }[]
): { accountId: string; period: string; amount: number; description: string; reason: string }[] {
  // Group by account
  const byAccount = new Map<string, typeof lineItems>();
  for (const item of lineItems) {
    const existing = byAccount.get(item.accountId) ?? [];
    existing.push(item);
    byAccount.set(item.accountId, existing);
  }

  const flags: { accountId: string; period: string; amount: number; description: string; reason: string }[] = [];

  for (const [accountId, items] of byAccount) {
    // Flag items that appear in only one period
    if (items.length === 1 && items[0].amount > 1000) {
      flags.push({
        ...items[0],
        reason: "Appears in only one period — potential one-time item",
      });
      continue;
    }

    // Flag amounts that deviate significantly from the average
    if (items.length >= 3) {
      const avg = items.reduce((s, i) => s + i.amount, 0) / items.length;
      const stdDev = Math.sqrt(
        items.reduce((s, i) => s + (i.amount - avg) ** 2, 0) / items.length
      );

      for (const item of items) {
        if (stdDev > 0 && Math.abs(item.amount - avg) > 2 * stdDev && item.amount > 1000) {
          flags.push({
            ...item,
            reason: `Amount $${item.amount.toLocaleString()} deviates >2 std dev from average $${avg.toFixed(0)}`,
          });
        }
      }
    }
  }

  return flags;
}
