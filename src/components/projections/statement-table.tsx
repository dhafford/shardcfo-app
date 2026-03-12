"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { type HistoricalYear, type ProjectedYear } from "@/lib/projections/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StatementType = "income_statement" | "balance_sheet" | "cash_flow" | "kpis";

interface StatementTableProps {
  type: StatementType;
  historicals: HistoricalYear[];
  projected: ProjectedYear[];
}

interface RowDef {
  label: string;
  historicalFn: (h: HistoricalYear) => number | null;
  projectedFn: (p: ProjectedYear) => number | null;
  format?: "currency" | "percent" | "days" | "ratio";
  bold?: boolean;
  indent?: number;
  section?: boolean;
  separator?: boolean;
}

// ---------------------------------------------------------------------------
// Currency / percent formatters
// ---------------------------------------------------------------------------

const currFmt = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD",
  minimumFractionDigits: 0, maximumFractionDigits: 0,
});

function fmtVal(value: number | null, format: RowDef["format"]): string {
  if (value === null || value === undefined) return "—";
  switch (format) {
    case "percent":
      return `${(value * 100).toFixed(1)}%`;
    case "days":
      return `${Math.round(value)}`;
    case "ratio":
      return value.toFixed(2) + "x";
    case "currency":
    default:
      if (Math.abs(value) < 0.5) return "$0";
      if (value < 0) return `(${currFmt.format(Math.abs(value))})`;
      return currFmt.format(value);
  }
}

// ---------------------------------------------------------------------------
// Row definitions per statement type
// ---------------------------------------------------------------------------

function getIncomeStatementRows(): RowDef[] {
  return [
    { label: "Revenue", section: true, historicalFn: () => null, projectedFn: () => null },
    // Revenue streams will be injected dynamically
    { label: "Total Revenue", bold: true, historicalFn: (h) => h.revenue, projectedFn: (p) => p.totalRevenue },
    { label: "  YoY Growth %", format: "percent", historicalFn: () => null, projectedFn: (p) => p.revenueGrowth },
    { label: "", separator: true, historicalFn: () => null, projectedFn: () => null },
    { label: "Cost of Revenue", section: true, historicalFn: () => null, projectedFn: () => null },
    { label: "Total Cost of Revenue", historicalFn: (h) => h.cogs, projectedFn: (p) => p.cogs },
    { label: "  COGS % of Revenue", format: "percent", historicalFn: (h) => h.revenue > 0 ? h.cogs / h.revenue : null, projectedFn: (p) => p.cogsPercent },
    { label: "", separator: true, historicalFn: () => null, projectedFn: () => null },
    { label: "Gross Profit", bold: true, historicalFn: (h) => h.grossProfit, projectedFn: (p) => p.grossProfit },
    { label: "  Gross Margin %", format: "percent", historicalFn: (h) => h.revenue > 0 ? h.grossProfit / h.revenue : null, projectedFn: (p) => p.grossMargin },
    { label: "", separator: true, historicalFn: () => null, projectedFn: () => null },
    { label: "Research & Development", section: true, historicalFn: () => null, projectedFn: () => null },
    { label: "Total R&D", historicalFn: (h) => h.rdExpense, projectedFn: (p) => p.rdExpense },
    { label: "", separator: true, historicalFn: () => null, projectedFn: () => null },
    { label: "Sales & Marketing", section: true, historicalFn: () => null, projectedFn: () => null },
    { label: "Total Sales & Marketing", historicalFn: (h) => h.smExpense, projectedFn: (p) => p.smExpense },
    { label: "", separator: true, historicalFn: () => null, projectedFn: () => null },
    { label: "General & Administrative", section: true, historicalFn: () => null, projectedFn: () => null },
    { label: "Total G&A", historicalFn: (h) => h.gaExpense, projectedFn: (p) => p.gaExpense },
    { label: "", separator: true, historicalFn: () => null, projectedFn: () => null },
    { label: "Total Operating Expenses", bold: true, historicalFn: (h) => h.totalOpex, projectedFn: (p) => p.totalOpex },
    { label: "  OpEx % of Revenue", format: "percent", historicalFn: (h) => h.revenue > 0 ? h.totalOpex / h.revenue : null, projectedFn: (p) => p.opexPercent },
    { label: "", separator: true, historicalFn: () => null, projectedFn: () => null },
    { label: "Operating Income (Loss)", bold: true, historicalFn: (h) => h.operatingIncome, projectedFn: (p) => p.operatingIncome },
    { label: "  Operating Margin %", format: "percent", historicalFn: (h) => h.revenue > 0 ? h.operatingIncome / h.revenue : null, projectedFn: (p) => p.operatingMargin },
    { label: "", separator: true, historicalFn: () => null, projectedFn: () => null },
    { label: "Other Income (Expense)", section: true, historicalFn: () => null, projectedFn: () => null },
    { label: "Interest Income", indent: 1, historicalFn: (h) => h.otherIncome, projectedFn: (p) => p.interestIncome },
    { label: "Interest Expense", indent: 1, historicalFn: (h) => h.otherExpense, projectedFn: (p) => p.interestExpense },
    { label: "Total Other Income (Expense)", historicalFn: (h) => h.otherIncome - h.otherExpense, projectedFn: (p) => p.totalOtherIncomeExpense },
    { label: "", separator: true, historicalFn: () => null, projectedFn: () => null },
    { label: "Income Before Taxes", bold: true, historicalFn: () => null, projectedFn: (p) => p.preTaxIncome },
    { label: "Income Tax Expense", indent: 1, historicalFn: () => null, projectedFn: (p) => p.incomeTax },
    { label: "Net Income (Loss)", bold: true, historicalFn: (h) => h.netIncome, projectedFn: (p) => p.netIncome },
    { label: "  Net Margin %", format: "percent", historicalFn: (h) => h.revenue > 0 ? h.netIncome / h.revenue : null, projectedFn: (p) => p.netMargin },
    { label: "", separator: true, historicalFn: () => null, projectedFn: () => null },
    { label: "EBITDA", bold: true, historicalFn: (h) => h.ebitda, projectedFn: (p) => p.ebitda },
    { label: "  EBITDA Margin %", format: "percent", historicalFn: (h) => h.revenue > 0 ? h.ebitda / h.revenue : null, projectedFn: (p) => p.ebitdaMargin },
  ];
}

function getBalanceSheetRows(): RowDef[] {
  const na = () => null;
  return [
    { label: "ASSETS", section: true, historicalFn: na, projectedFn: na },
    { label: "Current Assets", section: true, historicalFn: na, projectedFn: na },
    { label: "Cash & Cash Equivalents", indent: 1, historicalFn: na, projectedFn: (p) => p.cash },
    { label: "Short-Term Investments", indent: 1, historicalFn: na, projectedFn: (p) => p.shortTermInvestments },
    { label: "Accounts Receivable, Net", indent: 1, historicalFn: na, projectedFn: (p) => p.accountsReceivable },
    { label: "Prepaid Expenses & Other", indent: 1, historicalFn: na, projectedFn: (p) => p.prepaidExpenses },
    { label: "Total Current Assets", bold: true, historicalFn: na, projectedFn: (p) => p.totalCurrentAssets },
    { label: "", separator: true, historicalFn: na, projectedFn: na },
    { label: "Non-Current Assets", section: true, historicalFn: na, projectedFn: na },
    { label: "Property & Equipment, Net", indent: 1, historicalFn: na, projectedFn: (p) => p.ppeNet },
    { label: "Goodwill", indent: 1, historicalFn: na, projectedFn: (p) => p.goodwill },
    { label: "Intangible Assets, Net", indent: 1, historicalFn: na, projectedFn: (p) => p.intangibles },
    { label: "Capitalized Software, Net", indent: 1, historicalFn: na, projectedFn: (p) => p.capSoftwareNet },
    { label: "Other Non-Current Assets", indent: 1, historicalFn: na, projectedFn: (p) => p.otherNonCurrentAssets },
    { label: "Total Non-Current Assets", bold: true, historicalFn: na, projectedFn: (p) => p.totalNonCurrentAssets },
    { label: "", separator: true, historicalFn: na, projectedFn: na },
    { label: "TOTAL ASSETS", bold: true, historicalFn: na, projectedFn: (p) => p.totalAssets },
    { label: "", separator: true, historicalFn: na, projectedFn: na },
    { label: "LIABILITIES & EQUITY", section: true, historicalFn: na, projectedFn: na },
    { label: "Current Liabilities", section: true, historicalFn: na, projectedFn: na },
    { label: "Accounts Payable", indent: 1, historicalFn: na, projectedFn: (p) => p.accountsPayable },
    { label: "Accrued Liabilities", indent: 1, historicalFn: na, projectedFn: (p) => p.accruedLiabilities },
    { label: "Deferred Revenue — Current", indent: 1, historicalFn: na, projectedFn: (p) => p.deferredRevenueCurrent },
    { label: "Current Portion of Debt", indent: 1, historicalFn: na, projectedFn: (p) => p.currentDebt },
    { label: "Other Current Liabilities", indent: 1, historicalFn: na, projectedFn: (p) => p.otherCurrentLiabilities },
    { label: "Total Current Liabilities", bold: true, historicalFn: na, projectedFn: (p) => p.totalCurrentLiabilities },
    { label: "", separator: true, historicalFn: na, projectedFn: na },
    { label: "Non-Current Liabilities", section: true, historicalFn: na, projectedFn: na },
    { label: "Long-Term Debt", indent: 1, historicalFn: na, projectedFn: (p) => p.longTermDebt },
    { label: "Deferred Revenue — Non-Current", indent: 1, historicalFn: na, projectedFn: (p) => p.deferredRevenueNonCurrent },
    { label: "Other Non-Current Liabilities", indent: 1, historicalFn: na, projectedFn: (p) => p.otherNonCurrentLiabilities },
    { label: "Total Non-Current Liabilities", bold: true, historicalFn: na, projectedFn: (p) => p.totalNonCurrentLiabilities },
    { label: "Total Liabilities", bold: true, historicalFn: na, projectedFn: (p) => p.totalLiabilities },
    { label: "", separator: true, historicalFn: na, projectedFn: na },
    { label: "Stockholders' Equity", section: true, historicalFn: na, projectedFn: na },
    { label: "Common Stock", indent: 1, historicalFn: na, projectedFn: (p) => p.commonStock },
    { label: "Additional Paid-In Capital", indent: 1, historicalFn: na, projectedFn: (p) => p.apic },
    { label: "Retained Earnings", indent: 1, historicalFn: na, projectedFn: (p) => p.retainedEarnings },
    { label: "Treasury Stock", indent: 1, historicalFn: na, projectedFn: (p) => p.treasuryStock },
    { label: "Total Equity", bold: true, historicalFn: na, projectedFn: (p) => p.totalEquity },
    { label: "", separator: true, historicalFn: na, projectedFn: na },
    { label: "TOTAL LIABILITIES & EQUITY", bold: true, historicalFn: na, projectedFn: (p) => p.totalLiabilitiesAndEquity },
    { label: "Balance Check (A − L&E)", historicalFn: na, projectedFn: (p) => p.balanceCheck },
  ];
}

function getCashFlowRows(): RowDef[] {
  const na = () => null;
  return [
    { label: "Operating Activities", section: true, historicalFn: na, projectedFn: na },
    { label: "Net Income", indent: 1, historicalFn: (h) => h.netIncome, projectedFn: (p) => p.cfNetIncome },
    { label: "Depreciation & Amortization", indent: 1, historicalFn: na, projectedFn: (p) => p.cfDA },
    { label: "Stock-Based Compensation", indent: 1, historicalFn: na, projectedFn: (p) => p.cfSBC },
    { label: "Change in Accounts Receivable", indent: 1, historicalFn: na, projectedFn: (p) => p.cfChangeAR },
    { label: "Change in Prepaid & Other", indent: 1, historicalFn: na, projectedFn: (p) => p.cfChangePrepaid },
    { label: "Change in Accounts Payable", indent: 1, historicalFn: na, projectedFn: (p) => p.cfChangeAP },
    { label: "Change in Accrued Liabilities", indent: 1, historicalFn: na, projectedFn: (p) => p.cfChangeAccrued },
    { label: "Change in Deferred Revenue", indent: 1, historicalFn: na, projectedFn: (p) => p.cfChangeDeferredRev },
    { label: "Change in Other Working Cap", indent: 1, historicalFn: na, projectedFn: (p) => p.cfChangeOtherWorkingCap },
    { label: "Net Cash from Operations", bold: true, historicalFn: na, projectedFn: (p) => p.cfOperating },
    { label: "", separator: true, historicalFn: na, projectedFn: na },
    { label: "Investing Activities", section: true, historicalFn: na, projectedFn: na },
    { label: "CapEx (PP&E)", indent: 1, historicalFn: na, projectedFn: (p) => p.cfCapex },
    { label: "Capitalized Software", indent: 1, historicalFn: na, projectedFn: (p) => p.cfCapSoftware },
    { label: "Net Cash from Investing", bold: true, historicalFn: na, projectedFn: (p) => p.cfInvesting },
    { label: "", separator: true, historicalFn: na, projectedFn: na },
    { label: "Financing Activities", section: true, historicalFn: na, projectedFn: na },
    { label: "New Debt Issuance", indent: 1, historicalFn: na, projectedFn: (p) => p.cfNewDebt },
    { label: "Debt Repayments", indent: 1, historicalFn: na, projectedFn: (p) => p.cfDebtRepayment },
    { label: "Equity Issuance", indent: 1, historicalFn: na, projectedFn: (p) => p.cfEquityIssuance },
    { label: "Share Repurchases", indent: 1, historicalFn: na, projectedFn: (p) => p.cfShareRepurchases },
    { label: "Dividends Paid", indent: 1, historicalFn: na, projectedFn: (p) => p.cfDividends },
    { label: "Net Cash from Financing", bold: true, historicalFn: na, projectedFn: (p) => p.cfFinancing },
    { label: "", separator: true, historicalFn: na, projectedFn: na },
    { label: "Net Change in Cash", bold: true, historicalFn: na, projectedFn: (p) => p.netCashChange },
    { label: "Cash — Beginning", historicalFn: na, projectedFn: (p) => p.cashBeginning },
    { label: "Cash — Ending", bold: true, historicalFn: na, projectedFn: (p) => p.cashEnding },
    { label: "", separator: true, historicalFn: na, projectedFn: na },
    { label: "Free Cash Flow", bold: true, historicalFn: na, projectedFn: (p) => p.fcf },
    { label: "  FCF Margin %", format: "percent", historicalFn: na, projectedFn: (p) => p.fcfMargin },
  ];
}

function getKPIRows(): RowDef[] {
  return [
    { label: "Growth Metrics", section: true, historicalFn: () => null, projectedFn: () => null },
    { label: "Revenue YoY Growth", format: "percent", historicalFn: () => null, projectedFn: (p) => p.revenueGrowth },
    { label: "Gross Profit Growth", format: "percent", historicalFn: () => null, projectedFn: () => null },
    { label: "", separator: true, historicalFn: () => null, projectedFn: () => null },
    { label: "Profitability", section: true, historicalFn: () => null, projectedFn: () => null },
    { label: "Gross Margin %", format: "percent", historicalFn: (h) => h.revenue > 0 ? h.grossProfit / h.revenue : null, projectedFn: (p) => p.grossMargin },
    { label: "R&D % of Revenue", format: "percent", historicalFn: (h) => h.revenue > 0 ? h.rdExpense / h.revenue : null, projectedFn: (p) => p.rdPercent },
    { label: "S&M % of Revenue", format: "percent", historicalFn: (h) => h.revenue > 0 ? h.smExpense / h.revenue : null, projectedFn: (p) => p.smPercent },
    { label: "G&A % of Revenue", format: "percent", historicalFn: (h) => h.revenue > 0 ? h.gaExpense / h.revenue : null, projectedFn: (p) => p.gaPercent },
    { label: "OpEx % of Revenue", format: "percent", historicalFn: (h) => h.revenue > 0 ? h.totalOpex / h.revenue : null, projectedFn: (p) => p.opexPercent },
    { label: "Operating Margin %", format: "percent", historicalFn: (h) => h.revenue > 0 ? h.operatingIncome / h.revenue : null, projectedFn: (p) => p.operatingMargin },
    { label: "EBITDA Margin %", format: "percent", historicalFn: (h) => h.revenue > 0 ? h.ebitda / h.revenue : null, projectedFn: (p) => p.ebitdaMargin },
    { label: "Net Margin %", format: "percent", historicalFn: (h) => h.revenue > 0 ? h.netIncome / h.revenue : null, projectedFn: (p) => p.netMargin },
    { label: "", separator: true, historicalFn: () => null, projectedFn: () => null },
    { label: "Cash Flow", section: true, historicalFn: () => null, projectedFn: () => null },
    { label: "CFO", historicalFn: () => null, projectedFn: (p) => p.cfOperating },
    { label: "Total CapEx", historicalFn: () => null, projectedFn: (p) => p.cfCapex + p.cfCapSoftware },
    { label: "Free Cash Flow", bold: true, historicalFn: () => null, projectedFn: (p) => p.fcf },
    { label: "FCF Margin %", format: "percent", historicalFn: () => null, projectedFn: (p) => p.fcfMargin },
    { label: "", separator: true, historicalFn: () => null, projectedFn: () => null },
    { label: "Rule of 40", bold: true, format: "percent", historicalFn: () => null, projectedFn: (p) => p.revenueGrowth + p.fcfMargin },
  ];
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function StatementTable({ type, historicals, projected }: StatementTableProps) {
  const rows = React.useMemo(() => {
    switch (type) {
      case "income_statement": return getIncomeStatementRows();
      case "balance_sheet": return getBalanceSheetRows();
      case "cash_flow": return getCashFlowRows();
      case "kpis": return getKPIRows();
    }
  }, [type]);

  const title: Record<StatementType, string> = {
    income_statement: "Income Statement",
    balance_sheet: "Balance Sheet",
    cash_flow: "Statement of Cash Flows",
    kpis: "Key Performance Indicators",
  };

  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b">
            <th className="text-left px-4 py-2.5 font-semibold text-slate-700 min-w-[240px] sticky left-0 bg-slate-50 z-10">
              {title[type]}
            </th>
            {historicals.map((h) => (
              <th key={h.year} className="text-right px-3 py-2.5 font-medium text-slate-500 min-w-[100px]">
                {h.label}
              </th>
            ))}
            {projected.map((p) => (
              <th key={p.year} className="text-right px-3 py-2.5 font-medium text-blue-600 min-w-[100px] bg-blue-50/50">
                {p.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            if (row.separator) {
              return <tr key={idx} className="h-1" />;
            }

            if (row.section) {
              return (
                <tr key={idx} className="bg-slate-50">
                  <td
                    colSpan={1 + historicals.length + projected.length}
                    className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 sticky left-0 bg-slate-50 z-10"
                  >
                    {row.label}
                  </td>
                </tr>
              );
            }

            const isPercent = row.format === "percent";
            const fmt = row.format ?? "currency";

            return (
              <tr
                key={idx}
                className={cn(
                  "border-b last:border-b-0",
                  row.bold && "bg-slate-50/60",
                )}
              >
                <td
                  className={cn(
                    "px-4 py-1.5 sticky left-0 bg-white z-10",
                    row.bold && "font-semibold bg-slate-50/60",
                    isPercent && "text-xs text-muted-foreground",
                    row.indent && `pl-${4 + row.indent * 4}`,
                  )}
                  style={row.indent ? { paddingLeft: `${1 + row.indent * 1.25}rem` } : undefined}
                >
                  {row.label}
                </td>
                {historicals.map((h) => {
                  const val = row.historicalFn(h);
                  return (
                    <td
                      key={h.year}
                      className={cn(
                        "text-right px-3 py-1.5 tabular-nums",
                        row.bold && "font-semibold",
                        isPercent && "text-xs text-muted-foreground",
                        val !== null && val < 0 && "text-red-600",
                      )}
                    >
                      {fmtVal(val, fmt)}
                    </td>
                  );
                })}
                {projected.map((p) => {
                  const val = row.projectedFn(p);
                  return (
                    <td
                      key={p.year}
                      className={cn(
                        "text-right px-3 py-1.5 tabular-nums bg-blue-50/30",
                        row.bold && "font-semibold",
                        isPercent && "text-xs text-muted-foreground",
                        val !== null && val < 0 && "text-red-600",
                      )}
                    >
                      {fmtVal(val, fmt)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
