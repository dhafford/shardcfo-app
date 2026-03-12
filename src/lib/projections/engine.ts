/**
 * 3-Statement Projection Engine.
 *
 * Projects IS → BS → CF in order:
 *   1. Income Statement: revenue from growth rates, expenses from % of revenue
 *   2. Balance Sheet: working capital from DSO/DPO/% of revenue, then cash as plug
 *   3. Cash Flow: derived from IS net income + non-cash + BS changes + investing + financing
 *
 * Cash is calculated LAST and plugged into the BS to ensure balance.
 */

import {
  type ProjectionAssumptions,
  type HistoricalYear,
  type ProjectedYear,
  PROJECTION_YEARS,
} from "./types";

// ---------------------------------------------------------------------------
// Main projection function
// ---------------------------------------------------------------------------

export function runProjection(
  historicals: HistoricalYear[],
  assumptions: ProjectionAssumptions,
): ProjectedYear[] {
  if (historicals.length === 0) return [];

  const lastHistorical = historicals[historicals.length - 1];
  const startYear = lastHistorical.year + 1;
  const results: ProjectedYear[] = [];

  // Prior year state (starts from last historical)
  let priorRevenue = lastHistorical.revenue;
  let priorRevenueByStream = { ...lastHistorical.revenueByStream };

  // BS prior values — initialize from zero since we may not have historical BS
  let priorCash = 0;
  let priorAR = priorRevenue * 35 / 365; // estimate from revenue
  let priorPrepaid = priorRevenue * 0.03;
  let priorAP = lastHistorical.cogs * 30 / 365;
  let priorAccrued = priorRevenue * 0.06;
  let priorDeferredRevCurrent = priorRevenue * 0.08;
  let priorDeferredRevNonCurrent = priorRevenue * 0.02;
  let priorOtherCurrentLiab = priorRevenue * 0.02;
  let priorPPE = priorRevenue * 0.05;
  let priorCapSoftware = priorRevenue * 0.08;
  let priorLongTermDebt = 0;
  let priorAPIC = 0;
  let priorRetainedEarnings = 0;
  let priorTreasuryStock = 0;
  let priorShortTermInvestments = 0;
  let priorGoodwill = 0;
  let priorIntangibles = 0;
  let priorOtherNonCurrentAssets = 0;
  let priorCurrentDebt = 0;
  let priorOtherNonCurrentLiab = 0;
  let priorCommonStock = 0;

  for (let i = 0; i < Math.min(PROJECTION_YEARS, assumptions.cogsPercent.length); i++) {
    const year = startYear + i;
    const a = getYearAssumptions(assumptions, i);

    // -----------------------------------------------------------------------
    // INCOME STATEMENT
    // -----------------------------------------------------------------------

    // Revenue by stream
    const revenueByStream: Record<string, number> = {};
    let totalRevenue = 0;

    for (const stream of assumptions.revenueStreams) {
      const priorAmount = priorRevenueByStream[stream.name] || 0;
      const growth = stream.growthRates[i] ?? 0;

      if (priorAmount === 0 && priorRevenue > 0) {
        // New stream with no history — estimate from total revenue split
        revenueByStream[stream.name] = 0;
      } else {
        revenueByStream[stream.name] = priorAmount * (1 + growth);
      }
      totalRevenue += revenueByStream[stream.name];
    }

    // If all streams are zero but we have prior total revenue, use total with first stream growth
    if (totalRevenue === 0 && priorRevenue > 0) {
      const primaryGrowth = assumptions.revenueStreams[0]?.growthRates[i] ?? 0.30;
      totalRevenue = priorRevenue * (1 + primaryGrowth);
      // Distribute proportionally
      const totalPriorStreams = Object.values(priorRevenueByStream).reduce((s, v) => s + v, 0);
      if (totalPriorStreams > 0) {
        for (const stream of assumptions.revenueStreams) {
          const pct = (priorRevenueByStream[stream.name] || 0) / totalPriorStreams;
          revenueByStream[stream.name] = totalRevenue * pct;
        }
      } else {
        // Even split
        const n = assumptions.revenueStreams.length;
        for (const stream of assumptions.revenueStreams) {
          revenueByStream[stream.name] = totalRevenue / n;
        }
      }
    }

    const revenueGrowth = priorRevenue > 0 ? (totalRevenue - priorRevenue) / priorRevenue : 0;
    const cogs = totalRevenue * a.cogsPercent;
    const grossProfit = totalRevenue - cogs;
    const grossMargin = totalRevenue > 0 ? grossProfit / totalRevenue : 0;
    const rdExpense = totalRevenue * a.rdPercent;
    const smExpense = totalRevenue * a.smPercent;
    const gaExpense = totalRevenue * a.gaPercent;
    const totalOpex = rdExpense + smExpense + gaExpense;
    const operatingIncome = grossProfit - totalOpex;
    const operatingMargin = totalRevenue > 0 ? operatingIncome / totalRevenue : 0;

    const interestIncome = a.interestIncome;
    const interestExpense = a.interestExpense;
    const otherIncomeExpenseNet = 0;
    const totalOtherIncomeExpense = interestIncome - interestExpense + otherIncomeExpenseNet;

    const preTaxIncome = operatingIncome + totalOtherIncomeExpense;
    const incomeTax = preTaxIncome > 0 ? preTaxIncome * a.taxRate : 0;
    const netIncome = preTaxIncome - incomeTax;
    const netMargin = totalRevenue > 0 ? netIncome / totalRevenue : 0;

    const sbc = totalRevenue * a.sbcPercent;
    const da = totalRevenue * a.daPercent;
    const ebitda = operatingIncome + da + sbc;
    const ebitdaMargin = totalRevenue > 0 ? ebitda / totalRevenue : 0;

    // -----------------------------------------------------------------------
    // BALANCE SHEET
    // -----------------------------------------------------------------------

    // Working capital items
    const accountsReceivable = totalRevenue * a.dso / 365;
    const prepaidExpenses = totalRevenue * a.prepaidPercent;
    const accountsPayable = cogs * a.dpo / 365;
    const accruedLiabilities = totalRevenue * a.accruedLiabPercent;
    const otherCurrentLiabilities = totalRevenue * a.otherCurrentLiabPercent;
    const deferredRevenueCurrent = totalRevenue * a.deferredRevCurrentPercent;
    const deferredRevenueNonCurrent = totalRevenue * a.deferredRevNonCurrentPercent;

    // Fixed assets
    const capex = totalRevenue * a.capexPercent;
    const capSoftwareSpend = totalRevenue * a.capSoftwarePercent;
    const ppeNet = Math.max(0, priorPPE + capex - da * 0.4); // simplified: 40% of D&A goes to PP&E
    const capSoftwareNet = Math.max(0, priorCapSoftware + capSoftwareSpend - da * 0.6); // 60% to cap SW

    // Carry-forward items
    const shortTermInvestments = priorShortTermInvestments;
    const goodwill = priorGoodwill;
    const intangibles = priorIntangibles;
    const otherNonCurrentAssets = priorOtherNonCurrentAssets;
    const currentDebt = priorCurrentDebt;
    const otherNonCurrentLiab = priorOtherNonCurrentLiab;
    const commonStock = priorCommonStock;

    // Financing-driven
    const longTermDebt = Math.max(0, priorLongTermDebt + a.newDebt - a.debtRepayments);
    const apic = priorAPIC + sbc + a.equityIssuance;
    const retainedEarnings = priorRetainedEarnings + netIncome - a.dividendsPaid;
    const treasuryStock = priorTreasuryStock - a.shareRepurchases;
    const totalEquity = commonStock + apic + retainedEarnings + treasuryStock;

    // -----------------------------------------------------------------------
    // CASH FLOW STATEMENT
    // -----------------------------------------------------------------------

    // Operating
    const cfDA = da;
    const cfSBC = sbc;
    const cfOtherNonCash = 0;
    const cfChangeAR = -(accountsReceivable - priorAR);
    const cfChangePrepaid = -(prepaidExpenses - priorPrepaid);
    const cfChangeAP = accountsPayable - priorAP;
    const cfChangeAccrued = accruedLiabilities - priorAccrued;
    const cfChangeDeferredRev = (deferredRevenueCurrent - priorDeferredRevCurrent)
                              + (deferredRevenueNonCurrent - priorDeferredRevNonCurrent);
    const cfChangeOtherWorkingCap = otherCurrentLiabilities - priorOtherCurrentLiab;
    const cfOperating = netIncome + cfDA + cfSBC + cfOtherNonCash
                      + cfChangeAR + cfChangePrepaid + cfChangeAP
                      + cfChangeAccrued + cfChangeDeferredRev + cfChangeOtherWorkingCap;

    // Investing
    const cfCapex = -capex;
    const cfCapSoftware = -capSoftwareSpend;
    const cfOtherInvesting = 0;
    const cfInvesting = cfCapex + cfCapSoftware + cfOtherInvesting;

    // Financing
    const cfNewDebt = a.newDebt;
    const cfDebtRepayment = -a.debtRepayments;
    const cfEquityIssuance = a.equityIssuance;
    const cfShareRepurchases = -a.shareRepurchases;
    const cfDividends = -a.dividendsPaid;
    const cfOtherFinancing = 0;
    const cfFinancing = cfNewDebt + cfDebtRepayment + cfEquityIssuance
                      + cfShareRepurchases + cfDividends + cfOtherFinancing;

    const netCashChange = cfOperating + cfInvesting + cfFinancing;
    const cashBeginning = priorCash;
    const cashEnding = cashBeginning + netCashChange;

    // FCF
    const fcf = cfOperating + cfCapex + cfCapSoftware;
    const fcfMargin = totalRevenue > 0 ? fcf / totalRevenue : 0;

    // BS totals (cash is the plug)
    const cash = cashEnding;
    const totalCurrentAssets = cash + shortTermInvestments + accountsReceivable + prepaidExpenses;
    const totalNonCurrentAssets = ppeNet + goodwill + intangibles + capSoftwareNet + otherNonCurrentAssets;
    const totalAssets = totalCurrentAssets + totalNonCurrentAssets;
    const totalCurrentLiabilities = accountsPayable + accruedLiabilities + deferredRevenueCurrent + currentDebt + otherCurrentLiabilities;
    const totalNonCurrentLiabilities = longTermDebt + deferredRevenueNonCurrent + otherNonCurrentLiab;
    const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
    const balanceCheck = totalAssets - totalLiabilitiesAndEquity;

    const projected: ProjectedYear = {
      label: `FY ${year}E`,
      year,
      isProjected: true,
      revenueByStream, totalRevenue, revenueGrowth,
      cogs, cogsPercent: a.cogsPercent, grossProfit, grossMargin,
      rdExpense, rdPercent: a.rdPercent,
      smExpense, smPercent: a.smPercent,
      gaExpense, gaPercent: a.gaPercent,
      totalOpex, opexPercent: totalRevenue > 0 ? totalOpex / totalRevenue : 0,
      operatingIncome, operatingMargin,
      interestIncome, interestExpense, otherIncomeExpenseNet, totalOtherIncomeExpense,
      preTaxIncome, incomeTax, netIncome, netMargin,
      sbc, da, ebitda, ebitdaMargin,
      // BS
      cash, shortTermInvestments, accountsReceivable, prepaidExpenses,
      totalCurrentAssets, ppeNet, goodwill, intangibles, capSoftwareNet,
      otherNonCurrentAssets, totalNonCurrentAssets, totalAssets,
      accountsPayable, accruedLiabilities, deferredRevenueCurrent,
      currentDebt, otherCurrentLiabilities, totalCurrentLiabilities,
      longTermDebt, deferredRevenueNonCurrent, otherNonCurrentLiabilities: otherNonCurrentLiab,
      totalNonCurrentLiabilities, totalLiabilities,
      commonStock, apic, retainedEarnings, treasuryStock,
      totalEquity, totalLiabilitiesAndEquity, balanceCheck,
      // CF
      cfNetIncome: netIncome, cfDA, cfSBC, cfOtherNonCash,
      cfChangeAR, cfChangePrepaid, cfChangeAP, cfChangeAccrued,
      cfChangeDeferredRev, cfChangeOtherWorkingCap, cfOperating,
      cfCapex, cfCapSoftware, cfOtherInvesting, cfInvesting,
      cfNewDebt, cfDebtRepayment, cfEquityIssuance,
      cfShareRepurchases, cfDividends, cfOtherFinancing, cfFinancing,
      netCashChange, cashBeginning, cashEnding,
      fcf, fcfMargin,
    };

    results.push(projected);

    // Update prior state
    priorRevenue = totalRevenue;
    priorRevenueByStream = { ...revenueByStream };
    priorCash = cashEnding;
    priorAR = accountsReceivable;
    priorPrepaid = prepaidExpenses;
    priorAP = accountsPayable;
    priorAccrued = accruedLiabilities;
    priorDeferredRevCurrent = deferredRevenueCurrent;
    priorDeferredRevNonCurrent = deferredRevenueNonCurrent;
    priorOtherCurrentLiab = otherCurrentLiabilities;
    priorPPE = ppeNet;
    priorCapSoftware = capSoftwareNet;
    priorLongTermDebt = longTermDebt;
    priorAPIC = apic;
    priorRetainedEarnings = retainedEarnings;
    priorTreasuryStock = treasuryStock;
    priorShortTermInvestments = shortTermInvestments;
    priorGoodwill = goodwill;
    priorIntangibles = intangibles;
    priorOtherNonCurrentAssets = otherNonCurrentAssets;
    priorCurrentDebt = currentDebt;
    priorOtherNonCurrentLiab = otherNonCurrentLiab;
    priorCommonStock = commonStock;
  }

  return results;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface YearAssumptions {
  cogsPercent: number;
  rdPercent: number;
  smPercent: number;
  gaPercent: number;
  sbcPercent: number;
  daPercent: number;
  interestIncome: number;
  interestExpense: number;
  taxRate: number;
  dso: number;
  dpo: number;
  prepaidPercent: number;
  accruedLiabPercent: number;
  otherCurrentLiabPercent: number;
  deferredRevCurrentPercent: number;
  deferredRevNonCurrentPercent: number;
  capexPercent: number;
  capSoftwarePercent: number;
  newDebt: number;
  debtRepayments: number;
  equityIssuance: number;
  shareRepurchases: number;
  dividendsPaid: number;
}

function getYearAssumptions(a: ProjectionAssumptions, i: number): YearAssumptions {
  const get = (arr: number[]) => arr[Math.min(i, arr.length - 1)] ?? 0;
  return {
    cogsPercent: get(a.cogsPercent),
    rdPercent: get(a.rdPercent),
    smPercent: get(a.smPercent),
    gaPercent: get(a.gaPercent),
    sbcPercent: get(a.sbcPercent),
    daPercent: get(a.daPercent),
    interestIncome: get(a.interestIncome),
    interestExpense: get(a.interestExpense),
    taxRate: get(a.taxRate),
    dso: get(a.dso),
    dpo: get(a.dpo),
    prepaidPercent: get(a.prepaidPercent),
    accruedLiabPercent: get(a.accruedLiabPercent),
    otherCurrentLiabPercent: get(a.otherCurrentLiabPercent),
    deferredRevCurrentPercent: get(a.deferredRevCurrentPercent),
    deferredRevNonCurrentPercent: get(a.deferredRevNonCurrentPercent),
    capexPercent: get(a.capexPercent),
    capSoftwarePercent: get(a.capSoftwarePercent),
    newDebt: get(a.newDebt),
    debtRepayments: get(a.debtRepayments),
    equityIssuance: get(a.equityIssuance),
    shareRepurchases: get(a.shareRepurchases),
    dividendsPaid: get(a.dividendsPaid),
  };
}
