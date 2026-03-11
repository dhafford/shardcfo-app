/**
 * Red flag detection engine.
 *
 * Scans existing financial data and metrics to identify potential
 * diligence findings. Uses stage-appropriate materiality thresholds.
 */

export type FindingSeverity = "critical" | "significant" | "moderate" | "observation";

export interface DetectedFinding {
  category: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  impact: string;
  recommendation: string;
  dataPoints?: Record<string, string | number>;
}

export interface RedFlagInput {
  stage: string;
  // Metrics
  mrr: number | null;
  arr: number | null;
  mrrGrowthRate: number | null;
  netDollarRetention: number | null;
  grossRevenueRetention: number | null;
  ltvCacRatio: number | null;
  paybackMonths: number | null;
  burnMultiple: number | null;
  grossMarginPct: number | null;
  burnRate: number | null;
  runwayMonths: number | null;
  // Financial data
  totalRevenue: number;
  totalExpenses: number;
  cashBalance: number;
  // Counts
  monthlyPeriodCount: number;
  metricsMonthCount: number;
  accountCount: number;
  // Concentration (optional — from customer data if available)
  topCustomerPct?: number;
  top5CustomerPct?: number;
}

// Threshold config
interface Thresholds {
  revenueOverstatementDealKiller: number;
  customerConcentrationWarning: number;
  customerConcentrationCritical: number;
  ltvCacMinimum: number;
  paybackMaxMonths: number;
  burnMultipleMax: number;
}

const THRESHOLDS: Record<string, Thresholds> = {
  seed: {
    revenueOverstatementDealKiller: 0.50,
    customerConcentrationWarning: 0.40,
    customerConcentrationCritical: 0.60,
    ltvCacMinimum: 1.0,
    paybackMaxMonths: 36,
    burnMultipleMax: 3.0,
  },
  series_a: {
    revenueOverstatementDealKiller: 0.20,
    customerConcentrationWarning: 0.30,
    customerConcentrationCritical: 0.50,
    ltvCacMinimum: 2.0,
    paybackMaxMonths: 24,
    burnMultipleMax: 2.0,
  },
  series_b: {
    revenueOverstatementDealKiller: 0.10,
    customerConcentrationWarning: 0.25,
    customerConcentrationCritical: 0.40,
    ltvCacMinimum: 3.0,
    paybackMaxMonths: 18,
    burnMultipleMax: 1.5,
  },
  growth: {
    revenueOverstatementDealKiller: 0.10,
    customerConcentrationWarning: 0.20,
    customerConcentrationCritical: 0.30,
    ltvCacMinimum: 3.0,
    paybackMaxMonths: 14,
    burnMultipleMax: 1.0,
  },
};

/**
 * Detects red flags from the company's financial data and metrics.
 */
export function detectRedFlags(input: RedFlagInput): DetectedFinding[] {
  const findings: DetectedFinding[] = [];
  const thresholds = THRESHOLDS[input.stage] ?? THRESHOLDS.series_a;

  // ─── Runway & Burn ──────────────────────────────────────────────────

  if (input.runwayMonths !== null && input.runwayMonths < 6) {
    findings.push({
      category: "Financial",
      title: "Critical runway shortage",
      description: `Company has only ${input.runwayMonths.toFixed(1)} months of runway remaining.`,
      severity: input.runwayMonths < 3 ? "critical" : "significant",
      impact: "Company may not survive through the diligence and fundraising process.",
      recommendation: "Immediate cost reduction or bridge financing needed before proceeding.",
      dataPoints: { runwayMonths: input.runwayMonths },
    });
  }

  if (input.burnMultiple !== null && input.burnMultiple > thresholds.burnMultipleMax) {
    findings.push({
      category: "Efficiency",
      title: "Burn multiple exceeds threshold",
      description: `Burn multiple of ${input.burnMultiple.toFixed(1)}x exceeds the ${thresholds.burnMultipleMax}x threshold for ${input.stage.replace("_", " ")} stage.`,
      severity: input.burnMultiple > thresholds.burnMultipleMax * 1.5 ? "significant" : "moderate",
      impact: "Indicates inefficient capital deployment — spending too much relative to growth.",
      recommendation: "Review go-to-market spend efficiency and identify areas to reduce burn.",
      dataPoints: { burnMultiple: input.burnMultiple, threshold: thresholds.burnMultipleMax },
    });
  }

  // ─── Unit Economics ─────────────────────────────────────────────────

  if (input.ltvCacRatio !== null && input.ltvCacRatio < thresholds.ltvCacMinimum) {
    const isCritical = input.ltvCacRatio < 1.0;
    findings.push({
      category: "Unit Economics",
      title: isCritical ? "Unsustainable unit economics" : "LTV:CAC below target",
      description: `LTV:CAC ratio of ${input.ltvCacRatio.toFixed(1)}:1 is below the ${thresholds.ltvCacMinimum}:1 minimum.`,
      severity: isCritical ? "critical" : "significant",
      impact: isCritical
        ? "The business loses money on every customer acquired."
        : "Customer economics do not support current acquisition costs.",
      recommendation: "Review CAC components for common errors (excluded sales salaries, channel blending). Assess pricing strategy.",
      dataPoints: { ltvCacRatio: input.ltvCacRatio, threshold: thresholds.ltvCacMinimum },
    });
  }

  if (input.paybackMonths !== null && input.paybackMonths > thresholds.paybackMaxMonths) {
    findings.push({
      category: "Unit Economics",
      title: "CAC payback period too long",
      description: `CAC payback of ${input.paybackMonths.toFixed(0)} months exceeds the ${thresholds.paybackMaxMonths} month threshold.`,
      severity: input.paybackMonths > thresholds.paybackMaxMonths * 1.5 ? "significant" : "moderate",
      impact: "Long payback periods strain cash and make growth capital-intensive.",
      recommendation: "Evaluate pricing, onboarding costs, and whether CS costs should be included in CAC.",
      dataPoints: { paybackMonths: input.paybackMonths, threshold: thresholds.paybackMaxMonths },
    });
  }

  // ─── Retention ──────────────────────────────────────────────────────

  if (input.netDollarRetention !== null && input.netDollarRetention < 1.0) {
    findings.push({
      category: "Retention",
      title: "Net dollar retention below 100%",
      description: `NDR of ${(input.netDollarRetention * 100).toFixed(1)}% means existing customers are shrinking.`,
      severity: input.netDollarRetention < 0.85 ? "significant" : "moderate",
      impact: "Revenue base is eroding — growth must come entirely from new customers.",
      recommendation: "Investigate churn drivers: pricing, product-market fit, onboarding, customer success.",
      dataPoints: { ndr: input.netDollarRetention },
    });
  }

  if (input.grossRevenueRetention !== null && input.grossRevenueRetention < 0.85) {
    findings.push({
      category: "Retention",
      title: "Gross revenue retention below 85%",
      description: `GRR of ${(input.grossRevenueRetention * 100).toFixed(1)}% indicates significant churn.`,
      severity: input.grossRevenueRetention < 0.80 ? "significant" : "moderate",
      impact: "High gross churn creates a 'leaky bucket' requiring accelerating new sales.",
      recommendation: "Conduct churn analysis by cohort, segment, and reason code.",
      dataPoints: { grr: input.grossRevenueRetention },
    });
  }

  // ─── Gross Margin ───────────────────────────────────────────────────

  if (input.grossMarginPct !== null && input.grossMarginPct < 0.60) {
    findings.push({
      category: "Profitability",
      title: "Gross margin below SaaS expectations",
      description: `Gross margin of ${(input.grossMarginPct * 100).toFixed(1)}% is below the 70%+ SaaS benchmark.`,
      severity: input.grossMarginPct < 0.50 ? "significant" : "moderate",
      impact: "Low gross margins suggest high hosting/delivery costs or services dependency.",
      recommendation: "Review COGS composition. Separate hosting, support, and professional services costs.",
      dataPoints: { grossMargin: input.grossMarginPct },
    });
  }

  // ─── Customer Concentration ─────────────────────────────────────────

  if (input.topCustomerPct !== undefined) {
    if (input.topCustomerPct > thresholds.customerConcentrationCritical) {
      findings.push({
        category: "Revenue Quality",
        title: "Critical customer concentration risk",
        description: `Top customer represents ${(input.topCustomerPct * 100).toFixed(0)}% of revenue.`,
        severity: "critical",
        impact: "Loss of this single customer would be an existential threat.",
        recommendation: "Diversify customer base before fundraise. Secure long-term contracts with top accounts.",
        dataPoints: { topCustomerPct: input.topCustomerPct },
      });
    } else if (input.topCustomerPct > thresholds.customerConcentrationWarning) {
      findings.push({
        category: "Revenue Quality",
        title: "Elevated customer concentration",
        description: `Top customer represents ${(input.topCustomerPct * 100).toFixed(0)}% of revenue.`,
        severity: "moderate",
        impact: "Revenue concentration increases risk and may affect valuation.",
        recommendation: "Present a diversification plan with pipeline data showing trajectory.",
        dataPoints: { topCustomerPct: input.topCustomerPct },
      });
    }
  }

  // ─── Data Completeness ──────────────────────────────────────────────

  if (input.stage !== "seed" && input.monthlyPeriodCount < 12) {
    findings.push({
      category: "Financial Infrastructure",
      title: "Insufficient financial history",
      description: `Only ${input.monthlyPeriodCount} months of financial data available (12-24 months expected).`,
      severity: input.monthlyPeriodCount < 6 ? "significant" : "moderate",
      impact: "Investors require sufficient history to validate trends and perform cohort analysis.",
      recommendation: "Reconstruct historical financials from bank statements and accounting records.",
      dataPoints: { monthsAvailable: input.monthlyPeriodCount },
    });
  }

  if (input.stage !== "seed" && input.metricsMonthCount < 12) {
    findings.push({
      category: "Financial Infrastructure",
      title: "Insufficient metrics history",
      description: `Only ${input.metricsMonthCount} months of SaaS metrics tracked.`,
      severity: "moderate",
      impact: "Cannot validate retention trends or build reliable cohort analysis.",
      recommendation: "Backfill metrics from billing system data. Investors expect 24+ months at Series B.",
      dataPoints: { metricsMonths: input.metricsMonthCount },
    });
  }

  // ─── Growth ─────────────────────────────────────────────────────────

  if (input.mrrGrowthRate !== null && input.mrrGrowthRate < 0) {
    findings.push({
      category: "Growth",
      title: "Negative MRR growth",
      description: `MRR is declining at ${(input.mrrGrowthRate * 100).toFixed(1)}% month-over-month.`,
      severity: "significant",
      impact: "Declining revenue signals product-market fit issues or market contraction.",
      recommendation: "Identify root cause: churn spike, seasonal pattern, or structural decline.",
      dataPoints: { mrrGrowthRate: input.mrrGrowthRate },
    });
  }

  return findings;
}

/**
 * Computes a summary of the go/no-go gate status based on findings.
 */
export function assessGoNoGo(
  findings: DetectedFinding[]
): {
  recommendation: "proceed" | "proceed_with_conditions" | "do_not_proceed";
  criticalCount: number;
  significantCount: number;
  moderateCount: number;
  observationCount: number;
  riskRating: "low" | "medium" | "high";
} {
  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const significantCount = findings.filter((f) => f.severity === "significant").length;
  const moderateCount = findings.filter((f) => f.severity === "moderate").length;
  const observationCount = findings.filter((f) => f.severity === "observation").length;

  let recommendation: "proceed" | "proceed_with_conditions" | "do_not_proceed";
  let riskRating: "low" | "medium" | "high";

  if (criticalCount > 0) {
    recommendation = "do_not_proceed";
    riskRating = "high";
  } else if (significantCount >= 3) {
    recommendation = "do_not_proceed";
    riskRating = "high";
  } else if (significantCount > 0) {
    recommendation = "proceed_with_conditions";
    riskRating = "medium";
  } else if (moderateCount >= 3) {
    recommendation = "proceed_with_conditions";
    riskRating = "medium";
  } else {
    recommendation = "proceed";
    riskRating = moderateCount > 0 ? "medium" : "low";
  }

  return {
    recommendation,
    criticalCount,
    significantCount,
    moderateCount,
    observationCount,
    riskRating,
  };
}
