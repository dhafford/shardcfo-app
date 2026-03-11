"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateDDItemStatus, bulkCreateDDItems } from "@/lib/diligence/actions";
import { getIRLForStage, IRL_TEMPLATE_ITEMS } from "@/lib/diligence/irl-templates";
import { DD_CATEGORIES } from "@/lib/constants";
import type { DDItemRow } from "@/lib/supabase/types";

// Build a set of item names that support auto-response (derived from template metadata)
const AUTO_RESPOND_ITEM_NAMES = new Set(
  IRL_TEMPLATE_ITEMS.filter((t) => t.canAutoRespond).map((t) => t.item)
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IRLTrackerClientProps {
  items: DDItemRow[];
  companyId: string;
  companyStage: string;
  hasExistingItems: boolean;
}

type StatusFilter = "all" | "not_started" | "in_progress" | "complete" | "not_applicable";
type CategoryFilter = "all" | DDItemRow["category"];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<DDItemRow["status"], string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  complete: "Complete",
  not_applicable: "N/A",
};

const STATUS_BADGE_CLASS: Record<DDItemRow["status"], string> = {
  not_started: "bg-slate-100 text-slate-600",
  in_progress: "bg-blue-100 text-blue-700",
  complete: "bg-green-100 text-green-700",
  not_applicable: "bg-slate-100 text-slate-400",
};

const PRIORITY_BADGE_CLASS: Record<DDItemRow["priority"], string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-slate-100 text-slate-500",
};

const STATUS_CYCLE: DDItemRow["status"][] = [
  "not_started",
  "in_progress",
  "complete",
  "not_applicable",
];

// ---------------------------------------------------------------------------
// Summary stats bar
// ---------------------------------------------------------------------------

function SummaryStats({ items }: { items: DDItemRow[] }) {
  const total = items.length;
  const complete = items.filter((i) => i.status === "complete").length;
  const pending =
    items.filter((i) => i.status === "not_started" || i.status === "in_progress").length;
  const autoRespondable = items.filter((i) => AUTO_RESPOND_ITEM_NAMES.has(i.item_name)).length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: "Total Items", value: total, cls: "text-foreground" },
        { label: "Complete", value: complete, cls: "text-green-700" },
        { label: "Pending / In Progress", value: pending, cls: "text-blue-700" },
        { label: "Auto-Respondable", value: autoRespondable, cls: "text-purple-700" },
      ].map(({ label, value, cls }) => (
        <div key={label} className="rounded-lg border bg-white p-3 text-center">
          <div className={`text-2xl font-semibold ${cls}`}>{value}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Item row
// ---------------------------------------------------------------------------

function ItemRow({
  item,
  companyId,
}: {
  item: DDItemRow;
  companyId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useState<DDItemRow["status"]>(item.status);

  function handleStatusChange(newStatus: string | null) {
    if (!newStatus) return;
    const next = newStatus as DDItemRow["status"];
    setOptimisticStatus(next);
    startTransition(async () => {
      try {
        await updateDDItemStatus(companyId, item.id, next);
      } catch {
        // Revert on error
        setOptimisticStatus(item.status);
      }
    });
  }

  const canAutoRespond = AUTO_RESPOND_ITEM_NAMES.has(item.item_name);

  return (
    <div className="flex items-start gap-3 py-2.5 px-3 rounded-md hover:bg-slate-50 transition-colors">
      {/* Status selector */}
      <div className="shrink-0 pt-0.5">
        <Select
          value={optimisticStatus}
          onValueChange={handleStatusChange}
          disabled={isPending}
        >
          <SelectTrigger className="h-7 w-[130px] text-xs border-0 shadow-none focus:ring-0 p-0">
            <Badge className={`text-[10px] px-2 py-0.5 cursor-pointer ${STATUS_BADGE_CLASS[optimisticStatus]}`}>
              {STATUS_LABELS[optimisticStatus]}
            </Badge>
          </SelectTrigger>
          <SelectContent>
            {STATUS_CYCLE.map((s) => (
              <SelectItem key={s} value={s} className="text-xs">
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Item info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{item.item_name}</span>
          {canAutoRespond && (
            <Badge className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700">
              Auto
            </Badge>
          )}
        </div>
        {item.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {item.description}
          </p>
        )}
        {item.subcategory && (
          <span className="text-[10px] text-muted-foreground">{item.subcategory}</span>
        )}
      </div>

      {/* Priority badge */}
      <Badge className={`shrink-0 text-[10px] px-1.5 py-0.5 ${PRIORITY_BADGE_CLASS[item.priority]}`}>
        {item.priority}
      </Badge>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category section
// ---------------------------------------------------------------------------

function CategorySection({
  categoryId,
  items,
  companyId,
}: {
  categoryId: string;
  items: DDItemRow[];
  companyId: string;
}) {
  const catDef = DD_CATEGORIES.find((c) => c.id === categoryId);
  const label = catDef?.label ?? categoryId;

  const total = items.length;
  const complete = items.filter((i) => i.status === "complete").length;
  const pct = total > 0 ? Math.round((complete / total) * 100) : 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold">{label}</CardTitle>
          <span className="text-xs text-muted-foreground shrink-0">
            {complete}/{total} complete
          </span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </CardHeader>

      <CardContent className="p-0 divide-y">
        {items.map((item) => (
          <ItemRow key={item.id} item={item} companyId={companyId} />
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Generate from template empty state
// ---------------------------------------------------------------------------

function GeneratePrompt({
  companyId,
  companyStage,
}: {
  companyId: string;
  companyStage: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      try {
        const templateItems = getIRLForStage(companyStage);
        const insertItems = templateItems.map((tpl) => ({
          category: tpl.category as DDItemRow["category"],
          subcategory: tpl.subcategory,
          item_name: tpl.item,
          description: tpl.description,
          required_stages: tpl.requiredStages,
          status: "not_started" as DDItemRow["status"],
          priority: "medium" as DDItemRow["priority"],
        }));
        await bulkCreateDDItems(companyId, insertItems);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate IRL.");
      }
    });
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-blue-50 p-4 mb-4">
        <svg
          className="w-8 h-8 text-blue-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
          />
        </svg>
      </div>
      <h3 className="text-sm font-semibold mb-1">No IRL items yet</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">
        Generate a standard Information Request List based on your current
        funding stage ({companyStage.replace("_", " ")}).
      </p>
      {error && <p className="text-xs text-destructive mb-3">{error}</p>}
      <Button onClick={handleGenerate} disabled={isPending} size="sm">
        {isPending ? "Generating…" : "Generate from Template"}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function IRLTrackerClient({
  items,
  companyId,
  companyStage,
  hasExistingItems,
}: IRLTrackerClientProps) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  if (!hasExistingItems) {
    return (
      <div className="rounded-lg border bg-white">
        <GeneratePrompt companyId={companyId} companyStage={companyStage} />
      </div>
    );
  }

  // Apply filters
  const filteredItems = items.filter((item) => {
    const matchesCategory =
      categoryFilter === "all" || item.category === categoryFilter;
    const matchesStatus =
      statusFilter === "all" || item.status === statusFilter;
    return matchesCategory && matchesStatus;
  });

  // Group by category (using filtered items for display, but category sections
  // show only filtered items)
  const categoryIds = DD_CATEGORIES.map((c) => c.id);
  const presentCategories = categoryIds.filter((catId) =>
    filteredItems.some((item) => item.category === catId)
  );

  return (
    <div className="space-y-4">
      <SummaryStats items={items} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Category tabs */}
        <div className="flex items-center gap-1 flex-wrap">
          {(["all", ...categoryIds] as const).map((catId) => {
            const label =
              catId === "all"
                ? "All"
                : DD_CATEGORIES.find((c) => c.id === catId)?.label ?? catId;
            const count =
              catId === "all"
                ? items.length
                : items.filter((i) => i.category === catId).length;
            if (count === 0 && catId !== "all") return null;
            return (
              <button
                key={catId}
                type="button"
                onClick={() => setCategoryFilter(catId as CategoryFilter)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  categoryFilter === catId
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {label}
                <span className="ml-1 opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Status filter */}
        <div className="ml-auto">
          <Select
            value={statusFilter}
            onValueChange={(v) => { if (v) setStatusFilter(v as StatusFilter); }}
          >
            <SelectTrigger className="h-8 text-xs w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
              <SelectItem value="not_started" className="text-xs">Not Started</SelectItem>
              <SelectItem value="in_progress" className="text-xs">In Progress</SelectItem>
              <SelectItem value="complete" className="text-xs">Complete</SelectItem>
              <SelectItem value="not_applicable" className="text-xs">N/A</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Category sections */}
      {presentCategories.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground rounded-lg border border-dashed bg-white">
          No items match the selected filters.
        </div>
      ) : (
        presentCategories.map((catId) => {
          const catItems = filteredItems.filter((i) => i.category === catId);
          return (
            <CategorySection
              key={catId}
              categoryId={catId}
              items={catItems}
              companyId={companyId}
            />
          );
        })
      )}
    </div>
  );
}
