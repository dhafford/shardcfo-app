"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download } from "lucide-react";
import type { ComparisonMode, PnlDataPoint } from "./pnl-table";
import type { AccountRow, FinancialPeriodRow } from "@/lib/supabase/types";

interface FinancialsToolbarProps {
  companyId: string;
  currentView: "pnl" | "balance_sheet" | "cash_flow";
  currentComparison: ComparisonMode;
  accounts: AccountRow[];
  periods: FinancialPeriodRow[];
  data: PnlDataPoint[];
}

function buildCSV(
  accounts: AccountRow[],
  periods: FinancialPeriodRow[],
  data: PnlDataPoint[]
): string {
  const periodIds = periods.map((p) => p.id);
  const lookup = new Map<string, Map<string, PnlDataPoint>>();
  for (const d of data) {
    if (!lookup.has(d.periodId)) lookup.set(d.periodId, new Map());
    lookup.get(d.periodId)!.set(d.accountId, d);
  }

  const header = [
    "Account Code",
    "Account Name",
    "Type",
    ...periods.map((p) => p.period_label),
  ].join(",");

  const rows = accounts
    .filter((a) => a.is_active)
    .map((acc) => {
      const values = periodIds.map((pid) => {
        const dp = lookup.get(pid)?.get(acc.id);
        return dp ? String(dp.actual) : "0";
      });
      return [
        acc.code ?? "",
        `"${acc.name.replace(/"/g, '""')}"`,
        acc.account_type,
        ...values,
      ].join(",");
    });

  return [header, ...rows].join("\n");
}

export function FinancialsToolbar({
  companyId: _companyId,
  currentView,
  currentComparison,
  accounts,
  periods,
  data,
}: FinancialsToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParam = React.useCallback(
    (key: string, value: string | null) => {
      if (!value) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set(key, value);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const handleExport = React.useCallback(() => {
    const csv = buildCSV(accounts, periods, data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `financials-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [accounts, periods, data]);

  return (
    <div className="flex items-center gap-2">
      {/* View toggle */}
      <Select
        value={currentView}
        onValueChange={(v) => updateParam("view", v)}
      >
        <SelectTrigger className="w-[150px] h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pnl">P&amp;L</SelectItem>
          <SelectItem value="balance_sheet">Balance Sheet</SelectItem>
          <SelectItem value="cash_flow">Cash Flow</SelectItem>
        </SelectContent>
      </Select>

      {/* Comparison toggle */}
      <Select
        value={currentComparison}
        onValueChange={(v) => updateParam("comparison", v)}
      >
        <SelectTrigger className="w-[160px] h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No comparison</SelectItem>
          <SelectItem value="budget">vs. Budget</SelectItem>
          <SelectItem value="prior_year">vs. Prior Year</SelectItem>
        </SelectContent>
      </Select>

      {/* Export */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleExport}
        className="h-8"
      >
        <Download className="w-3.5 h-3.5 mr-1.5" />
        Export CSV
      </Button>
    </div>
  );
}
