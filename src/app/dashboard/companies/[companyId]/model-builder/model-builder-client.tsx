"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Download,
  Play,
  ListChecks,
  SlidersHorizontal,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { type HistoricalYear, type ProjectionAssumptions, PROJECTION_YEARS } from "@/lib/projections/types";
import { getIndustryBenchmarks } from "@/lib/projections/benchmarks";
import { runProjection } from "@/lib/projections/engine";
import { StatementTable } from "@/components/projections/statement-table";
import { AssumptionsPanel } from "@/components/projections/assumptions-panel";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ModelBuilderClientProps {
  companyId: string;
  companyName: string;
  industry: string;
  historicals: HistoricalYear[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Revenue methodology definitions
// ---------------------------------------------------------------------------

interface RevenueMethod {
  id: string;
  label: string;
  desc: string;
  industries: string;
  inputs: { key: string; label: string; type: "currency" | "percent" | "number"; default: number }[];
}

const REVENUE_METHODS: RevenueMethod[] = [
  {
    id: "growth_rate", label: "Simple Growth Rate", desc: "YoY growth per revenue stream",
    industries: "Any — quick default",
    inputs: [], // handled by standard assumptions panel
  },
  {
    id: "volume_price", label: "Volume × Price", desc: "Units sold × ASP per product line",
    industries: "Electronics, CPG, pharma, automotive, e-commerce, airlines",
    inputs: [
      { key: "vp_units_1", label: "Product 1 — Units Sold", type: "number", default: 50000 },
      { key: "vp_asp_1", label: "Product 1 — ASP ($)", type: "currency", default: 299 },
      { key: "vp_units_2", label: "Product 2 — Units Sold", type: "number", default: 120000 },
      { key: "vp_asp_2", label: "Product 2 — ASP ($)", type: "currency", default: 79 },
      { key: "vp_units_3", label: "Product 3 — Units Sold", type: "number", default: 0 },
      { key: "vp_asp_3", label: "Product 3 — ASP ($)", type: "currency", default: 0 },
      { key: "vp_unit_growth", label: "Unit Growth Rate (YoY)", type: "percent", default: 0.10 },
      { key: "vp_asp_growth", label: "ASP Growth Rate (YoY)", type: "percent", default: -0.03 },
    ],
  },
  {
    id: "tam", label: "Top-Down / TAM-Based", desc: "Market size × market share capture",
    industries: "Early-stage, new markets, biotech, telecom",
    inputs: [
      { key: "tam_total", label: "Total Addressable Market ($)", type: "currency", default: 10000000000 },
      { key: "tam_growth", label: "TAM Growth Rate (CAGR)", type: "percent", default: 0.12 },
      { key: "sam_pct", label: "SAM as % of TAM", type: "percent", default: 0.15 },
      { key: "som_share", label: "Market Share % (of SAM)", type: "percent", default: 0.005 },
    ],
  },
  {
    id: "sales_capacity", label: "Bottoms-Up Sales Capacity", desc: "Reps × quota × attainment — B2B gold standard",
    industries: "B2B SaaS, enterprise SW, pro services, insurance, recruiting",
    inputs: [
      { key: "sc_beg_reps", label: "Beginning Quota-Carrying Reps", type: "number", default: 20 },
      { key: "sc_new_hires", label: "New Hires (per year)", type: "number", default: 8 },
      { key: "sc_attrition", label: "Attrition (reps lost/yr)", type: "number", default: 2 },
      { key: "sc_ramp_months", label: "Ramp Time (months)", type: "number", default: 6 },
      { key: "sc_quota", label: "Annual Quota per Rep ($)", type: "currency", default: 800000 },
      { key: "sc_attainment", label: "Avg Quota Attainment %", type: "percent", default: 0.85 },
    ],
  },
  {
    id: "cohort", label: "Cohort / Bookings-Based", desc: "New bookings × retention × expansion",
    industries: "SaaS, streaming, mobile gaming, D2C subscription, fintech lending",
    inputs: [
      { key: "coh_new_acv", label: "New Cohort ACV ($)", type: "currency", default: 2000000 },
      { key: "coh_new_logos", label: "New Logos (customers)", type: "number", default: 100 },
      { key: "coh_gross_churn", label: "Quarterly Gross Churn Rate", type: "percent", default: 0.03 },
      { key: "coh_expansion", label: "Quarterly Net Expansion Rate", type: "percent", default: 0.02 },
      { key: "coh_recog", label: "Recognition Period (months)", type: "number", default: 12 },
    ],
  },
  {
    id: "arr_waterfall", label: "ARR Waterfall", desc: "Beg ARR + New + Expansion − Churn − Contraction",
    industries: "Growth SaaS, cloud, cybersecurity, HR tech",
    inputs: [
      { key: "arr_beg", label: "Beginning ARR ($)", type: "currency", default: 40000000 },
      { key: "arr_new", label: "New ARR (new logos)", type: "currency", default: 3200000 },
      { key: "arr_expansion", label: "Expansion ARR (upsell)", type: "currency", default: 2400000 },
      { key: "arr_churn", label: "Churned ARR (lost)", type: "currency", default: 1600000 },
      { key: "arr_contraction", label: "Contraction ARR (downgrades)", type: "currency", default: 800000 },
      { key: "arr_nrr", label: "Target NRR %", type: "percent", default: 1.10 },
      { key: "arr_grr", label: "Target GRR %", type: "percent", default: 0.92 },
    ],
  },
  {
    id: "same_store", label: "Same-Store + New Store", desc: "Existing stores × SSSG + new store ramp",
    industries: "Restaurant chains, retail, fitness, grocery, hotels",
    inputs: [
      { key: "ss_existing", label: "Existing Store Count", type: "number", default: 200 },
      { key: "ss_rev_per", label: "Avg Revenue / Store ($)", type: "currency", default: 1800000 },
      { key: "ss_sssg", label: "Same-Store Sales Growth", type: "percent", default: 0.045 },
      { key: "ss_new_stores", label: "New Stores Opened", type: "number", default: 25 },
      { key: "ss_new_rev", label: "Avg Revenue / New Store ($)", type: "currency", default: 1500000 },
      { key: "ss_partial", label: "New Store Partial-Year Factor", type: "number", default: 0.5 },
    ],
  },
  {
    id: "backlog", label: "Contract Backlog / Pipeline", desc: "Backlog burn + new awards",
    industries: "Defense, construction, gov IT, oilfield services",
    inputs: [
      { key: "bl_opening", label: "Beginning Backlog ($)", type: "currency", default: 2400000000 },
      { key: "bl_new_awards", label: "New Contract Awards ($)", type: "currency", default: 1100000000 },
      { key: "bl_burn_rate", label: "Backlog Burn Rate (%/yr)", type: "percent", default: 0.33 },
      { key: "bl_book_bill", label: "Target Book-to-Bill", type: "number", default: 1.10 },
      { key: "bl_win_rate", label: "Pipeline Win Rate %", type: "percent", default: 0.30 },
    ],
  },
  {
    id: "yield", label: "Yield-Based (FinServ)", desc: "Earning assets × NIM + AUM × fee rate",
    industries: "Banks, asset managers, insurance, REITs, fintech lenders",
    inputs: [
      { key: "yld_assets", label: "Avg Earning Assets ($)", type: "currency", default: 12000000000 },
      { key: "yld_nim", label: "Net Interest Margin", type: "percent", default: 0.0315 },
      { key: "yld_aum", label: "Assets Under Management ($)", type: "currency", default: 4000000000 },
      { key: "yld_mgmt_fee", label: "Management Fee Rate", type: "percent", default: 0.0075 },
      { key: "yld_nonint", label: "Non-Interest Income ($)", type: "currency", default: 45000000 },
    ],
  },
  {
    id: "usage", label: "Usage / Consumption", desc: "Active customers × usage × price/unit",
    industries: "Cloud infra, APIs (Twilio/Stripe), Snowflake, telecom, utilities",
    inputs: [
      { key: "usg_customers", label: "Active Customers", type: "number", default: 8500 },
      { key: "usg_cust_growth", label: "Customer Growth (YoY)", type: "percent", default: 0.25 },
      { key: "usg_avg_usage", label: "Avg Usage / Customer / Month", type: "number", default: 12000 },
      { key: "usg_usage_growth", label: "Usage Growth / Customer (YoY)", type: "percent", default: 0.15 },
      { key: "usg_price", label: "Price per Unit ($)", type: "currency", default: 0.045 },
      { key: "usg_vol_disc", label: "Volume Discount Drag (%)", type: "percent", default: 0.02 },
    ],
  },
  {
    id: "advertising", label: "Advertising / Monetization", desc: "Impressions × CPM or GMV × take rate",
    industries: "Social media, search, marketplaces, gaming, publishers",
    inputs: [
      { key: "ad_dau", label: "Daily Active Users (DAU)", type: "number", default: 150000000 },
      { key: "ad_sessions", label: "Sessions per DAU", type: "number", default: 4.2 },
      { key: "ad_load", label: "Ads per Session", type: "number", default: 6 },
      { key: "ad_cpm", label: "Average CPM ($)", type: "currency", default: 8.50 },
      { key: "ad_gmv", label: "Marketplace GMV ($)", type: "currency", default: 0 },
      { key: "ad_take_rate", label: "Take Rate (%)", type: "percent", default: 0.14 },
    ],
  },
  {
    id: "recurring_split", label: "Recurring + Non-Recurring", desc: "Subscription ARR + PS + license + hardware",
    industries: "Enterprise SW (license→SaaS), IoT, medtech, fitness+content",
    inputs: [
      { key: "rnr_sub_arr", label: "Subscription ARR ($)", type: "currency", default: 80000000 },
      { key: "rnr_maint_rate", label: "Maintenance Rate (% of base)", type: "percent", default: 0.20 },
      { key: "rnr_ps_attach", label: "PS Attach Rate (%)", type: "percent", default: 0.70 },
      { key: "rnr_ps_avg", label: "Avg PS Engagement ($)", type: "currency", default: 45000 },
      { key: "rnr_new_cust", label: "New Customers / Year", type: "number", default: 120 },
      { key: "rnr_impl", label: "Avg Implementation Fee ($)", type: "currency", default: 15000 },
    ],
  },
  {
    id: "channel_mix", label: "Channel Mix", desc: "Direct + partner + OEM with discount tiers",
    industries: "Enterprise SW, consumer electronics, CPG, cloud marketplace",
    inputs: [
      { key: "ch_direct_deals", label: "Direct — # Deals", type: "number", default: 500 },
      { key: "ch_direct_acv", label: "Direct — ACV ($)", type: "currency", default: 48000 },
      { key: "ch_partner_deals", label: "Partner — # Deals", type: "number", default: 300 },
      { key: "ch_partner_disc", label: "Partner Discount (%)", type: "percent", default: 0.20 },
      { key: "ch_oem_deals", label: "OEM — # Deals", type: "number", default: 150 },
      { key: "ch_oem_disc", label: "OEM Discount (%)", type: "percent", default: 0.40 },
    ],
  },
  {
    id: "geo_segment", label: "Geographic Segmentation", desc: "Regional build with FX overlay",
    industries: "Any multinational with 40%+ international revenue",
    inputs: [
      { key: "geo_na_rev", label: "North America Revenue ($)", type: "currency", default: 120000000 },
      { key: "geo_na_growth", label: "North America Growth (%)", type: "percent", default: 0.08 },
      { key: "geo_eu_rev", label: "Europe Revenue (local €)", type: "currency", default: 45000000 },
      { key: "geo_eu_fx", label: "EUR/USD Rate", type: "number", default: 1.08 },
      { key: "geo_apac_rev", label: "APAC Revenue (local)", type: "currency", default: 35000000 },
      { key: "geo_apac_fx", label: "APAC/USD Rate", type: "number", default: 1.0 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Expense category definitions
// ---------------------------------------------------------------------------

interface ExpenseCategory {
  id: string;
  label: string;
  code: string;
  driver: string;
  inputs: { key: string; label: string; type: "currency" | "percent" | "number"; default: number }[];
}

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  {
    id: "payroll", label: "Payroll & Benefits", code: "5000–5050", driver: "HC × Salary",
    inputs: [
      { key: "hc_start", label: "Starting Headcount", type: "number", default: 50 },
      { key: "hc_growth", label: "HC Growth Rate (YoY)", type: "percent", default: 0.05 },
      { key: "avg_salary", label: "Avg Salary / Employee ($)", type: "currency", default: 95000 },
      { key: "bonus_pct", label: "Bonus (% of Base)", type: "percent", default: 0.10 },
      { key: "health_pct", label: "Health Insurance (% of Base)", type: "percent", default: 0.12 },
      { key: "401k_pct", label: "401k Match (% of Base)", type: "percent", default: 0.06 },
      { key: "payroll_tax", label: "Payroll Taxes (% of Base)", type: "percent", default: 0.10 },
      { key: "sbc_per_emp", label: "SBC per Employee ($/yr)", type: "currency", default: 2000 },
    ],
  },
  {
    id: "opex", label: "Operating Expenses", code: "6000–6050", driver: "HC × SqFt × $/SqFt",
    inputs: [
      { key: "sqft_per_emp", label: "Office Sq Ft / Employee", type: "number", default: 150 },
      { key: "rent_sqft", label: "Rent per Sq Ft (annual $)", type: "currency", default: 65 },
      { key: "util_pct", label: "Utilities (% of Rent)", type: "percent", default: 0.08 },
      { key: "insurance_mo", label: "Insurance ($/month)", type: "currency", default: 1500 },
      { key: "supplies_emp_mo", label: "Office Supplies ($/emp/mo)", type: "currency", default: 50 },
      { key: "sw_subs_emp_mo", label: "Software Subs ($/emp/mo)", type: "currency", default: 200 },
    ],
  },
  {
    id: "travel", label: "Travel & Entertainment", code: "6100–6130", driver: "HC × T&E Budget",
    inputs: [
      { key: "te_budget", label: "T&E Budget / Employee ($/yr)", type: "currency", default: 3500 },
      { key: "te_air_pct", label: "Airfare (%)", type: "percent", default: 0.35 },
      { key: "te_hotel_pct", label: "Hotels (%)", type: "percent", default: 0.25 },
      { key: "te_meals_pct", label: "Meals & Per Diem (%)", type: "percent", default: 0.20 },
      { key: "te_client_pct", label: "Client Entertainment (%)", type: "percent", default: 0.10 },
    ],
  },
  {
    id: "marketing", label: "Marketing & Advertising", code: "6200–6220", driver: "Revenue × Mktg %",
    inputs: [
      { key: "mktg_pct", label: "Marketing as % of Revenue", type: "percent", default: 0.12 },
      { key: "digital_pct", label: "Digital Ads (% of Mktg)", type: "percent", default: 0.40 },
      { key: "content_pct", label: "Content Marketing (%)", type: "percent", default: 0.15 },
      { key: "events_pct", label: "Events & Conferences (%)", type: "percent", default: 0.20 },
      { key: "agency_pct", label: "Agency Fees (%)", type: "percent", default: 0.15 },
    ],
  },
  {
    id: "cogs", label: "Cost of Goods Sold", code: "7000–7030", driver: "Revenue × COGS %",
    inputs: [
      { key: "cogs_pct", label: "COGS as % of Revenue", type: "percent", default: 0.35 },
      { key: "materials_pct", label: "Raw Materials (% of COGS)", type: "percent", default: 0.50 },
      { key: "labor_pct", label: "Direct Labor (% of COGS)", type: "percent", default: 0.30 },
      { key: "overhead_pct", label: "Mfg Overhead (% of COGS)", type: "percent", default: 0.12 },
      { key: "shipping_pct", label: "Shipping & Freight (%)", type: "percent", default: 0.08 },
    ],
  },
  {
    id: "capex", label: "Capital Expenditures", code: "8000–8020", driver: "Revenue × CapEx %",
    inputs: [
      { key: "capex_pct", label: "CapEx as % of Revenue", type: "percent", default: 0.04 },
      { key: "it_hw_pct", label: "IT Hardware (% of CapEx)", type: "percent", default: 0.45 },
      { key: "furniture_pct", label: "Furniture & Fixtures (%)", type: "percent", default: 0.20 },
      { key: "leasehold_pct", label: "Leasehold Improvements (%)", type: "percent", default: 0.25 },
    ],
  },
  {
    id: "professional", label: "Professional Services", code: "8100–8120", driver: "Fixed $/month",
    inputs: [
      { key: "legal_mo", label: "Legal Fees ($/mo)", type: "currency", default: 8000 },
      { key: "audit_mo", label: "Accounting & Audit ($/mo)", type: "currency", default: 5000 },
      { key: "consult_mo", label: "Consulting ($/mo)", type: "currency", default: 12000 },
      { key: "contract_mo", label: "Contractors ($/mo)", type: "currency", default: 15000 },
    ],
  },
  {
    id: "technology", label: "Technology & IT", code: "8200–8210", driver: "HC × IT $/emp",
    inputs: [
      { key: "it_cost_emp", label: "IT Cost / Employee ($/yr)", type: "currency", default: 8500 },
      { key: "saas_pct", label: "SaaS Licenses (% of IT)", type: "percent", default: 0.40 },
      { key: "cloud_pct", label: "Cloud Hosting (% of IT)", type: "percent", default: 0.30 },
      { key: "security_pct", label: "Cybersecurity (% of IT)", type: "percent", default: 0.12 },
    ],
  },
  {
    id: "rd", label: "Research & Development", code: "8300–8310", driver: "Revenue × R&D %",
    inputs: [
      { key: "rd_pct", label: "R&D as % of Revenue", type: "percent", default: 0.15 },
      { key: "rd_staff_pct", label: "Staff Costs (% of R&D)", type: "percent", default: 0.60 },
      { key: "rd_proto_pct", label: "Prototyping (%)", type: "percent", default: 0.15 },
      { key: "rd_qa_pct", label: "Testing & QA (%)", type: "percent", default: 0.10 },
    ],
  },
  {
    id: "debt", label: "Debt Service", code: "9000–9010", driver: "Balance × Rate",
    inputs: [
      { key: "debt_balance", label: "Outstanding Debt ($)", type: "currency", default: 2000000 },
      { key: "debt_rate", label: "Annual Interest Rate", type: "percent", default: 0.065 },
      { key: "debt_term_mo", label: "Remaining Term (months)", type: "number", default: 60 },
    ],
  },
  {
    id: "taxes_reg", label: "Taxes & Regulatory", code: "9100+", driver: "Fixed $/month",
    inputs: [
      { key: "prop_tax_mo", label: "Property Tax ($/mo)", type: "currency", default: 4500 },
      { key: "sales_tax_mo", label: "Sales & Use Tax ($/mo)", type: "currency", default: 3200 },
      { key: "compliance_mo", label: "Compliance Costs ($/mo)", type: "currency", default: 2500 },
      { key: "income_tax_rate", label: "Income Tax Rate", type: "percent", default: 0.25 },
    ],
  },
  {
    id: "da", label: "Depreciation & Amortization", code: "—", driver: "CapEx × Rate",
    inputs: [
      { key: "depr_rate", label: "Depreciation Rate (SL %/yr)", type: "percent", default: 0.20 },
      { key: "intang_amort_mo", label: "Intangible Amort ($/mo)", type: "currency", default: 2000 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Seasonality overlay
// ---------------------------------------------------------------------------

const SEASONALITY_INPUTS = [
  { key: "seas_q1", label: "Q1 Index (%)", default: 0.25 },
  { key: "seas_q2", label: "Q2 Index (%)", default: 0.25 },
  { key: "seas_q3", label: "Q3 Index (%)", default: 0.25 },
  { key: "seas_q4", label: "Q4 Index (%)", default: 0.25 },
];

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

const currFmt = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD",
  minimumFractionDigits: 0, maximumFractionDigits: 0,
});

function formatAmount(n: number): string {
  if (Math.abs(n) < 0.5) return "$0";
  if (n < 0) return `(${currFmt.format(Math.abs(n))})`;
  return currFmt.format(n);
}

function formatInput(v: number, type: "currency" | "percent" | "number"): string {
  if (type === "percent") return `${(v * 100).toFixed(1)}%`;
  if (type === "currency") {
    if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
    return `$${v.toFixed(2)}`;
  }
  return v.toLocaleString();
}

// ---------------------------------------------------------------------------
// Inline editable input
// ---------------------------------------------------------------------------

function InlineInput({
  value,
  onChange,
  type,
}: {
  value: number;
  onChange: (v: number) => void;
  type: "currency" | "percent" | "number";
}) {
  const display = type === "percent" ? (value * 100).toFixed(1) : String(value);
  return (
    <input
      type="number"
      step={type === "percent" ? "0.1" : "1"}
      className="w-24 rounded border border-slate-200 bg-amber-50/60 px-2 py-1 text-right text-xs font-mono tabular-nums focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
      defaultValue={display}
      onBlur={(e) => {
        const raw = parseFloat(e.target.value);
        if (!isNaN(raw)) onChange(type === "percent" ? raw / 100 : raw);
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ModelBuilderClient({
  companyId,
  companyName,
  industry,
  historicals,
  error,
}: ModelBuilderClientProps) {
  const benchmarks = getIndustryBenchmarks(industry);
  const [assumptions, setAssumptions] = React.useState<ProjectionAssumptions>(
    () => initAssumptions(benchmarks.assumptions, historicals)
  );

  const [selectedRevMethods, setSelectedRevMethods] = React.useState<Set<string>>(
    () => new Set(["growth_rate"])
  );
  const [activeExpenses, setActiveExpenses] = React.useState<Set<string>>(
    () => new Set(["payroll", "opex", "marketing", "cogs", "rd", "technology"])
  );
  const [enableSeasonality, setEnableSeasonality] = React.useState(false);

  // Methodology-specific assumptions (key → value)
  const [methodInputs, setMethodInputs] = React.useState<Record<string, number>>(() => {
    const defaults: Record<string, number> = {};
    for (const m of REVENUE_METHODS) for (const inp of m.inputs) defaults[inp.key] = inp.default;
    for (const c of EXPENSE_CATEGORIES) for (const inp of c.inputs) defaults[inp.key] = inp.default;
    for (const s of SEASONALITY_INPUTS) defaults[s.key] = s.default;
    return defaults;
  });

  function setInput(key: string, value: number) {
    setMethodInputs((prev) => ({ ...prev, [key]: value }));
  }

  const projected = React.useMemo(
    () => runProjection(historicals, assumptions),
    [historicals, assumptions]
  );

  const [isExporting, setIsExporting] = React.useState(false);
  const balanceCheckPassing = projected.every((p) => Math.abs(p.balanceCheck) < 0.01);

  const activeRevMethodsList = REVENUE_METHODS.filter((m) => selectedRevMethods.has(m.id));

  function toggleRevMethod(id: string) {
    setSelectedRevMethods((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { if (next.size > 1) next.delete(id); } // keep at least one
      else next.add(id);
      return next;
    });
  }

  async function exportToExcel() {
    setIsExporting(true);
    try {
      const res = await fetch("/api/generate-xlsx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "projection", companyId, historicals, projected, assumptions, companyName,
          revenueMethods: Array.from(selectedRevMethods),
          methodInputs,
          activeExpenses: Array.from(activeExpenses),
        }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${companyName.replace(/[^a-zA-Z0-9 _-]/g, "")} - Full Model.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  function toggleExpense(id: string) {
    setActiveExpenses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Error loading financial data: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{companyName} — Full Financial Model Builder</h2>
          <p className="text-sm text-muted-foreground">
            Select what to model, configure assumptions, then export a live Excel model.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {balanceCheckPassing ? (
            <Badge variant="outline" className="gap-1 text-emerald-700 border-emerald-300 bg-emerald-50">
              <CheckCircle2 className="w-3 h-3" /> Balanced
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-red-700 border-red-300 bg-red-50">
              <AlertTriangle className="w-3 h-3" /> Imbalance
            </Badge>
          )}
          <Badge variant="outline" className="capitalize">{benchmarks.label}</Badge>
        </div>
      </div>

      <Tabs defaultValue="scope">
        <TabsList>
          <TabsTrigger value="scope" className="gap-1.5">
            <ListChecks className="w-3.5 h-3.5" /> Model Scope
          </TabsTrigger>
          <TabsTrigger value="assumptions" className="gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Assumptions
          </TabsTrigger>
          <TabsTrigger value="output" className="gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Model Output
          </TabsTrigger>
        </TabsList>

        {/* ================================================================= */}
        {/* TAB 1: MODEL SCOPE                                                */}
        {/* ================================================================= */}
        <TabsContent value="scope" className="mt-4 space-y-6">

          {/* Revenue Methods (multi-select) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Revenue Build Methodologies</h3>
              <span className="text-xs text-muted-foreground">
                {selectedRevMethods.size} selected — each gets its own Excel tab, rolling up to IS
              </span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {REVENUE_METHODS.map((method) => (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => toggleRevMethod(method.id)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-all",
                    selectedRevMethods.has(method.id)
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 opacity-50"
                  )}
                >
                  <p className="text-xs font-semibold">{method.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{method.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Expense Categories */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Expense & Cash Flow Build Items</h3>
              <span className="text-xs text-muted-foreground">{activeExpenses.size} of {EXPENSE_CATEGORIES.length} active</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {EXPENSE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleExpense(cat.id)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-all",
                    activeExpenses.has(cat.id)
                      ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 opacity-50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold">{cat.label}</p>
                    <Badge variant="outline" className="text-[9px] font-mono">{cat.code}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{cat.driver}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Seasonality toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEnableSeasonality(!enableSeasonality)}
              className={cn(
                "rounded-lg border px-4 py-2.5 text-left transition-all",
                enableSeasonality
                  ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              <p className="text-xs font-semibold">Seasonality Overlay</p>
              <p className="text-[10px] text-muted-foreground">Q1–Q4 distribution indices</p>
            </button>
          </div>

          {/* Next step hint */}
          <div className="flex justify-end">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              Next: configure assumptions for your selections <ChevronRight className="w-3 h-3" />
            </p>
          </div>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 2: ASSUMPTIONS                                                */}
        {/* ================================================================= */}
        <TabsContent value="assumptions" className="mt-4 space-y-6">

          {/* Revenue method-specific assumptions — one card per selected method */}
          {activeRevMethodsList.map((method) => (
            <Card key={method.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Badge className="bg-blue-100 text-blue-800 text-[9px]">Revenue</Badge>
                    {method.label}
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px]">{method.industries}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{method.desc}</p>
              </CardHeader>
              <CardContent>
                {method.inputs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Simple Growth Rate uses the stream-level growth rates in the core assumptions below.
                    This method&apos;s output tab in Excel will show per-stream revenue with YoY growth formulas.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {method.inputs.map((inp) => (
                      <div key={inp.key} className="flex items-center justify-between gap-2 rounded border bg-slate-50/60 px-3 py-2">
                        <label className="text-xs text-slate-700 shrink-0">{inp.label}</label>
                        <InlineInput
                          value={methodInputs[inp.key] ?? inp.default}
                          onChange={(v) => setInput(inp.key, v)}
                          type={inp.type}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Active expense assumptions */}
          {EXPENSE_CATEGORIES.filter((c) => activeExpenses.has(c.id)).map((cat) => (
            <Card key={cat.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{cat.label}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px] font-mono">{cat.code}</Badge>
                    <Badge variant="secondary" className="text-[9px]">{cat.driver}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {cat.inputs.map((inp) => (
                    <div key={inp.key} className="flex items-center justify-between gap-2 rounded border bg-slate-50/60 px-3 py-2">
                      <label className="text-xs text-slate-700 shrink-0">{inp.label}</label>
                      <InlineInput
                        value={methodInputs[inp.key] ?? inp.default}
                        onChange={(v) => setInput(inp.key, v)}
                        type={inp.type}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Seasonality assumptions */}
          {enableSeasonality && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Seasonality Overlay</CardTitle>
                <p className="text-xs text-muted-foreground">Q1–Q4 indices must sum to 100%. Applied on top of annual revenue.</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {SEASONALITY_INPUTS.map((s) => (
                    <div key={s.key} className="flex items-center justify-between gap-2 rounded border bg-slate-50/60 px-3 py-2">
                      <label className="text-xs text-slate-700">{s.label}</label>
                      <InlineInput
                        value={methodInputs[s.key] ?? s.default}
                        onChange={(v) => setInput(s.key, v)}
                        type="percent"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Core 3-statement assumptions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Core Model Assumptions</CardTitle>
              <p className="text-xs text-muted-foreground">Growth rates, margins, BS drivers, and financing assumptions that feed the IS / BS / CFS formulas.</p>
            </CardHeader>
            <CardContent>
              <AssumptionsPanel
                assumptions={assumptions}
                onChange={setAssumptions}
                historicals={historicals}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 3: MODEL OUTPUT                                               */}
        {/* ================================================================= */}
        <TabsContent value="output" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {projected.length} years projected from {historicals.length} years of historicals
              </span>
            </div>
            <Button onClick={exportToExcel} disabled={isExporting || projected.length === 0} className="gap-1.5">
              <Download className="w-4 h-4" />
              {isExporting ? "Building Excel Model…" : "Export Full Model (.xlsx)"}
            </Button>
          </div>

          {/* Summary strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {projected.length > 0 && (() => {
              const last = projected[projected.length - 1];
              const first = projected[0];
              return [
                { label: `FY ${first.year} Rev`, value: formatAmount(first.totalRevenue) },
                { label: `FY ${last.year} Rev`, value: formatAmount(last.totalRevenue) },
                { label: `FY ${last.year} EBITDA`, value: formatAmount(last.ebitda) },
                { label: `FY ${last.year} NI`, value: formatAmount(last.netIncome) },
                { label: `FY ${last.year} FCF`, value: formatAmount(last.fcf) },
                { label: `FY ${last.year} Cash`, value: formatAmount(last.cash) },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border bg-white p-3 text-center">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-base font-semibold font-mono tabular-nums">{item.value}</p>
                </div>
              ));
            })()}
          </div>

          <Tabs defaultValue="income_statement">
            <TabsList>
              <TabsTrigger value="income_statement">Income Statement</TabsTrigger>
              <TabsTrigger value="balance_sheet">Balance Sheet</TabsTrigger>
              <TabsTrigger value="cash_flow">Cash Flow</TabsTrigger>
              <TabsTrigger value="kpis">Key KPIs</TabsTrigger>
            </TabsList>
            <TabsContent value="income_statement">
              <StatementTable type="income_statement" historicals={historicals} projected={projected} />
            </TabsContent>
            <TabsContent value="balance_sheet">
              <StatementTable type="balance_sheet" historicals={historicals} projected={projected} />
            </TabsContent>
            <TabsContent value="cash_flow">
              <StatementTable type="cash_flow" historicals={historicals} projected={projected} />
            </TabsContent>
            <TabsContent value="kpis">
              <StatementTable type="kpis" historicals={historicals} projected={projected} />
            </TabsContent>
          </Tabs>

          {/* Diagnostics */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Diagnostics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {projected.map((p) => (
                  <div
                    key={p.year}
                    className={cn(
                      "rounded border p-2 text-center",
                      Math.abs(p.balanceCheck) < 0.01
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-red-200 bg-red-50"
                    )}
                  >
                    <p className="font-medium">{p.label}</p>
                    <p className="font-mono tabular-nums">
                      {Math.abs(p.balanceCheck) < 0.01 ? (
                        <span className="text-emerald-700">PASS</span>
                      ) : (
                        <span className="text-red-700">FAIL: {formatAmount(p.balanceCheck)}</span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Initialize assumptions from benchmarks
// ---------------------------------------------------------------------------

function initAssumptions(
  benchmarkAssumptions: ProjectionAssumptions,
  historicals: HistoricalYear[],
): ProjectionAssumptions {
  if (historicals.length === 0) return benchmarkAssumptions;

  const lastYear = historicals[historicals.length - 1];
  const streamNames = Object.keys(lastYear.revenueByStream);
  if (streamNames.length === 0) return benchmarkAssumptions;

  const revenueStreams = streamNames.map((name, i) => ({
    name,
    growthRates: benchmarkAssumptions.revenueStreams[
      Math.min(i, benchmarkAssumptions.revenueStreams.length - 1)
    ]?.growthRates ?? benchmarkAssumptions.revenueStreams[0].growthRates,
  }));

  return { ...benchmarkAssumptions, revenueStreams };
}
