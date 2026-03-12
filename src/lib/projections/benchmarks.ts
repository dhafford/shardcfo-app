/**
 * Top-decile growth benchmarks by industry.
 *
 * These represent aggressive but realistic assumptions for high-performing
 * companies in each vertical. Revenue growth decays over time to model
 * the natural deceleration of growth. Expense percentages improve
 * (leverage) as the company scales.
 *
 * Sources: Bessemer Cloud Index, KeyBanc SaaS Survey, Iconiq Growth
 * benchmarking data, public company filings. Values represent approximate
 * top-quartile to top-decile performance.
 */

import { type ProjectionAssumptions, PROJECTION_YEARS } from "./types";

// ---------------------------------------------------------------------------
// Helper: create an array that decays linearly from `start` to `end`
// ---------------------------------------------------------------------------

function decay(start: number, end: number, n = PROJECTION_YEARS): number[] {
  return Array.from({ length: n }, (_, i) =>
    Math.round((start + (end - start) * (i / (n - 1))) * 1000) / 1000
  );
}

function constant(value: number, n = PROJECTION_YEARS): number[] {
  return Array.from({ length: n }, () => value);
}

// ---------------------------------------------------------------------------
// Base assumptions (shared across all industries, then overridden)
// ---------------------------------------------------------------------------

function baseAssumptions(): Omit<ProjectionAssumptions, "revenueStreams"> {
  return {
    cogsPercent:                 decay(0.22, 0.18),
    rdPercent:                   decay(0.28, 0.20),
    smPercent:                   decay(0.40, 0.25),
    gaPercent:                   decay(0.12, 0.08),
    sbcPercent:                  decay(0.10, 0.06),
    daPercent:                   decay(0.04, 0.03),
    interestIncome:              constant(0),
    interestExpense:             constant(0),
    taxRate:                     decay(0, 0.15),
    dso:                         constant(35),
    dpo:                         constant(30),
    prepaidPercent:              constant(0.03),
    accruedLiabPercent:          constant(0.06),
    otherCurrentLiabPercent:     constant(0.02),
    deferredRevCurrentPercent:   constant(0.08),
    deferredRevNonCurrentPercent:constant(0.02),
    capexPercent:                constant(0.02),
    capSoftwarePercent:          constant(0.04),
    newDebt:                     constant(0),
    debtRepayments:              constant(0),
    equityIssuance:              constant(0),
    shareRepurchases:            constant(0),
    dividendsPaid:               constant(0),
  };
}

// ---------------------------------------------------------------------------
// Revenue stream templates per industry (growth rates decay from top-decile)
// ---------------------------------------------------------------------------

type StreamDef = { name: string; growthStart: number; growthEnd: number };

function makeStreams(defs: StreamDef[]): ProjectionAssumptions["revenueStreams"] {
  return defs.map((d) => ({
    name: d.name,
    growthRates: decay(d.growthStart, d.growthEnd),
  }));
}

// ---------------------------------------------------------------------------
// Industry-specific benchmarks
// ---------------------------------------------------------------------------

export type IndustryBenchmarkId =
  | "ai_ml" | "data_analytics" | "devtools" | "ecommerce" | "edtech"
  | "fintech" | "healthtech" | "infrastructure" | "markettech"
  | "saas" | "security" | "other";

interface IndustryBenchmark {
  id: IndustryBenchmarkId;
  label: string;
  assumptions: ProjectionAssumptions;
}

const BENCHMARKS: Record<IndustryBenchmarkId, IndustryBenchmark> = {
  saas: {
    id: "saas",
    label: "SaaS",
    assumptions: {
      ...baseAssumptions(),
      revenueStreams: makeStreams([
        { name: "Subscription Revenue",          growthStart: 0.70, growthEnd: 0.25 },
        { name: "Professional Services Revenue",  growthStart: 0.30, growthEnd: 0.10 },
        { name: "Usage-Based Revenue",            growthStart: 0.80, growthEnd: 0.30 },
        { name: "Other Revenue",                  growthStart: 0.15, growthEnd: 0.05 },
      ]),
      cogsPercent: decay(0.20, 0.16),
      rdPercent: decay(0.30, 0.22),
      smPercent: decay(0.42, 0.28),
      gaPercent: decay(0.12, 0.08),
      deferredRevCurrentPercent: constant(0.10),
    },
  },

  ai_ml: {
    id: "ai_ml",
    label: "AI / ML",
    assumptions: {
      ...baseAssumptions(),
      revenueStreams: makeStreams([
        { name: "Subscription & Platform Revenue",          growthStart: 0.85, growthEnd: 0.30 },
        { name: "Usage-Based Revenue (Compute & API)",      growthStart: 1.00, growthEnd: 0.35 },
        { name: "Model Licensing & Royalties",              growthStart: 0.60, growthEnd: 0.20 },
        { name: "Professional Services & Custom Models",    growthStart: 0.40, growthEnd: 0.12 },
        { name: "Other Revenue",                            growthStart: 0.15, growthEnd: 0.05 },
      ]),
      cogsPercent: decay(0.30, 0.22),
      rdPercent: decay(0.35, 0.25),
      smPercent: decay(0.35, 0.22),
      gaPercent: decay(0.10, 0.07),
    },
  },

  data_analytics: {
    id: "data_analytics",
    label: "Data & Analytics",
    assumptions: {
      ...baseAssumptions(),
      revenueStreams: makeStreams([
        { name: "Subscription & Platform Revenue",         growthStart: 0.65, growthEnd: 0.25 },
        { name: "Usage-Based / Consumption Revenue",       growthStart: 0.80, growthEnd: 0.30 },
        { name: "Data Licensing & Marketplace Revenue",    growthStart: 0.50, growthEnd: 0.18 },
        { name: "Professional Services & Consulting",      growthStart: 0.25, growthEnd: 0.10 },
        { name: "Other Revenue",                           growthStart: 0.15, growthEnd: 0.05 },
      ]),
      cogsPercent: decay(0.25, 0.18),
      rdPercent: decay(0.32, 0.22),
      smPercent: decay(0.38, 0.25),
    },
  },

  devtools: {
    id: "devtools",
    label: "Developer Tools",
    assumptions: {
      ...baseAssumptions(),
      revenueStreams: makeStreams([
        { name: "Subscription Revenue",                growthStart: 0.70, growthEnd: 0.25 },
        { name: "Usage-Based / Consumption Revenue",   growthStart: 0.90, growthEnd: 0.30 },
        { name: "Marketplace & Add-On Revenue",        growthStart: 0.60, growthEnd: 0.20 },
        { name: "Professional Services & Training",    growthStart: 0.25, growthEnd: 0.08 },
        { name: "Other Revenue",                       growthStart: 0.15, growthEnd: 0.05 },
      ]),
      cogsPercent: decay(0.18, 0.14),
      rdPercent: decay(0.35, 0.25),
      smPercent: decay(0.35, 0.22),
    },
  },

  ecommerce: {
    id: "ecommerce",
    label: "E-Commerce",
    assumptions: {
      ...baseAssumptions(),
      revenueStreams: makeStreams([
        { name: "Product Revenue",                        growthStart: 0.50, growthEnd: 0.15 },
        { name: "Marketplace / Platform Revenue",         growthStart: 0.60, growthEnd: 0.22 },
        { name: "Shipping & Delivery Revenue",            growthStart: 0.45, growthEnd: 0.12 },
        { name: "Advertising & Sponsored Listings",       growthStart: 0.80, growthEnd: 0.25 },
        { name: "Other Revenue",                          growthStart: 0.15, growthEnd: 0.05 },
      ]),
      cogsPercent: decay(0.55, 0.45),
      rdPercent: decay(0.12, 0.08),
      smPercent: decay(0.25, 0.15),
      gaPercent: decay(0.10, 0.06),
      dso: constant(10),
      dpo: constant(45),
      deferredRevCurrentPercent: constant(0.02),
      deferredRevNonCurrentPercent: constant(0),
    },
  },

  edtech: {
    id: "edtech",
    label: "EdTech",
    assumptions: {
      ...baseAssumptions(),
      revenueStreams: makeStreams([
        { name: "Subscription Revenue (B2C)",                growthStart: 0.55, growthEnd: 0.20 },
        { name: "Institutional License Revenue (B2B)",       growthStart: 0.45, growthEnd: 0.18 },
        { name: "Content & Courseware Revenue",              growthStart: 0.35, growthEnd: 0.12 },
        { name: "Certification & Assessment Revenue",        growthStart: 0.40, growthEnd: 0.15 },
        { name: "Other Revenue",                             growthStart: 0.15, growthEnd: 0.05 },
      ]),
      cogsPercent: decay(0.30, 0.22),
      rdPercent: decay(0.25, 0.18),
      smPercent: decay(0.35, 0.22),
    },
  },

  fintech: {
    id: "fintech",
    label: "Fintech",
    assumptions: {
      ...baseAssumptions(),
      revenueStreams: makeStreams([
        { name: "Transaction & Processing Revenue",  growthStart: 0.70, growthEnd: 0.25 },
        { name: "Interchange Revenue",               growthStart: 0.60, growthEnd: 0.20 },
        { name: "Subscription & Platform Fees",      growthStart: 0.55, growthEnd: 0.22 },
        { name: "Interest Income on Loans",          growthStart: 0.40, growthEnd: 0.15 },
        { name: "Other Revenue",                     growthStart: 0.15, growthEnd: 0.05 },
      ]),
      cogsPercent: decay(0.35, 0.25),
      rdPercent: decay(0.22, 0.16),
      smPercent: decay(0.30, 0.20),
      gaPercent: decay(0.15, 0.10),
    },
  },

  healthtech: {
    id: "healthtech",
    label: "HealthTech",
    assumptions: {
      ...baseAssumptions(),
      revenueStreams: makeStreams([
        { name: "Subscription & Platform Revenue",       growthStart: 0.55, growthEnd: 0.22 },
        { name: "Per-Transaction / Per-Claim Revenue",   growthStart: 0.45, growthEnd: 0.18 },
        { name: "Data & Analytics Revenue",              growthStart: 0.60, growthEnd: 0.25 },
        { name: "Implementation & Services Revenue",     growthStart: 0.30, growthEnd: 0.10 },
        { name: "Other Revenue",                         growthStart: 0.15, growthEnd: 0.05 },
      ]),
      cogsPercent: decay(0.28, 0.20),
      rdPercent: decay(0.25, 0.18),
      smPercent: decay(0.32, 0.22),
      gaPercent: decay(0.14, 0.10),
    },
  },

  infrastructure: {
    id: "infrastructure",
    label: "Infrastructure / Cloud",
    assumptions: {
      ...baseAssumptions(),
      revenueStreams: makeStreams([
        { name: "Subscription & Platform Revenue",    growthStart: 0.65, growthEnd: 0.25 },
        { name: "Usage-Based / Consumption Revenue",  growthStart: 0.80, growthEnd: 0.30 },
        { name: "Managed Services Revenue",           growthStart: 0.40, growthEnd: 0.15 },
        { name: "License & Support Revenue",          growthStart: 0.30, growthEnd: 0.10 },
        { name: "Other Revenue",                      growthStart: 0.15, growthEnd: 0.05 },
      ]),
      cogsPercent: decay(0.35, 0.28),
      rdPercent: decay(0.28, 0.20),
      smPercent: decay(0.32, 0.22),
      capexPercent: constant(0.06),
    },
  },

  markettech: {
    id: "markettech",
    label: "Marketing Technology",
    assumptions: {
      ...baseAssumptions(),
      revenueStreams: makeStreams([
        { name: "Subscription & Platform Revenue",     growthStart: 0.60, growthEnd: 0.22 },
        { name: "Usage-Based / Consumption Revenue",   growthStart: 0.70, growthEnd: 0.28 },
        { name: "Managed Services Revenue",            growthStart: 0.35, growthEnd: 0.12 },
        { name: "Data & Analytics Revenue",            growthStart: 0.55, growthEnd: 0.20 },
        { name: "Other Revenue",                       growthStart: 0.15, growthEnd: 0.05 },
      ]),
      cogsPercent: decay(0.25, 0.18),
      rdPercent: decay(0.28, 0.20),
      smPercent: decay(0.38, 0.25),
    },
  },

  security: {
    id: "security",
    label: "Cybersecurity",
    assumptions: {
      ...baseAssumptions(),
      revenueStreams: makeStreams([
        { name: "Subscription Revenue",                      growthStart: 0.65, growthEnd: 0.25 },
        { name: "License Revenue",                           growthStart: 0.30, growthEnd: 0.08 },
        { name: "Managed Security Services Revenue",         growthStart: 0.55, growthEnd: 0.20 },
        { name: "Professional Services & Consulting",        growthStart: 0.30, growthEnd: 0.10 },
        { name: "Other Revenue",                             growthStart: 0.15, growthEnd: 0.05 },
      ]),
      cogsPercent: decay(0.22, 0.16),
      rdPercent: decay(0.30, 0.22),
      smPercent: decay(0.40, 0.28),
    },
  },

  other: {
    id: "other",
    label: "Other / General",
    assumptions: {
      ...baseAssumptions(),
      revenueStreams: makeStreams([
        { name: "Product Revenue",       growthStart: 0.50, growthEnd: 0.18 },
        { name: "Service Revenue",       growthStart: 0.40, growthEnd: 0.15 },
        { name: "Subscription Revenue",  growthStart: 0.55, growthEnd: 0.20 },
        { name: "Usage-Based Revenue",   growthStart: 0.60, growthEnd: 0.22 },
        { name: "Other Revenue",         growthStart: 0.15, growthEnd: 0.05 },
      ]),
    },
  },
};

export function getIndustryBenchmarks(industryId: string): IndustryBenchmark {
  const normalized = industryId.toLowerCase().replace(/[\s/]+/g, "_");
  return BENCHMARKS[normalized as IndustryBenchmarkId] ?? BENCHMARKS.other;
}

export function getAllIndustryIds(): IndustryBenchmarkId[] {
  return Object.keys(BENCHMARKS) as IndustryBenchmarkId[];
}
