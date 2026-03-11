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
import { Badge } from "@/components/ui/badge";
import type { AccountRow, FinancialPeriodRow } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BudgetVarianceRow {
  accountId: string;
  periodId: string;
  actual: number;
  budget: number;
  ytdActual: number;
  ytdBudget: number;
}

interface BudgetVarianceTableProps {
  accounts: AccountRow[];
  period: FinancialPeriodRow;
  rows: BudgetVarianceRow[];
  /** Variance threshold (absolute %) above which rows are highlighted. Default: 10 */
  varianceThreshold?: number;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function calcVariance(actual: number, budget: number): { dollar: number; pct: number | null } {
  const dollar = actual - budget;
  const pct = budget !== 0 ? (dollar / Math.abs(budget)) * 100 : null;
  return { dollar, pct };
}

/**
 * Determines whether a variance is "favorable" (green) or "unfavorable" (red).
 * Revenue lines: over-actual is favorable. Expense lines: under-actual is favorable.
 */
function isFavorable(actual: number, budget: number, accountType: string): boolean {
  const isExpense = ["cogs", "operating_expense"].includes(accountType);
  if (isExpense) {
    return actual <= budget; // spending less than budget = favorable
  }
  return actual >= budget; // earning more than budget = favorable
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BudgetVarianceTable({
  accounts,
  period,
  rows,
  varianceThreshold = 10,
  className,
}: BudgetVarianceTableProps) {
  // Build lookup by accountId
  const rowsByAccountId = React.useMemo(() => {
    const map = new Map<string, BudgetVarianceRow>();
    for (const row of rows) {
      if (row.periodId === period.id) {
        map.set(row.accountId, row);
      }
    }
    return map;
  }, [rows, period.id]);

  const activeAccounts = accounts.filter((a) => a.is_active);

  if (activeAccounts.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        No accounts found.
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto rounded-md border bg-white", className)}>
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="w-14 sticky left-0 bg-slate-50 z-10 text-xs uppercase tracking-wider">
              Code
            </TableHead>
            <TableHead className="w-48 sticky left-14 bg-slate-50 z-10 text-xs uppercase tracking-wider">
              Account
            </TableHead>
            <TableHead className="text-right text-xs uppercase tracking-wider min-w-[90px]">
              Actual
            </TableHead>
            <TableHead className="text-right text-xs uppercase tracking-wider min-w-[90px]">
              Budget
            </TableHead>
            <TableHead className="text-right text-xs uppercase tracking-wider min-w-[90px]">
              Variance ($)
            </TableHead>
            <TableHead className="text-right text-xs uppercase tracking-wider min-w-[80px]">
              Variance (%)
            </TableHead>
            <TableHead className="text-right text-xs uppercase tracking-wider min-w-[90px]">
              YTD Actual
            </TableHead>
            <TableHead className="text-right text-xs uppercase tracking-wider min-w-[90px]">
              YTD Budget
            </TableHead>
            <TableHead className="text-right text-xs uppercase tracking-wider min-w-[90px]">
              YTD Var
            </TableHead>
            <TableHead className="text-xs uppercase tracking-wider min-w-[80px]">
              Status
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {activeAccounts.map((account) => {
            const row = rowsByAccountId.get(account.id);
            const actual = row?.actual ?? 0;
            const budget = row?.budget ?? 0;
            const ytdActual = row?.ytdActual ?? 0;
            const ytdBudget = row?.ytdBudget ?? 0;

            const { dollar: varDollar, pct: varPct } = calcVariance(actual, budget);
            const { dollar: ytdVarDollar, pct: ytdVarPct } = calcVariance(ytdActual, ytdBudget);

            const favorable = isFavorable(actual, budget, account.category);
            const absPct = varPct !== null ? Math.abs(varPct) : 0;
            const isThresholdBreached = absPct > varianceThreshold;

            const rowBg = isThresholdBreached
              ? favorable
                ? "bg-green-50/60"
                : "bg-red-50/60"
              : "";

            return (
              <TableRow key={account.id} className={cn("hover:bg-slate-50/80", rowBg)}>
                <TableCell className="sticky left-0 bg-inherit z-10 font-mono text-xs text-muted-foreground">
                  {account.account_number}
                </TableCell>
                <TableCell className="sticky left-14 bg-inherit z-10 text-sm font-medium max-w-[180px] truncate">
                  {account.name}
                </TableCell>

                {/* Actual */}
                <TableCell
                  className={cn(
                    "text-right font-mono tabular-nums text-sm",
                    actual < 0 && "text-red-600"
                  )}
                >
                  {formatCurrency(actual)}
                </TableCell>

                {/* Budget */}
                <TableCell className="text-right font-mono tabular-nums text-sm text-muted-foreground">
                  {formatCurrency(budget)}
                </TableCell>

                {/* Variance $ */}
                <TableCell
                  className={cn(
                    "text-right font-mono tabular-nums text-sm font-medium",
                    varDollar === 0
                      ? "text-muted-foreground"
                      : favorable
                      ? "text-green-700"
                      : "text-red-600"
                  )}
                >
                  {varDollar >= 0 ? "+" : ""}{formatCurrency(varDollar)}
                </TableCell>

                {/* Variance % */}
                <TableCell
                  className={cn(
                    "text-right font-mono tabular-nums text-sm font-medium",
                    varPct === null
                      ? "text-muted-foreground"
                      : favorable
                      ? "text-green-700"
                      : "text-red-600"
                  )}
                >
                  {varPct !== null
                    ? `${varPct >= 0 ? "+" : ""}${varPct.toFixed(1)}%`
                    : "—"}
                </TableCell>

                {/* YTD Actual */}
                <TableCell
                  className={cn(
                    "text-right font-mono tabular-nums text-sm",
                    ytdActual < 0 && "text-red-600"
                  )}
                >
                  {formatCurrency(ytdActual)}
                </TableCell>

                {/* YTD Budget */}
                <TableCell className="text-right font-mono tabular-nums text-sm text-muted-foreground">
                  {formatCurrency(ytdBudget)}
                </TableCell>

                {/* YTD Variance */}
                <TableCell
                  className={cn(
                    "text-right font-mono tabular-nums text-sm",
                    ytdVarPct === null
                      ? "text-muted-foreground"
                      : isFavorable(ytdActual, ytdBudget, account.category)
                      ? "text-green-700"
                      : "text-red-600"
                  )}
                >
                  {ytdVarPct !== null
                    ? `${ytdVarPct >= 0 ? "+" : ""}${ytdVarPct.toFixed(1)}%`
                    : `${ytdVarDollar >= 0 ? "+" : ""}${formatCurrency(ytdVarDollar)}`}
                </TableCell>

                {/* Status badge */}
                <TableCell>
                  {!isThresholdBreached ? (
                    <Badge variant="secondary" className="text-xs">On track</Badge>
                  ) : favorable ? (
                    <Badge className="text-xs bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
                      Favorable
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">
                      Over budget
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
