"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, SortAsc, SortDesc, Plus, Building2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import type { CompanyRow } from "@/lib/supabase/types";

// Minimal per-company summary derived from metrics fetched server-side
export interface CompanySummary {
  company: CompanyRow;
  mrr: number | null;
  arr: number | null;
  burnRate: number | null;
  runwayMonths: number | null;
  needsAttention: boolean;
}

interface PortfolioClientProps {
  companies: CompanySummary[];
}

type SortField = "name" | "mrr" | "arr" | "runway";
type SortDir = "asc" | "desc";

function formatCurrency(value: number | null, currency = "USD"): string {
  if (value === null) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function statusColor(status: CompanyRow["status"]): string {
  switch (status) {
    case "active":
      return "bg-green-500";
    case "inactive":
      return "bg-amber-500";
    case "archived":
      return "bg-slate-400";
  }
}

function runwayBadgeVariant(
  months: number | null
): "default" | "secondary" | "destructive" | "outline" {
  if (months === null) return "outline";
  if (months < 6) return "destructive";
  if (months < 12) return "secondary";
  return "default";
}

function CompanyCard({ summary }: { summary: CompanySummary }) {
  const { company, mrr, arr, burnRate, runwayMonths, needsAttention } = summary;

  return (
    <Link
      href={`/dashboard/companies/${company.id}`}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
    >
      <Card className="h-full transition-shadow hover:shadow-md group-focus-visible:shadow-md">
        <CardContent className="p-5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2 mb-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className={`inline-block w-2 h-2 rounded-full shrink-0 ${statusColor(company.status)}`}
                  aria-hidden="true"
                />
                <h3 className="font-semibold text-sm text-foreground truncate leading-tight">
                  {company.name}
                </h3>
              </div>
              {company.industry && (
                <p className="text-xs text-muted-foreground truncate">
                  {company.industry}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {needsAttention && (
                <AlertCircle
                  className="w-4 h-4 text-amber-500"
                  aria-label="Needs attention"
                />
              )}
              <Badge variant={company.status === "active" ? "default" : "secondary"}>
                {company.status}
              </Badge>
            </div>
          </div>

          {/* Metrics grid */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <dt className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                MRR
              </dt>
              <dd className="text-sm font-semibold font-mono tabular-nums">
                {formatCurrency(mrr, company.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                ARR
              </dt>
              <dd className="text-sm font-semibold font-mono tabular-nums">
                {formatCurrency(arr, company.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                Burn Rate
              </dt>
              <dd className="text-sm font-semibold font-mono tabular-nums">
                {formatCurrency(burnRate, company.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                Runway
              </dt>
              <dd className="text-sm font-semibold font-mono tabular-nums">
                {runwayMonths !== null ? (
                  <Badge variant={runwayBadgeVariant(runwayMonths)} className="text-xs">
                    {Math.round(runwayMonths)}mo
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </Link>
  );
}

function AddCompanyCard() {
  return (
    <Link
      href="/dashboard/companies/new"
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
    >
      <Card className="h-full border-dashed border-2 border-slate-200 bg-slate-50/50 transition-all hover:border-blue-300 hover:bg-blue-50/30 group-focus-visible:border-blue-400">
        <CardContent className="p-5 flex flex-col items-center justify-center h-full min-h-[180px] gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
            <Plus className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700">Add Company</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Onboard a new portfolio company
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function PortfolioClient({ companies }: PortfolioClientProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [statusFilter, setStatusFilter] = useState<"all" | CompanyRow["status"]>("all");

  const filtered = useMemo(() => {
    let result = companies;

    if (statusFilter !== "all") {
      result = result.filter((s) => s.company.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.company.name.toLowerCase().includes(q) ||
          s.company.industry?.toLowerCase().includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.company.name.localeCompare(b.company.name);
          break;
        case "mrr":
          cmp = (a.mrr ?? -1) - (b.mrr ?? -1);
          break;
        case "arr":
          cmp = (a.arr ?? -1) - (b.arr ?? -1);
          break;
        case "runway":
          cmp = (a.runwayMonths ?? 9999) - (b.runwayMonths ?? 9999);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [companies, search, sortField, sortDir, statusFilter]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const SortIcon = sortDir === "asc" ? SortAsc : SortDesc;

  if (companies.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="No companies yet"
        description="Add your first portfolio company to get started tracking financials and KPIs."
        actionLabel="Add Company"
        actionHref="/dashboard/companies/new"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>

        <div className="flex gap-2 shrink-0">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
          >
            <SelectTrigger className="w-[130px] h-9 text-sm" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={sortField}
            onValueChange={(v) => setSortField(v as SortField)}
          >
            <SelectTrigger className="w-[120px] h-9 text-sm" aria-label="Sort by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="mrr">MRR</SelectItem>
              <SelectItem value="arr">ARR</SelectItem>
              <SelectItem value="runway">Runway</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className="h-9 px-2.5"
            onClick={() => toggleSort(sortField)}
            aria-label={`Sort ${sortDir === "asc" ? "descending" : "ascending"}`}
          >
            <SortIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Company grid */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No companies match your filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((summary) => (
            <CompanyCard key={summary.company.id} summary={summary} />
          ))}
          <AddCompanyCard />
        </div>
      )}
    </div>
  );
}
