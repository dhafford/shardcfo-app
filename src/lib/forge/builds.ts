/**
 * Revenue and expense build methodology definitions.
 *
 * Maps business types to appropriate revenue build formulas and expense
 * structures. Used by the generator prompt and the exporter.
 *
 * Ported from promptforge/builds.py.
 */

// ---------------------------------------------------------------------------
// Revenue build methodologies
// ---------------------------------------------------------------------------

export interface RevenueMethodDriver {
  key: string;
  label: string;
  unit: "dollar" | "pct" | "number" | "multiple";
}

export interface RevenueMethod {
  name: string;
  bestFor: string[];
  drivers: RevenueMethodDriver[];
  formulaDesc: string;
}

export const REVENUE_METHODS: Record<string, RevenueMethod> = {
  arr_waterfall: {
    name: "ARR Waterfall",
    bestFor: ["SaaS", "subscription", "cloud", "cybersecurity", "HR tech", "fintech SaaS"],
    drivers: [
      { key: "beginning_arr", label: "Beginning ARR", unit: "dollar" },
      { key: "new_arr", label: "New ARR (New Logos)", unit: "dollar" },
      { key: "expansion_arr", label: "Expansion ARR", unit: "dollar" },
      { key: "churned_arr", label: "Churned ARR", unit: "dollar" },
      { key: "contraction_arr", label: "Contraction ARR", unit: "dollar" },
      { key: "ending_arr", label: "Ending ARR", unit: "dollar" },
      { key: "arr_to_revenue", label: "ARR-to-Revenue Factor", unit: "pct" },
    ],
    formulaDesc: "Ending ARR = Beg ARR + New + Expansion - Churn - Contraction; Revenue = Ending ARR * Factor",
  },
  volume_x_price: {
    name: "Volume x Price",
    bestFor: ["consumer electronics", "e-commerce", "CPG", "pharma", "automotive", "hardware"],
    drivers: [
      { key: "units_sold", label: "Units Sold", unit: "number" },
      { key: "asp", label: "Average Selling Price", unit: "dollar" },
      { key: "unit_growth_pct", label: "Unit Growth (%)", unit: "pct" },
      { key: "asp_growth_pct", label: "ASP Growth (%)", unit: "pct" },
    ],
    formulaDesc: "Revenue = Units Sold x ASP",
  },
  sales_capacity: {
    name: "Bottoms-Up Sales Capacity",
    bestFor: ["B2B SaaS", "enterprise software", "professional services", "insurance", "staffing"],
    drivers: [
      { key: "beginning_reps", label: "Beginning Quota-Carrying Reps", unit: "number" },
      { key: "new_hires", label: "New Hires", unit: "number" },
      { key: "attrition", label: "Attrition", unit: "number" },
      { key: "quota_per_rep", label: "Annual Quota per Rep", unit: "dollar" },
      { key: "attainment_pct", label: "Average Attainment (%)", unit: "pct" },
      { key: "ramp_months", label: "Ramp Time (months)", unit: "number" },
    ],
    formulaDesc: "Revenue = Productive Reps x Quota x Attainment %",
  },
  cohort_retention: {
    name: "Cohort / Bookings-Based",
    bestFor: ["subscription", "streaming", "D2C", "mobile gaming", "marketplace"],
    drivers: [
      { key: "new_customers", label: "New Customers Acquired", unit: "number" },
      { key: "avg_acv", label: "Average ACV", unit: "dollar" },
      { key: "gross_churn_pct", label: "Gross Churn Rate (%)", unit: "pct" },
      { key: "expansion_pct", label: "Net Expansion Rate (%)", unit: "pct" },
    ],
    formulaDesc: "Revenue_t = Sum of all cohort ACV x Survival x Expansion",
  },
  tam_based: {
    name: "Top-Down / TAM-Based",
    bestFor: ["early-stage startup", "new market", "biotech", "pre-revenue"],
    drivers: [
      { key: "tam", label: "Total Addressable Market", unit: "dollar" },
      { key: "sam_pct", label: "SAM (% of TAM)", unit: "pct" },
      { key: "market_share_pct", label: "Market Share (%)", unit: "pct" },
      { key: "tam_growth_pct", label: "TAM Growth (%)", unit: "pct" },
      { key: "share_gain_pct", label: "Annual Share Gain (%)", unit: "pct" },
    ],
    formulaDesc: "Revenue = TAM x SAM% x Market Share%",
  },
  usage_consumption: {
    name: "Usage / Consumption-Based",
    bestFor: ["cloud infrastructure", "API", "data platform", "telecom", "utilities", "AI/ML"],
    drivers: [
      { key: "active_customers", label: "Active Customers", unit: "number" },
      { key: "avg_usage_units", label: "Avg Usage per Customer", unit: "number" },
      { key: "price_per_unit", label: "Price per Unit", unit: "dollar" },
      { key: "customer_growth_pct", label: "Customer Growth (%)", unit: "pct" },
      { key: "usage_growth_pct", label: "Usage Growth per Customer (%)", unit: "pct" },
    ],
    formulaDesc: "Revenue = Active Customers x Avg Usage x Price/Unit",
  },
  same_store_new_store: {
    name: "Same-Store + New Store",
    bestFor: ["restaurant", "retail", "fitness", "grocery", "hotel", "healthcare clinic"],
    drivers: [
      { key: "existing_stores", label: "Existing Store Count", unit: "number" },
      { key: "avg_rev_per_store", label: "Avg Revenue per Store", unit: "dollar" },
      { key: "sssg_pct", label: "Same-Store Sales Growth (%)", unit: "pct" },
      { key: "new_stores", label: "New Stores Opened", unit: "number" },
      { key: "new_store_ramp_pct", label: "New Store Ramp Factor (%)", unit: "pct" },
    ],
    formulaDesc: "Revenue = Existing x Rev/Store x (1+SSSG) + New x Rev/Store x Ramp",
  },
  recurring_nonrecurring: {
    name: "Recurring + Non-Recurring Split",
    bestFor: ["enterprise software", "IoT", "security systems", "medical devices", "telecom"],
    drivers: [
      { key: "recurring_rev", label: "Recurring Revenue (Subscription/Maint)", unit: "dollar" },
      { key: "recurring_growth_pct", label: "Recurring Growth (%)", unit: "pct" },
      { key: "nonrecurring_rev", label: "Non-Recurring Revenue (PS/License/HW)", unit: "dollar" },
      { key: "nonrecurring_growth_pct", label: "Non-Recurring Growth (%)", unit: "pct" },
      { key: "recurring_mix_pct", label: "Recurring Mix Target (%)", unit: "pct" },
    ],
    formulaDesc: "Total Revenue = Recurring + Non-Recurring",
  },
  contract_backlog: {
    name: "Contract Backlog / Pipeline",
    bestFor: ["defense", "construction", "government IT", "consulting", "oilfield"],
    drivers: [
      { key: "beginning_backlog", label: "Beginning Backlog", unit: "dollar" },
      { key: "new_awards", label: "New Contract Awards", unit: "dollar" },
      { key: "burn_rate_pct", label: "Backlog Burn Rate (%)", unit: "pct" },
      { key: "book_to_bill", label: "Book-to-Bill Ratio", unit: "multiple" },
    ],
    formulaDesc: "Revenue = Backlog Burn; End Backlog = Beg - Burn + New Awards",
  },
  yield_based: {
    name: "Yield-Based (Financial Services)",
    bestFor: ["bank", "asset manager", "insurance", "REIT", "fintech lender", "mortgage"],
    drivers: [
      { key: "avg_earning_assets", label: "Avg Earning Assets / AUM", unit: "dollar" },
      { key: "yield_pct", label: "Yield / NIM / Fee Rate (%)", unit: "pct" },
      { key: "asset_growth_pct", label: "Asset Growth (%)", unit: "pct" },
      { key: "fee_income", label: "Non-Interest / Fee Income", unit: "dollar" },
    ],
    formulaDesc: "NII = Avg Assets x NIM; Total Rev = NII + Fee Income",
  },
};

// ---------------------------------------------------------------------------
// Expense build categories
// ---------------------------------------------------------------------------

export interface ExpenseCategoryItem {
  key: string;
  label: string;
  unit: "dollar" | "number" | "pct";
}

export interface ExpenseCategory {
  name: string;
  driver: "headcount" | "revenue_pct" | "per_head" | "mixed";
  items: ExpenseCategoryItem[];
}

export const EXPENSE_CATEGORIES: Record<string, ExpenseCategory> = {
  payroll_benefits: {
    name: "Payroll & Benefits",
    driver: "headcount",
    items: [
      { key: "headcount", label: "Headcount (FTE)", unit: "number" },
      { key: "base_salaries", label: "Base Salaries", unit: "dollar" },
      { key: "bonuses", label: "Bonuses", unit: "dollar" },
      { key: "health_insurance", label: "Health Insurance", unit: "dollar" },
      { key: "retirement_401k", label: "Retirement / 401k", unit: "dollar" },
      { key: "payroll_taxes", label: "Payroll Taxes", unit: "dollar" },
      { key: "sbc", label: "Stock-Based Compensation", unit: "dollar" },
      { key: "total_payroll", label: "Total Payroll & Benefits", unit: "dollar" },
    ],
  },
  cogs: {
    name: "Cost of Goods Sold",
    driver: "revenue_pct",
    items: [
      { key: "hosting_infra", label: "Hosting / Infrastructure", unit: "dollar" },
      { key: "direct_labor", label: "Direct Labor", unit: "dollar" },
      { key: "materials", label: "Raw Materials / Inputs", unit: "dollar" },
      { key: "merchant_fees", label: "Merchant / Processing Fees", unit: "dollar" },
      { key: "revenue_share", label: "Revenue Share / Royalties", unit: "dollar" },
      { key: "shipping", label: "Shipping & Freight", unit: "dollar" },
      { key: "total_cogs", label: "Total COGS", unit: "dollar" },
    ],
  },
  sales_marketing: {
    name: "Sales & Marketing",
    driver: "revenue_pct",
    items: [
      { key: "digital_ads", label: "Digital Advertising", unit: "dollar" },
      { key: "content_marketing", label: "Content Marketing", unit: "dollar" },
      { key: "events_conferences", label: "Events & Conferences", unit: "dollar" },
      { key: "sm_contractors", label: "S&M Contractors", unit: "dollar" },
      { key: "sm_software", label: "S&M Software / Tools", unit: "dollar" },
      { key: "travel", label: "Travel", unit: "dollar" },
      { key: "total_sm", label: "Total Sales & Marketing", unit: "dollar" },
    ],
  },
  general_admin: {
    name: "General & Administrative",
    driver: "mixed",
    items: [
      { key: "office_rent", label: "Office Rent", unit: "dollar" },
      { key: "utilities", label: "Utilities", unit: "dollar" },
      { key: "insurance", label: "Insurance", unit: "dollar" },
      { key: "legal_fees", label: "Legal Fees", unit: "dollar" },
      { key: "accounting_fees", label: "Accounting & Audit", unit: "dollar" },
      { key: "office_supplies", label: "Office Supplies", unit: "dollar" },
      { key: "ga_software", label: "G&A Software", unit: "dollar" },
      { key: "total_ga", label: "Total G&A", unit: "dollar" },
    ],
  },
  engineering_rd: {
    name: "Engineering & R&D",
    driver: "headcount",
    items: [
      { key: "eng_contractors", label: "Engineering Contractors", unit: "dollar" },
      { key: "eng_software", label: "Dev Tools & Software", unit: "dollar" },
      { key: "prototyping", label: "Prototyping / Testing", unit: "dollar" },
      { key: "total_rd", label: "Total Engineering & R&D", unit: "dollar" },
    ],
  },
  technology_it: {
    name: "Technology & IT",
    driver: "per_head",
    items: [
      { key: "saas_licenses", label: "SaaS Licenses", unit: "dollar" },
      { key: "cloud_hosting", label: "Cloud Hosting (non-COGS)", unit: "dollar" },
      { key: "telecom", label: "Telecom", unit: "dollar" },
      { key: "cybersecurity", label: "Cybersecurity", unit: "dollar" },
      { key: "total_tech", label: "Total Technology & IT", unit: "dollar" },
    ],
  },
};

// ---------------------------------------------------------------------------
// Business type signals → methodology mapping
// ---------------------------------------------------------------------------

export interface BusinessTypeSignal {
  signals: string[];
  revenueMethod: string;
  keyExpenseCats: string[];
}

export const BUSINESS_TYPE_SIGNALS: Record<string, BusinessTypeSignal> = {
  saas: {
    signals: ["subscription", "arr", "mrr", "saas", "recurring revenue", "churn", "platform revenue"],
    revenueMethod: "arr_waterfall",
    keyExpenseCats: ["payroll_benefits", "cogs", "sales_marketing", "engineering_rd", "general_admin", "technology_it"],
  },
  b2b_software: {
    signals: ["enterprise", "license", "professional services", "implementation", "b2b"],
    revenueMethod: "sales_capacity",
    keyExpenseCats: ["payroll_benefits", "cogs", "sales_marketing", "engineering_rd", "general_admin"],
  },
  ecommerce: {
    signals: ["orders", "aov", "gmv", "units", "sku", "marketplace", "e-commerce"],
    revenueMethod: "volume_x_price",
    keyExpenseCats: ["payroll_benefits", "cogs", "sales_marketing", "general_admin", "technology_it"],
  },
  marketplace: {
    signals: ["gmv", "take rate", "marketplace", "platform", "two-sided"],
    revenueMethod: "usage_consumption",
    keyExpenseCats: ["payroll_benefits", "cogs", "sales_marketing", "engineering_rd", "general_admin"],
  },
  fintech: {
    signals: ["loan", "aum", "interest", "premium", "yield", "nim", "fintech", "lending"],
    revenueMethod: "yield_based",
    keyExpenseCats: ["payroll_benefits", "cogs", "general_admin", "technology_it"],
  },
  retail_restaurant: {
    signals: ["store", "location", "same-store", "comp", "restaurant", "retail", "unit"],
    revenueMethod: "same_store_new_store",
    keyExpenseCats: ["payroll_benefits", "cogs", "sales_marketing", "general_admin"],
  },
  early_stage: {
    signals: ["pre-revenue", "seed", "safe", "convertible", "pre-product"],
    revenueMethod: "tam_based",
    keyExpenseCats: ["payroll_benefits", "engineering_rd", "general_admin", "technology_it"],
  },
  defense_gov: {
    signals: ["contract", "backlog", "government", "defense", "award"],
    revenueMethod: "contract_backlog",
    keyExpenseCats: ["payroll_benefits", "cogs", "general_admin"],
  },
  cloud_infrastructure: {
    signals: ["compute", "storage", "api", "consumption", "usage", "tokens", "metered"],
    revenueMethod: "usage_consumption",
    keyExpenseCats: ["payroll_benefits", "cogs", "engineering_rd", "sales_marketing", "general_admin"],
  },
};

// ---------------------------------------------------------------------------
// Business classifier
// ---------------------------------------------------------------------------

export interface ClassificationResult {
  businessType: string;
  confidence: number;
  revenueMethod: string;
  /** Human-readable name of the selected revenue methodology. */
  methodologyName: string;
  methodology: RevenueMethod;
}

/**
 * Scan financial text (or a serialized FinancialModel) for signal keywords
 * and return the best-matching business type with confidence score.
 *
 * Accepts either a raw string or any object (e.g. FinancialModel) — objects
 * are serialized to JSON before scanning.
 */
export function classifyBusiness(financialInput: string | object): ClassificationResult {
  const text = typeof financialInput === "string" ? financialInput : JSON.stringify(financialInput);
  const lower = text.toLowerCase();

  let bestType = "early_stage";
  let bestCount = 0;
  let bestTotal = 1;

  for (const [bType, config] of Object.entries(BUSINESS_TYPE_SIGNALS)) {
    const totalSignals = config.signals.length;
    const matchCount = config.signals.filter((signal) => lower.includes(signal.toLowerCase())).length;

    if (matchCount > bestCount) {
      bestCount = matchCount;
      bestTotal = totalSignals;
      bestType = bType;
    }
  }

  const config = BUSINESS_TYPE_SIGNALS[bestType];
  const methodology = REVENUE_METHODS[config.revenueMethod];

  return {
    businessType: bestType,
    confidence: bestCount / bestTotal,
    revenueMethod: config.revenueMethod,
    methodologyName: methodology.name,
    methodology,
  };
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

const REVENUE_BUILD_PROMPT_TEMPLATE = `
## REVENUE BUILD METHODOLOGY

You MUST select and apply the appropriate revenue build methodology based on the business type.
Analyze the historical financial data to classify the business and select the right model.

Available methodologies:
{method_list}

### Output Format for Revenue Build
In your JSON output, include a "revenue_build" key with:
\`\`\`
"revenue_build": {
    "methodology": "<method_slug>",
    "business_type": "<classification>",
    "drivers": {
        "<driver_key>": {"period1": value, "period2": value, ...},
        ...
    }
}
\`\`\`
The drivers must be the specific inputs for the selected methodology.
Historical values should be derived from the input data.
Projected values should be reasonable assumptions that flow into the revenue line.

CRITICAL: The revenue calculated from the build drivers MUST tie to the revenue line on the Income Statement.
`;

const EXPENSE_BUILD_PROMPT = `
## EXPENSE BUILD METHODOLOGY

Break expenses into detailed categories with sub-line items.
Each category should have individual line items with specific driver assumptions.

### Output Format for Expense Build
In your JSON output, include an "expense_build" key with:
\`\`\`
"expense_build": {
    "categories": {
        "<category_slug>": {
            "items": {
                "<item_key>": {"period1": value, "period2": value, ...},
                ...
            }
        },
        ...
    }
}
\`\`\`

Common expense categories:
- payroll_benefits: Headcount-driven (salaries, bonuses, benefits, taxes, SBC)
- cogs: Revenue-driven (hosting, direct labor, materials, merchant fees)
- sales_marketing: Revenue-driven (ads, content, events, tools, travel)
- general_admin: Mixed (rent, utilities, insurance, legal, accounting)
- engineering_rd: Headcount-driven (contractors, software, prototyping)
- technology_it: Per-head (SaaS licenses, hosting, telecom, security)

CRITICAL: The sum of all expense category totals MUST tie to Total COGS + Total OpEx on the Income Statement.
`;

/** Build a formatted list of revenue methodologies for inclusion in a prompt. */
function getMethodPromptList(): string {
  return Object.entries(REVENUE_METHODS)
    .map(([slug, m]) => {
      const industries = m.bestFor.slice(0, 4).join(", ");
      const drivers = m.drivers.map((d) => d.label).join(", ");
      return [
        `- **${m.name}** (\`${slug}\`): ${m.formulaDesc}`,
        `  Best for: ${industries}`,
        `  Drivers: ${drivers}`,
      ].join("\n");
    })
    .join("\n");
}

/**
 * Build the complete revenue + expense build prompt addition.
 * This is appended to the system message when calling the LLM.
 */
export function buildRevenueExpensePrompt(): string {
  const methodList = getMethodPromptList();
  const revPrompt = REVENUE_BUILD_PROMPT_TEMPLATE.replace("{method_list}", methodList);
  return revPrompt + "\n" + EXPENSE_BUILD_PROMPT;
}
