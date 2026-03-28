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
import { AlertTriangle } from "lucide-react";
import type { ComputedCashFlow, CashFlowSection } from "@/lib/computations/cash-flow-engine";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAmount(n: number): string {
  if (Math.abs(n) < 0.5) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatPeriodLabel(dateStr: string): string {
  const [y, m] = dateStr.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

// ---------------------------------------------------------------------------
// Section renderer
// ---------------------------------------------------------------------------

function SectionBlock({
  section,
  periods,
}: {
  section: CashFlowSection;
  periods: string[];
}) {
  return (
    <>
      {/* Section header */}
      <TableRow className="bg-slate-50/80 border-t-2 border-slate-200">
        <TableCell
          colSpan={periods.length + 1}
          className="text-sm font-semibold text-slate-700 py-1.5"
        >
          {section.name}
        </TableCell>
      </TableRow>

      {/* Line items */}
      {section.lines.map((line, idx) => (
        <TableRow key={idx}>
          <TableCell
            className={cn(
              "text-sm",
              line.bold && "font-semibold",
            )}
            style={{ paddingLeft: `${line.indent * 16 + 8}px` }}
          >
            {line.label}
          </TableCell>
          {periods.map((pd) => {
            const val = line.amounts[pd] ?? 0;
            return (
              <TableCell
                key={pd}
                className={cn(
                  "text-sm text-right tabular-nums",
                  line.bold && "font-semibold",
                  val < -0.5 && "text-red-600",
                )}
              >
                {formatAmount(val)}
              </TableCell>
            );
          })}
        </TableRow>
      ))}

      {/* Section total */}
      <TableRow className="bg-slate-100 border-t border-slate-200">
        <TableCell className="text-sm font-semibold text-slate-700 py-1.5">
          {section.totalLabel}
        </TableCell>
        {periods.map((pd) => {
          const val = section.totalAmounts[pd] ?? 0;
          return (
            <TableCell
              key={pd}
              className={cn(
                "text-sm text-right tabular-nums font-semibold py-1.5",
                val < -0.5 && "text-red-600",
              )}
            >
              {formatAmount(val)}
            </TableCell>
          );
        })}
      </TableRow>
    </>
  );
}

// ---------------------------------------------------------------------------
// Summary row helper
// ---------------------------------------------------------------------------

function SummaryRow({
  label,
  amounts,
  periods,
  bold = false,
  doubleUnderline = false,
}: {
  label: string;
  amounts: Record<string, number>;
  periods: string[];
  bold?: boolean;
  doubleUnderline?: boolean;
}) {
  return (
    <TableRow className={cn(bold && "bg-slate-50/50")}>
      <TableCell
        className={cn(
          "text-sm py-1.5",
          bold && "font-semibold text-slate-700",
          doubleUnderline && "border-b-4 border-double border-slate-300",
        )}
      >
        {label}
      </TableCell>
      {periods.map((pd) => {
        const val = amounts[pd] ?? 0;
        return (
          <TableCell
            key={pd}
            className={cn(
              "text-sm text-right tabular-nums py-1.5",
              bold && "font-semibold",
              doubleUnderline && "border-b-4 border-double border-slate-300",
              val < -0.5 && "text-red-600",
            )}
          >
            {formatAmount(val)}
          </TableCell>
        );
      })}
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface CashFlowTableProps {
  cashFlow: ComputedCashFlow;
  className?: string;
}

export function CashFlowTable({ cashFlow, className }: CashFlowTableProps) {
  const { periods, operating, investing, financing, netCashChange, beginningCash, endingCash, fcf, warnings } = cashFlow;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
            <AlertTriangle className="w-4 h-4" />
            Cash flow reconciliation warnings
          </div>
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-600 pl-6">{w}</p>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-auto max-h-[600px]">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_theme(colors.slate.200)]">
            <TableRow>
              <TableHead className="text-xs font-semibold min-w-[260px]">
                Statement of Cash Flows
              </TableHead>
              {periods.map((pd) => (
                <TableHead key={pd} className="text-xs font-semibold text-right min-w-[100px]">
                  {formatPeriodLabel(pd)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <SectionBlock section={operating} periods={periods} />

            {/* Blank separator */}
            <TableRow><TableCell colSpan={periods.length + 1} className="h-2 p-0" /></TableRow>

            <SectionBlock section={investing} periods={periods} />

            <TableRow><TableCell colSpan={periods.length + 1} className="h-2 p-0" /></TableRow>

            <SectionBlock section={financing} periods={periods} />

            <TableRow><TableCell colSpan={periods.length + 1} className="h-2 p-0" /></TableRow>

            {/* Net Cash Change */}
            <SummaryRow label="Net Cash Change" amounts={netCashChange} periods={periods} bold />

            {/* Beginning / Ending Cash */}
            <SummaryRow label="Beginning Cash" amounts={beginningCash} periods={periods} />
            <SummaryRow label="Ending Cash" amounts={endingCash} periods={periods} bold doubleUnderline />

            <TableRow><TableCell colSpan={periods.length + 1} className="h-2 p-0" /></TableRow>

            {/* Free Cash Flow */}
            <SummaryRow label="Free Cash Flow" amounts={fcf} periods={periods} bold />
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
