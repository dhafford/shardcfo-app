/**
 * Types for the 3-statement projection model.
 *
 * The model projects 7 fiscal years from historicals using assumption-driven
 * formulas. Revenue streams grow individually; expenses are % of revenue.
 * Balance sheet items are revenue-driven (DSO, DPO, % of revenue).
 * Cash flow is derived from IS + BS changes.
 */

// ---------------------------------------------------------------------------
// Assumptions
// ---------------------------------------------------------------------------

export interface RevenueStreamAssumption {
  name: string;
  /** YoY growth rate per projection year (e.g. [0.60, 0.55, 0.50, ...]) */
  growthRates: number[];
}

export interface ProjectionAssumptions {
  /** Revenue stream growth rates */
  revenueStreams: RevenueStreamAssumption[];

  // Margin & cost assumptions (% of revenue, per projection year)
  cogsPercent: number[];
  rdPercent: number[];
  smPercent: number[];
  gaPercent: number[];

  // Other P&L assumptions
  sbcPercent: number[];
  daPercent: number[];
  interestIncome: number[];
  interestExpense: number[];
  taxRate: number[];

  // Balance sheet assumptions
  dso: number[];
  dpo: number[];
  prepaidPercent: number[];
  accruedLiabPercent: number[];
  otherCurrentLiabPercent: number[];
  deferredRevCurrentPercent: number[];
  deferredRevNonCurrentPercent: number[];

  // CapEx & investing (% of revenue)
  capexPercent: number[];
  capSoftwarePercent: number[];

  // Financing (absolute amounts)
  newDebt: number[];
  debtRepayments: number[];
  equityIssuance: number[];
  shareRepurchases: number[];
  dividendsPaid: number[];
}

// ---------------------------------------------------------------------------
// Historical data
// ---------------------------------------------------------------------------

export interface HistoricalYear {
  label: string;       // "FY 2023A"
  year: number;        // 2023
  revenue: number;
  revenueByStream: Record<string, number>;
  cogs: number;
  rdExpense: number;
  smExpense: number;
  gaExpense: number;
  otherIncome: number;
  otherExpense: number;
  // Derived
  grossProfit: number;
  totalOpex: number;
  operatingIncome: number;
  netIncome: number;
  ebitda: number;
}

// ---------------------------------------------------------------------------
// Projected period
// ---------------------------------------------------------------------------

export interface ProjectedYear {
  label: string;       // "FY 2026E"
  year: number;
  isProjected: true;

  // Income Statement
  revenueByStream: Record<string, number>;
  totalRevenue: number;
  revenueGrowth: number;
  cogs: number;
  cogsPercent: number;
  grossProfit: number;
  grossMargin: number;
  rdExpense: number;
  rdPercent: number;
  smExpense: number;
  smPercent: number;
  gaExpense: number;
  gaPercent: number;
  totalOpex: number;
  opexPercent: number;
  operatingIncome: number;
  operatingMargin: number;
  interestIncome: number;
  interestExpense: number;
  otherIncomeExpenseNet: number;
  totalOtherIncomeExpense: number;
  preTaxIncome: number;
  incomeTax: number;
  netIncome: number;
  netMargin: number;
  sbc: number;
  da: number;
  ebitda: number;
  ebitdaMargin: number;

  // Balance Sheet
  cash: number;
  shortTermInvestments: number;
  accountsReceivable: number;
  prepaidExpenses: number;
  totalCurrentAssets: number;
  ppeNet: number;
  goodwill: number;
  intangibles: number;
  capSoftwareNet: number;
  otherNonCurrentAssets: number;
  totalNonCurrentAssets: number;
  totalAssets: number;
  accountsPayable: number;
  accruedLiabilities: number;
  deferredRevenueCurrent: number;
  currentDebt: number;
  otherCurrentLiabilities: number;
  totalCurrentLiabilities: number;
  longTermDebt: number;
  deferredRevenueNonCurrent: number;
  otherNonCurrentLiabilities: number;
  totalNonCurrentLiabilities: number;
  totalLiabilities: number;
  commonStock: number;
  apic: number;
  retainedEarnings: number;
  treasuryStock: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  balanceCheck: number;

  // Cash Flow
  cfNetIncome: number;
  cfDA: number;
  cfSBC: number;
  cfOtherNonCash: number;
  cfChangeAR: number;
  cfChangePrepaid: number;
  cfChangeAP: number;
  cfChangeAccrued: number;
  cfChangeDeferredRev: number;
  cfChangeOtherWorkingCap: number;
  cfOperating: number;
  cfCapex: number;
  cfCapSoftware: number;
  cfOtherInvesting: number;
  cfInvesting: number;
  cfNewDebt: number;
  cfDebtRepayment: number;
  cfEquityIssuance: number;
  cfShareRepurchases: number;
  cfDividends: number;
  cfOtherFinancing: number;
  cfFinancing: number;
  netCashChange: number;
  cashBeginning: number;
  cashEnding: number;
  fcf: number;
  fcfMargin: number;
}

// ---------------------------------------------------------------------------
// Combined model
// ---------------------------------------------------------------------------

export type ModelYear = (HistoricalYear & { isProjected: false }) | ProjectedYear;

export interface ProjectionModel {
  companyId: string;
  companyName: string;
  industry: string;
  historicals: HistoricalYear[];
  projected: ProjectedYear[];
  assumptions: ProjectionAssumptions;
  projectionYears: number;
}

/** Number of projection years */
export const PROJECTION_YEARS = 7;
