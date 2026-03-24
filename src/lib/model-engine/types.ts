/**
 * Core types for the three-statement financial model engine.
 *
 * Every other file in this module imports from here. Organized into:
 *  - Policy / config types
 *  - Input types (assumptions, historical data, debt, NOLs, equity)
 *  - State types (per-period IS, BS, CFS, schedules)
 *  - Output types (solver metrics, diagnostics, final output)
 *  - Factory helpers (createEmptyPeriodState, createPeriodStateFromHistorical)
 */

// ---------------------------------------------------------------------------
// Policy & config
// ---------------------------------------------------------------------------

export interface PolicyFlags {
  accountingStandard: "GAAP" | "IFRS";
  // Cash flow statement classification choices
  cfsInterestPaid: "CFO" | "CFF";
  cfsInterestReceived: "CFO" | "CFI";
  cfsDividendsPaid: "CFO" | "CFF";
  cfsDividendsReceived: "CFO" | "CFI";
  // Lease accounting
  leaseModel: "ASC_842" | "IFRS_16" | "OPERATING_ONLY";
  // R&D capitalization policy
  rdAccounting: "EXPENSE_ALL" | "CAPITALIZE_DEVELOPMENT";
  // Impairment reversal (IFRS allows for non-goodwill assets)
  impairmentReversal: "NOT_ALLOWED" | "ALLOWED_NON_GOODWILL";
  // SBC forfeiture estimation method
  sbcForfeitureMethod: "AS_OCCUR" | "ESTIMATE_AT_GRANT";
  // Inventory costing method
  inventoryMethod: "FIFO" | "LIFO" | "WEIGHTED_AVG";
}

export interface SolverConfig {
  /** Relaxation factor for the circular cash sweep iteration (0 < alpha ≤ 1). */
  alpha: number;
  /** Convergence tolerance — residual below this value is treated as converged. */
  tolerance: number;
  maxIterations: number;
  /** When true, break the circularity with a plug rather than iterating. */
  breakerMode: boolean;
}

export interface ModelConfig {
  policyFlags: PolicyFlags;
  solverConfig: SolverConfig;
  projectionYears: number;
  /** 1-based month number (e.g. 12 = December, 3 = March). */
  fiscalYearEndMonth: number;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface RevenueStreamInput {
  name: string;
  /** YoY growth rates, one per projection year. */
  growthRates: number[];
}

export interface DebtTranche {
  id: string;
  name: string;
  type:
    | "term_loan_a"
    | "term_loan_b"
    | "senior_notes"
    | "sub_notes"
    | "mezzanine"
    | "revolver";
  principalBalance: number;
  /** Fixed coupon rate or all-in rate for fixed instruments. */
  interestRate: number;
  isFloating: boolean;
  /** Spread over benchmark (e.g. SOFR) for floating-rate instruments. */
  spread: number;
  /** Rate floor for floating instruments (e.g. 0.01 = 1%). */
  floor: number;
  /** PIK interest rate (0 if instrument is cash-pay only). */
  pikRate: number;
  /** Scheduled amortization payments per year. */
  mandatoryAmortization: number[];
  maturityYear: number;
  // Revolver-specific fields
  isRevolver: boolean;
  commitment: number;
  borrowingBase: number;
  locOutstanding: number;
  /** Minimum cash balance the model must maintain before drawing the revolver. */
  minCash: number;
  /** Annual commitment fee rate on the undrawn portion. */
  commitmentFeeRate: number;
}

export interface NOLVintage {
  vintageYear: number;
  originalAmount: number;
  utilizedToDate: number;
  /** Null for post-TCJA NOLs (indefinite carryforward). */
  expirationYear: number | null;
  /** 0.8 for post-TCJA (80% income limitation); 1.0 for pre-TCJA (full utilization). */
  limitationRate: number;
}

export interface EquityInputs {
  basicSharesOutstanding: number;
  parValue: number;
  optionPool: {
    shares: number;
    avgExercisePrice: number;
    avgStockPrice: number;
  };
  rsuShares: number;
  /** Convertible debt converted to equity for diluted share count purposes. */
  convertibleDebt: {
    shares: number;
    interestSaved: number;
  };
  dividendPerShare: number;
  /** Share buyback spend per projection year. */
  buybackBudget: number[];
}

export interface HistoricalBalanceSheet {
  // Current assets
  cash: number;
  shortTermInvestments: number;
  accountsReceivable: number;
  inventory: number;
  prepaidExpenses: number;
  otherCurrentAssets: number;
  // Non-current assets
  grossPPE: number;
  accumulatedDepreciation: number;
  goodwill: number;
  intangiblesNet: number;
  capitalizedSoftwareNet: number;
  otherNonCurrentAssets: number;
  deferredTaxAsset: number;
  // Current liabilities
  accountsPayable: number;
  accruedLiabilities: number;
  deferredRevenueCurrent: number;
  incomeTaxPayable: number;
  currentPortionLTD: number;
  otherCurrentLiabilities: number;
  // Non-current liabilities
  deferredRevenueNonCurrent: number;
  deferredTaxLiability: number;
  otherNonCurrentLiabilities: number;
  // Equity
  commonStock: number;
  apic: number;
  retainedEarnings: number;
  aoci: number;
  treasuryStock: number;
}

export interface Assumptions {
  revenueStreams: RevenueStreamInput[];
  /** COGS as a percent of revenue, per projection year. */
  cogsPercent: number[];
  /** R&D as a percent of revenue, per projection year. */
  rdPercent: number[];
  /** Sales & marketing as a percent of revenue, per projection year. */
  smPercent: number[];
  /** G&A as a percent of revenue, per projection year. */
  gaPercent: number[];
  /** SBC as a percent of revenue, per projection year. */
  sbcPercent: number[];
  // Working capital drivers (days)
  dso: number[];
  dio: number[];
  dpo: number[];
  // Balance sheet % of revenue drivers
  prepaidPercent: number[];
  accruedLiabPercent: number[];
  deferredRevCurrentPercent: number[];
  deferredRevNonCurrentPercent: number[];
  // CapEx & investing (% of revenue)
  capexPercent: number[];
  capSoftwarePercent: number[];
  taxRate: number[];
  /** Absolute interest income per year. */
  interestIncome: number[];
  /** Absolute other non-operating income (loss) per year. */
  otherNonOperating: number[];
}

export interface ModelInput {
  companyName: string;
  industry: string;
  assumptions: Assumptions;
  historicalIS: {
    revenue: number;
    revenueByStream: Record<string, number>;
    cogs: number;
    lastFiscalYear: number;
  };
  historicalBS: HistoricalBalanceSheet;
  debtTranches: DebtTranche[];
  nolVintages: NOLVintage[];
  equityInputs: EquityInputs;
}

// ---------------------------------------------------------------------------
// Per-period state sub-types
// ---------------------------------------------------------------------------

export interface IncomeStatementState {
  revenue: number;
  revenueByStream: Record<string, number>;
  cogs: number;
  grossProfit: number;
  rdExpense: number;
  smExpense: number;
  gaExpense: number;
  totalOpex: number;
  ebitda: number;
  sbc: number;
  da: number;
  operatingIncome: number;
  interestExpense: number;
  interestIncome: number;
  otherNonOperating: number;
  ebt: number;
  currentTaxExpense: number;
  deferredTaxExpense: number;
  totalTaxExpense: number;
  netIncome: number;
  basicEPS: number;
  dilutedEPS: number;
}

export interface BalanceSheetState {
  // Current assets
  cash: number;
  shortTermInvestments: number;
  accountsReceivable: number;
  inventory: number;
  prepaidExpenses: number;
  otherCurrentAssets: number;
  totalCurrentAssets: number;
  // Non-current assets
  grossPPE: number;
  accumulatedDepreciation: number;
  netPPE: number;
  goodwill: number;
  intangiblesNet: number;
  capitalizedSoftwareNet: number;
  /** Right-of-use assets (ASC 842 / IFRS 16). */
  rous: number;
  deferredTaxAsset: number;
  otherNonCurrentAssets: number;
  totalNonCurrentAssets: number;
  totalAssets: number;
  // Current liabilities
  accountsPayable: number;
  accruedLiabilities: number;
  deferredRevenueCurrent: number;
  incomeTaxPayable: number;
  currentPortionLTD: number;
  revolverBalance: number;
  otherCurrentLiabilities: number;
  totalCurrentLiabilities: number;
  // Non-current liabilities
  longTermDebt: number;
  deferredRevenueNonCurrent: number;
  deferredTaxLiability: number;
  otherNonCurrentLiabilities: number;
  totalNonCurrentLiabilities: number;
  totalLiabilities: number;
  // Equity
  commonStock: number;
  apic: number;
  retainedEarnings: number;
  aoci: number;
  treasuryStock: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  /** Should be 0; non-zero indicates a model error. */
  balanceCheck: number;
}

export interface CashFlowState {
  // Operating — non-cash adjustments
  cfNetIncome: number;
  cfDA: number;
  cfSBC: number;
  cfDeferredTax: number;
  cfPIK: number;
  cfImpairment: number;
  cfAmortDebtCosts: number;
  cfGainLossDisposals: number;
  cfOtherNonCash: number;
  // Operating — working capital changes
  cfChangeAR: number;
  cfChangeInventory: number;
  cfChangePrepaid: number;
  cfChangeAP: number;
  cfChangeAccrued: number;
  cfChangeDeferredRev: number;
  cfChangeOtherWC: number;
  cfOperating: number;
  // Investing
  cfCapex: number;
  cfCapSoftware: number;
  cfAssetSales: number;
  cfAcquisitions: number;
  cfOtherInvesting: number;
  cfInvesting: number;
  // Financing
  cfDebtIssuances: number;
  cfDebtRepayments: number;
  cfRevolverNet: number;
  cfEquityIssuances: number;
  cfShareRepurchases: number;
  cfDividends: number;
  cfDebtIssuanceCosts: number;
  cfOtherFinancing: number;
  cfFinancing: number;
  // Totals
  fxEffect: number;
  netCashChange: number;
  beginningCash: number;
  endingCash: number;
  /** Free cash flow = cfOperating + cfCapex + cfCapSoftware. */
  fcf: number;
}

export interface DebtTrancheResult {
  trancheId: string;
  opening: number;
  issuances: number;
  mandatoryAmort: number;
  optionalPrepay: number;
  pikAccrual: number;
  closing: number;
  cashInterest: number;
  // Revolver-specific
  revolverDraw: number;
  revolverSweep: number;
  commitmentFee: number;
}

export interface NOLVintageResult {
  vintageYear: number;
  opening: number;
  utilized: number;
  expired: number;
  closing: number;
}

export interface ScheduleState {
  debtTranches: DebtTrancheResult[];
  nolVintages: NOLVintageResult[];
  totalInterestExpense: number;
  totalCashInterest: number;
  totalPIK: number;
  grossPPERollForward: {
    opening: number;
    additions: number;
    disposals: number;
    closing: number;
  };
  accumDeprRollForward: {
    opening: number;
    expense: number;
    disposals: number;
    closing: number;
  };
  basicShares: number;
  dilutedShares: number;
}

// ---------------------------------------------------------------------------
// PeriodState — the core per-year container
// ---------------------------------------------------------------------------

export interface PeriodState {
  /** Human-readable period label, e.g. "FY 2026E". */
  label: string;
  year: number;
  /** 0-based index into the projection array. */
  periodIndex: number;
  is: IncomeStatementState;
  bs: BalanceSheetState;
  cfs: CashFlowState;
  schedules: ScheduleState;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface SolverMetrics {
  converged: boolean;
  iterations: number;
  finalResidual: number;
}

export interface DiagnosticResult {
  id: string;
  name: string;
  severity: "CRITICAL" | "HIGH" | "WARNING" | "INFO";
  passed: boolean;
  /** Projection year this diagnostic applies to (undefined = model-wide). */
  period?: number;
  deviation?: number;
  rootCause?: string;
  fix?: string;
}

export interface ModelOutput {
  periods: PeriodState[];
  diagnostics: DiagnosticResult[];
  /** One SolverMetrics entry per projection period. */
  solverMetrics: SolverMetrics[];
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

/** Returns a PeriodState with all numeric fields zeroed and empty arrays/maps. */
export function createEmptyPeriodState(
  label: string,
  year: number,
  periodIndex: number
): PeriodState {
  const emptyIS: IncomeStatementState = {
    revenue: 0,
    revenueByStream: {},
    cogs: 0,
    grossProfit: 0,
    rdExpense: 0,
    smExpense: 0,
    gaExpense: 0,
    totalOpex: 0,
    ebitda: 0,
    sbc: 0,
    da: 0,
    operatingIncome: 0,
    interestExpense: 0,
    interestIncome: 0,
    otherNonOperating: 0,
    ebt: 0,
    currentTaxExpense: 0,
    deferredTaxExpense: 0,
    totalTaxExpense: 0,
    netIncome: 0,
    basicEPS: 0,
    dilutedEPS: 0,
  };

  const emptyBS: BalanceSheetState = {
    cash: 0,
    shortTermInvestments: 0,
    accountsReceivable: 0,
    inventory: 0,
    prepaidExpenses: 0,
    otherCurrentAssets: 0,
    totalCurrentAssets: 0,
    grossPPE: 0,
    accumulatedDepreciation: 0,
    netPPE: 0,
    goodwill: 0,
    intangiblesNet: 0,
    capitalizedSoftwareNet: 0,
    rous: 0,
    deferredTaxAsset: 0,
    otherNonCurrentAssets: 0,
    totalNonCurrentAssets: 0,
    totalAssets: 0,
    accountsPayable: 0,
    accruedLiabilities: 0,
    deferredRevenueCurrent: 0,
    incomeTaxPayable: 0,
    currentPortionLTD: 0,
    revolverBalance: 0,
    otherCurrentLiabilities: 0,
    totalCurrentLiabilities: 0,
    longTermDebt: 0,
    deferredRevenueNonCurrent: 0,
    deferredTaxLiability: 0,
    otherNonCurrentLiabilities: 0,
    totalNonCurrentLiabilities: 0,
    totalLiabilities: 0,
    commonStock: 0,
    apic: 0,
    retainedEarnings: 0,
    aoci: 0,
    treasuryStock: 0,
    totalEquity: 0,
    totalLiabilitiesAndEquity: 0,
    balanceCheck: 0,
  };

  const emptyCFS: CashFlowState = {
    cfNetIncome: 0,
    cfDA: 0,
    cfSBC: 0,
    cfDeferredTax: 0,
    cfPIK: 0,
    cfImpairment: 0,
    cfAmortDebtCosts: 0,
    cfGainLossDisposals: 0,
    cfOtherNonCash: 0,
    cfChangeAR: 0,
    cfChangeInventory: 0,
    cfChangePrepaid: 0,
    cfChangeAP: 0,
    cfChangeAccrued: 0,
    cfChangeDeferredRev: 0,
    cfChangeOtherWC: 0,
    cfOperating: 0,
    cfCapex: 0,
    cfCapSoftware: 0,
    cfAssetSales: 0,
    cfAcquisitions: 0,
    cfOtherInvesting: 0,
    cfInvesting: 0,
    cfDebtIssuances: 0,
    cfDebtRepayments: 0,
    cfRevolverNet: 0,
    cfEquityIssuances: 0,
    cfShareRepurchases: 0,
    cfDividends: 0,
    cfDebtIssuanceCosts: 0,
    cfOtherFinancing: 0,
    cfFinancing: 0,
    fxEffect: 0,
    netCashChange: 0,
    beginningCash: 0,
    endingCash: 0,
    fcf: 0,
  };

  const emptySchedules: ScheduleState = {
    debtTranches: [],
    nolVintages: [],
    totalInterestExpense: 0,
    totalCashInterest: 0,
    totalPIK: 0,
    grossPPERollForward: { opening: 0, additions: 0, disposals: 0, closing: 0 },
    accumDeprRollForward: { opening: 0, expense: 0, disposals: 0, closing: 0 },
    basicShares: 0,
    dilutedShares: 0,
  };

  return { label, year, periodIndex, is: emptyIS, bs: emptyBS, cfs: emptyCFS, schedules: emptySchedules };
}

/**
 * Bootstraps the period-0 state from historical actuals.
 *
 * Only populates fields that are directly observable from the historical
 * income statement and balance sheet; all schedule and CFS fields are
 * left at zero because they require forward-looking computation.
 */
export function createPeriodStateFromHistorical(
  historicalBS: HistoricalBalanceSheet,
  historicalIS: ModelInput["historicalIS"],
  label: string,
  year: number
): PeriodState {
  const base = createEmptyPeriodState(label, year, -1);

  // Populate IS from historical income statement
  base.is.revenue = historicalIS.revenue;
  base.is.revenueByStream = { ...historicalIS.revenueByStream };
  base.is.cogs = historicalIS.cogs;
  base.is.grossProfit = historicalIS.revenue - historicalIS.cogs;

  // Populate BS directly from historical balance sheet
  base.bs.cash = historicalBS.cash;
  base.bs.shortTermInvestments = historicalBS.shortTermInvestments;
  base.bs.accountsReceivable = historicalBS.accountsReceivable;
  base.bs.inventory = historicalBS.inventory;
  base.bs.prepaidExpenses = historicalBS.prepaidExpenses;
  base.bs.otherCurrentAssets = historicalBS.otherCurrentAssets;
  base.bs.grossPPE = historicalBS.grossPPE;
  base.bs.accumulatedDepreciation = historicalBS.accumulatedDepreciation;
  base.bs.netPPE = historicalBS.grossPPE + historicalBS.accumulatedDepreciation; // accum depr is negative
  base.bs.goodwill = historicalBS.goodwill;
  base.bs.intangiblesNet = historicalBS.intangiblesNet;
  base.bs.capitalizedSoftwareNet = historicalBS.capitalizedSoftwareNet;
  base.bs.deferredTaxAsset = historicalBS.deferredTaxAsset;
  base.bs.otherNonCurrentAssets = historicalBS.otherNonCurrentAssets;
  base.bs.accountsPayable = historicalBS.accountsPayable;
  base.bs.accruedLiabilities = historicalBS.accruedLiabilities;
  base.bs.deferredRevenueCurrent = historicalBS.deferredRevenueCurrent;
  base.bs.incomeTaxPayable = historicalBS.incomeTaxPayable;
  base.bs.currentPortionLTD = historicalBS.currentPortionLTD;
  base.bs.otherCurrentLiabilities = historicalBS.otherCurrentLiabilities;
  base.bs.deferredRevenueNonCurrent = historicalBS.deferredRevenueNonCurrent;
  base.bs.deferredTaxLiability = historicalBS.deferredTaxLiability;
  base.bs.otherNonCurrentLiabilities = historicalBS.otherNonCurrentLiabilities;
  base.bs.commonStock = historicalBS.commonStock;
  base.bs.apic = historicalBS.apic;
  base.bs.retainedEarnings = historicalBS.retainedEarnings;
  base.bs.aoci = historicalBS.aoci;
  base.bs.treasuryStock = historicalBS.treasuryStock;

  return base;
}
