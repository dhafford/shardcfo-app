/**
 * Industry-specific financial statement templates.
 *
 * Every template uses the SAME section structure:
 *   Revenue → Cost of Revenue → Gross Profit
 *   → R&D → S&M → G&A → EBITDA
 *   → Other Income (Expense) → Net Income
 *
 * Balance Sheet and Cash Flow sections are also defined here.
 *
 * Only the suggested line items vary per industry.
 * Templates sourced from 12 industry-specific Excel workbooks.
 */

import type { StatementType } from "./statement-detection";

// ---------------------------------------------------------------------------
// Statement sections — IS, BS, CF
// ---------------------------------------------------------------------------

export interface StatementSection {
  id: string;
  label: string;
  order: number;
  calculated?: boolean;
  /** Template categories that map into this section */
  accountCategories: string[];
  /** Sign convention: 1 = positive adds to income, -1 = subtracted */
  sign: 1 | -1;
  /** Which financial statement this section belongs to */
  statementType: StatementType;
}

export const STATEMENT_SECTIONS: StatementSection[] = [
  // ── Income Statement ────────────────────────────────────────────────
  { id: "revenue", label: "Revenue", order: 1, accountCategories: ["revenue"], sign: 1, statementType: "income_statement" },
  { id: "cogs", label: "Cost of Revenue", order: 2, accountCategories: ["cogs"], sign: -1, statementType: "income_statement" },
  { id: "gross_profit", label: "Gross Profit", order: 3, calculated: true, accountCategories: [], sign: 1, statementType: "income_statement" },
  { id: "rd", label: "Research & Development", order: 4, accountCategories: ["rd_expense"], sign: -1, statementType: "income_statement" },
  { id: "sm", label: "Sales & Marketing", order: 5, accountCategories: ["sm_expense"], sign: -1, statementType: "income_statement" },
  { id: "ga", label: "General & Administrative", order: 6, accountCategories: ["ga_expense", "operating_expense"], sign: -1, statementType: "income_statement" },
  { id: "ebitda", label: "EBITDA", order: 7, calculated: true, accountCategories: [], sign: 1, statementType: "income_statement" },
  { id: "other_income_expense", label: "Other Income (Expense)", order: 8, accountCategories: ["other_income", "other_expense"], sign: -1, statementType: "income_statement" },
  { id: "net_income", label: "Net Income", order: 9, calculated: true, accountCategories: [], sign: 1, statementType: "income_statement" },

  // ── Balance Sheet ───────────────────────────────────────────────────
  { id: "current_assets", label: "Current Assets", order: 101, accountCategories: ["asset_current"], sign: 1, statementType: "balance_sheet" },
  { id: "non_current_assets", label: "Non-Current Assets", order: 102, accountCategories: ["asset_non_current"], sign: 1, statementType: "balance_sheet" },
  { id: "total_assets", label: "Total Assets", order: 103, calculated: true, accountCategories: [], sign: 1, statementType: "balance_sheet" },
  { id: "current_liabilities", label: "Current Liabilities", order: 104, accountCategories: ["liability_current"], sign: 1, statementType: "balance_sheet" },
  { id: "long_term_liabilities", label: "Long-Term Liabilities", order: 105, accountCategories: ["liability_long_term"], sign: 1, statementType: "balance_sheet" },
  { id: "total_liabilities", label: "Total Liabilities", order: 106, calculated: true, accountCategories: [], sign: 1, statementType: "balance_sheet" },
  { id: "stockholders_equity", label: "Stockholders' Equity", order: 107, accountCategories: ["equity"], sign: 1, statementType: "balance_sheet" },
  { id: "total_liabilities_equity", label: "Total Liabilities & Equity", order: 108, calculated: true, accountCategories: [], sign: 1, statementType: "balance_sheet" },

  // ── Cash Flow Statement ─────────────────────────────────────────────
  { id: "cfo", label: "Cash from Operations", order: 201, accountCategories: ["cfo"], sign: 1, statementType: "cash_flow" },
  { id: "cfi", label: "Cash from Investing", order: 202, accountCategories: ["cfi"], sign: 1, statementType: "cash_flow" },
  { id: "cff", label: "Cash from Financing", order: 203, accountCategories: ["cff"], sign: 1, statementType: "cash_flow" },
  { id: "net_change_cash", label: "Net Change in Cash", order: 204, calculated: true, accountCategories: [], sign: 1, statementType: "cash_flow" },
];

/** Only IS sections that hold actual line items (not calculated rows). Backward-compatible. */
export const LINE_ITEM_SECTIONS = STATEMENT_SECTIONS.filter(
  (s) => !s.calculated && s.statementType === "income_statement"
);

/** All sections filtered by statement type. */
export const IS_SECTIONS = STATEMENT_SECTIONS.filter((s) => s.statementType === "income_statement");
export const BS_SECTIONS = STATEMENT_SECTIONS.filter((s) => s.statementType === "balance_sheet");
export const CF_SECTIONS = STATEMENT_SECTIONS.filter((s) => s.statementType === "cash_flow");

/** Get all sections for a given statement type. */
export function getSectionsForType(type: StatementType): StatementSection[] {
  return STATEMENT_SECTIONS.filter((s) => s.statementType === type);
}

/** Get non-calculated sections for a given statement type. */
export function getLineItemSectionsForType(type: StatementType): StatementSection[] {
  return STATEMENT_SECTIONS.filter((s) => s.statementType === type && !s.calculated);
}

/** Map from template category → section ID */
export const CATEGORY_TO_SECTION: Record<string, string> = {};
for (const section of STATEMENT_SECTIONS) {
  for (const cat of section.accountCategories) {
    CATEGORY_TO_SECTION[cat] = section.id;
  }
}

/**
 * Map template categories back to DB-compatible categories.
 * The DB schema uses broad categories (operating_expense, other_income, etc.)
 * while the template system uses finer-grained ones (rd_expense, sm_expense, etc.).
 */
export const TEMPLATE_TO_DB_CATEGORY: Record<string, string> = {
  // Income Statement
  revenue: "revenue",
  cogs: "cogs",
  rd_expense: "operating_expense",
  sm_expense: "operating_expense",
  ga_expense: "operating_expense",
  operating_expense: "operating_expense",
  other_income: "other_income",
  other_expense: "other_expense",
  // Balance Sheet
  asset_current: "asset",
  asset_non_current: "asset",
  liability_current: "liability",
  liability_long_term: "liability",
  equity: "equity",
  // Cash Flow
  cfo: "operating_expense",
  cfi: "asset",
  cff: "liability",
};

// ---------------------------------------------------------------------------
// Industry templates
// ---------------------------------------------------------------------------

export interface SuggestedAccount {
  name: string;
  category: string;
}

export interface IndustryTemplate {
  id: string;
  label: string;
  /** Lowercase keywords to match against company.industry */
  matchPatterns: string[];
  /** Suggested line items per section ID */
  sections: Record<string, SuggestedAccount[]>;
}

export const INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  {
    id: "ai_ml",
    label: "AI / Machine Learning",
    matchPatterns: ["ai", "ml", "machine learning", "artificial intelligence", "deep learning", "neural", "llm", "generative"],
    sections: {
      revenue: [
        { name: "Subscription & Platform Revenue", category: "revenue" },
        { name: "Usage-Based / Consumption Revenue (Compute & API)", category: "revenue" },
        { name: "Model Licensing & Royalty Revenue", category: "revenue" },
        { name: "Professional Services & Custom Model Revenue", category: "revenue" },
        { name: "Other Revenue", category: "revenue" },
      ],
      cogs: [
        { name: "GPU / Compute Infrastructure Costs", category: "cogs" },
        { name: "Third-Party Model & Data Licensing", category: "cogs" },
        { name: "Training Data Acquisition & Annotation", category: "cogs" },
        { name: "Customer Support Costs", category: "cogs" },
        { name: "Capitalized Model Development Amortization", category: "cogs" },
      ],
      rd: [
        { name: "Salaries & Benefits — Research Scientists & Engineers", category: "rd_expense" },
        { name: "Compute Costs — Research & Experimentation", category: "rd_expense" },
        { name: "Data Infrastructure & Tooling", category: "rd_expense" },
        { name: "Contractor & Outsourced Development", category: "rd_expense" },
      ],
      sm: [
        { name: "Salaries & Benefits — Sales", category: "sm_expense" },
        { name: "Salaries & Benefits — Marketing", category: "sm_expense" },
        { name: "Customer Acquisition Costs", category: "sm_expense" },
        { name: "Events, Conferences & Research Publications", category: "sm_expense" },
        { name: "Partner & Channel Commissions", category: "sm_expense" },
      ],
      ga: [
        { name: "Salaries & Benefits — G&A", category: "ga_expense" },
        { name: "Rent & Facilities", category: "ga_expense" },
        { name: "Insurance", category: "ga_expense" },
        { name: "Legal, IP & Professional Fees", category: "ga_expense" },
        { name: "Depreciation & Amortization (Non-COGS)", category: "ga_expense" },
      ],
      other_income_expense: [
        { name: "Interest Income", category: "other_income" },
        { name: "Interest Expense", category: "other_expense" },
        { name: "Other Income (Expense), Net", category: "other_income" },
        { name: "Income Tax Expense (Benefit)", category: "other_expense" },
      ],
    },
  },
  {
    id: "data_analytics",
    label: "Data & Analytics",
    matchPatterns: ["data", "analytics", "business intelligence", "bi", "data platform", "data analytics"],
    sections: {
      revenue: [
        { name: "Subscription & Platform Revenue", category: "revenue" },
        { name: "Usage-Based / Consumption Revenue", category: "revenue" },
        { name: "Data Licensing & Marketplace Revenue", category: "revenue" },
        { name: "Professional Services & Consulting Revenue", category: "revenue" },
        { name: "Other Revenue", category: "revenue" },
      ],
      cogs: [
        { name: "Hosting & Cloud Infrastructure Costs", category: "cogs" },
        { name: "Third-Party Data Acquisition & Licensing", category: "cogs" },
        { name: "Customer Support Costs", category: "cogs" },
        { name: "Payment Processing Fees", category: "cogs" },
        { name: "Capitalized Software Amortization", category: "cogs" },
      ],
      rd: [
        { name: "Salaries & Benefits — Engineering", category: "rd_expense" },
        { name: "Data Infrastructure & Pipeline Tooling", category: "rd_expense" },
        { name: "Cloud Dev/Test Costs", category: "rd_expense" },
        { name: "Contractor & Outsourced Development", category: "rd_expense" },
      ],
      sm: [
        { name: "Salaries & Benefits — Sales", category: "sm_expense" },
        { name: "Salaries & Benefits — Marketing", category: "sm_expense" },
        { name: "Customer Acquisition Costs", category: "sm_expense" },
        { name: "Events & Conferences", category: "sm_expense" },
        { name: "Partner & Channel Commissions", category: "sm_expense" },
      ],
      ga: [
        { name: "Salaries & Benefits — G&A", category: "ga_expense" },
        { name: "Rent & Facilities", category: "ga_expense" },
        { name: "Insurance", category: "ga_expense" },
        { name: "Legal & Professional Fees", category: "ga_expense" },
        { name: "Depreciation & Amortization (Non-COGS)", category: "ga_expense" },
      ],
      other_income_expense: [
        { name: "Interest Income", category: "other_income" },
        { name: "Interest Expense", category: "other_expense" },
        { name: "Other Income (Expense), Net", category: "other_income" },
        { name: "Income Tax Expense (Benefit)", category: "other_expense" },
      ],
    },
  },
  {
    id: "devtools",
    label: "Developer Tools",
    matchPatterns: ["devtools", "developer tools", "developer platform", "dev tools", "api platform", "open source", "ci/cd"],
    sections: {
      revenue: [
        { name: "Subscription Revenue", category: "revenue" },
        { name: "Usage-Based / Consumption Revenue", category: "revenue" },
        { name: "Marketplace & Add-On Revenue", category: "revenue" },
        { name: "Professional Services & Training Revenue", category: "revenue" },
        { name: "Other Revenue", category: "revenue" },
      ],
      cogs: [
        { name: "Hosting & Infrastructure Costs", category: "cogs" },
        { name: "Open Source Maintenance & Support", category: "cogs" },
        { name: "Customer Support Costs", category: "cogs" },
        { name: "Payment Processing Fees", category: "cogs" },
        { name: "Capitalized Software Amortization", category: "cogs" },
      ],
      rd: [
        { name: "Salaries & Benefits — Engineering", category: "rd_expense" },
        { name: "Open Source Community Investment", category: "rd_expense" },
        { name: "Cloud Dev/Test Costs", category: "rd_expense" },
        { name: "Contractor & Outsourced Development", category: "rd_expense" },
      ],
      sm: [
        { name: "Salaries & Benefits — Sales", category: "sm_expense" },
        { name: "Salaries & Benefits — Marketing", category: "sm_expense" },
        { name: "Developer Advocacy & Community", category: "sm_expense" },
        { name: "Events, Conferences & Hackathons", category: "sm_expense" },
        { name: "Partner & Channel Commissions", category: "sm_expense" },
      ],
      ga: [
        { name: "Salaries & Benefits — G&A", category: "ga_expense" },
        { name: "Rent & Facilities", category: "ga_expense" },
        { name: "Insurance", category: "ga_expense" },
        { name: "Legal & Professional Fees", category: "ga_expense" },
        { name: "Depreciation & Amortization (Non-COGS)", category: "ga_expense" },
      ],
      other_income_expense: [
        { name: "Interest Income", category: "other_income" },
        { name: "Interest Expense", category: "other_expense" },
        { name: "Other Income (Expense), Net", category: "other_income" },
        { name: "Income Tax Expense (Benefit)", category: "other_expense" },
      ],
    },
  },
  {
    id: "ecommerce",
    label: "E-Commerce",
    matchPatterns: ["ecommerce", "e-commerce", "retail", "dtc", "direct to consumer", "marketplace", "shop", "store"],
    sections: {
      revenue: [
        { name: "Product Revenue", category: "revenue" },
        { name: "Marketplace / Platform Revenue", category: "revenue" },
        { name: "Shipping & Delivery Revenue", category: "revenue" },
        { name: "Advertising & Sponsored Listing Revenue", category: "revenue" },
        { name: "Other Revenue", category: "revenue" },
      ],
      cogs: [
        { name: "Cost of Goods Sold (Product)", category: "cogs" },
        { name: "Fulfillment & Warehousing Costs", category: "cogs" },
        { name: "Shipping & Delivery Costs", category: "cogs" },
        { name: "Payment Processing Fees", category: "cogs" },
        { name: "Inventory Write-Downs & Shrinkage", category: "cogs" },
      ],
      rd: [
        { name: "Salaries & Benefits — Engineering", category: "rd_expense" },
        { name: "Cloud Infrastructure (Dev)", category: "rd_expense" },
        { name: "Contractor & Outsourced Development", category: "rd_expense" },
        { name: "Software Tools & Licenses", category: "rd_expense" },
      ],
      sm: [
        { name: "Salaries & Benefits — Sales", category: "sm_expense" },
        { name: "Salaries & Benefits — Marketing", category: "sm_expense" },
        { name: "Performance Marketing & Paid Ads", category: "sm_expense" },
        { name: "Affiliate & Referral Commissions", category: "sm_expense" },
        { name: "Promotions & Discounts", category: "sm_expense" },
      ],
      ga: [
        { name: "Salaries & Benefits — G&A", category: "ga_expense" },
        { name: "Rent & Facilities", category: "ga_expense" },
        { name: "Insurance", category: "ga_expense" },
        { name: "Legal & Professional Fees", category: "ga_expense" },
        { name: "Depreciation & Amortization (Non-COGS)", category: "ga_expense" },
      ],
      other_income_expense: [
        { name: "Interest Income", category: "other_income" },
        { name: "Interest Expense", category: "other_expense" },
        { name: "Other Income (Expense), Net", category: "other_income" },
        { name: "Income Tax Expense (Benefit)", category: "other_expense" },
      ],
    },
  },
  {
    id: "edtech",
    label: "EdTech",
    matchPatterns: ["edtech", "education", "learning", "courseware", "e-learning", "lms", "training platform"],
    sections: {
      revenue: [
        { name: "Subscription Revenue (B2C)", category: "revenue" },
        { name: "Institutional / Enterprise License Revenue (B2B)", category: "revenue" },
        { name: "Content & Courseware Revenue", category: "revenue" },
        { name: "Certification & Assessment Revenue", category: "revenue" },
        { name: "Other Revenue", category: "revenue" },
      ],
      cogs: [
        { name: "Content Development & Licensing", category: "cogs" },
        { name: "Hosting & Infrastructure Costs", category: "cogs" },
        { name: "Instructor & Facilitator Costs", category: "cogs" },
        { name: "Payment Processing Fees", category: "cogs" },
        { name: "Capitalized Content Amortization", category: "cogs" },
      ],
      rd: [
        { name: "Salaries & Benefits — Engineering", category: "rd_expense" },
        { name: "Curriculum & Instructional Design", category: "rd_expense" },
        { name: "Cloud Dev/Test Costs", category: "rd_expense" },
        { name: "Contractor & Outsourced Development", category: "rd_expense" },
      ],
      sm: [
        { name: "Salaries & Benefits — Sales", category: "sm_expense" },
        { name: "Salaries & Benefits — Marketing", category: "sm_expense" },
        { name: "Student / User Acquisition Costs", category: "sm_expense" },
        { name: "Advertising & Demand Generation", category: "sm_expense" },
        { name: "Partner & Affiliate Commissions", category: "sm_expense" },
      ],
      ga: [
        { name: "Salaries & Benefits — G&A", category: "ga_expense" },
        { name: "Rent & Facilities", category: "ga_expense" },
        { name: "Insurance", category: "ga_expense" },
        { name: "Legal & Professional Fees", category: "ga_expense" },
        { name: "Depreciation & Amortization (Non-COGS)", category: "ga_expense" },
      ],
      other_income_expense: [
        { name: "Interest Income", category: "other_income" },
        { name: "Interest Expense", category: "other_expense" },
        { name: "Other Income (Expense), Net", category: "other_income" },
        { name: "Income Tax Expense (Benefit)", category: "other_expense" },
      ],
    },
  },
  {
    id: "fintech",
    label: "Fintech / Financial Services",
    matchPatterns: ["fintech", "financial", "banking", "payments", "lending", "insurance tech", "insurtech", "crypto", "defi", "neobank"],
    sections: {
      revenue: [
        { name: "Transaction & Processing Revenue", category: "revenue" },
        { name: "Interchange Revenue", category: "revenue" },
        { name: "Subscription & Platform Fees", category: "revenue" },
        { name: "Interest Income on Loans", category: "revenue" },
        { name: "Other Revenue", category: "revenue" },
      ],
      cogs: [
        { name: "Payment Processing & Network Costs", category: "cogs" },
        { name: "Interchange & Network Fees", category: "cogs" },
        { name: "Provision for Loan Losses", category: "cogs" },
        { name: "Fraud & Chargeback Losses", category: "cogs" },
        { name: "Compliance & Regulatory Costs", category: "cogs" },
      ],
      rd: [
        { name: "Salaries & Benefits — Engineering", category: "rd_expense" },
        { name: "Cloud Infrastructure (Dev)", category: "rd_expense" },
        { name: "Security & Compliance Tools", category: "rd_expense" },
        { name: "Contractor & Outsourced Development", category: "rd_expense" },
      ],
      sm: [
        { name: "Salaries & Benefits — Sales", category: "sm_expense" },
        { name: "Salaries & Benefits — Marketing", category: "sm_expense" },
        { name: "Customer Acquisition Costs", category: "sm_expense" },
        { name: "Partner & Referral Fees", category: "sm_expense" },
        { name: "Brand & Advertising", category: "sm_expense" },
      ],
      ga: [
        { name: "Salaries & Benefits — G&A", category: "ga_expense" },
        { name: "Rent & Facilities", category: "ga_expense" },
        { name: "Insurance", category: "ga_expense" },
        { name: "Legal, Regulatory & Licensing Fees", category: "ga_expense" },
        { name: "Depreciation & Amortization (Non-COGS)", category: "ga_expense" },
      ],
      other_income_expense: [
        { name: "Interest Income", category: "other_income" },
        { name: "Interest Expense", category: "other_expense" },
        { name: "Other Income (Expense), Net", category: "other_income" },
        { name: "Income Tax Expense (Benefit)", category: "other_expense" },
      ],
    },
  },
  {
    id: "healthtech",
    label: "HealthTech",
    matchPatterns: ["healthtech", "health tech", "health", "healthcare", "biotech", "pharma", "medical", "clinic", "hospital", "wellness", "telehealth", "digital health"],
    sections: {
      revenue: [
        { name: "Subscription & Platform Revenue", category: "revenue" },
        { name: "Per-Transaction / Per-Claim Revenue", category: "revenue" },
        { name: "Data & Analytics Revenue", category: "revenue" },
        { name: "Implementation & Services Revenue", category: "revenue" },
        { name: "Other Revenue", category: "revenue" },
      ],
      cogs: [
        { name: "Hosting & Infrastructure Costs", category: "cogs" },
        { name: "Data Acquisition & Licensing", category: "cogs" },
        { name: "Claims Processing Costs", category: "cogs" },
        { name: "Implementation & Onboarding Costs", category: "cogs" },
        { name: "Capitalized Software Amortization", category: "cogs" },
      ],
      rd: [
        { name: "Salaries & Benefits — Engineering", category: "rd_expense" },
        { name: "Clinical & Regulatory R&D", category: "rd_expense" },
        { name: "Cloud Dev/Test Costs", category: "rd_expense" },
        { name: "Contractor & Outsourced Development", category: "rd_expense" },
      ],
      sm: [
        { name: "Salaries & Benefits — Sales", category: "sm_expense" },
        { name: "Salaries & Benefits — Marketing", category: "sm_expense" },
        { name: "Customer Acquisition Costs", category: "sm_expense" },
        { name: "Events & Conferences", category: "sm_expense" },
        { name: "Channel & Reseller Commissions", category: "sm_expense" },
      ],
      ga: [
        { name: "Salaries & Benefits — G&A", category: "ga_expense" },
        { name: "Rent & Facilities", category: "ga_expense" },
        { name: "Insurance (incl. Malpractice / E&O)", category: "ga_expense" },
        { name: "Legal, Regulatory & Compliance", category: "ga_expense" },
        { name: "Depreciation & Amortization (Non-COGS)", category: "ga_expense" },
      ],
      other_income_expense: [
        { name: "Interest Income", category: "other_income" },
        { name: "Interest Expense", category: "other_expense" },
        { name: "Other Income (Expense), Net", category: "other_income" },
        { name: "Income Tax Expense (Benefit)", category: "other_expense" },
      ],
    },
  },
  {
    id: "infrastructure",
    label: "Infrastructure / Cloud",
    matchPatterns: ["infrastructure", "cloud", "iaas", "paas", "hosting", "data center", "cdn", "devops platform"],
    sections: {
      revenue: [
        { name: "Subscription & Platform Revenue", category: "revenue" },
        { name: "Usage-Based / Consumption Revenue", category: "revenue" },
        { name: "Managed Services Revenue", category: "revenue" },
        { name: "License & Support Revenue", category: "revenue" },
        { name: "Other Revenue", category: "revenue" },
      ],
      cogs: [
        { name: "Data Center & Cloud Infrastructure Costs", category: "cogs" },
        { name: "Bandwidth & Network Costs", category: "cogs" },
        { name: "Hardware & Equipment Depreciation", category: "cogs" },
        { name: "Customer Support Costs", category: "cogs" },
        { name: "Capitalized Software Amortization", category: "cogs" },
      ],
      rd: [
        { name: "Salaries & Benefits — Engineering", category: "rd_expense" },
        { name: "Cloud Dev/Test Costs", category: "rd_expense" },
        { name: "Hardware R&D & Prototyping", category: "rd_expense" },
        { name: "Contractor & Outsourced Development", category: "rd_expense" },
      ],
      sm: [
        { name: "Salaries & Benefits — Sales", category: "sm_expense" },
        { name: "Salaries & Benefits — Marketing", category: "sm_expense" },
        { name: "Customer Acquisition Costs", category: "sm_expense" },
        { name: "Events & Conferences", category: "sm_expense" },
        { name: "Partner & Channel Commissions", category: "sm_expense" },
      ],
      ga: [
        { name: "Salaries & Benefits — G&A", category: "ga_expense" },
        { name: "Rent & Facilities", category: "ga_expense" },
        { name: "Insurance", category: "ga_expense" },
        { name: "Legal & Professional Fees", category: "ga_expense" },
        { name: "Depreciation & Amortization (Non-COGS)", category: "ga_expense" },
      ],
      other_income_expense: [
        { name: "Interest Income", category: "other_income" },
        { name: "Interest Expense", category: "other_expense" },
        { name: "Other Income (Expense), Net", category: "other_income" },
        { name: "Income Tax Expense (Benefit)", category: "other_expense" },
      ],
    },
  },
  {
    id: "markettech",
    label: "Marketing Technology",
    matchPatterns: ["martech", "marketing tech", "marketing technology", "adtech", "ad tech", "advertising technology", "marketing automation"],
    sections: {
      revenue: [
        { name: "Subscription & Platform Revenue", category: "revenue" },
        { name: "Usage-Based / Consumption Revenue", category: "revenue" },
        { name: "Managed Services Revenue", category: "revenue" },
        { name: "Data & Analytics Revenue", category: "revenue" },
        { name: "Other Revenue", category: "revenue" },
      ],
      cogs: [
        { name: "Hosting & Infrastructure Costs", category: "cogs" },
        { name: "Third-Party Data & API Costs", category: "cogs" },
        { name: "Ad Serving & Delivery Costs", category: "cogs" },
        { name: "Customer Support Costs", category: "cogs" },
        { name: "Capitalized Software Amortization", category: "cogs" },
      ],
      rd: [
        { name: "Salaries & Benefits — Engineering", category: "rd_expense" },
        { name: "Cloud Dev/Test Costs", category: "rd_expense" },
        { name: "Contractor & Outsourced Development", category: "rd_expense" },
        { name: "Software Tools & Licenses", category: "rd_expense" },
      ],
      sm: [
        { name: "Salaries & Benefits — Sales", category: "sm_expense" },
        { name: "Salaries & Benefits — Marketing", category: "sm_expense" },
        { name: "Customer Acquisition Costs", category: "sm_expense" },
        { name: "Events & Conferences", category: "sm_expense" },
        { name: "Partner & Channel Commissions", category: "sm_expense" },
      ],
      ga: [
        { name: "Salaries & Benefits — G&A", category: "ga_expense" },
        { name: "Rent & Facilities", category: "ga_expense" },
        { name: "Insurance", category: "ga_expense" },
        { name: "Legal & Professional Fees", category: "ga_expense" },
        { name: "Depreciation & Amortization (Non-COGS)", category: "ga_expense" },
      ],
      other_income_expense: [
        { name: "Interest Income", category: "other_income" },
        { name: "Interest Expense", category: "other_expense" },
        { name: "Other Income (Expense), Net", category: "other_income" },
        { name: "Income Tax Expense (Benefit)", category: "other_expense" },
      ],
    },
  },
  {
    id: "saas",
    label: "SaaS",
    matchPatterns: ["saas", "software", "software as a service", "platform", "tech", "technology"],
    sections: {
      revenue: [
        { name: "Subscription Revenue", category: "revenue" },
        { name: "Professional Services Revenue", category: "revenue" },
        { name: "Usage-Based Revenue", category: "revenue" },
        { name: "Other Revenue", category: "revenue" },
      ],
      cogs: [
        { name: "Hosting & Infrastructure Costs", category: "cogs" },
        { name: "Customer Support Costs", category: "cogs" },
        { name: "Professional Services Costs", category: "cogs" },
        { name: "Payment Processing Fees", category: "cogs" },
        { name: "Capitalized Software Amortization", category: "cogs" },
      ],
      rd: [
        { name: "Salaries & Benefits — Engineering", category: "rd_expense" },
        { name: "Cloud Dev/Test Environment Costs", category: "rd_expense" },
        { name: "Contractor & Outsourced Development", category: "rd_expense" },
        { name: "Software Tools & Licenses", category: "rd_expense" },
      ],
      sm: [
        { name: "Salaries & Benefits — Sales", category: "sm_expense" },
        { name: "Salaries & Benefits — Marketing", category: "sm_expense" },
        { name: "Advertising & Demand Generation", category: "sm_expense" },
        { name: "Events & Conferences", category: "sm_expense" },
        { name: "Partner & Channel Commissions", category: "sm_expense" },
      ],
      ga: [
        { name: "Salaries & Benefits — G&A", category: "ga_expense" },
        { name: "Rent & Facilities", category: "ga_expense" },
        { name: "Insurance", category: "ga_expense" },
        { name: "Legal & Professional Fees", category: "ga_expense" },
        { name: "Depreciation & Amortization (Non-COGS)", category: "ga_expense" },
      ],
      other_income_expense: [
        { name: "Interest Income", category: "other_income" },
        { name: "Interest Expense", category: "other_expense" },
        { name: "Other Income (Expense), Net", category: "other_income" },
        { name: "Income Tax Expense (Benefit)", category: "other_expense" },
      ],
    },
  },
  {
    id: "security",
    label: "Cybersecurity",
    matchPatterns: ["security", "cybersecurity", "cyber", "infosec", "information security", "threat", "soc", "siem", "endpoint protection"],
    sections: {
      revenue: [
        { name: "Subscription Revenue", category: "revenue" },
        { name: "License Revenue", category: "revenue" },
        { name: "Managed Security Services Revenue", category: "revenue" },
        { name: "Professional Services & Consulting Revenue", category: "revenue" },
        { name: "Other Revenue", category: "revenue" },
      ],
      cogs: [
        { name: "Hosting & Infrastructure Costs", category: "cogs" },
        { name: "Threat Intelligence & Data Feeds", category: "cogs" },
        { name: "Security Operations Center (SOC) Costs", category: "cogs" },
        { name: "Customer Support Costs", category: "cogs" },
        { name: "Capitalized Software Amortization", category: "cogs" },
      ],
      rd: [
        { name: "Salaries & Benefits — Engineering", category: "rd_expense" },
        { name: "Threat Research & Vulnerability Lab", category: "rd_expense" },
        { name: "Cloud Dev/Test Costs", category: "rd_expense" },
        { name: "Contractor & Outsourced Development", category: "rd_expense" },
      ],
      sm: [
        { name: "Salaries & Benefits — Sales", category: "sm_expense" },
        { name: "Salaries & Benefits — Marketing", category: "sm_expense" },
        { name: "Customer Acquisition Costs", category: "sm_expense" },
        { name: "Events & Conferences", category: "sm_expense" },
        { name: "Partner & Channel Commissions", category: "sm_expense" },
      ],
      ga: [
        { name: "Salaries & Benefits — G&A", category: "ga_expense" },
        { name: "Rent & Facilities", category: "ga_expense" },
        { name: "Insurance (incl. Cyber Liability)", category: "ga_expense" },
        { name: "Legal & Professional Fees", category: "ga_expense" },
        { name: "Depreciation & Amortization (Non-COGS)", category: "ga_expense" },
      ],
      other_income_expense: [
        { name: "Interest Income", category: "other_income" },
        { name: "Interest Expense", category: "other_expense" },
        { name: "Other Income (Expense), Net", category: "other_income" },
        { name: "Income Tax Expense (Benefit)", category: "other_expense" },
      ],
    },
  },
];

/** Fallback template used when no industry matches (from "Other" Excel template) */
export const DEFAULT_TEMPLATE: IndustryTemplate = {
  id: "other",
  label: "Other / General",
  matchPatterns: [],
  sections: {
    revenue: [
      { name: "Product Revenue", category: "revenue" },
      { name: "Service Revenue", category: "revenue" },
      { name: "Subscription Revenue", category: "revenue" },
      { name: "Usage-Based Revenue", category: "revenue" },
      { name: "Other Revenue", category: "revenue" },
    ],
    cogs: [
      { name: "Hosting & Infrastructure Costs", category: "cogs" },
      { name: "Direct Labor & Service Delivery", category: "cogs" },
      { name: "Third-Party Costs & Licensing", category: "cogs" },
      { name: "Payment Processing Fees", category: "cogs" },
      { name: "Depreciation & Amortization (COGS)", category: "cogs" },
    ],
    rd: [
      { name: "Salaries & Benefits — Engineering", category: "rd_expense" },
      { name: "Cloud Dev/Test Costs", category: "rd_expense" },
      { name: "Contractor & Outsourced Development", category: "rd_expense" },
      { name: "Software Tools & Licenses", category: "rd_expense" },
    ],
    sm: [
      { name: "Salaries & Benefits — Sales", category: "sm_expense" },
      { name: "Salaries & Benefits — Marketing", category: "sm_expense" },
      { name: "Customer Acquisition Costs", category: "sm_expense" },
      { name: "Events & Conferences", category: "sm_expense" },
      { name: "Partner & Channel Commissions", category: "sm_expense" },
    ],
    ga: [
      { name: "Salaries & Benefits — G&A", category: "ga_expense" },
      { name: "Rent & Facilities", category: "ga_expense" },
      { name: "Insurance", category: "ga_expense" },
      { name: "Legal & Professional Fees", category: "ga_expense" },
      { name: "Depreciation & Amortization (Non-COGS)", category: "ga_expense" },
    ],
    other_income_expense: [
      { name: "Interest Income", category: "other_income" },
      { name: "Interest Expense", category: "other_expense" },
      { name: "Other Income (Expense), Net", category: "other_income" },
      { name: "Income Tax Expense (Benefit)", category: "other_expense" },
    ],
  },
};

// ---------------------------------------------------------------------------
// Template matching
// ---------------------------------------------------------------------------

/** Find the best matching industry template for a company's industry string. */
export function matchIndustryTemplate(industry: string | null | undefined): IndustryTemplate {
  if (!industry) return DEFAULT_TEMPLATE;

  const normalized = industry.toLowerCase().trim();

  // Try exact ID match first
  const byId = INDUSTRY_TEMPLATES.find((t) => t.id === normalized);
  if (byId) return byId;

  // Try pattern matching — score by number of matching keywords
  let bestTemplate: IndustryTemplate | null = null;
  let bestScore = 0;

  for (const template of INDUSTRY_TEMPLATES) {
    let score = 0;
    for (const pattern of template.matchPatterns) {
      if (normalized.includes(pattern)) {
        score += pattern.length; // longer matches score higher
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestTemplate = template;
    }
  }

  return bestTemplate ?? DEFAULT_TEMPLATE;
}

// ---------------------------------------------------------------------------
// Categorize account names by keyword matching
// ---------------------------------------------------------------------------

interface CategoryKeyword {
  pattern: RegExp;
  category: string;
  /** If set, only match when context.statementType is in this list */
  statementTypes?: StatementType[];
}

const CATEGORY_KEYWORDS: CategoryKeyword[] = [
  // ── Income Statement keywords (universal — also match without context) ──

  // Other income/expense FIRST — specific patterns should not be caught by broader ones
  { pattern: /\b(interest income|dividend|gain on|investment income|grant income)\b/i, category: "other_income" },
  { pattern: /\b(interest expense|loss on|write.?off|bad debt|tax expense|income tax)\b/i, category: "other_expense" },
  // COGS signals (before revenue — "cost of sales/revenue" should match COGS not revenue)
  { pattern: /\b(cogs|cost of (goods|revenue|sales)|hosting|infrastructure|direct cost|payment processing|fulfillment|warehousing)\b/i, category: "cogs" },
  // R&D signals (before generic patterns)
  { pattern: /\b(r&d|research|development|engineering|dev.?ops|data infrastructure|compute cost|software tools|cloud dev)\b/i, category: "rd_expense" },
  // S&M signals (before revenue — "Sales & Marketing" should match S&M not revenue)
  { pattern: /\b(sales & marketing|sales &|marketing|advertising|customer acquisition|demand gen|events|conferences|partner.*commission|channel|brand|advocacy)\b/i, category: "sm_expense" },
  // G&A signals
  { pattern: /\b(general & admin|g&a|rent|facilities|insurance|legal|professional fees|depreciation|amortization|office|admin|executive|finance)\b/i, category: "ga_expense" },
  // Revenue signals LAST among line-item categories (broadest patterns)
  { pattern: /\b(revenue|sales|subscription|recurring|arr|mrr|license fee)\b/i, category: "revenue" },
  // Generic salary/wages → G&A as catch-all
  { pattern: /\b(salary|salaries|wages|benefits|travel)\b/i, category: "ga_expense" },

  // ── Balance Sheet: Current Assets ───────────────────────────────────
  { pattern: /\b(cash and cash equivalents|cash equivalents|petty cash)\b/i, category: "asset_current", statementTypes: ["balance_sheet"] },
  { pattern: /\b(cash|bank|checking|savings|money market)\b/i, category: "asset_current", statementTypes: ["balance_sheet"] },
  { pattern: /\b(accounts receivable|a\/r|trade receivable|receivable)\b/i, category: "asset_current", statementTypes: ["balance_sheet"] },
  { pattern: /\b(inventor(y|ies)|raw material|finished goods|work in progress|wip)\b/i, category: "asset_current", statementTypes: ["balance_sheet"] },
  { pattern: /\b(prepaid|prepayment|deposit|deferred charge|current portion of)\b/i, category: "asset_current", statementTypes: ["balance_sheet"] },
  { pattern: /\b(short.?term investment|marketable securit|certificate of deposit)\b/i, category: "asset_current", statementTypes: ["balance_sheet"] },
  { pattern: /\b(allowance for doubtful|allowance for bad)\b/i, category: "asset_current", statementTypes: ["balance_sheet"] },
  { pattern: /\b(other current asset)\b/i, category: "asset_current", statementTypes: ["balance_sheet"] },

  // ── Balance Sheet: Non-Current Assets ───────────────────────────────
  { pattern: /\b(property.?plant|pp&?e|fixed asset|furniture|vehicle|machinery|building|land|leasehold improvement)\b/i, category: "asset_non_current", statementTypes: ["balance_sheet"] },
  { pattern: /\b(intangible|goodwill|patent|trademark|copyright|intellectual property)\b/i, category: "asset_non_current", statementTypes: ["balance_sheet"] },
  { pattern: /\b(accumulated depreciation|accumulated amortization)\b/i, category: "asset_non_current", statementTypes: ["balance_sheet"] },
  { pattern: /\b(long.?term investment|investment in|right.?of.?use|lease asset|deferred tax asset)\b/i, category: "asset_non_current", statementTypes: ["balance_sheet"] },
  { pattern: /\b(capitalized software|construction in progress)\b/i, category: "asset_non_current", statementTypes: ["balance_sheet"] },
  { pattern: /\b(other (long.?term|non.?current) asset)\b/i, category: "asset_non_current", statementTypes: ["balance_sheet"] },

  // ── Balance Sheet: Current Liabilities ──────────────────────────────
  { pattern: /\b(accounts payable|a\/p|trade payable)\b/i, category: "liability_current", statementTypes: ["balance_sheet"] },
  { pattern: /\b(accrued|accrual|wages payable|salary payable|tax payable|interest payable|payroll)\b/i, category: "liability_current", statementTypes: ["balance_sheet"] },
  { pattern: /\b(short.?term (debt|loan|note)|line of credit|credit card|credit line)\b/i, category: "liability_current", statementTypes: ["balance_sheet"] },
  { pattern: /\b(unearned|deferred revenue|customer deposit|advance.* from customer)\b/i, category: "liability_current", statementTypes: ["balance_sheet"] },
  { pattern: /\b(current portion of long)\b/i, category: "liability_current", statementTypes: ["balance_sheet"] },
  { pattern: /\b(other current liabilit)\b/i, category: "liability_current", statementTypes: ["balance_sheet"] },

  // ── Balance Sheet: Long-Term Liabilities ────────────────────────────
  { pattern: /\b(long.?term (debt|loan|note|liabilit))\b/i, category: "liability_long_term", statementTypes: ["balance_sheet"] },
  { pattern: /\b(mortgage|bond payable|convertible note)\b/i, category: "liability_long_term", statementTypes: ["balance_sheet"] },
  { pattern: /\b(deferred tax liability|lease liability|pension|post.?retirement)\b/i, category: "liability_long_term", statementTypes: ["balance_sheet"] },
  { pattern: /\b(other (long.?term|non.?current) liabilit)\b/i, category: "liability_long_term", statementTypes: ["balance_sheet"] },

  // ── Balance Sheet: Equity ───────────────────────────────────────────
  { pattern: /\b(common stock|preferred stock|share capital|par value)\b/i, category: "equity", statementTypes: ["balance_sheet"] },
  { pattern: /\b(additional paid.?in|apic|paid in capital)\b/i, category: "equity", statementTypes: ["balance_sheet"] },
  { pattern: /\b(retained earnings|accumulated (deficit|surplus))\b/i, category: "equity", statementTypes: ["balance_sheet"] },
  { pattern: /\b(treasury stock|stock repurchase)\b/i, category: "equity", statementTypes: ["balance_sheet"] },
  { pattern: /\b(owner.?s (equity|capital|draw)|partner.?s capital|member.?s equity)\b/i, category: "equity", statementTypes: ["balance_sheet"] },
  { pattern: /\b(comprehensive (income|loss)|foreign currency translation|unrealized)\b/i, category: "equity", statementTypes: ["balance_sheet"] },
  { pattern: /\b(net income|net loss|current (year|period) earnings)\b/i, category: "equity", statementTypes: ["balance_sheet"] },

  // ── Cash Flow: Operating ────────────────────────────────────────────
  { pattern: /\b(depreciation|amortization)\b/i, category: "cfo", statementTypes: ["cash_flow"] },
  { pattern: /\b(stock.?based comp|share.?based comp)\b/i, category: "cfo", statementTypes: ["cash_flow"] },
  { pattern: /\b(deferred (tax|income tax|revenue))\b/i, category: "cfo", statementTypes: ["cash_flow"] },
  { pattern: /\b(non.?cash|working capital)\b/i, category: "cfo", statementTypes: ["cash_flow"] },
  { pattern: /\b(change in.*(receivable|payable|inventor|prepaid|accrued|deferred))\b/i, category: "cfo", statementTypes: ["cash_flow"] },
  { pattern: /\b((increase|decrease) in.*(receivable|payable|inventor|prepaid|accrued))\b/i, category: "cfo", statementTypes: ["cash_flow"] },
  { pattern: /\b(net income|net loss|net profit)\b/i, category: "cfo", statementTypes: ["cash_flow"] },
  { pattern: /\b(loss on disposal|gain on disposal|impairment)\b/i, category: "cfo", statementTypes: ["cash_flow"] },

  // ── Cash Flow: Investing ────────────────────────────────────────────
  { pattern: /\b(purchase of (equipment|property|asset|investment|securit))\b/i, category: "cfi", statementTypes: ["cash_flow"] },
  { pattern: /\b(capital expenditure|capex)\b/i, category: "cfi", statementTypes: ["cash_flow"] },
  { pattern: /\b(proceeds from (sale|disposal))\b/i, category: "cfi", statementTypes: ["cash_flow"] },
  { pattern: /\b(acquisition|business combination)\b/i, category: "cfi", statementTypes: ["cash_flow"] },
  { pattern: /\b(investment in|purchase of.*intangible)\b/i, category: "cfi", statementTypes: ["cash_flow"] },

  // ── Cash Flow: Financing ────────────────────────────────────────────
  { pattern: /\b(proceeds from (debt|loan|issuance|borrowing|note|line of credit))\b/i, category: "cff", statementTypes: ["cash_flow"] },
  { pattern: /\b(repayment|principal payment|debt repay)\b/i, category: "cff", statementTypes: ["cash_flow"] },
  { pattern: /\b(dividend|distribution)\b/i, category: "cff", statementTypes: ["cash_flow"] },
  { pattern: /\b(buyback|repurchase|treasury)\b/i, category: "cff", statementTypes: ["cash_flow"] },
  { pattern: /\b(issuance of (stock|equity|shares))\b/i, category: "cff", statementTypes: ["cash_flow"] },
  { pattern: /\b(capital contribution|equity raise)\b/i, category: "cff", statementTypes: ["cash_flow"] },
];

/** Map section context labels to template-granular categories. */
const SECTION_CONTEXT_MAP: Record<string, string> = {
  "current assets": "asset_current",
  "non-current assets": "asset_non_current",
  "noncurrent assets": "asset_non_current",
  "fixed assets": "asset_non_current",
  "other assets": "asset_non_current",
  "current liabilities": "liability_current",
  "long-term liabilities": "liability_long_term",
  "non-current liabilities": "liability_long_term",
  "noncurrent liabilities": "liability_long_term",
  "stockholders equity": "equity",
  "shareholders equity": "equity",
  "owners equity": "equity",
  "equity": "equity",
  "operating activities": "cfo",
  "cash from operations": "cfo",
  "investing activities": "cfi",
  "cash from investing": "cfi",
  "financing activities": "cff",
  "cash from financing": "cff",
};

export interface GuessCategoryContext {
  statementType?: StatementType;
  sectionContext?: string;
}

/**
 * Guess an account's category from its name, optionally using statement-type context.
 *
 * When context.sectionContext is provided (e.g., from a section header like "Current Assets"),
 * it's used as a strong signal with 0.9 confidence.
 *
 * When context.statementType is provided, only keywords applicable to that statement type
 * (or universal keywords) are tested, reducing false positives.
 */
export function guessCategory(
  accountName: string,
  context?: GuessCategoryContext,
): { category: string; confidence: number } | null {
  const name = accountName.toLowerCase();

  // 1. Section context is the strongest signal
  if (context?.sectionContext) {
    const normalizedContext = context.sectionContext.toLowerCase().replace(/[^a-z\s]/g, "").trim();
    const mapped = SECTION_CONTEXT_MAP[normalizedContext];
    if (mapped) {
      return { category: mapped, confidence: 0.9 };
    }
  }

  // 2. Keyword matching, filtered by statement type if available
  for (const { pattern, category, statementTypes } of CATEGORY_KEYWORDS) {
    // Skip keywords scoped to other statement types
    if (statementTypes && context?.statementType) {
      if (!statementTypes.includes(context.statementType)) continue;
    }
    // Skip BS/CF-scoped keywords when there's no statement type context
    if (statementTypes && !context?.statementType) continue;

    if (pattern.test(name)) {
      return { category, confidence: 0.75 };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Organize imported rows into template sections
// ---------------------------------------------------------------------------

export interface ReviewLineItem {
  /** Unique key for this group (normalized account name, optionally qualified by statement type) */
  key: string;
  accountName: string;
  accountCode: string;
  /** Assigned section ID */
  sectionId: string;
  /** Category that maps to the section */
  category: string;
  /** How confident the categorization is */
  confidence: "high" | "medium" | "low";
  /** Total amount across all periods */
  totalAmount: number;
  /** Amount per period date */
  periodAmounts: Record<string, number>;
  /** Indices into the original rows array */
  rowIndices: number[];
  /** Source sheet name (for multi-tab imports) */
  sourceSheet: string;
  /** Financial statement type */
  statementType: StatementType;
}

export interface StatementBreakdown {
  lineItems: ReviewLineItem[];
  uncategorized: ReviewLineItem[];
}

export interface OrganizedStatement {
  template: IndustryTemplate;
  lineItems: ReviewLineItem[];
  /** Items that couldn't be categorized */
  uncategorized: ReviewLineItem[];
  /** Unique period dates found in the data */
  periods: string[];
  /** Breakdown by statement type (for multi-statement imports) */
  statementBreakdown: Partial<Record<StatementType, StatementBreakdown>>;
}

interface OrganizeInput {
  rows: Record<string, string>[];
  mapping: Record<string, string>;
  industry: string | null | undefined;
}

export function organizeIntoTemplate(input: OrganizeInput): OrganizedStatement {
  const { rows, mapping, industry } = input;
  const template = matchIndustryTemplate(industry);

  // Reverse mapping: app field -> import column header
  const reverseMap: Record<string, string> = {};
  for (const [header, field] of Object.entries(mapping)) {
    if (field) reverseMap[field] = header;
  }

  // Group rows by account name
  const groups = new Map<string, {
    accountName: string;
    accountCode: string;
    category: string;
    totalAmount: number;
    periodAmounts: Record<string, number>;
    rowIndices: number[];
    confidence: "high" | "medium" | "low";
  }>();

  const periods = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const accountName = (reverseMap["account_name"] ? row[reverseMap["account_name"]] : "").trim();
    const accountCode = (reverseMap["account_code"] ? row[reverseMap["account_code"]] : "").trim();
    const rawCategory = (reverseMap["account_type"] ? row[reverseMap["account_type"]] : "").trim();
    const rawDate = reverseMap["date"] ? row[reverseMap["date"]]
      : reverseMap["period_date"] ? row[reverseMap["period_date"]] : "";

    // Parse amount
    const rawAmount = reverseMap["amount"] ? row[reverseMap["amount"]] : "";
    const rawDebit = reverseMap["debit"] ? row[reverseMap["debit"]] : "";
    const rawCredit = reverseMap["credit"] ? row[reverseMap["credit"]] : "";
    let amount = 0;

    if (rawAmount) {
      const cleaned = rawAmount.replace(/[$,\s()]/g, "");
      const isNeg = rawAmount.includes("(") && rawAmount.includes(")");
      amount = parseFloat(cleaned) || 0;
      if (isNeg) amount = -Math.abs(amount);
    } else if (rawDebit || rawCredit) {
      const debit = parseFloat((rawDebit || "0").replace(/[$,\s]/g, "")) || 0;
      const credit = parseFloat((rawCredit || "0").replace(/[$,\s]/g, "")) || 0;
      amount = debit - credit;
    }

    if (rawDate) periods.add(rawDate.trim());

    const key = (accountName || accountCode || `row-${i}`).toLowerCase().replace(/\s+/g, " ");

    if (!groups.has(key)) {
      // Determine category
      let category = rawCategory;
      let confidence: "high" | "medium" | "low" = "high";

      if (!category || !CATEGORY_TO_SECTION[category]) {
        const guess = guessCategory(accountName || accountCode);
        if (guess) {
          category = guess.category;
          confidence = "medium";
        } else {
          category = "";
          confidence = "low";
        }
      }

      // If category is the broad "operating_expense", try to narrow it to R&D/S&M/G&A
      if (category === "operating_expense") {
        const guess = guessCategory(accountName || accountCode);
        if (guess && ["rd_expense", "sm_expense", "ga_expense"].includes(guess.category)) {
          category = guess.category;
          confidence = "medium";
        }
        // If still "operating_expense", it stays mapped to "ga" via CATEGORY_TO_SECTION
      }

      groups.set(key, {
        accountName: accountName || accountCode || `Row ${i + 1}`,
        accountCode,
        category,
        totalAmount: 0,
        periodAmounts: {},
        rowIndices: [],
        confidence,
      });
    }

    const group = groups.get(key)!;
    group.totalAmount += amount;
    group.rowIndices.push(i);
    if (rawDate) {
      const pd = rawDate.trim();
      group.periodAmounts[pd] = (group.periodAmounts[pd] || 0) + amount;
    }
  }

  // Assign each group to a template section
  const lineItems: ReviewLineItem[] = [];
  const uncategorized: ReviewLineItem[] = [];

  for (const [key, group] of groups) {
    const sectionId = CATEGORY_TO_SECTION[group.category] || "";
    const item: ReviewLineItem = {
      key,
      accountName: group.accountName,
      accountCode: group.accountCode,
      sectionId,
      category: group.category,
      confidence: group.confidence,
      totalAmount: group.totalAmount,
      periodAmounts: group.periodAmounts,
      rowIndices: group.rowIndices,
      sourceSheet: "",
      statementType: "income_statement",
    };

    if (sectionId) {
      lineItems.push(item);
    } else {
      uncategorized.push(item);
    }
  }

  return {
    template,
    lineItems,
    uncategorized,
    periods: Array.from(periods).sort(),
    statementBreakdown: {},
  };
}

// ---------------------------------------------------------------------------
// Multi-statement organizer (for multi-tab imports)
// ---------------------------------------------------------------------------

export interface ParsedFinancialLineItem {
  label: string;
  accountCode: string;
  sectionContext: string;
  amounts: Record<string, number>;
  rowIndex: number;
}

export interface ParsedFinancialSheetData {
  sheetName: string;
  statementType: StatementType;
  periods: string[];
  lineItems: ParsedFinancialLineItem[];
}

export interface OrganizeMultiInput {
  sheets: ParsedFinancialSheetData[];
  industry: string | null | undefined;
  overrides?: Record<string, { category: string; sectionId: string; statementType: StatementType }>;
}

export function organizeMultiStatement(input: OrganizeMultiInput): OrganizedStatement {
  const { sheets, industry, overrides } = input;
  const template = matchIndustryTemplate(industry);

  const allLineItems: ReviewLineItem[] = [];
  const allUncategorized: ReviewLineItem[] = [];
  const allPeriods = new Set<string>();
  const breakdown: Partial<Record<StatementType, StatementBreakdown>> = {};

  for (const sheet of sheets) {
    const sheetItems: ReviewLineItem[] = [];
    const sheetUncategorized: ReviewLineItem[] = [];

    for (const period of sheet.periods) {
      allPeriods.add(period);
    }

    // Group line items by normalized name (within this sheet/statement)
    const groups = new Map<string, {
      accountName: string;
      accountCode: string;
      category: string;
      totalAmount: number;
      periodAmounts: Record<string, number>;
      rowIndices: number[];
      confidence: "high" | "medium" | "low";
      sectionContext: string;
    }>();

    for (const item of sheet.lineItems) {
      const key = `${(item.label || item.accountCode || "unknown").toLowerCase().replace(/\s+/g, " ")}__${sheet.statementType}`;

      if (!groups.has(key)) {
        // Check overrides first
        const overrideKey = (item.label || item.accountCode).toLowerCase().replace(/\s+/g, " ");
        const override = overrides?.[overrideKey];

        let category: string;
        let confidence: "high" | "medium" | "low";

        if (override && override.statementType === sheet.statementType) {
          category = override.category;
          confidence = "high";
        } else {
          const guess = guessCategory(item.label || item.accountCode, {
            statementType: sheet.statementType,
            sectionContext: item.sectionContext,
          });
          if (guess) {
            category = guess.category;
            confidence = guess.confidence >= 0.9 ? "high" : "medium";
          } else {
            category = "";
            confidence = "low";
          }
        }

        // For IS items, try to narrow "operating_expense" → R&D/S&M/G&A
        if (category === "operating_expense" && sheet.statementType === "income_statement") {
          const guess = guessCategory(item.label || item.accountCode, { statementType: "income_statement" });
          if (guess && ["rd_expense", "sm_expense", "ga_expense"].includes(guess.category)) {
            category = guess.category;
            confidence = "medium";
          }
        }

        groups.set(key, {
          accountName: item.label || item.accountCode || "Unknown",
          accountCode: item.accountCode,
          category,
          totalAmount: 0,
          periodAmounts: {},
          rowIndices: [],
          confidence,
          sectionContext: item.sectionContext,
        });
      }

      const group = groups.get(key)!;
      group.rowIndices.push(item.rowIndex);
      for (const [period, amount] of Object.entries(item.amounts)) {
        group.totalAmount += amount;
        group.periodAmounts[period] = (group.periodAmounts[period] || 0) + amount;
      }
    }

    // Assign to sections
    for (const [key, group] of groups) {
      const sectionId = CATEGORY_TO_SECTION[group.category] || "";
      const reviewItem: ReviewLineItem = {
        key,
        accountName: group.accountName,
        accountCode: group.accountCode,
        sectionId,
        category: group.category,
        confidence: group.confidence,
        totalAmount: group.totalAmount,
        periodAmounts: group.periodAmounts,
        rowIndices: group.rowIndices,
        sourceSheet: sheet.sheetName,
        statementType: sheet.statementType,
      };

      if (sectionId) {
        sheetItems.push(reviewItem);
        allLineItems.push(reviewItem);
      } else {
        sheetUncategorized.push(reviewItem);
        allUncategorized.push(reviewItem);
      }
    }

    breakdown[sheet.statementType] = {
      lineItems: sheetItems,
      uncategorized: sheetUncategorized,
    };
  }

  return {
    template,
    lineItems: allLineItems,
    uncategorized: allUncategorized,
    periods: Array.from(allPeriods).sort(),
    statementBreakdown: breakdown,
  };
}
