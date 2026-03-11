"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { FDD_REPORT_SECTIONS, SEVERITY_CONFIG } from "@/lib/constants";
import type { DDFindingRow, QoEAdjustmentRow } from "@/lib/supabase/types";
import type { DetectedFinding } from "@/lib/calculations/red-flags";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PnlPeriod {
  period: string;
  revenue: number;
  cogs: number;
  opex: number;
  ebitda: number;
  netIncome: number;
}

interface GoNoGoResult {
  recommendation: string;
  riskRating: string;
  criticalCount: number;
  significantCount: number;
  moderateCount: number;
  observationCount: number;
}

interface FDDReportClientProps {
  companyId: string;
  company: { name: string; industry: string | null; stage: string | null };
  readinessScore: number | null;
  findings: DDFindingRow[];
  detectedFindings: DetectedFinding[];
  qoeAdjustments: QoEAdjustmentRow[];
  metrics: Record<string, number | null>;
  pnlData: PnlPeriod[];
  goNoGoResult: GoNoGoResult;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const pct = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function fmtCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return usd.format(value);
}

function fmtPercent(value: number | null | undefined): string {
  if (value == null) return "—";
  return pct.format(value);
}

function fmtRatio(value: number | null | undefined, decimals = 1): string {
  if (value == null) return "—";
  return `${value.toFixed(decimals)}x`;
}

function fmtMonths(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${Math.round(value)} mo`;
}

function formatStage(stage: string | null): string {
  if (!stage) return "—";
  const map: Record<string, string> = {
    pre_seed: "Pre-Seed",
    seed: "Seed",
    series_a: "Series A",
    series_b: "Series B",
    series_c: "Series C",
    growth: "Growth",
    public: "Public",
  };
  return map[stage] ?? stage;
}

/** Abbreviated period label: "2024-01-01" -> "Jan 2024" */
function fmtPeriod(period: string): string {
  try {
    const d = new Date(period + "T00:00:00");
    return d.toLocaleString("en-US", { month: "short", year: "numeric" });
  } catch {
    return period;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Section wrapper card — consistent styling for every report section. */
function ReportSection({
  index,
  children,
}: {
  index: number;
  children: React.ReactNode;
}) {
  const section = FDD_REPORT_SECTIONS[index];
  return (
    <Card className="print:shadow-none print:border print:border-gray-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-baseline gap-2 text-base">
          <span className="text-muted-foreground font-normal text-sm">
            {index + 1}.
          </span>
          {section.label}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{section.description}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Severity badge using SEVERITY_CONFIG colors. */
function SeverityBadge({ severity }: { severity: string }) {
  const config =
    SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG] ??
    SEVERITY_CONFIG.observation;
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium"
      style={{
        color: config.color,
        backgroundColor: config.bgColor,
        border: `1px solid ${config.borderColor}`,
      }}
    >
      {config.label}
    </span>
  );
}

/** Risk rating badge for the executive summary. */
function RiskRatingBadge({ rating }: { rating: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    Low: { bg: "#dcfce7", text: "#166534" },
    Medium: { bg: "#fef9c3", text: "#854d0e" },
    High: { bg: "#fee2e2", text: "#991b1b" },
  };
  const c = colors[rating] ?? colors.Medium;
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {rating} Risk
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FDDReportClient({
  company,
  readinessScore,
  findings,
  detectedFindings,
  qoeAdjustments,
  metrics,
  pnlData,
  goNoGoResult,
}: FDDReportClientProps) {
  const generatedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // All open manual findings sorted by severity priority
  const severityOrder: Record<string, number> = {
    critical: 0,
    significant: 1,
    moderate: 2,
    observation: 3,
  };
  const openFindings = findings
    .filter((f) => !f.resolved)
    .sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

  // Top 5 findings for executive summary (manual first, then detected)
  const allFindingsSorted = [
    ...openFindings,
    ...detectedFindings.map((d) => ({
      id: `detected-${d.title}`,
      title: d.title,
      severity: d.severity,
      category: d.category,
      description: d.description,
      impact: d.impact,
      recommendation: d.recommendation,
    })),
  ].slice(0, 5);

  // P&L computed columns
  const pnlWithGrossProfit = pnlData.map((r) => ({
    ...r,
    grossProfit: r.revenue - r.cogs,
  }));

  // MoM revenue growth
  const revenueGrowth = pnlData.map((r, i) => {
    if (i === 0) return null;
    const prev = pnlData[i - 1].revenue;
    if (prev === 0) return null;
    return (r.revenue - prev) / prev;
  });

  // QoE total net impact
  const totalQoeImpact = qoeAdjustments.reduce((sum, a) => sum + (a.amount ?? 0), 0);

  // Findings grouped by severity for Section 10
  type AnyFinding = DDFindingRow | (DetectedFinding & { id?: string });
  const findingsBySeverity: Record<string, AnyFinding[]> = {
    critical: [],
    significant: [],
    moderate: [],
    observation: [],
  };
  for (const f of openFindings) {
    findingsBySeverity[f.severity]?.push(f);
  }
  for (const f of detectedFindings) {
    findingsBySeverity[f.severity]?.push({ ...f, id: undefined });
  }

  return (
    <>
      {/* Print-specific styles injected via a style tag */}
      <style>{`
        @media print {
          body > *:not(.fdd-report-root) { display: none !important; }
          nav, header, aside, [data-sidebar], [data-topbar] { display: none !important; }
          .print-hide { display: none !important; }
          .fdd-report-root { padding: 0; }
        }
      `}</style>

      <div className="fdd-report-root space-y-4">

        {/* ── Section 1: Executive Summary ─────────────────────────────────── */}
        <ReportSection index={0}>
          <div className="space-y-5">
            {/* Risk rating + recommendation */}
            <div className="flex flex-wrap items-center gap-3">
              <RiskRatingBadge rating={goNoGoResult.riskRating} />
              <Badge
                variant={
                  goNoGoResult.recommendation === "Proceed"
                    ? "default"
                    : goNoGoResult.recommendation === "Do Not Proceed"
                      ? "destructive"
                      : "secondary"
                }
                className="text-sm px-3 py-1"
              >
                {goNoGoResult.recommendation}
              </Badge>
            </div>

            {/* Finding counts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Critical", count: goNoGoResult.criticalCount, severity: "critical" },
                { label: "Significant", count: goNoGoResult.significantCount, severity: "significant" },
                { label: "Moderate", count: goNoGoResult.moderateCount, severity: "moderate" },
                { label: "Observation", count: goNoGoResult.observationCount, severity: "observation" },
              ].map(({ label, count, severity }) => {
                const config = SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG];
                return (
                  <div
                    key={severity}
                    className="rounded-lg p-3 text-center"
                    style={{ backgroundColor: config.bgColor, border: `1px solid ${config.borderColor}` }}
                  >
                    <p
                      className="text-2xl font-bold tabular-nums"
                      style={{ color: config.color }}
                    >
                      {count}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: config.color }}>
                      {label}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Top 5 findings */}
            {allFindingsSorted.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Top Findings</h4>
                <ul className="space-y-2">
                  {allFindingsSorted.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <SeverityBadge severity={f.severity} />
                      <span className="text-foreground">{f.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Key financial highlights */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Key Financial Highlights</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "ARR", value: fmtCurrency(metrics["arr"]) },
                  { label: "MRR", value: fmtCurrency(metrics["mrr"]) },
                  { label: "Monthly Burn", value: fmtCurrency(metrics["monthly_burn_rate"] ?? metrics["burn_rate"]) },
                  { label: "Runway", value: fmtMonths(metrics["runway_months"]) },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg border bg-slate-50 p-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-base font-semibold tabular-nums mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Readiness score */}
            {readinessScore !== null && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Diligence Readiness Score:</span>
                <span className="font-semibold">{readinessScore} / 100</span>
              </div>
            )}
          </div>
        </ReportSection>

        {/* ── Section 2: Company Background ────────────────────────────────── */}
        <ReportSection index={1}>
          <div className="space-y-3">
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Company Name</dt>
                <dd className="font-medium mt-0.5">{company.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Industry</dt>
                <dd className="font-medium mt-0.5">{company.industry ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Stage</dt>
                <dd className="font-medium mt-0.5">{formatStage(company.stage)}</dd>
              </div>
            </dl>
            <p className="text-sm text-muted-foreground italic border-l-2 border-slate-200 pl-3">
              This section should be customized with additional company details including
              corporate history, ownership structure, key products/services, and business model.
            </p>
          </div>
        </ReportSection>

        {/* ── Section 3: Financial Analysis ────────────────────────────────── */}
        <ReportSection index={2}>
          {pnlWithGrossProfit.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Period</th>
                    <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Revenue</th>
                    <th className="text-right py-2 px-3 font-semibold text-muted-foreground">COGS</th>
                    <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Gross Profit</th>
                    <th className="text-right py-2 px-3 font-semibold text-muted-foreground">OpEx</th>
                    <th className="text-right py-2 px-3 font-semibold text-muted-foreground">EBITDA</th>
                    <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Net Income</th>
                  </tr>
                </thead>
                <tbody>
                  {pnlWithGrossProfit.map((row, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-slate-50/50">
                      <td className="py-2 px-3 font-medium">{fmtPeriod(row.period)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmtCurrency(row.revenue)}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{fmtCurrency(row.cogs)}</td>
                      <td className="py-2 px-3 text-right tabular-nums font-medium">{fmtCurrency(row.grossProfit)}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{fmtCurrency(row.opex)}</td>
                      <td
                        className="py-2 px-3 text-right tabular-nums font-medium"
                        style={{ color: row.ebitda >= 0 ? "#166534" : "#991b1b" }}
                      >
                        {fmtCurrency(row.ebitda)}
                      </td>
                      <td
                        className="py-2 px-3 text-right tabular-nums font-medium"
                        style={{ color: row.netIncome >= 0 ? "#166534" : "#991b1b" }}
                      >
                        {fmtCurrency(row.netIncome)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {pnlWithGrossProfit.length > 1 && (
                  <tfoot>
                    <tr className="border-t-2 bg-slate-50 font-semibold">
                      <td className="py-2 px-3">Trailing 12M Total</td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        {fmtCurrency(pnlWithGrossProfit.reduce((s, r) => s + r.revenue, 0))}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        {fmtCurrency(pnlWithGrossProfit.reduce((s, r) => s + r.cogs, 0))}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        {fmtCurrency(pnlWithGrossProfit.reduce((s, r) => s + r.grossProfit, 0))}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        {fmtCurrency(pnlWithGrossProfit.reduce((s, r) => s + r.opex, 0))}
                      </td>
                      <td
                        className="py-2 px-3 text-right tabular-nums"
                        style={{
                          color:
                            pnlWithGrossProfit.reduce((s, r) => s + r.ebitda, 0) >= 0
                              ? "#166534"
                              : "#991b1b",
                        }}
                      >
                        {fmtCurrency(pnlWithGrossProfit.reduce((s, r) => s + r.ebitda, 0))}
                      </td>
                      <td
                        className="py-2 px-3 text-right tabular-nums"
                        style={{
                          color:
                            pnlWithGrossProfit.reduce((s, r) => s + r.netIncome, 0) >= 0
                              ? "#166534"
                              : "#991b1b",
                        }}
                      >
                        {fmtCurrency(pnlWithGrossProfit.reduce((s, r) => s + r.netIncome, 0))}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No financial data available for the trailing 12 months. Import financial statements to populate this section.
            </p>
          )}
        </ReportSection>

        {/* ── Section 4: Revenue Analysis ──────────────────────────────────── */}
        <ReportSection index={3}>
          <div className="space-y-4">
            {pnlData.length > 1 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Period</th>
                      <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Revenue</th>
                      <th className="text-right py-2 px-3 font-semibold text-muted-foreground">MoM Growth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pnlData.map((row, i) => {
                      const growth = revenueGrowth[i];
                      return (
                        <tr key={i} className="border-b last:border-0 hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-medium">{fmtPeriod(row.period)}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{fmtCurrency(row.revenue)}</td>
                          <td
                            className="py-2 px-3 text-right tabular-nums"
                            style={
                              growth == null
                                ? {}
                                : { color: growth >= 0 ? "#166534" : "#991b1b" }
                            }
                          >
                            {growth == null ? "—" : fmtPercent(growth)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Insufficient revenue data to show trend. At least 2 months of data required.
              </p>
            )}

            {/* NDR / GRR */}
            {(metrics["net_dollar_retention"] != null || metrics["gross_revenue_retention"] != null) && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                {metrics["net_dollar_retention"] != null && (
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <p className="text-xs text-muted-foreground">Net Dollar Retention (NDR)</p>
                    <p className="text-base font-semibold tabular-nums mt-0.5">
                      {fmtPercent(metrics["net_dollar_retention"])}
                    </p>
                  </div>
                )}
                {metrics["gross_revenue_retention"] != null && (
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <p className="text-xs text-muted-foreground">Gross Revenue Retention (GRR)</p>
                    <p className="text-base font-semibold tabular-nums mt-0.5">
                      {fmtPercent(metrics["gross_revenue_retention"])}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </ReportSection>

        {/* ── Section 5: Cost Structure ─────────────────────────────────────── */}
        <ReportSection index={4}>
          <div className="space-y-4">
            {pnlData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Period</th>
                      <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Revenue</th>
                      <th className="text-right py-2 px-3 font-semibold text-muted-foreground">COGS</th>
                      <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Gross Margin</th>
                      <th className="text-right py-2 px-3 font-semibold text-muted-foreground">OpEx</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pnlData.map((row, i) => {
                      const gm = row.revenue > 0 ? (row.revenue - row.cogs) / row.revenue : null;
                      return (
                        <tr key={i} className="border-b last:border-0 hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-medium">{fmtPeriod(row.period)}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{fmtCurrency(row.revenue)}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{fmtCurrency(row.cogs)}</td>
                          <td
                            className="py-2 px-3 text-right tabular-nums font-medium"
                            style={
                              gm == null
                                ? {}
                                : { color: gm >= 0.7 ? "#166534" : gm >= 0.5 ? "#854d0e" : "#991b1b" }
                            }
                          >
                            {fmtPercent(gm)}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{fmtCurrency(row.opex)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No cost data available. Import financial statements to populate this section.
              </p>
            )}

            {metrics["gross_margin_pct"] != null && (
              <div className="rounded-lg border bg-slate-50 p-3 inline-block">
                <p className="text-xs text-muted-foreground">Latest Gross Margin (from metrics)</p>
                <p className="text-base font-semibold tabular-nums mt-0.5">
                  {fmtPercent(metrics["gross_margin_pct"])}
                </p>
              </div>
            )}
          </div>
        </ReportSection>

        {/* ── Section 6: Cash Flow & Runway ────────────────────────────────── */}
        <ReportSection index={5}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border bg-slate-50 p-3">
                <p className="text-xs text-muted-foreground">Monthly Burn Rate</p>
                <p className="text-base font-semibold tabular-nums mt-0.5">
                  {fmtCurrency(metrics["monthly_burn_rate"] ?? metrics["burn_rate"])}
                </p>
              </div>
              <div className="rounded-lg border bg-slate-50 p-3">
                <p className="text-xs text-muted-foreground">Runway</p>
                <p className="text-base font-semibold tabular-nums mt-0.5">
                  {fmtMonths(metrics["runway_months"])}
                </p>
              </div>
              {qoeAdjustments.length > 0 && (
                <div className="rounded-lg border bg-slate-50 p-3">
                  <p className="text-xs text-muted-foreground">QoE Net EBITDA Adjustment</p>
                  <p
                    className="text-base font-semibold tabular-nums mt-0.5"
                    style={{ color: totalQoeImpact >= 0 ? "#166534" : "#991b1b" }}
                  >
                    {fmtCurrency(totalQoeImpact)}
                  </p>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground italic border-l-2 border-slate-200 pl-3">
              A 13-week cash forecast should be provided separately by the company as part of the data room.
            </p>
          </div>
        </ReportSection>

        {/* ── Section 7: Unit Economics ────────────────────────────────────── */}
        <ReportSection index={6}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "CAC",
                value: fmtCurrency(metrics["cac"]),
              },
              {
                label: "LTV",
                value: fmtCurrency(metrics["ltv"]),
              },
              {
                label: "LTV:CAC",
                value: fmtRatio(metrics["ltv_cac_ratio"]),
              },
              {
                label: "CAC Payback",
                value: fmtMonths(metrics["payback_period_months"]),
              },
              {
                label: "Burn Multiple",
                value: fmtRatio(metrics["burn_multiple"]),
              },
              {
                label: "Magic Number",
                value: fmtRatio(metrics["magic_number"], 2),
              },
              {
                label: "Rule of 40",
                value: metrics["rule_of_40"] != null ? `${(metrics["rule_of_40"]! * 100).toFixed(0)}` : "—",
              },
              {
                label: "MRR Growth",
                value: fmtPercent(metrics["mrr_growth_rate"]),
              },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border bg-slate-50 p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-base font-semibold tabular-nums mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </ReportSection>

        {/* ── Section 8: Tax Review ─────────────────────────────────────────── */}
        <ReportSection index={7}>
          <p className="text-sm text-muted-foreground italic border-l-2 border-slate-200 pl-3">
            Tax review requires manual input from tax advisors. Topics to cover include federal
            and state income tax filings, sales tax compliance by jurisdiction, R&amp;D tax
            credit studies, NOL carryforwards, and any open tax examinations or exposures.
          </p>
        </ReportSection>

        {/* ── Section 9: Cap Table & Equity ────────────────────────────────── */}
        <ReportSection index={8}>
          <p className="text-sm text-muted-foreground italic border-l-2 border-slate-200 pl-3">
            Cap table review requires data from Carta, Pulley, or equivalent equity management
            platform. Topics to cover include fully diluted ownership, option pool size and
            vesting schedules, 409A valuation, any convertible instruments (SAFEs, notes),
            and anti-dilution provisions.
          </p>
        </ReportSection>

        {/* ── Section 10: Risk Assessment & Recommendations ────────────────── */}
        <ReportSection index={9}>
          <div className="space-y-5">
            {/* Summary counts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(["critical", "significant", "moderate", "observation"] as const).map((sev) => {
                const config = SEVERITY_CONFIG[sev];
                const count = findingsBySeverity[sev]?.length ?? 0;
                return (
                  <div
                    key={sev}
                    className="rounded-lg p-3 text-center"
                    style={{
                      backgroundColor: config.bgColor,
                      border: `1px solid ${config.borderColor}`,
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

            {/* All findings grouped by severity */}
            {(["critical", "significant", "moderate", "observation"] as const).map((sev) => {
              const items = findingsBySeverity[sev] ?? [];
              if (items.length === 0) return null;
              const config = SEVERITY_CONFIG[sev];
              return (
                <div key={sev}>
                  <h4
                    className="text-sm font-semibold mb-2 pb-1 border-b"
                    style={{ color: config.color, borderColor: config.borderColor }}
                  >
                    {config.label} Findings ({items.length})
                  </h4>
                  <div className="space-y-3">
                    {items.map((f, i) => (
                      <div
                        key={i}
                        className="rounded-lg p-3 text-sm space-y-1"
                        style={{
                          backgroundColor: config.bgColor,
                          border: `1px solid ${config.borderColor}`,
                        }}
                      >
                        <p className="font-semibold">{f.title}</p>
                        {f.description && (
                          <p className="text-muted-foreground">{f.description}</p>
                        )}
                        {f.impact && (
                          <p>
                            <span className="font-medium">Impact: </span>
                            {f.impact}
                          </p>
                        )}
                        {f.recommendation && (
                          <p>
                            <span className="font-medium">Recommendation: </span>
                            {f.recommendation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Conditions for proceeding */}
            {goNoGoResult.recommendation === "Proceed with Conditions" &&
              findingsBySeverity["significant"].length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <h4 className="text-sm font-semibold text-amber-800 mb-2">
                    Conditions for Proceeding
                  </h4>
                  <p className="text-sm text-amber-700 mb-2">
                    The following significant findings must be addressed before closing:
                  </p>
                  <ul className="space-y-1">
                    {findingsBySeverity["significant"].map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                        <span className="mt-1">•</span>
                        <span>
                          <span className="font-medium">{f.title}</span>
                          {f.recommendation && ` — ${f.recommendation}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {openFindings.length === 0 && detectedFindings.length === 0 && (
              <p className="text-sm text-muted-foreground italic">
                No findings logged. Run the readiness assessment and add manual findings to populate this section.
              </p>
            )}
          </div>
        </ReportSection>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Generated on {generatedDate} &middot; ShardCFO Financial Due Diligence Report
          </p>
          <Button
            variant="outline"
            size="sm"
            className="print-hide flex items-center gap-2"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" />
            Print Report
          </Button>
        </div>
      </div>
    </>
  );
}
