"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { AccountRow, LineItemRow, FinancialPeriodRow } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PnlDataPoint {
  periodId: string;
  accountId: string;
  actual: number;
  budget: number | null;
  priorYear: number | null;
}

export type ComparisonMode = "none" | "budget" | "prior_year";

interface PnlTableProps {
  accounts: AccountRow[];
  periods: FinancialPeriodRow[];
  data: PnlDataPoint[];
  comparisonMode: ComparisonMode;
  className?: string;
}

// ---------------------------------------------------------------------------
// Section definitions — drives row grouping and order
// ---------------------------------------------------------------------------

type SectionKey =
  | "revenue"
  | "cogs"
  | "gross_profit"
  | "sales_marketing"
  | "research_development"
  | "general_administrative"
  | "total_opex"
  | "ebitda"
  | "other"
  | "net_income";

interface Section {
  key: SectionKey;
  label: string;
  accountTypes: string[];
  isSubtotal: boolean;
  indent: number;
}

const SECTIONS: Section[] = [
  { key: "revenue", label: "Revenue", accountTypes: ["revenue"], isSubtotal: false, indent: 0 },
  { key: "cogs", label: "Cost of Revenue", accountTypes: ["cogs"], isSubtotal: false, indent: 0 },
  { key: "gross_profit", label: "Gross Profit", accountTypes: [], isSubtotal: true, indent: 0 },
  { key: "sales_marketing", label: "Sales & Marketing", accountTypes: ["opex"], isSubtotal: false, indent: 1 },
  { key: "research_development", label: "Research & Development", accountTypes: ["opex"], isSubtotal: false, indent: 1 },
  { key: "general_administrative", label: "General & Administrative", accountTypes: ["opex"], isSubtotal: false, indent: 1 },
  { key: "total_opex", label: "Total OpEx", accountTypes: [], isSubtotal: true, indent: 0 },
  { key: "ebitda", label: "EBITDA", accountTypes: [], isSubtotal: true, indent: 0 },
  { key: "other", label: "Other Income / Expense", accountTypes: ["other"], isSubtotal: false, indent: 0 },
  { key: "net_income", label: "Net Income", accountTypes: [], isSubtotal: true, indent: 0 },
];

// Map account_category to section key
const CATEGORY_TO_SECTION: Record<string, SectionKey> = {
  arr: "revenue",
  mrr: "revenue",
  services: "revenue",
  gross_profit: "gross_profit",
  sales_marketing: "sales_marketing",
  research_development: "research_development",
  general_administrative: "general_administrative",
  ebitda: "ebitda",
  cash: "other",
  accounts_receivable: "other",
  other: "other",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAmount(n: number, compact = false): string {
  const abs = Math.abs(n);
  if (compact) {
    if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function variancePct(actual: number, comparison: number): number | null {
  if (comparison === 0) return null;
  return ((actual - comparison) / Math.abs(comparison)) * 100;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PnlTable({
  accounts,
  periods,
  data,
  comparisonMode,
  className,
}: PnlTableProps) {
  const [expandedSections, setExpandedSections] = React.useState<Set<SectionKey>>(
    new Set(["revenue", "cogs", "sales_marketing", "research_development", "general_administrative", "other"])
  );

  const toggleSection = React.useCallback((key: SectionKey) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Build lookup: periodId -> accountId -> data point
  const lookup = React.useMemo(() => {
    const map = new Map<string, Map<string, PnlDataPoint>>();
    for (const d of data) {
      if (!map.has(d.periodId)) map.set(d.periodId, new Map());
      map.get(d.periodId)!.set(d.accountId, d);
    }
    return map;
  }, [data]);

  // Group accounts by section
  const accountsBySection = React.useMemo(() => {
    const grouped = new Map<SectionKey, AccountRow[]>();
    for (const acc of accounts) {
      if (!acc.is_active) continue;
      let sectionKey: SectionKey | null = null;
      if (acc.category && CATEGORY_TO_SECTION[acc.category]) {
        sectionKey = CATEGORY_TO_SECTION[acc.category];
      } else if (acc.account_type === "revenue") {
        sectionKey = "revenue";
      } else if (acc.account_type === "cogs") {
        sectionKey = "cogs";
      } else if (acc.account_type === "opex") {
        sectionKey = "general_administrative";
      } else if (acc.account_type === "other") {
        sectionKey = "other";
      }
      if (sectionKey) {
        if (!grouped.has(sectionKey)) grouped.set(sectionKey, []);
        grouped.get(sectionKey)!.push(acc);
      }
    }
    return grouped;
  }, [accounts]);

  // Compute section totals per period
  const sectionTotals = React.useMemo(() => {
    const totals = new Map<string, Map<SectionKey, { actual: number; budget: number; priorYear: number }>>();

    for (const period of periods) {
      const ptotals = new Map<SectionKey, { actual: number; budget: number; priorYear: number }>();

      const initSection = (key: SectionKey) =>
        ptotals.set(key, { actual: 0, budget: 0, priorYear: 0 });

      SECTIONS.filter((s) => !s.isSubtotal).forEach((s) => initSection(s.key));

      for (const [sectionKey, accs] of accountsBySection.entries()) {
        const sectionTotal = ptotals.get(sectionKey) ?? { actual: 0, budget: 0, priorYear: 0 };
        for (const acc of accs) {
          const dp = lookup.get(period.id)?.get(acc.id);
          if (dp) {
            sectionTotal.actual += dp.actual;
            sectionTotal.budget += dp.budget ?? 0;
            sectionTotal.priorYear += dp.priorYear ?? 0;
          }
        }
        ptotals.set(sectionKey, sectionTotal);
      }

      // Subtotals
      const rev = ptotals.get("revenue") ?? { actual: 0, budget: 0, priorYear: 0 };
      const cogs = ptotals.get("cogs") ?? { actual: 0, budget: 0, priorYear: 0 };
      const sm = ptotals.get("sales_marketing") ?? { actual: 0, budget: 0, priorYear: 0 };
      const rd = ptotals.get("research_development") ?? { actual: 0, budget: 0, priorYear: 0 };
      const ga = ptotals.get("general_administrative") ?? { actual: 0, budget: 0, priorYear: 0 };
      const other = ptotals.get("other") ?? { actual: 0, budget: 0, priorYear: 0 };

      const grossProfit = {
        actual: rev.actual - cogs.actual,
        budget: rev.budget - cogs.budget,
        priorYear: rev.priorYear - cogs.priorYear,
      };
      const totalOpex = {
        actual: sm.actual + rd.actual + ga.actual,
        budget: sm.budget + rd.budget + ga.budget,
        priorYear: sm.priorYear + rd.priorYear + ga.priorYear,
      };
      const ebitda = {
        actual: grossProfit.actual - totalOpex.actual,
        budget: grossProfit.budget - totalOpex.budget,
        priorYear: grossProfit.priorYear - totalOpex.priorYear,
      };
      const netIncome = {
        actual: ebitda.actual + other.actual,
        budget: ebitda.budget + other.budget,
        priorYear: ebitda.priorYear + other.priorYear,
      };

      ptotals.set("gross_profit", grossProfit);
      ptotals.set("total_opex", totalOpex);
      ptotals.set("ebitda", ebitda);
      ptotals.set("net_income", netIncome);

      totals.set(period.id, ptotals);
    }

    return totals;
  }, [periods, accountsBySection, lookup]);

  const showComparison = comparisonMode !== "none";
  const compLabel = comparisonMode === "budget" ? "Bgt" : "PY";

  if (periods.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No periods available for the selected range.
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto rounded-md border bg-white", className)}>
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="w-56 sticky left-0 bg-slate-50 z-10 text-xs uppercase tracking-wider">
              Account
            </TableHead>
            {periods.map((period) => (
              <React.Fragment key={period.id}>
                <TableHead className="text-right text-xs uppercase tracking-wider min-w-[90px]">
                  {period.period_label}
                </TableHead>
                {showComparison && (
                  <>
                    <TableHead className="text-right text-xs text-muted-foreground min-w-[80px]">
                      {compLabel}
                    </TableHead>
                    <TableHead className="text-right text-xs text-muted-foreground min-w-[70px]">
                      Var%
                    </TableHead>
                  </>
                )}
              </React.Fragment>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {SECTIONS.map((section) => {
            const sectionAccounts = accountsBySection.get(section.key) ?? [];
            const isExpanded = expandedSections.has(section.key);
            const isExpandable = !section.isSubtotal && sectionAccounts.length > 0;

            return (
              <React.Fragment key={section.key}>
                {/* Section header row */}
                <TableRow
                  className={cn(
                    section.isSubtotal
                      ? "bg-slate-100 font-semibold border-t-2 border-slate-300"
                      : "bg-slate-50 font-medium cursor-pointer hover:bg-slate-100",
                    "group"
                  )}
                  onClick={isExpandable ? () => toggleSection(section.key) : undefined}
                >
                  <TableCell
                    className={cn(
                      "sticky left-0 z-10 text-sm",
                      section.isSubtotal ? "bg-slate-100" : "bg-slate-50 group-hover:bg-slate-100",
                      section.indent > 0 && "pl-6"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      {isExpandable && (
                        <span className="text-muted-foreground w-4 shrink-0">
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </span>
                      )}
                      {!isExpandable && <span className="w-4 shrink-0" />}
                      {section.label}
                    </div>
                  </TableCell>

                  {periods.map((period) => {
                    const t = sectionTotals.get(period.id)?.get(section.key);
                    const actual = t?.actual ?? 0;
                    const comparison =
                      comparisonMode === "budget"
                        ? (t?.budget ?? 0)
                        : comparisonMode === "prior_year"
                        ? (t?.priorYear ?? 0)
                        : 0;
                    const varPct = showComparison ? variancePct(actual, comparison) : null;

                    // Determine if negative is "bad" — depends on line type
                    const isSubtotalPositiveGood = ["gross_profit", "ebitda", "net_income"].includes(section.key);
                    const actualIsNegative = actual < 0;
                    const shouldHighlightRed = isSubtotalPositiveGood && actualIsNegative;
                    const shouldHighlightYellow =
                      isSubtotalPositiveGood &&
                      varPct !== null &&
                      varPct < -10;

                    return (
                      <React.Fragment key={period.id}>
                        <TableCell
                          className={cn(
                            "text-right font-mono tabular-nums text-sm font-medium",
                            shouldHighlightRed && "text-red-600",
                            shouldHighlightYellow && !shouldHighlightRed && "text-amber-600"
                          )}
                        >
                          {formatAmount(actual)}
                        </TableCell>
                        {showComparison && (
                          <>
                            <TableCell className="text-right font-mono tabular-nums text-sm text-muted-foreground">
                              {formatAmount(comparison)}
                            </TableCell>
                            <TableCell
                              className={cn(
                                "text-right font-mono tabular-nums text-xs",
                                varPct === null
                                  ? "text-muted-foreground"
                                  : varPct >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              )}
                            >
                              {varPct !== null ? formatPct(varPct) : "—"}
                            </TableCell>
                          </>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableRow>

                {/* Account detail rows */}
                {!section.isSubtotal && isExpanded && sectionAccounts.map((acc) => (
                  <TableRow key={acc.id} className="hover:bg-slate-50/80">
                    <TableCell className="sticky left-0 bg-white z-10 pl-10 text-sm text-muted-foreground">
                      <span className="truncate max-w-[180px] block">
                        {acc.code ? `${acc.code} · ` : ""}{acc.name}
                      </span>
                    </TableCell>

                    {periods.map((period) => {
                      const dp = lookup.get(period.id)?.get(acc.id);
                      const actual = dp?.actual ?? 0;
                      const comparison =
                        comparisonMode === "budget"
                          ? (dp?.budget ?? 0)
                          : comparisonMode === "prior_year"
                          ? (dp?.priorYear ?? 0)
                          : 0;
                      const varPct = showComparison ? variancePct(actual, comparison) : null;

                      return (
                        <React.Fragment key={period.id}>
                          <TableCell
                            className={cn(
                              "text-right font-mono tabular-nums text-sm",
                              actual < 0 && "text-red-600"
                            )}
                          >
                            {actual !== 0 ? formatAmount(actual) : "—"}
                          </TableCell>
                          {showComparison && (
                            <>
                              <TableCell className="text-right font-mono tabular-nums text-sm text-muted-foreground">
                                {comparison !== 0 ? formatAmount(comparison) : "—"}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  "text-right font-mono tabular-nums text-xs",
                                  varPct === null
                                    ? "text-muted-foreground"
                                    : varPct >= 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                )}
                              >
                                {varPct !== null ? formatPct(varPct) : "—"}
                              </TableCell>
                            </>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableRow>
                ))}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
