"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SEVERITY_CONFIG } from "@/lib/constants";
import {
  createFinding,
  resolveFinding,
} from "@/lib/diligence/actions";
import type { DDFindingRow, DDFindingInsert } from "@/lib/supabase/types";
import type { DetectedFinding } from "@/lib/calculations/red-flags";
import type { assessGoNoGo } from "@/lib/calculations/red-flags";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GoNoGoResult = ReturnType<typeof assessGoNoGo>;

interface FindingsDashboardClientProps {
  companyId: string;
  storedFindings: DDFindingRow[];
  detectedFindings: DetectedFinding[];
  goNoGo: GoNoGoResult;
  companyStage: string;
}

const FINDING_CATEGORIES = [
  "Financial",
  "Retention",
  "Unit Economics",
  "Efficiency",
  "Growth",
  "Revenue Quality",
  "Financial Infrastructure",
  "Profitability",
  "Legal",
  "Tax",
  "HR",
  "Product",
  "Other",
];

const SEVERITY_OPTIONS = [
  { value: "critical", label: "Critical" },
  { value: "significant", label: "Significant" },
  { value: "moderate", label: "Moderate" },
  { value: "observation", label: "Observation" },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bannerConfig(recommendation: GoNoGoResult["recommendation"]) {
  switch (recommendation) {
    case "proceed":
      return {
        label: "Proceed",
        bgClass: "bg-green-50 border-green-200",
        textClass: "text-green-800",
        badgeVariant: "default" as const,
      };
    case "proceed_with_conditions":
      return {
        label: "Proceed with Conditions",
        bgClass: "bg-amber-50 border-amber-200",
        textClass: "text-amber-800",
        badgeVariant: "secondary" as const,
      };
    case "do_not_proceed":
      return {
        label: "Do Not Proceed",
        bgClass: "bg-red-50 border-red-200",
        textClass: "text-red-800",
        badgeVariant: "destructive" as const,
      };
  }
}

function riskBadgeVariant(riskRating: "low" | "medium" | "high") {
  if (riskRating === "low") return "default" as const;
  if (riskRating === "medium") return "secondary" as const;
  return "destructive" as const;
}

function severityBadgeStyle(severity: string): React.CSSProperties {
  const config = SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG];
  if (!config) return {};
  return {
    backgroundColor: config.bgColor,
    color: config.color,
    borderColor: config.borderColor,
    border: "1px solid",
  };
}

// ---------------------------------------------------------------------------
// Add Finding Form
// ---------------------------------------------------------------------------

interface AddFindingFormProps {
  companyId: string;
  onClose: () => void;
}

function AddFindingForm({ companyId, onClose }: AddFindingFormProps) {
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<DDFindingInsert["severity"]>("moderate");
  const [impact, setImpact] = useState("");
  const [recommendation, setRecommendation] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !category || !severity) return;
    startTransition(async () => {
      await createFinding(companyId, {
        title,
        category,
        description: description || null,
        severity,
        impact: impact || null,
        recommendation: recommendation || null,
      });
      onClose();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border rounded-lg p-4 bg-slate-50 space-y-3"
    >
      <p className="text-sm font-medium">Add Finding</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="finding-title" className="text-xs">
            Title
          </Label>
          <Input
            id="finding-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Undisclosed related-party transaction"
            required
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="finding-category" className="text-xs">
            Category
          </Label>
          <Select value={category} onValueChange={(v) => setCategory(v ?? "")}>
            <SelectTrigger id="finding-category" className="h-8 text-sm">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {FINDING_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="finding-severity" className="text-xs">
            Severity
          </Label>
          <Select
            value={severity}
            onValueChange={(v) =>
              setSeverity((v ?? "moderate") as DDFindingInsert["severity"])
            }
          >
            <SelectTrigger id="finding-severity" className="h-8 text-sm">
              <SelectValue placeholder="Select severity" />
            </SelectTrigger>
            <SelectContent>
              {SEVERITY_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="finding-description" className="text-xs">
            Description
          </Label>
          <Textarea
            id="finding-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what was found…"
            className="text-sm resize-none"
            rows={2}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="finding-impact" className="text-xs">
            Impact
          </Label>
          <Input
            id="finding-impact"
            value={impact}
            onChange={(e) => setImpact(e.target.value)}
            placeholder="e.g. May affect valuation"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="finding-recommendation" className="text-xs">
            Recommendation
          </Label>
          <Input
            id="finding-recommendation"
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value)}
            placeholder="e.g. Require indemnification"
            className="h-8 text-sm"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Detected Finding Card
// ---------------------------------------------------------------------------

interface DetectedFindingCardProps {
  finding: DetectedFinding;
  companyId: string;
}

function DetectedFindingCard({ finding, companyId }: DetectedFindingCardProps) {
  const [isSaved, setIsSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const config = SEVERITY_CONFIG[finding.severity as keyof typeof SEVERITY_CONFIG];

  function handleSave() {
    startTransition(async () => {
      await createFinding(companyId, {
        title: finding.title,
        category: finding.category,
        description: finding.description,
        severity: finding.severity as DDFindingInsert["severity"],
        impact: finding.impact,
        recommendation: finding.recommendation,
      });
      setIsSaved(true);
    });
  }

  return (
    <div
      className="rounded-lg border p-4 space-y-2"
      style={{
        borderColor: config?.borderColor ?? "#e5e7eb",
        backgroundColor: config?.bgColor ?? "#f9fafb",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            className="text-xs"
            style={severityBadgeStyle(finding.severity)}
          >
            {config?.label ?? finding.severity}
          </Badge>
          <span className="text-xs text-muted-foreground">{finding.category}</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2 text-xs shrink-0"
          disabled={isPending || isSaved}
          onClick={handleSave}
        >
          {isSaved ? "Saved" : isPending ? "Saving…" : "Save to Findings"}
        </Button>
      </div>
      <p className="text-sm font-medium">{finding.title}</p>
      {finding.description && (
        <p className="text-xs text-muted-foreground">{finding.description}</p>
      )}
      {finding.impact && (
        <p className="text-xs">
          <span className="font-medium">Impact: </span>
          {finding.impact}
        </p>
      )}
      {finding.recommendation && (
        <p className="text-xs">
          <span className="font-medium">Recommendation: </span>
          {finding.recommendation}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FindingsDashboardClient({
  companyId,
  storedFindings,
  detectedFindings,
  goNoGo,
  companyStage: _companyStage,
}: FindingsDashboardClientProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [, startResolveTransition] = useTransition();

  const banner = bannerConfig(goNoGo.recommendation);

  function handleResolve(findingId: string, currentlyResolved: boolean) {
    startResolveTransition(async () => {
      await resolveFinding(companyId, findingId, !currentlyResolved);
    });
  }

  const openStoredFindings = storedFindings.filter((f) => !f.resolved);
  const resolvedStoredFindings = storedFindings.filter((f) => f.resolved);

  return (
    <div className="space-y-6">
      {/* ── Go/No-Go Banner ───────────────────────────────────────────── */}
      <div
        className={`rounded-xl border p-5 ${banner.bgClass}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className={`text-xs font-medium uppercase tracking-wide ${banner.textClass} opacity-70`}>
              Go/No-Go Recommendation
            </p>
            <p className={`text-xl font-bold mt-0.5 ${banner.textClass}`}>
              {banner.label}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm">
              <span className={banner.textClass + " opacity-70"}>Risk:</span>
              <Badge variant={riskBadgeVariant(goNoGo.riskRating)} className="text-xs capitalize">
                {goNoGo.riskRating}
              </Badge>
            </div>
            <div className={`text-xs ${banner.textClass} opacity-80`}>
              {goNoGo.criticalCount > 0 && `${goNoGo.criticalCount} critical · `}
              {goNoGo.significantCount > 0 && `${goNoGo.significantCount} significant · `}
              {goNoGo.moderateCount > 0 && `${goNoGo.moderateCount} moderate · `}
              {goNoGo.observationCount > 0 && `${goNoGo.observationCount} observation · `}
              {goNoGo.criticalCount + goNoGo.significantCount + goNoGo.moderateCount + goNoGo.observationCount === 0
                ? "No findings"
                : `${goNoGo.criticalCount + goNoGo.significantCount + goNoGo.moderateCount + goNoGo.observationCount} total`}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 1: Finding Severity Summary ───────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(
          [
            { key: "critical", count: goNoGo.criticalCount },
            { key: "significant", count: goNoGo.significantCount },
            { key: "moderate", count: goNoGo.moderateCount },
            { key: "observation", count: goNoGo.observationCount },
          ] as const
        ).map(({ key, count }) => {
          const config = SEVERITY_CONFIG[key];
          return (
            <div
              key={key}
              className="rounded-lg border p-3 text-center"
              style={{
                borderColor: config.borderColor,
                backgroundColor: config.bgColor,
              }}
            >
              <p
                className="text-2xl font-bold tabular-nums"
                style={{ color: config.color }}
              >
                {count}
              </p>
              <p className="text-xs mt-0.5" style={{ color: config.color }}>
                {config.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Section 2: Auto-Detected Findings ────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Auto-Detected Findings</h2>
          <span className="text-xs text-muted-foreground">
            {detectedFindings.length} detected
          </span>
        </div>
        {detectedFindings.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-sm text-muted-foreground border border-dashed rounded-lg">
            No red flags detected from current financial data.
          </div>
        ) : (
          <div className="space-y-3">
            {detectedFindings.map((finding, idx) => (
              <DetectedFindingCard
                key={idx}
                finding={finding}
                companyId={companyId}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Section 3: Stored Findings ───────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Logged Findings
            </CardTitle>
            {!showAddForm && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddForm(true)}
              >
                Add Finding
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAddForm && (
            <AddFindingForm
              companyId={companyId}
              onClose={() => setShowAddForm(false)}
            />
          )}

          {storedFindings.length === 0 && !showAddForm ? (
            <div className="flex items-center justify-center h-20 text-sm text-muted-foreground border border-dashed rounded-lg">
              No findings logged yet. Add one manually or save a detected finding above.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Open findings */}
              {openStoredFindings.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Open ({openStoredFindings.length})
                  </p>
                  {openStoredFindings.map((finding) => {
                    const config =
                      SEVERITY_CONFIG[
                        finding.severity as keyof typeof SEVERITY_CONFIG
                      ];
                    return (
                      <div
                        key={finding.id}
                        className="rounded-lg border p-3 space-y-1"
                        style={{
                          borderColor: config?.borderColor ?? "#e5e7eb",
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <Badge
                              className="text-xs shrink-0"
                              style={severityBadgeStyle(finding.severity)}
                            >
                              {config?.label ?? finding.severity}
                            </Badge>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {finding.category}
                            </span>
                            <span className="text-sm font-medium truncate">
                              {finding.title}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-xs shrink-0"
                            onClick={() =>
                              handleResolve(finding.id, finding.resolved)
                            }
                          >
                            Mark Resolved
                          </Button>
                        </div>
                        {finding.description && (
                          <p className="text-xs text-muted-foreground">
                            {finding.description}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Resolved findings */}
              {resolvedStoredFindings.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Resolved ({resolvedStoredFindings.length})
                  </p>
                  {resolvedStoredFindings.map((finding) => (
                    <div
                      key={finding.id}
                      className="rounded-lg border border-slate-200 p-3 space-y-1 opacity-60"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {SEVERITY_CONFIG[finding.severity as keyof typeof SEVERITY_CONFIG]?.label ?? finding.severity}
                          </Badge>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {finding.category}
                          </span>
                          <span className="text-sm font-medium truncate line-through">
                            {finding.title}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs shrink-0 text-muted-foreground"
                          onClick={() =>
                            handleResolve(finding.id, finding.resolved)
                          }
                        >
                          Reopen
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
