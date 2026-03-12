"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  GripVertical,
} from "lucide-react";
import {
  STATEMENT_SECTIONS,
  LINE_ITEM_SECTIONS,
  CATEGORY_TO_SECTION,
  type OrganizedStatement,
  type ReviewLineItem,
  type StatementSection,
} from "@/lib/import/industry-templates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImportTemplateReviewProps {
  organized: OrganizedStatement;
  onApprove: (lineItems: ReviewLineItem[]) => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Currency formatter
// ---------------------------------------------------------------------------

const fmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatAmount(n: number): string {
  if (n < 0) return `(${fmt.format(Math.abs(n))})`;
  return fmt.format(n);
}

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return "—";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Section component
// ---------------------------------------------------------------------------

function SectionBlock({
  section,
  items,
  onReassign,
  onRemove,
}: {
  section: StatementSection;
  items: ReviewLineItem[];
  onReassign: (itemKey: string, newSectionId: string) => void;
  onRemove: (itemKey: string) => void;
}) {
  const total = items.reduce((sum, item) => sum + item.totalAmount, 0);

  return (
    <div className="border-b last:border-b-0">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {section.label}
        </span>
        <span className="text-sm font-semibold tabular-nums">
          {formatAmount(total)}
        </span>
      </div>

      {/* Line items */}
      {items.length === 0 ? (
        <div className="px-4 py-2 text-xs text-muted-foreground italic">
          No items mapped to this section
        </div>
      ) : (
        items.map((item) => (
          <div
            key={item.key}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 text-sm hover:bg-slate-50/50 group",
              item.confidence === "low" && "bg-amber-50/40"
            )}
          >
            <GripVertical className="w-3.5 h-3.5 text-slate-300 shrink-0" />

            {/* Confidence indicator */}
            {item.confidence === "low" && (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            )}
            {item.confidence === "medium" && (
              <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              </span>
            )}
            {item.confidence === "high" && (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
            )}

            {/* Account name */}
            <span className="flex-1 truncate">{item.accountName}</span>

            {/* Reassign dropdown */}
            <Select
              value={item.sectionId}
              onValueChange={(val) => val && onReassign(item.key, val)}
            >
              <SelectTrigger className="h-6 w-[140px] text-xs opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINE_ITEM_SECTIONS.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Amount */}
            <span className="w-28 text-right tabular-nums font-medium shrink-0">
              {formatAmount(item.totalAmount)}
            </span>

            {/* Remove button */}
            <button
              onClick={() => onRemove(item.key)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-slate-400 hover:text-red-500"
              title="Remove from import"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calculated row (Gross Profit, EBITDA, Net Income)
// ---------------------------------------------------------------------------

function CalculatedRow({
  label,
  amount,
  revenueTotal,
  bold,
}: {
  label: string;
  amount: number;
  revenueTotal: number;
  bold?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-2 border-b last:border-b-0",
        bold ? "bg-slate-100 border-t-2 border-t-slate-300" : "bg-slate-50/60"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "text-sm uppercase tracking-wider",
            bold ? "font-bold text-slate-800" : "font-semibold text-slate-600"
          )}
        >
          {label}
        </span>
        {revenueTotal > 0 && (
          <Badge variant="outline" className="text-[10px] font-normal">
            {pct(amount, revenueTotal)} margin
          </Badge>
        )}
      </div>
      <span
        className={cn(
          "tabular-nums text-sm",
          bold ? "font-bold" : "font-semibold",
          amount < 0 ? "text-red-600" : "text-slate-800"
        )}
      >
        {formatAmount(amount)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ImportTemplateReview({
  organized,
  onApprove,
  onBack,
}: ImportTemplateReviewProps) {
  // Mutable copy of line items for user edits
  const [items, setItems] = React.useState<ReviewLineItem[]>(() => [
    ...organized.lineItems,
    ...organized.uncategorized,
  ]);
  const [removedKeys, setRemovedKeys] = React.useState<Set<string>>(new Set());

  const activeItems = items.filter((item) => !removedKeys.has(item.key));

  // Group by section
  const bySection = React.useMemo(() => {
    const map = new Map<string, ReviewLineItem[]>();
    for (const s of STATEMENT_SECTIONS) {
      if (!s.calculated) map.set(s.id, []);
    }
    map.set("uncategorized", []);

    for (const item of activeItems) {
      const bucket = item.sectionId && map.has(item.sectionId) ? item.sectionId : "uncategorized";
      map.get(bucket)!.push(item);
    }
    return map;
  }, [activeItems]);

  // Calculate totals
  const sectionTotal = (sectionId: string) =>
    (bySection.get(sectionId) || []).reduce((s, i) => s + i.totalAmount, 0);

  const revenueTotal = sectionTotal("revenue");
  const cogsTotal = sectionTotal("cogs");
  const grossProfit = revenueTotal - Math.abs(cogsTotal);
  const opexTotal = sectionTotal("operating_expense");
  const ebitda = grossProfit - Math.abs(opexTotal);
  const otherIncomeTotal = sectionTotal("other_income");
  const otherExpenseTotal = sectionTotal("other_expense");
  const netIncome = ebitda + otherIncomeTotal - Math.abs(otherExpenseTotal);

  const uncategorized = bySection.get("uncategorized") || [];

  // Handlers
  function handleReassign(itemKey: string, newSectionId: string) {
    const section = LINE_ITEM_SECTIONS.find((s) => s.id === newSectionId);
    if (!section) return;
    const newCategory = section.accountCategories[0] || "";

    setItems((prev) =>
      prev.map((item) =>
        item.key === itemKey
          ? { ...item, sectionId: newSectionId, category: newCategory, confidence: "high" }
          : item
      )
    );
  }

  function handleRemove(itemKey: string) {
    setRemovedKeys((prev) => new Set(prev).add(itemKey));
  }

  function handleApprove() {
    onApprove(activeItems);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Template Review</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review your data organized as a{" "}
            <span className="font-medium text-foreground">{organized.template.label}</span>{" "}
            income statement. Reassign items between sections as needed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {activeItems.length} line items
          </Badge>
          {organized.periods.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {organized.periods.length} period{organized.periods.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>

      {/* Confidence legend */}
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-green-500" /> High confidence
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" /> Inferred
        </span>
        <span className="flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-amber-500" /> Needs review
        </span>
      </div>

      {/* Financial statement */}
      <div className="rounded-lg border bg-white overflow-hidden">
        {STATEMENT_SECTIONS.map((section) => {
          if (section.calculated) {
            // Render calculated rows
            const value =
              section.id === "gross_profit"
                ? grossProfit
                : section.id === "ebitda"
                ? ebitda
                : netIncome;

            return (
              <CalculatedRow
                key={section.id}
                label={section.label}
                amount={value}
                revenueTotal={revenueTotal}
                bold={section.id === "net_income"}
              />
            );
          }

          return (
            <SectionBlock
              key={section.id}
              section={section}
              items={bySection.get(section.id) || []}
              onReassign={handleReassign}
              onRemove={handleRemove}
            />
          );
        })}

        {/* Uncategorized items */}
        {uncategorized.length > 0 && (
          <div className="border-t-2 border-amber-300">
            <div className="flex items-center justify-between px-4 py-2 bg-amber-50">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                  Uncategorized ({uncategorized.length})
                </span>
              </div>
              <span className="text-xs text-amber-600">
                Assign these items to a section before importing
              </span>
            </div>
            {uncategorized.map((item) => (
              <div
                key={item.key}
                className="flex items-center gap-2 px-4 py-1.5 text-sm bg-amber-50/60 hover:bg-amber-50 group"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="flex-1 truncate">{item.accountName}</span>

                <Select
                  value={item.sectionId || "uncategorized"}
                  onValueChange={(val) => val && handleReassign(item.key, val)}
                >
                  <SelectTrigger className="h-6 w-[140px] text-xs border-amber-300">
                    <SelectValue placeholder="Assign section..." />
                  </SelectTrigger>
                  <SelectContent>
                    {LINE_ITEM_SECTIONS.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <span className="w-28 text-right tabular-nums font-medium shrink-0">
                  {formatAmount(item.totalAmount)}
                </span>

                <button
                  onClick={() => handleRemove(item.key)}
                  className="p-0.5 text-slate-400 hover:text-red-500"
                  title="Remove from import"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Removed items indicator */}
      {removedKeys.size > 0 && (
        <p className="text-xs text-muted-foreground">
          {removedKeys.size} item{removedKeys.size > 1 ? "s" : ""} removed from import.{" "}
          <button
            className="text-blue-600 hover:underline"
            onClick={() => setRemovedKeys(new Set())}
          >
            Restore all
          </button>
        </p>
      )}

      {/* Actions */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          Back to Mapping
        </Button>
        <Button
          onClick={handleApprove}
          disabled={uncategorized.length > 0}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {uncategorized.length > 0
            ? `Categorize ${uncategorized.length} item${uncategorized.length > 1 ? "s" : ""} to continue`
            : "Approve & Continue to Import"}
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
