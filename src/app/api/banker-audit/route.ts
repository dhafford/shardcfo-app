/**
 * POST /api/banker-audit
 *
 * Accepts an Excel file (multipart/form-data) and runs the full
 * Banker Bible audit (Sections A–D). Returns the structured
 * AuditReport as JSON.
 *
 * Usage from frontend:
 *   const formData = new FormData();
 *   formData.append("file", xlsxBlob, "model.xlsx");
 *   const res = await fetch("/api/banker-audit", { method: "POST", body: formData });
 *   const report = await res.json();
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/require-auth";
import ExcelJS from "exceljs";
import { auditWorkbook } from "@/lib/forge/banker-audit";

export async function POST(request: NextRequest) {
  try {
    try {
      await requireAuth({ redirect: false });
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "file is required (multipart/form-data with .xlsx)" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuffer as ArrayBuffer);

    const report = auditWorkbook(wb);

    return NextResponse.json({
      ...report,
      clientReady: report.sectionAPass,
      summary: `${report.totalPassed}/${report.total} checks passed (${Math.round(report.scorePct)}%). Section A: ${report.sectionAPass ? "PASS" : "FAIL"}`,
    });
  } catch (error) {
    console.error("Banker audit error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
