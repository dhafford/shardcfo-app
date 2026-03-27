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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  STATEMENT_SECTIONS,
  LINE_ITEM_SECTIONS,
  IS_SECTIONS,
  BS_SECTIONS,
  CF_SECTIONS,
  getSectionsForType,
  getLineItemSectionsForType,
  type OrganizedStatement,
  type ReviewLineItem,
  type StatementSection,
} from "@/lib/import/industry-templates";
import { type StatementType, STATEMENT_TYPE_LABELS } from "@/lib/import/statement-detection";

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
  reassignOptions,
  showSourceSheet,
}: {
  section: StatementSection;
  items: ReviewLineItem[];
  onReassign: (itemKey: string, newSectionId: string) => void;
  onRemove: (itemKey: string) => void;
  reassignOptions?: StatementSection[];
  showSourceSheet?: boolean;
}) {
  const sectionOptions = reassignOptions || LINE_ITEM_SECTIONS;
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

            {/* Source sheet badge */}
            {showSourceSheet && item.sourceSheet && (
              <Badge variant="outline" className="text-[10px] py-0 px-1 shrink-0">
                {item.sourceSheet}
              </Badge>
            )}

            {/* Reassign dropdown */}
            <Select
              value={item.sectionId}
              onValueChange={(val) => val && onReassign(item.key, val)}
            >
              <SelectTrigger className="h-6 w-[140px] text-xs opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sectionOptions.map((s) => (
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

// ---------------------------------------------------------------------------
// Statement-specific calculated rows
// ---------------------------------------------------------------------------

function ISCalculatedRows({
  bySection,
  revenueTotal,
}: {
  bySection: Map<string, ReviewLineItem[]>;
  revenueTotal: number;
}) {
  const sectionTotal = (id: string) =>
    (bySection.get(id) || []).reduce((s, i) => s + i.totalAmount, 0);

  const cogsTotal = sectionTotal("cogs");
  const grossProfit = revenueTotal - Math.abs(cogsTotal);
  const rdTotal = sectionTotal("rd");
  const smTotal = sectionTotal("sm");
  const gaTotal = sectionTotal("ga");
  const totalOpex = Math.abs(rdTotal) + Math.abs(smTotal) + Math.abs(gaTotal);
  const ebitda = grossProfit - totalOpex;
  const otherTotal = sectionTotal("other_income_expense");
  const netIncome = ebitda + otherTotal;

  return { grossProfit, ebitda, netIncome };
}

function BSCalculatedValues(bySection: Map<string, ReviewLineItem[]>) {
  const sectionTotal = (id: string) =>
    (bySection.get(id) || []).reduce((s, i) => s + i.totalAmount, 0);

  const currentAssets = sectionTotal("current_assets");
  const nonCurrentAssets = sectionTotal("non_current_assets");
  const totalAssets = currentAssets + nonCurrentAssets;
  const currentLiabilities = sectionTotal("current_liabilities");
  const longTermLiabilities = sectionTotal("long_term_liabilities");
  const totalLiabilities = currentLiabilities + longTermLiabilities;
  const equity = sectionTotal("stockholders_equity");
  const totalLiabilitiesEquity = totalLiabilities + equity;
  const isBalanced = Math.abs(totalAssets - totalLiabilitiesEquity) < 0.01;

  return { totalAssets, totalLiabilities, totalLiabilitiesEquity, isBalanced };
}

function CFCalculatedValues(bySection: Map<string, ReviewLineItem[]>) {
  const sectionTotal = (id: string) =>
    (bySection.get(id) || []).reduce((s, i) => s + i.totalAmount, 0);

  const cfo = sectionTotal("cfo");
  const cfi = sectionTotal("cfi");
  const cff = sectionTotal("cff");
  const netChangeCash = cfo + cfi + cff;

  return { netChangeCash };
}

// ---------------------------------------------------------------------------
// Statement panel — renders one statement type's sections
// ---------------------------------------------------------------------------

function StatementPanel({
  statementType,
  items,
  removedKeys,
  onReassign,
  onRemove,
  showSourceSheet,
}: {
  statementType: StatementType;
  items: ReviewLineItem[];
  removedKeys: Set<string>;
  onReassign: (key: string, sectionId: string) => void;
  onRemove: (key: string) => void;
  showSourceSheet: boolean;
}) {
  const activeItems = items.filter((i) => !removedKeys.has(i.key));
  const sections = getSectionsForType(statementType);
  const lineItemSections = getLineItemSectionsForType(statementType);

  const bySection = React.useMemo(() => {
    const map = new Map<string, ReviewLineItem[]>();
    for (const s of sections) {
      if (!s.calculated) map.set(s.id, []);
    }
    map.set("uncategorized", []);

    for (const item of activeItems) {
      const bucket = item.sectionId && map.has(item.sectionId) ? item.sectionId : "uncategorized";
      map.get(bucket)!.push(item);
    }
    return map;
  }, [activeItems, sections]);

  const sectionTotal = (id: string) =>
    (bySection.get(id) || []).reduce((s, i) => s + i.totalAmount, 0);

  const uncategorized = bySection.get("uncategorized") || [];

  // Calculate values for calculated rows
  const getCalculatedValue = (sectionId: string): number => {
    if (statementType === "income_statement") {
      const revenueTotal = sectionTotal("revenue");
      const { grossProfit, ebitda, netIncome } = ISCalculatedRows({ bySection, revenueTotal });
      if (sectionId === "gross_profit") return grossProfit;
      if (sectionId === "ebitda") return ebitda;
      if (sectionId === "net_income") return netIncome;
    }
    if (statementType === "balance_sheet") {
      const { totalAssets, totalLiabilities, totalLiabilitiesEquity } = BSCalculatedValues(bySection);
      if (sectionId === "total_assets") return totalAssets;
      if (sectionId === "total_liabilities") return totalLiabilities;
      if (sectionId === "total_liabilities_equity") return totalLiabilitiesEquity;
    }
    if (statementType === "cash_flow") {
      const { netChangeCash } = CFCalculatedValues(bySection);
      if (sectionId === "net_change_cash") return netChangeCash;
    }
    return 0;
  };

  const revenueTotal = statementType === "income_statement" ? sectionTotal("revenue") : 0;

  return (
    <div className="space-y-3">
      {/* Balance sheet balance check */}
      {statementType === "balance_sheet" && (() => {
        const { totalAssets, totalLiabilitiesEquity, isBalanced } = BSCalculatedValues(bySection);
        return (
          <div className={cn(
            "rounded-md px-3 py-2 text-xs flex items-center gap-2",
            isBalanced ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
          )}>
            {isBalanced ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5" />
            )}
            {isBalanced
              ? `Balance sheet balances (${formatAmount(totalAssets)})`
              : `Out of balance: Assets ${formatAmount(totalAssets)} vs L+E ${formatAmount(totalLiabilitiesEquity)}`
            }
          </div>
        );
      })()}

      <div className="rounded-lg border bg-white overflow-hidden">
        {sections.map((section) => {
          if (section.calculated) {
            const value = getCalculatedValue(section.id);
            return (
              <CalculatedRow
                key={section.id}
                label={section.label}
                amount={value}
                revenueTotal={revenueTotal}
                bold={["net_income", "total_liabilities_equity", "net_change_cash"].includes(section.id)}
              />
            );
          }

          return (
            <SectionBlock
              key={section.id}
              section={section}
              items={bySection.get(section.id) || []}
              onReassign={onReassign}
              onRemove={onRemove}
              reassignOptions={lineItemSections}
              showSourceSheet={showSourceSheet}
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
                {showSourceSheet && item.sourceSheet && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1 shrink-0">
                    {item.sourceSheet}
                  </Badge>
                )}

                <Select
                  value={item.sectionId || "uncategorized"}
                  onValueChange={(val) => val && onReassign(item.key, val)}
                >
                  <SelectTrigger className="h-6 w-[140px] text-xs border-amber-300">
                    <SelectValue placeholder="Assign section..." />
                  </SelectTrigger>
                  <SelectContent>
                    {lineItemSections.map((s) => (
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
                  onClick={() => onRemove(item.key)}
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

  // Detect if this is a multi-statement import
  const statementTypes = React.useMemo(() => {
    const types = new Set(activeItems.map((i) => i.statementType).filter(Boolean));
    // If all items have no statementType or only income_statement, it's single-statement
    if (types.size === 0) types.add("income_statement" as StatementType);
    return Array.from(types) as StatementType[];
  }, [activeItems]);

  const isMultiStatement = statementTypes.length > 1;
  const showSourceSheet = isMultiStatement;

  // Count uncategorized across all statement types
  const totalUncategorized = React.useMemo(() => {
    return activeItems.filter((item) => {
      const sections = getSectionsForType(item.statementType || "income_statement");
      return !item.sectionId || !sections.some((s) => s.id === item.sectionId);
    }).length;
  }, [activeItems]);

  // Handlers
  function handleReassign(itemKey: string, newSectionId: string) {
    // Find the section across all statement types
    const section = STATEMENT_SECTIONS.find((s) => s.id === newSectionId && !s.calculated);
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

  // Items grouped by statement type
  const itemsByType = React.useMemo(() => {
    const map = new Map<StatementType, ReviewLineItem[]>();
    for (const type of statementTypes) {
      map.set(type, []);
    }
    for (const item of items) {
      const type = item.statementType || "income_statement";
      if (!map.has(type)) map.set(type, []);
      map.get(type)!.push(item);
    }
    return map;
  }, [items, statementTypes]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">
            {isMultiStatement ? "Multi-Statement Review" : "Template Review"}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isMultiStatement ? (
              <>Review line items across {statementTypes.length} financial statements. Reassign items between sections as needed.</>
            ) : (
              <>
                Review your data organized as a{" "}
                <span className="font-medium text-foreground">{organized.template.label}</span>{" "}
                income statement. Reassign items between sections as needed.
              </>
            )}
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

      {/* Financial statements — tabbed if multi-statement, flat if single */}
      {isMultiStatement ? (
        <Tabs defaultValue={statementTypes[0]}>
          <TabsList>
            {statementTypes.map((type) => {
              const typeItems = itemsByType.get(type) || [];
              const typeActiveCount = typeItems.filter((i) => !removedKeys.has(i.key)).length;
              return (
                <TabsTrigger key={type} value={type} className="text-sm">
                  {STATEMENT_TYPE_LABELS[type]}
                  <Badge variant="outline" className="ml-1.5 text-[10px] py-0 px-1">
                    {typeActiveCount}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>
          {statementTypes.map((type) => (
            <TabsContent key={type} value={type}>
              <StatementPanel
                statementType={type}
                items={itemsByType.get(type) || []}
                removedKeys={removedKeys}
                onReassign={handleReassign}
                onRemove={handleRemove}
                showSourceSheet={showSourceSheet}
              />
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <StatementPanel
          statementType="income_statement"
          items={items}
          removedKeys={removedKeys}
          onReassign={handleReassign}
          onRemove={handleRemove}
          showSourceSheet={showSourceSheet}
        />
      )}

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
          Back
        </Button>
        <Button
          onClick={handleApprove}
          disabled={totalUncategorized > 0}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {totalUncategorized > 0
            ? `Categorize ${totalUncategorized} item${totalUncategorized > 1 ? "s" : ""} to continue`
            : "Approve & Continue to Import"}
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
