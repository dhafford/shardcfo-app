import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/supabase/require-auth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardCheck,
  FolderOpen,
  FileText,
  BarChart3,
  AlertTriangle,
  FileOutput,
} from "lucide-react";
import type { CompanyRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatStage(stage: string | null): string {
  if (!stage) return "Pre-seed";
  const map: Record<string, string> = {
    seed: "Seed",
    series_a: "Series A",
    series_b: "Series B",
    series_c: "Series C",
    growth: "Growth",
  };
  return map[stage] ?? stage;
}

function scoreColor(score: number): string {
  if (score >= 70) return "#16a34a"; // green-600
  if (score >= 40) return "#ca8a04"; // yellow-600
  return "#dc2626"; // red-600
}

function scoreLabel(score: number): string {
  if (score >= 70) return "Ready";
  if (score >= 40) return "Partial";
  return "Not Ready";
}

// CSS-based circular progress — pure SVG, no chart library
function ScoreCircle({ score }: { score: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);

  return (
    <svg width="128" height="128" viewBox="0 0 128 128" aria-label={`Score: ${score}`}>
      {/* Track */}
      <circle
        cx="64"
        cy="64"
        r={radius}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth="10"
      />
      {/* Progress */}
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
      {/* Score text */}
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
        {scoreLabel(score)}
      </text>
    </svg>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export default async function DiligenceHubPage({ params }: PageProps) {
  const { companyId } = await params;
  const { supabase } = await requireAuth();

  const { data: rawCompany } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();

  if (!rawCompany) notFound();
  const company = rawCompany as CompanyRow;

  // ─── Fetch counts from all diligence tables ─────────────────────────────────

  const [
    { data: ddItemsRaw },
    { data: ddFindingsRaw },
    { data: latestAssessmentRaw },
    { data: dataRoomDocsRaw },
    { data: qoeAdjustmentsRaw },
  ] = await Promise.all([
    supabase
      .from("dd_items")
      .select("id, status")
      .eq("company_id", companyId),
    supabase
      .from("dd_findings")
      .select("id, severity, resolved")
      .eq("company_id", companyId),
    supabase
      .from("dd_assessments")
      .select("overall_score, stage, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("data_room_documents")
      .select("id, status")
      .eq("company_id", companyId),
    supabase
      .from("qoe_adjustments")
      .select("id, amount")
      .eq("company_id", companyId),
  ]);

  const ddItems = (ddItemsRaw ?? []) as { id: string; status: string }[];
  const ddFindings = (ddFindingsRaw ?? []) as {
    id: string;
    severity: string;
    resolved: boolean;
  }[];
  const latestAssessment = latestAssessmentRaw as {
    overall_score: number;
    stage: string;
    created_at: string;
  } | null;
  const dataRoomDocs = (dataRoomDocsRaw ?? []) as {
    id: string;
    status: string;
  }[];
  const qoeAdjustments = (qoeAdjustmentsRaw ?? []) as {
    id: string;
    amount: number;
  }[];

  // ─── Derived metrics ─────────────────────────────────────────────────────────

  // IRL items by status
  const iriComplete = ddItems.filter((i) => i.status === "complete").length;
  const iriInProgress = ddItems.filter((i) => i.status === "in_progress").length;
  const iriTotal = ddItems.length;

  // Data room completion
  const docsUploaded = dataRoomDocs.filter(
    (d) => d.status === "uploaded" || d.status === "verified"
  ).length;
  const docsTotal = dataRoomDocs.length;
  const docsCompletionPct =
    docsTotal > 0 ? Math.round((docsUploaded / docsTotal) * 100) : 0;

  // Findings by severity (open only)
  const openFindings = ddFindings.filter((f) => !f.resolved);
  const criticalFindings = openFindings.filter(
    (f) => f.severity === "critical"
  ).length;
  const significantFindings = openFindings.filter(
    (f) => f.severity === "significant"
  ).length;

  // QoE — total adjusted EBITDA impact
  const totalQoeAmount = qoeAdjustments.reduce(
    (sum, a) => sum + (a.amount ?? 0),
    0
  );

  // Readiness score
  const assessmentScore = latestAssessment?.overall_score ?? null;

  // ─── Hub cards definition ────────────────────────────────────────────────────

  const hubCards = [
    {
      id: "readiness",
      href: `./readiness`,
      icon: ClipboardCheck,
      title: "Readiness Assessment",
      metric:
        assessmentScore !== null
          ? `${assessmentScore} / 100`
          : "Not started",
      description:
        assessmentScore !== null
          ? `${formatStage(latestAssessment?.stage ?? null)} stage readiness`
          : "Run a 25-point gate check",
      badge:
        assessmentScore !== null
          ? scoreLabel(assessmentScore)
          : null,
      badgeColor:
        assessmentScore !== null
          ? assessmentScore >= 70
            ? "default"
            : assessmentScore >= 40
              ? "secondary"
              : "destructive"
          : "outline",
    },
    {
      id: "data-room",
      href: `./data-room`,
      icon: FolderOpen,
      title: "Data Room",
      metric: `${docsUploaded} / ${docsTotal || "—"} docs`,
      description:
        docsTotal > 0
          ? `${docsCompletionPct}% uploaded`
          : "No documents yet",
      badge: docsTotal > 0 ? `${docsCompletionPct}%` : null,
      badgeColor:
        docsCompletionPct >= 80
          ? "default"
          : docsCompletionPct >= 40
            ? "secondary"
            : "outline",
    },
    {
      id: "irl",
      href: `./irl`,
      icon: FileText,
      title: "IRL Tracker",
      metric:
        iriTotal > 0
          ? `${iriComplete} of ${iriTotal} complete`
          : "No items",
      description:
        iriInProgress > 0
          ? `${iriInProgress} in progress`
          : "Initial request list",
      badge: iriTotal > 0 ? `${iriComplete}/${iriTotal}` : null,
      badgeColor:
        iriComplete === iriTotal && iriTotal > 0
          ? "default"
          : "secondary",
    },
    {
      id: "qoe",
      href: `./qoe`,
      icon: BarChart3,
      title: "QoE Analysis",
      metric:
        qoeAdjustments.length > 0
          ? `${qoeAdjustments.length} adjustment${qoeAdjustments.length !== 1 ? "s" : ""}`
          : "No data",
      description:
        qoeAdjustments.length > 0
          ? `$${Math.abs(totalQoeAmount / 1000).toFixed(0)}K net EBITDA impact`
          : "Quality of earnings adjustments",
      badge: null,
      badgeColor: "outline" as const,
    },
    {
      id: "findings",
      href: `./findings`,
      icon: AlertTriangle,
      title: "Findings",
      metric:
        openFindings.length > 0
          ? `${openFindings.length} open`
          : "No findings",
      description:
        criticalFindings > 0
          ? `${criticalFindings} critical, ${significantFindings} significant`
          : ddFindings.length > 0
            ? "All resolved"
            : "No issues logged",
      badge:
        criticalFindings > 0
          ? `${criticalFindings} critical`
          : null,
      badgeColor: "destructive" as const,
    },
    {
      id: "report",
      href: `./report`,
      icon: FileOutput,
      title: "FDD Report",
      metric: "Not generated",
      description: "Full financial due diligence report",
      badge: null,
      badgeColor: "outline" as const,
    },
  ] as const;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Page heading */}
      <div>
        <h1 className="text-xl font-semibold">Due Diligence</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {formatStage(company.stage)} stage readiness and financial due
          diligence hub
        </p>
      </div>

      {/* Hub cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {hubCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.id} href={card.href} className="group">
              <Card className="h-full transition-shadow group-hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                        <Icon className="h-4 w-4" />
                      </div>
                      <CardTitle className="text-sm font-medium">
                        {card.title}
                      </CardTitle>
                    </div>
                    {card.badge && (
                      <Badge variant={card.badgeColor as any} className="text-xs shrink-0">
                        {card.badge}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tracking-tight tabular-nums">
                    {card.metric}
                  </p>
                  <CardDescription className="mt-1 text-xs">
                    {card.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Summary section — overall readiness score */}
      <div className="rounded-xl border bg-white p-6">
        <h2 className="text-base font-semibold mb-4">Overall Readiness</h2>
        {assessmentScore !== null ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <ScoreCircle score={assessmentScore} />
            <div className="space-y-3 flex-1">
              <p className="text-sm text-muted-foreground">
                Last assessed for{" "}
                <span className="font-medium text-foreground">
                  {formatStage(latestAssessment?.stage ?? null)}
                </span>{" "}
                stage fundraising.
              </p>
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="font-semibold text-green-600">
                    {openFindings.filter((f) => f.severity !== "critical").length}
                  </span>
                  <span className="text-muted-foreground ml-1">
                    non-critical open findings
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">
                    {iriComplete}
                  </span>
                  <span className="text-muted-foreground ml-1">
                    IRL items complete
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">
                    {docsUploaded}
                  </span>
                  <span className="text-muted-foreground ml-1">
                    data room documents uploaded
                  </span>
                </div>
              </div>
              <Link
                href={`./readiness`}
                className="inline-flex items-center text-sm font-medium text-blue-600 hover:underline"
              >
                Update assessment
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
            <ClipboardCheck className="h-10 w-10 text-slate-300" />
            <div>
              <p className="text-sm font-medium text-foreground">
                No readiness assessment yet
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Run the 25-point gate check to score your diligence readiness.
              </p>
            </div>
            <Link
              href={`./readiness`}
              className="mt-2 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Start Assessment
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
