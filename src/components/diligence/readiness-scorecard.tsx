"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, AlertCircle, XCircle, MinusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { saveAssessment } from "@/lib/diligence/actions";
import type {
  ScoredReadinessItem,
  ReadinessStatus,
} from "@/lib/calculations/readiness";
import { computeReadinessScore } from "@/lib/calculations/readiness";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReadinessScorecardProps {
  items: ScoredReadinessItem[];
  autoStatuses: Record<string, ReadinessStatus>;
  stage: string;
  companyId: string;
}

// ─── Status cycle ────────────────────────────────────────────────────────────

const STATUS_CYCLE: ReadinessStatus[] = ["pass", "partial", "fail", "na"];

function nextStatus(current: ReadinessStatus): ReadinessStatus {
  const idx = STATUS_CYCLE.indexOf(current);
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

// ─── Score circle ────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 70) return "#16a34a";
  if (score >= 40) return "#ca8a04";
  return "#dc2626";
}

function ScoreCircle({ score }: { score: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);

  return (
    <svg
      width="140"
      height="140"
      viewBox="0 0 128 128"
      aria-label={`Score: ${score}`}
    >
      <circle
        cx="64"
        cy="64"
        r={radius}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth="10"
      />
      <circle
        cx="64"
        cy="64"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 64 64)"
      />
      <text
        x="64"
        y="60"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="22"
        fontWeight="700"
        fill={color}
        fontFamily="system-ui, sans-serif"
      >
        {score}
      </text>
      <text
        x="64"
        y="80"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="11"
        fill="#64748b"
        fontFamily="system-ui, sans-serif"
      >
        / 100
      </text>
    </svg>
  );
}

// ─── Category progress bar ───────────────────────────────────────────────────

function CategoryBar({
  label,
  score,
}: {
  label: string;
  score: number;
}) {
  const color =
    score >= 70
      ? "bg-green-500"
      : score >= 40
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">{score}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

// ─── Status icon ────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: ReadinessStatus }) {
  switch (status) {
    case "pass":
      return <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />;
    case "partial":
      return <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0" />;
    case "fail":
      return <XCircle className="h-5 w-5 text-red-500 shrink-0" />;
    case "na":
      return <MinusCircle className="h-5 w-5 text-slate-400 shrink-0" />;
  }
}

// ─── Status toggle button label ──────────────────────────────────────────────

const STATUS_LABEL: Record<ReadinessStatus, string> = {
  pass: "Pass",
  partial: "Partial",
  fail: "Fail",
  na: "N/A",
};

const STATUS_BUTTON_CLASS: Record<ReadinessStatus, string> = {
  pass: "border-green-200 bg-green-50 text-green-700 hover:bg-green-100",
  partial:
    "border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100",
  fail: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
  na: "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100",
};

// ─── Category label map ──────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  corporate: "Corporate Foundation",
  financial: "Financial Infrastructure",
  tax: "Tax & Compliance",
};

// ─── Main component ──────────────────────────────────────────────────────────

export function ReadinessScorecard({
  items: initialItems,
  autoStatuses,
  stage,
  companyId,
}: ReadinessScorecardProps) {
  // Mutable state: map of item id -> status (only for non-auto-detected items)
  const [manualStatuses, setManualStatuses] = useState<
    Record<string, ReadinessStatus>
  >(() => {
    const initial: Record<string, ReadinessStatus> = {};
    for (const item of initialItems) {
      if (!item.autoDetectable) {
        initial[item.id] = item.status;
      }
    }
    return initial;
  });

  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [isPending, startTransition] = useTransition();

  // Merge auto statuses and manual statuses into current item list
  const currentItems: ScoredReadinessItem[] = initialItems.map((item) => ({
    ...item,
    status:
      item.autoDetectable && item.autoDetectKey
        ? autoStatuses[item.autoDetectKey] ?? item.status
        : manualStatuses[item.id] ?? item.status,
  }));

  const score = computeReadinessScore(currentItems, stage);

  function toggleStatus(itemId: string) {
    setManualStatuses((prev) => {
      const current = prev[itemId] ?? "fail";
      return { ...prev, [itemId]: nextStatus(current) };
    });
  }

  function handleSave() {
    setSaveState("saving");

    // Build the items payload: all item IDs -> { status, notes }
    const itemsPayload: Record<string, { status: ReadinessStatus; notes: string }> = {};
    for (const item of currentItems) {
      itemsPayload[item.id] = { status: item.status, notes: item.notes };
    }

    startTransition(async () => {
      try {
        await saveAssessment(companyId, {
          stage: stage as any,
          overall_score: score.overall,
          items: itemsPayload as any,
        });
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 2000);
      } catch {
        setSaveState("error");
        setTimeout(() => setSaveState("idle"), 3000);
      }
    });
  }

  const categories = ["corporate", "financial", "tax"] as const;

  return (
    <div className="space-y-6">
      {/* Score summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-8">
            {/* Circle */}
            <div className="shrink-0">
              <ScoreCircle score={score.overall} />
            </div>

            {/* Category bars */}
            <div className="flex-1 w-full space-y-4">
              <CategoryBar
                label="Corporate Foundation"
                score={score.corporate}
              />
              <CategoryBar
                label="Financial Infrastructure"
                score={score.financial}
              />
              <CategoryBar label="Tax & Compliance" score={score.tax} />
            </div>

            {/* Counts */}
            <div className="shrink-0 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="tabular-nums font-medium">
                  {score.passCount}
                </span>
                <span className="text-muted-foreground">pass</span>
              </div>
              <div className="flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <span className="tabular-nums font-medium">
                  {score.partialCount}
                </span>
                <span className="text-muted-foreground">partial</span>
              </div>
              <div className="flex items-center gap-1.5">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="tabular-nums font-medium">
                  {score.failCount}
                </span>
                <span className="text-muted-foreground">fail</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MinusCircle className="h-4 w-4 text-slate-400" />
                <span className="tabular-nums font-medium">
                  {score.naCount}
                </span>
                <span className="text-muted-foreground">n/a</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Item list by category */}
      {categories.map((cat) => {
        const catItems = currentItems.filter((i) => i.category === cat);
        if (catItems.length === 0) return null;

        return (
          <Card key={cat}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {CATEGORY_LABELS[cat]}
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {catItems.map((item) => {
                const isAutoDetected =
                  item.autoDetectable && item.autoDetectKey != null;
                const currentStatus = item.status;

                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    {/* Status icon */}
                    <div className="pt-0.5">
                      <StatusIcon status={currentStatus} />
                    </div>

                    {/* Label + description */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">
                          {item.label}
                        </span>
                        {isAutoDetected && (
                          <Badge
                            variant="outline"
                            className="text-xs h-4 px-1.5 text-blue-600 border-blue-200 bg-blue-50"
                          >
                            Auto-detected
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className="text-xs h-4 px-1.5 text-slate-500"
                        >
                          {item.weight === 3
                            ? "High"
                            : item.weight === 2
                              ? "Medium"
                              : "Low"}{" "}
                          weight
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {item.description}
                      </p>
                    </div>

                    {/* Status toggle — only for manual items */}
                    {!isAutoDetected && (
                      <button
                        type="button"
                        onClick={() => toggleStatus(item.id)}
                        className={`shrink-0 rounded border px-2.5 py-1 text-xs font-medium transition-colors ${STATUS_BUTTON_CLASS[currentStatus]}`}
                        title="Click to cycle status"
                      >
                        {STATUS_LABEL[currentStatus]}
                      </button>
                    )}
                    {isAutoDetected && (
                      <span
                        className={`shrink-0 rounded border px-2.5 py-1 text-xs font-medium ${STATUS_BUTTON_CLASS[currentStatus]} opacity-70 cursor-default`}
                      >
                        {STATUS_LABEL[currentStatus]}
                      </span>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      {/* Save button */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={isPending || saveState === "saving"}
          className="min-w-[140px]"
        >
          {saveState === "saving" || isPending
            ? "Saving..."
            : saveState === "saved"
              ? "Saved"
              : saveState === "error"
                ? "Error — retry"
                : "Save Assessment"}
        </Button>
        {saveState === "saved" && (
          <span className="text-sm text-green-600">
            Assessment saved successfully.
          </span>
        )}
        {saveState === "error" && (
          <span className="text-sm text-red-600">
            Failed to save. Please try again.
          </span>
        )}
      </div>
    </div>
  );
}
