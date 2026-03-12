/**
 * Industry-specific financial statement templates.
 *
 * Every template uses the SAME section structure (Revenue → COGS → Gross Profit
 * → OpEx → EBITDA → Other → Net Income). Only the suggested line items vary
 * per industry.
 */

// ---------------------------------------------------------------------------
// Standard P&L sections — identical for ALL industries
// ---------------------------------------------------------------------------

export interface StatementSection {
  id: string;
  label: string;
  order: number;
  calculated?: boolean;
  /** DB account categories that map into this section */
  accountCategories: string[];
  /** Sign convention: 1 = positive adds to income, -1 = subtracted */
  sign: 1 | -1;
}

export const STATEMENT_SECTIONS: StatementSection[] = [
  { id: "revenue", label: "Revenue", order: 1, accountCategories: ["revenue"], sign: 1 },
  { id: "cogs", label: "Cost of Goods Sold", order: 2, accountCategories: ["cogs"], sign: -1 },
  { id: "gross_profit", label: "Gross Profit", order: 3, calculated: true, accountCategories: [], sign: 1 },
  { id: "operating_expense", label: "Operating Expenses", order: 4, accountCategories: ["operating_expense"], sign: -1 },
  { id: "ebitda", label: "EBITDA", order: 5, calculated: true, accountCategories: [], sign: 1 },
  { id: "other_income", label: "Other Income", order: 6, accountCategories: ["other_income"], sign: 1 },
  { id: "other_expense", label: "Other Expense", order: 7, accountCategories: ["other_expense"], sign: -1 },
  { id: "net_income", label: "Net Income", order: 8, calculated: true, accountCategories: [], sign: 1 },
];

/** Only sections that hold actual line items (not calculated rows). */
export const LINE_ITEM_SECTIONS = STATEMENT_SECTIONS.filter((s) => !s.calculated);

/** Map from DB account category → section ID */
export const CATEGORY_TO_SECTION: Record<string, string> = {};
for (const section of STATEMENT_SECTIONS) {
  for (const cat of section.accountCategories) {
    CATEGORY_TO_SECTION[cat] = section.id;
  }
}

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
    id: "saas",
    label: "SaaS / Software",
    matchPatterns: ["saas", "software", "tech", "technology", "cloud", "platform", "ai", "ml", "data"],
    sections: {
      revenue: [
        { name: "Subscription Revenue", category: "revenue" },
        { name: "Professional Services", category: "revenue" },
        { name: "Usage-Based Revenue", category: "revenue" },
        { name: "Other Revenue", category: "revenue" },
      ],
      cogs: [
        { name: "Hosting & Infrastructure", category: "cogs" },
        { name: "Customer Support", category: "cogs" },
        { name: "Third-Party Software Costs", category: "cogs" },
        { name: "Payment Processing Fees", category: "cogs" },
      ],
      operating_expense: [
        { name: "Sales & Marketing", category: "operating_expense" },
        { name: "Research & Development", category: "operating_expense" },
        { name: "General & Administrative", category: "operating_expense" },
        { name: "Rent & Facilities", category: "operating_expense" },
        { name: "Insurance", category: "operating_expense" },
        { name: "Depreciation & Amortization", category: "operating_expense" },
      ],
      other_income: [
        { name: "Interest Income", category: "other_income" },
      ],
      other_expense: [
        { name: "Interest Expense", category: "other_expense" },
      ],
    },
  },
  {
    id: "ecommerce",
    label: "E-Commerce / Retail",
    matchPatterns: ["ecommerce", "e-commerce", "retail", "dtc", "direct to consumer", "marketplace", "shop", "store"],
    sections: {
      revenue: [
        { name: "Product Sales", category: "revenue" },
        { name: "Shipping Revenue", category: "revenue" },
        { name: "Marketplace Revenue", category: "revenue" },
        { name: "Return Allowances", category: "revenue" },
      ],
      cogs: [
        { name: "Product Costs", category: "cogs" },
        { name: "Shipping & Fulfillment", category: "cogs" },
        { name: "Packaging Materials", category: "cogs" },
        { name: "Payment Processing Fees", category: "cogs" },
        { name: "Inventory Shrinkage", category: "cogs" },
      ],
      operating_expense: [
        { name: "Sales & Marketing", category: "operating_expense" },
        { name: "Advertising & Paid Media", category: "operating_expense" },
        { name: "Warehouse & Operations", category: "operating_expense" },
        { name: "General & Administrative", category: "operating_expense" },
        { name: "Rent & Facilities", category: "operating_expense" },
        { name: "Insurance", category: "operating_expense" },
      ],
      other_income: [
        { name: "Interest Income", category: "other_income" },
      ],
      other_expense: [
        { name: "Interest Expense", category: "other_expense" },
      ],
    },
  },
  {
    id: "services",
    label: "Professional Services",
    matchPatterns: ["services", "consulting", "agency", "professional", "advisory", "staffing", "legal", "accounting"],
    sections: {
      revenue: [
        { name: "Consulting Revenue", category: "revenue" },
        { name: "Retainer Revenue", category: "revenue" },
        { name: "Project Revenue", category: "revenue" },
        { name: "Reimbursable Revenue", category: "revenue" },
      ],
      cogs: [
        { name: "Direct Labor", category: "cogs" },
        { name: "Subcontractors", category: "cogs" },
        { name: "Project Materials", category: "cogs" },
        { name: "Travel & Expenses (Billable)", category: "cogs" },
      ],
      operating_expense: [
        { name: "Salaries & Benefits", category: "operating_expense" },
        { name: "Sales & Marketing", category: "operating_expense" },
        { name: "General & Administrative", category: "operating_expense" },
        { name: "Rent & Facilities", category: "operating_expense" },
        { name: "Professional Development", category: "operating_expense" },
        { name: "Insurance", category: "operating_expense" },
      ],
      other_income: [
        { name: "Interest Income", category: "other_income" },
      ],
      other_expense: [
        { name: "Interest Expense", category: "other_expense" },
      ],
    },
  },
  {
    id: "healthcare",
    label: "Healthcare / Biotech",
    matchPatterns: ["health", "healthcare", "biotech", "pharma", "medical", "clinic", "hospital", "wellness", "bio"],
    sections: {
      revenue: [
        { name: "Patient Revenue", category: "revenue" },
        { name: "Insurance Reimbursements", category: "revenue" },
        { name: "Lab Services Revenue", category: "revenue" },
        { name: "Product Sales", category: "revenue" },
        { name: "Grant Revenue", category: "revenue" },
      ],
      cogs: [
        { name: "Medical Supplies", category: "cogs" },
        { name: "Lab Costs", category: "cogs" },
        { name: "Pharmaceuticals", category: "cogs" },
        { name: "Equipment Depreciation", category: "cogs" },
      ],
      operating_expense: [
        { name: "Clinical Staff", category: "operating_expense" },
        { name: "Research & Development", category: "operating_expense" },
        { name: "Regulatory & Compliance", category: "operating_expense" },
        { name: "General & Administrative", category: "operating_expense" },
        { name: "Rent & Facilities", category: "operating_expense" },
        { name: "Insurance & Malpractice", category: "operating_expense" },
      ],
      other_income: [
        { name: "Interest Income", category: "other_income" },
      ],
      other_expense: [
        { name: "Interest Expense", category: "other_expense" },
      ],
    },
  },
  {
    id: "manufacturing",
    label: "Manufacturing",
    matchPatterns: ["manufacturing", "industrial", "production", "factory", "hardware", "fabrication"],
    sections: {
      revenue: [
        { name: "Product Sales", category: "revenue" },
        { name: "Custom Orders", category: "revenue" },
        { name: "Maintenance Contracts", category: "revenue" },
        { name: "Tooling Revenue", category: "revenue" },
      ],
      cogs: [
        { name: "Raw Materials", category: "cogs" },
        { name: "Direct Labor", category: "cogs" },
        { name: "Factory Overhead", category: "cogs" },
        { name: "Packaging & Shipping", category: "cogs" },
        { name: "Equipment Depreciation", category: "cogs" },
      ],
      operating_expense: [
        { name: "Sales & Marketing", category: "operating_expense" },
        { name: "Research & Development", category: "operating_expense" },
        { name: "General & Administrative", category: "operating_expense" },
        { name: "Rent & Facilities", category: "operating_expense" },
        { name: "Quality Control", category: "operating_expense" },
        { name: "Insurance", category: "operating_expense" },
      ],
      other_income: [
        { name: "Interest Income", category: "other_income" },
      ],
      other_expense: [
        { name: "Interest Expense", category: "other_expense" },
      ],
    },
  },
  {
    id: "fintech",
    label: "Fintech / Financial Services",
    matchPatterns: ["fintech", "financial", "banking", "payments", "lending", "insurance tech", "insurtech", "crypto", "defi"],
    sections: {
      revenue: [
        { name: "Transaction Revenue", category: "revenue" },
        { name: "Subscription Revenue", category: "revenue" },
        { name: "Interest Income (Operating)", category: "revenue" },
        { name: "Fee Revenue", category: "revenue" },
      ],
      cogs: [
        { name: "Payment Processing Costs", category: "cogs" },
        { name: "Credit Losses / Provisions", category: "cogs" },
        { name: "Third-Party Data Costs", category: "cogs" },
        { name: "Infrastructure & Hosting", category: "cogs" },
      ],
      operating_expense: [
        { name: "Sales & Marketing", category: "operating_expense" },
        { name: "Research & Development", category: "operating_expense" },
        { name: "General & Administrative", category: "operating_expense" },
        { name: "Compliance & Regulatory", category: "operating_expense" },
        { name: "Insurance", category: "operating_expense" },
      ],
      other_income: [
        { name: "Investment Income", category: "other_income" },
      ],
      other_expense: [
        { name: "Interest Expense", category: "other_expense" },
      ],
    },
  },
];

/** Fallback template used when no industry matches */
export const DEFAULT_TEMPLATE: IndustryTemplate = {
  id: "general",
  label: "General",
  matchPatterns: [],
  sections: {
    revenue: [
      { name: "Revenue", category: "revenue" },
      { name: "Other Revenue", category: "revenue" },
    ],
    cogs: [
      { name: "Cost of Revenue", category: "cogs" },
      { name: "Direct Costs", category: "cogs" },
    ],
    operating_expense: [
      { name: "Sales & Marketing", category: "operating_expense" },
      { name: "Research & Development", category: "operating_expense" },
      { name: "General & Administrative", category: "operating_expense" },
      { name: "Rent & Facilities", category: "operating_expense" },
      { name: "Depreciation & Amortization", category: "operating_expense" },
      { name: "Insurance", category: "operating_expense" },
    ],
    other_income: [
      { name: "Interest Income", category: "other_income" },
    ],
    other_expense: [
      { name: "Interest Expense", category: "other_expense" },
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

const CATEGORY_KEYWORDS: { pattern: RegExp; category: string }[] = [
  // Revenue signals
  { pattern: /\b(revenue|sales|income|subscription|recurring|arr|mrr)\b/i, category: "revenue" },
  // COGS signals
  { pattern: /\b(cogs|cost of (goods|revenue|sales)|hosting|infrastructure|direct cost|payment processing)\b/i, category: "cogs" },
  // OpEx signals
  { pattern: /\b(salary|salaries|wages|benefits|rent|marketing|advertising|r&d|research|development|admin|office|travel|insurance|depreciation|amortization|professional fees|legal fees|accounting)\b/i, category: "operating_expense" },
  // Other income
  { pattern: /\b(interest income|dividend|gain on|investment income|grant)\b/i, category: "other_income" },
  // Other expense
  { pattern: /\b(interest expense|loss on|write.?off|bad debt|tax expense)\b/i, category: "other_expense" },
];

/** Guess an account's category from its name. Returns null if no confident match. */
export function guessCategory(accountName: string): { category: string; confidence: number } | null {
  const name = accountName.toLowerCase();

  for (const { pattern, category } of CATEGORY_KEYWORDS) {
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
  /** Unique key for this group (normalized account name) */
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
}

export interface OrganizedStatement {
  template: IndustryTemplate;
  lineItems: ReviewLineItem[];
  /** Items that couldn't be categorized */
  uncategorized: ReviewLineItem[];
  /** Unique period dates found in the data */
  periods: string[];
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
  };
}
