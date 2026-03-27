import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/require-auth";
import ExcelJS from "exceljs";
import {
  buildProjectionWorkbook,
  buildScenarioWorkbook,
} from "@/lib/export/xlsx-builder";
import { auditWorkbook } from "@/lib/forge/banker-audit";
import type { AuditReport } from "@/lib/forge/banker-audit";
import type {
  HistoricalYear,
  ProjectedYear,
  ProjectionAssumptions,
  ScenarioProjection,
  ScenarioAssumptions,
} from "@/lib/export/xlsx-builder";

interface ExportRequest {
  type: "projection" | "scenario";
  companyId: string;
  // For projections:
  historicals?: HistoricalYear[];
  projected?: ProjectedYear[];
  assumptions?: ProjectionAssumptions;
  companyName?: string;
  revenueMethods?: string[];
  methodInputs?: Record<string, number>;
  activeExpenses?: string[];
  // For scenarios:
  projection?: ScenarioProjection;
  scenarioAssumptions?: ScenarioAssumptions;
  scenarioName?: string;
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9 \-_]/g, "")
    .trim()
    .slice(0, 100) || "export";
}

export async function POST(request: NextRequest) {
  try {
    try {
      await requireAuth({ redirect: false });
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: ExportRequest = await request.json();
    const { type } = body;

    if (!type || !body.companyId) {
      return NextResponse.json(
        { error: "type and companyId are required" },
        { status: 400 }
      );
    }

    let buffer: Buffer;
    let filename: string;

    if (type === "projection") {
      const { historicals = [], projected = [], assumptions, companyName } = body;
      if (!assumptions) {
        return NextResponse.json({ error: "assumptions required for projection export" }, { status: 400 });
      }
      buffer = await buildProjectionWorkbook(
        historicals,
        projected,
        assumptions,
        companyName ?? "Company",
        body.revenueMethods,
        body.methodInputs,
        body.activeExpenses,
      );
      filename = sanitizeFilename(
        companyName ? `${companyName} Projection` : "projection"
      );
    } else if (type === "scenario") {
      const { projection, scenarioAssumptions, scenarioName } = body;
      if (!projection || !scenarioAssumptions) {
        return NextResponse.json({ error: "projection and assumptions required for scenario export" }, { status: 400 });
      }
      buffer = await buildScenarioWorkbook(
        projection,
        scenarioAssumptions,
        scenarioName ?? "Scenario"
      );
      filename = sanitizeFilename(scenarioName ?? "scenario");
    } else {
      return NextResponse.json(
        { error: `Unknown export type: ${type}` },
        { status: 400 }
      );
    }

    // Run Banker Bible audit on the generated workbook
    let auditReport: AuditReport | null = null;
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as unknown as ArrayBuffer);
      auditReport = auditWorkbook(wb);
      console.log(
        `[BANKER AUDIT] ${filename}: ${auditReport.totalPassed}/${auditReport.total} (${Math.round(auditReport.scorePct)}%) | Section A: ${auditReport.sectionAPass ? "PASS" : "FAIL"}`
      );
      if (!auditReport.sectionAPass) {
        console.warn(
          `[BANKER AUDIT] Section A failures:`,
          auditReport.sectionAFailures.map((r) => `${r.checkId}: ${r.description}`),
        );
      }
    } catch (auditErr) {
      console.error("[BANKER AUDIT] Audit failed:", auditErr);
    }

    // Serialize audit details for frontend (compact: only failures + summary)
    const auditDetailsJson = auditReport
      ? JSON.stringify({
          passed: auditReport.totalPassed,
          total: auditReport.total,
          pct: Math.round(auditReport.scorePct),
          sectionAPass: auditReport.sectionAPass,
          failures: auditReport.results
            .filter((r) => !r.passed)
            .map((r) => ({ id: r.checkId, s: r.section, g: r.gating, d: r.description, t: r.details })),
        })
      : "";

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
        // Include audit results in response headers for the frontend
        "X-Banker-Audit-Score": auditReport ? `${auditReport.totalPassed}/${auditReport.total}` : "N/A",
        "X-Banker-Audit-Section-A": auditReport ? (auditReport.sectionAPass ? "PASS" : "FAIL") : "N/A",
        "X-Banker-Audit-Pct": auditReport ? `${Math.round(auditReport.scorePct)}` : "0",
        "X-Banker-Audit-Details": auditDetailsJson,
      },
    });
  } catch (error) {
    console.error("XLSX generation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
