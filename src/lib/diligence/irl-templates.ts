/**
 * Information Request List (IRL) templates by funding stage.
 *
 * Each item defines what documents/data investors typically request
 * during due diligence. Items are organized by category and tagged
 * with which stages require them.
 */

export interface IRLItem {
  id: string;
  category: string;
  subcategory: string;
  item: string;
  description: string;
  requiredStages: string[];
  canAutoRespond: boolean;
  dataSource?: string;
}

export const IRL_TEMPLATE_ITEMS: IRLItem[] = [
  // ─── Corporate & Legal ─────────────────────────────────────────────
  {
    id: "irl-corp-01",
    category: "corporate",
    subcategory: "Formation",
    item: "Certificate of Incorporation",
    description: "Current certificate of incorporation including all amendments",
    requiredStages: ["seed", "series_a", "series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-corp-02",
    category: "corporate",
    subcategory: "Formation",
    item: "Bylaws",
    description: "Current bylaws with all amendments",
    requiredStages: ["seed", "series_a", "series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-corp-03",
    category: "corporate",
    subcategory: "Formation",
    item: "Good Standing Certificate",
    description: "Certificate of good standing from state of incorporation",
    requiredStages: ["series_a", "series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-corp-04",
    category: "corporate",
    subcategory: "Board Records",
    item: "Board Meeting Minutes",
    description: "All board meeting minutes and written consents",
    requiredStages: ["series_a", "series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-corp-05",
    category: "corporate",
    subcategory: "Prior Financing",
    item: "SAFE / Convertible Note Agreements",
    description: "All outstanding SAFEs, convertible notes, and prior equity documents",
    requiredStages: ["seed", "series_a", "series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-corp-06",
    category: "corporate",
    subcategory: "Prior Financing",
    item: "Investor Rights Agreements",
    description: "All investor rights agreements and side letters",
    requiredStages: ["series_a", "series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-corp-07",
    category: "corporate",
    subcategory: "Cap Table",
    item: "Fully Diluted Cap Table",
    description: "Current fully-diluted capitalization table with all outstanding securities",
    requiredStages: ["seed", "series_a", "series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-corp-08",
    category: "corporate",
    subcategory: "Cap Table",
    item: "Stock Option Plan & Grants",
    description: "Equity incentive plan, all option grants, and exercise history",
    requiredStages: ["series_a", "series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-corp-09",
    category: "corporate",
    subcategory: "Cap Table",
    item: "409A Valuation Report",
    description: "Most recent 409A valuation (must be less than 12 months old)",
    requiredStages: ["series_a", "series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-corp-10",
    category: "corporate",
    subcategory: "Governance",
    item: "D&O Insurance Policy",
    description: "Current directors and officers liability insurance",
    requiredStages: ["series_b"],
    canAutoRespond: false,
  },

  // ─── Financial Information ─────────────────────────────────────────
  {
    id: "irl-fin-01",
    category: "financial",
    subcategory: "Historical Financials",
    item: "Monthly P&L Statements",
    description: "Monthly income statements for trailing 12-24 months (or from inception)",
    requiredStages: ["seed", "series_a", "series_b"],
    canAutoRespond: true,
    dataSource: "financial_periods + line_items",
  },
  {
    id: "irl-fin-02",
    category: "financial",
    subcategory: "Historical Financials",
    item: "Balance Sheet",
    description: "Monthly balance sheets for trailing 12-24 months",
    requiredStages: ["series_a", "series_b"],
    canAutoRespond: true,
    dataSource: "financial_periods + line_items (asset/liability/equity)",
  },
  {
    id: "irl-fin-03",
    category: "financial",
    subcategory: "Historical Financials",
    item: "Cash Flow Statement",
    description: "Monthly or quarterly cash flow statements",
    requiredStages: ["series_a", "series_b"],
    canAutoRespond: true,
    dataSource: "get_cash_flow_summary",
  },
  {
    id: "irl-fin-04",
    category: "financial",
    subcategory: "Projections",
    item: "Financial Model (3-5 Year)",
    description: "Three-statement financial model with base/upside/downside scenarios",
    requiredStages: ["series_a", "series_b"],
    canAutoRespond: true,
    dataSource: "scenarios",
  },
  {
    id: "irl-fin-05",
    category: "financial",
    subcategory: "Projections",
    item: "Current Year Budget",
    description: "Annual budget with monthly granularity",
    requiredStages: ["series_a", "series_b"],
    canAutoRespond: true,
    dataSource: "financial_periods (budget type)",
  },
  {
    id: "irl-fin-06",
    category: "financial",
    subcategory: "Revenue Detail",
    item: "MRR/ARR Bridge",
    description: "Monthly MRR bridge showing new, expansion, contraction, and churned MRR",
    requiredStages: ["series_a", "series_b"],
    canAutoRespond: true,
    dataSource: "metrics (mrr, new_mrr, expansion_mrr, churned_mrr)",
  },
  {
    id: "irl-fin-07",
    category: "financial",
    subcategory: "Revenue Detail",
    item: "Revenue by Customer",
    description: "Revenue breakdown by customer showing concentration",
    requiredStages: ["series_a", "series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-fin-08",
    category: "financial",
    subcategory: "Revenue Detail",
    item: "Deferred Revenue Schedule",
    description: "Monthly deferred revenue roll-forward",
    requiredStages: ["series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-fin-09",
    category: "financial",
    subcategory: "Revenue Detail",
    item: "Customer Concentration Analysis",
    description: "Top 10/20 customer revenue contribution analysis",
    requiredStages: ["series_a", "series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-fin-10",
    category: "financial",
    subcategory: "KPIs",
    item: "SaaS Metrics Dashboard",
    description: "Monthly KPI report with trailing 12-24 months of key metrics",
    requiredStages: ["series_a", "series_b"],
    canAutoRespond: true,
    dataSource: "metrics table",
  },
  {
    id: "irl-fin-11",
    category: "financial",
    subcategory: "Banking",
    item: "Bank Statements (12 months)",
    description: "All bank account statements for the trailing 12 months",
    requiredStages: ["series_a", "series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-fin-12",
    category: "financial",
    subcategory: "Banking",
    item: "Outstanding Debt Schedule",
    description: "Summary of all outstanding debt, credit lines, and loan agreements",
    requiredStages: ["series_a", "series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-fin-13",
    category: "financial",
    subcategory: "Historical Financials",
    item: "Basic Financial Summary",
    description: "Summary of revenue, expenses, and cash position",
    requiredStages: ["seed"],
    canAutoRespond: true,
    dataSource: "get_pnl_summary",
  },
  {
    id: "irl-fin-14",
    category: "financial",
    subcategory: "Revenue Detail",
    item: "Cohort Retention Analysis",
    description: "Customer cohort retention matrix with 24+ months of data",
    requiredStages: ["series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-fin-15",
    category: "financial",
    subcategory: "Projections",
    item: "Burn Rate & Runway Analysis",
    description: "Current burn rate calculation and runway projections",
    requiredStages: ["seed", "series_a", "series_b"],
    canAutoRespond: true,
    dataSource: "calculate_runway",
  },

  // ─── Tax & Compliance ──────────────────────────────────────────────
  {
    id: "irl-tax-01",
    category: "tax",
    subcategory: "Federal",
    item: "Federal Tax Returns (3 years)",
    description: "Federal income tax returns for the last 3 fiscal years",
    requiredStages: ["series_a", "series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-tax-02",
    category: "tax",
    subcategory: "State",
    item: "State Tax Returns",
    description: "All state income tax returns for all jurisdictions",
    requiredStages: ["series_a", "series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-tax-03",
    category: "tax",
    subcategory: "Compliance",
    item: "Delaware Franchise Tax",
    description: "Proof of Delaware franchise tax payments current",
    requiredStages: ["series_a", "series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-tax-04",
    category: "tax",
    subcategory: "Credits",
    item: "R&D Tax Credit Documentation",
    description: "R&D tax credit studies and supporting documentation",
    requiredStages: ["series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-tax-05",
    category: "tax",
    subcategory: "Sales Tax",
    item: "Sales Tax Nexus Analysis",
    description: "Sales tax nexus analysis and registration status across states",
    requiredStages: ["series_b"],
    canAutoRespond: false,
  },

  // ─── Human Resources ───────────────────────────────────────────────
  {
    id: "irl-hr-01",
    category: "hr",
    subcategory: "Organization",
    item: "Organization Chart",
    description: "Current org chart showing reporting structure",
    requiredStages: ["series_a", "series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-hr-02",
    category: "hr",
    subcategory: "Organization",
    item: "Employee Census",
    description: "Full employee list with titles, start dates, compensation, and equity",
    requiredStages: ["series_a", "series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-hr-03",
    category: "hr",
    subcategory: "Agreements",
    item: "Employment Agreements",
    description: "All employment and contractor agreements",
    requiredStages: ["series_a", "series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-hr-04",
    category: "hr",
    subcategory: "Agreements",
    item: "PIIA Agreements",
    description: "Proprietary Information and Inventions Assignment agreements for all team members",
    requiredStages: ["seed", "series_a", "series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-hr-05",
    category: "hr",
    subcategory: "Plans",
    item: "Hiring Plan",
    description: "Planned headcount additions with timeline and budget",
    requiredStages: ["series_a", "series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-hr-06",
    category: "hr",
    subcategory: "Compliance",
    item: "Employee Handbook",
    description: "Current employee handbook and policies",
    requiredStages: ["series_b"],
    canAutoRespond: false,
  },

  // ─── Revenue & Customer Data (SaaS-specific) ──────────────────────
  {
    id: "irl-rev-01",
    category: "financial",
    subcategory: "Revenue Detail",
    item: "Customer List with Contract Values",
    description: "Complete customer list with ACV/ARR values and contract terms",
    requiredStages: ["series_a", "series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-rev-02",
    category: "financial",
    subcategory: "Revenue Detail",
    item: "Sales Pipeline Data",
    description: "Current pipeline with stages, values, and expected close dates",
    requiredStages: ["series_a", "series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-rev-03",
    category: "financial",
    subcategory: "Revenue Detail",
    item: "CAC/LTV Calculations & Methodology",
    description: "Detailed CAC and LTV calculations with methodology documentation",
    requiredStages: ["series_a", "series_b"],
    canAutoRespond: true,
    dataSource: "metrics (cac, ltv, ltv_cac_ratio)",
  },

  // ─── IP & Technology ───────────────────────────────────────────────
  {
    id: "irl-ip-01",
    category: "product_tech",
    subcategory: "IP",
    item: "IP Assignment Agreements",
    description: "All intellectual property assignment agreements",
    requiredStages: ["seed", "series_a", "series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-ip-02",
    category: "product_tech",
    subcategory: "IP",
    item: "Patent & Trademark Registrations",
    description: "List of all patents (pending and granted) and trademarks",
    requiredStages: ["series_a", "series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-ip-03",
    category: "product_tech",
    subcategory: "Technology",
    item: "Open Source Audit",
    description: "Summary of open-source dependencies and license compliance",
    requiredStages: ["series_b"],
    canAutoRespond: false,
  },

  // ─── Legal ─────────────────────────────────────────────────────────
  {
    id: "irl-legal-01",
    category: "legal",
    subcategory: "Contracts",
    item: "Top Customer Contracts",
    description: "Top 10-20 customer contracts by ARR value",
    requiredStages: ["series_a", "series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-legal-02",
    category: "legal",
    subcategory: "Contracts",
    item: "Key Vendor Agreements",
    description: "Material vendor and service provider agreements",
    requiredStages: ["series_a", "series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-legal-03",
    category: "legal",
    subcategory: "Litigation",
    item: "Litigation Summary",
    description: "Summary of pending, settled, and threatened litigation",
    requiredStages: ["series_a", "series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-legal-04",
    category: "legal",
    subcategory: "Compliance",
    item: "Privacy Policy & Data Protection",
    description: "Privacy policies, DPA templates, and data processing documentation",
    requiredStages: ["series_b"],
    canAutoRespond: false,
  },

  // ─── Fundraising Materials ─────────────────────────────────────────
  {
    id: "irl-fund-01",
    category: "fundraising",
    subcategory: "Materials",
    item: "Pitch Deck",
    description: "Current investor pitch deck",
    requiredStages: ["seed", "series_a", "series_b"],
    canAutoRespond: false,
  },
  {
    id: "irl-fund-02",
    category: "fundraising",
    subcategory: "Materials",
    item: "Executive Summary",
    description: "One-page executive summary of the business",
    requiredStages: ["series_a", "series_b"],
    canAutoRespond: false,
  },
];

/**
 * Returns IRL items filtered by the given funding stage.
 */
export function getIRLForStage(stage: string): IRLItem[] {
  return IRL_TEMPLATE_ITEMS.filter((item) =>
    item.requiredStages.includes(stage)
  );
}

/**
 * Returns the count of IRL items per category for a given stage.
 */
export function getIRLCategoryCounts(
  stage: string
): Record<string, number> {
  const items = getIRLForStage(stage);
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.category] = (counts[item.category] ?? 0) + 1;
  }
  return counts;
}
