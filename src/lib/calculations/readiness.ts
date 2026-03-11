/**
 * Due diligence readiness scoring engine.
 *
 * Scores a company's readiness for fundraising diligence across three
 * categories: Corporate Foundation, Financial Infrastructure, and Tax
 * & Compliance. Items are the 25-point gate check from the FDD
 * blueprint, with stage-specific weighting.
 */

export type ReadinessStatus = "pass" | "partial" | "fail" | "na";

export interface ReadinessItem {
  id: string;
  category: "corporate" | "financial" | "tax";
  label: string;
  description: string;
  requiredStages: string[];
  /** Weight 1-3: how much this impacts the overall score */
  weight: number;
  /** Whether the system can auto-detect status from existing data */
  autoDetectable: boolean;
  autoDetectKey?: string;
}

export interface ScoredReadinessItem extends ReadinessItem {
  status: ReadinessStatus;
  notes: string;
}

export interface ReadinessScore {
  overall: number;
  corporate: number;
  financial: number;
  tax: number;
  items: ScoredReadinessItem[];
  itemsByCategory: Record<string, ScoredReadinessItem[]>;
  passCount: number;
  partialCount: number;
  failCount: number;
  naCount: number;
}

// ─── The 25-item gate check ──────────────────────────────────────────

export const READINESS_ITEMS: ReadinessItem[] = [
  // Corporate Foundation (9 items)
  {
    id: "corp-01",
    category: "corporate",
    label: "Delaware C-Corp (or investor-preferred entity)",
    description: "Company is incorporated as a Delaware C-Corp or equivalent",
    requiredStages: ["seed", "series_a", "series_b"],
    weight: 3,
    autoDetectable: false,
  },
  {
    id: "corp-02",
    category: "corporate",
    label: "Clean cap table on Carta/Pulley",
    description: "Cap table managed in a recognized platform, fully reconciled",
    requiredStages: ["seed", "series_a", "series_b"],
    weight: 3,
    autoDetectable: false,
  },
  {
    id: "corp-03",
    category: "corporate",
    label: "409A valuation current (<12 months)",
    description: "Most recent 409A valuation is less than 12 months old",
    requiredStages: ["series_a", "series_b"],
    weight: 3,
    autoDetectable: false,
  },
  {
    id: "corp-04",
    category: "corporate",
    label: "IP properly assigned (PIIA agreements signed)",
    description: "All founders, employees, and contractors have signed PIIA agreements",
    requiredStages: ["seed", "series_a", "series_b"],
    weight: 3,
    autoDetectable: false,
  },
  {
    id: "corp-05",
    category: "corporate",
    label: "Board consents & corporate minutes current",
    description: "All board actions have written consents, minutes are up to date",
    requiredStages: ["series_a", "series_b"],
    weight: 2,
    autoDetectable: false,
  },
  {
    id: "corp-06",
    category: "corporate",
    label: "Prior financing documents organized",
    description: "All SAFEs, convertible notes, and equity docs accessible in data room",
    requiredStages: ["seed", "series_a", "series_b"],
    weight: 2,
    autoDetectable: false,
  },
  {
    id: "corp-07",
    category: "corporate",
    label: "83(b) elections filed for restricted stock",
    description: "All restricted stock grants have timely 83(b) elections on file",
    requiredStages: ["series_a", "series_b"],
    weight: 2,
    autoDetectable: false,
  },
  {
    id: "corp-08",
    category: "corporate",
    label: "D&O insurance in place",
    description: "Directors and officers liability insurance policy is current",
    requiredStages: ["series_b"],
    weight: 1,
    autoDetectable: false,
  },
  {
    id: "corp-09",
    category: "corporate",
    label: "No commingled personal/business funds",
    description: "Business finances are fully separated from personal accounts",
    requiredStages: ["seed", "series_a", "series_b"],
    weight: 3,
    autoDetectable: false,
  },

  // Financial Infrastructure (10 items)
  {
    id: "fin-01",
    category: "financial",
    label: "Monthly GAAP-compliant financial statements",
    description: "P&L, balance sheet, and cash flow produced monthly on accrual basis",
    requiredStages: ["series_a", "series_b"],
    weight: 3,
    autoDetectable: true,
    autoDetectKey: "has_monthly_periods",
  },
  {
    id: "fin-02",
    category: "financial",
    label: "Month-end close within 15 business days",
    description: "Monthly close process completes within 15 business days",
    requiredStages: ["series_a", "series_b"],
    weight: 2,
    autoDetectable: false,
  },
  {
    id: "fin-03",
    category: "financial",
    label: "Bank accounts reconciled monthly",
    description: "All bank accounts are reconciled to the general ledger each month",
    requiredStages: ["series_a", "series_b"],
    weight: 2,
    autoDetectable: false,
  },
  {
    id: "fin-04",
    category: "financial",
    label: "Chart of accounts structured for SaaS metrics",
    description: "Account numbering follows standard structure with SaaS-specific accounts",
    requiredStages: ["series_a", "series_b"],
    weight: 2,
    autoDetectable: true,
    autoDetectKey: "has_structured_coa",
  },
  {
    id: "fin-05",
    category: "financial",
    label: "Revenue recognition policy (ASC 606)",
    description: "Documented revenue recognition policy compliant with ASC 606",
    requiredStages: ["series_a", "series_b"],
    weight: 3,
    autoDetectable: false,
  },
  {
    id: "fin-06",
    category: "financial",
    label: "13-week rolling cash flow forecast",
    description: "Weekly cash flow forecast maintained and updated regularly",
    requiredStages: ["series_a", "series_b"],
    weight: 2,
    autoDetectable: false,
  },
  {
    id: "fin-07",
    category: "financial",
    label: "Financial model with 3-5 year projections",
    description: "Three-statement model with base, upside, and downside scenarios",
    requiredStages: ["series_a", "series_b"],
    weight: 3,
    autoDetectable: true,
    autoDetectKey: "has_scenarios",
  },
  {
    id: "fin-08",
    category: "financial",
    label: "KPI dashboard with 12-24 month history",
    description: "Dashboard tracking key SaaS metrics with sufficient historical data",
    requiredStages: ["series_a", "series_b"],
    weight: 2,
    autoDetectable: true,
    autoDetectKey: "has_metrics_history",
  },
  {
    id: "fin-09",
    category: "financial",
    label: "Basic financial tracking",
    description: "At minimum, revenue and expense tracking with clear records",
    requiredStages: ["seed"],
    weight: 2,
    autoDetectable: true,
    autoDetectKey: "has_any_financials",
  },
  {
    id: "fin-10",
    category: "financial",
    label: "Board deck / investor update process",
    description: "Regular board deck or investor update process established",
    requiredStages: ["series_a", "series_b"],
    weight: 1,
    autoDetectable: true,
    autoDetectKey: "has_board_decks",
  },

  // Tax & Compliance (6 items)
  {
    id: "tax-01",
    category: "tax",
    label: "Federal and state tax returns filed and current",
    description: "All required federal and state tax returns filed on time",
    requiredStages: ["series_a", "series_b"],
    weight: 3,
    autoDetectable: false,
  },
  {
    id: "tax-02",
    category: "tax",
    label: "Delaware franchise tax paid",
    description: "Delaware franchise tax is current with no outstanding balance",
    requiredStages: ["series_a", "series_b"],
    weight: 2,
    autoDetectable: false,
  },
  {
    id: "tax-03",
    category: "tax",
    label: "R&D tax credit documentation prepared",
    description: "R&D activities documented for potential tax credit claims",
    requiredStages: ["series_b"],
    weight: 1,
    autoDetectable: false,
  },
  {
    id: "tax-04",
    category: "tax",
    label: "Sales tax nexus analysis completed",
    description: "Analysis of sales tax obligations across all states with nexus",
    requiredStages: ["series_b"],
    weight: 2,
    autoDetectable: false,
  },
  {
    id: "tax-05",
    category: "tax",
    label: "Payroll tax filings current",
    description: "All payroll tax filings (federal and state) up to date",
    requiredStages: ["series_a", "series_b"],
    weight: 2,
    autoDetectable: false,
  },
  {
    id: "tax-06",
    category: "tax",
    label: "1099s filed for all contractors",
    description: "1099 forms filed for all contractors paid over $600 annually",
    requiredStages: ["series_a", "series_b"],
    weight: 1,
    autoDetectable: false,
  },
];

// ─── Auto-detection data shape ───────────────────────────────────────

export interface AutoDetectData {
  monthlyPeriodCount: number;
  accountCount: number;
  hasRevenueAccounts: boolean;
  hasCOGSAccounts: boolean;
  hasOpexAccounts: boolean;
  scenarioCount: number;
  metricsMonthCount: number;
  boardDeckCount: number;
  hasAnyFinancials: boolean;
}

/**
 * Runs auto-detection for items that can be checked from existing data.
 * Returns a map of autoDetectKey -> ReadinessStatus.
 */
export function autoDetectStatuses(
  data: AutoDetectData
): Record<string, ReadinessStatus> {
  return {
    has_monthly_periods:
      data.monthlyPeriodCount >= 12
        ? "pass"
        : data.monthlyPeriodCount >= 6
          ? "partial"
          : "fail",
    has_structured_coa:
      data.hasRevenueAccounts && data.hasCOGSAccounts && data.hasOpexAccounts
        ? data.accountCount >= 25
          ? "pass"
          : "partial"
        : "fail",
    has_scenarios: data.scenarioCount >= 3 ? "pass" : data.scenarioCount >= 1 ? "partial" : "fail",
    has_metrics_history:
      data.metricsMonthCount >= 12
        ? "pass"
        : data.metricsMonthCount >= 6
          ? "partial"
          : "fail",
    has_board_decks: data.boardDeckCount >= 1 ? "pass" : "fail",
    has_any_financials: data.hasAnyFinancials ? "pass" : "fail",
  };
}

/**
 * Computes the overall readiness score.
 *
 * @param items - Scored items with status set
 * @param stage - Current funding stage (filters items)
 */
export function computeReadinessScore(
  items: ScoredReadinessItem[],
  stage: string
): ReadinessScore {
  const applicable = items.filter(
    (item) => item.requiredStages.includes(stage) && item.status !== "na"
  );

  const byCategory = (cat: string) =>
    applicable.filter((i) => i.category === cat);

  function categoryScore(cat: string): number {
    const catItems = byCategory(cat);
    if (catItems.length === 0) return 100;
    const maxPoints = catItems.reduce((s, i) => s + i.weight * 2, 0);
    const earnedPoints = catItems.reduce((s, i) => {
      if (i.status === "pass") return s + i.weight * 2;
      if (i.status === "partial") return s + i.weight;
      return s;
    }, 0);
    return maxPoints > 0 ? Math.round((earnedPoints / maxPoints) * 100) : 100;
  }

  const corporateScore = categoryScore("corporate");
  const financialScore = categoryScore("financial");
  const taxScore = categoryScore("tax");

  const maxTotal = applicable.reduce((s, i) => s + i.weight * 2, 0);
  const earnedTotal = applicable.reduce((s, i) => {
    if (i.status === "pass") return s + i.weight * 2;
    if (i.status === "partial") return s + i.weight;
    return s;
  }, 0);
  const overall = maxTotal > 0 ? Math.round((earnedTotal / maxTotal) * 100) : 0;

  const itemsByCategory: Record<string, ScoredReadinessItem[]> = {};
  for (const item of items) {
    const cat = item.category;
    if (!itemsByCategory[cat]) itemsByCategory[cat] = [];
    itemsByCategory[cat].push(item);
  }

  return {
    overall,
    corporate: corporateScore,
    financial: financialScore,
    tax: taxScore,
    items,
    itemsByCategory,
    passCount: items.filter((i) => i.status === "pass").length,
    partialCount: items.filter((i) => i.status === "partial").length,
    failCount: items.filter((i) => i.status === "fail").length,
    naCount: items.filter((i) => i.status === "na").length,
  };
}
