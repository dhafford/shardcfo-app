/**
 * Banker Bible Audit — validates Excel workbook output against the full
 * quality rubric from banker_bible.md (Sections A–D).
 *
 * This runs server-side against an ExcelJS Workbook object BEFORE the
 * buffer is sent to the client. It returns a structured AuditReport
 * that can be displayed in the UI or used to gate downloads.
 *
 * Ported from promptforge/banker_audit.py with TypeScript adaptations.
 */

import ExcelJS from "exceljs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditResult {
  checkId: string;
  section: "A" | "B" | "C" | "D";
  passed: boolean;
  description: string;
  details?: string;
  gating: boolean; // true = Section A (must pass)
}

export interface AuditReport {
  results: AuditResult[];
  sectionAPass: boolean;
  totalPassed: number;
  total: number;
  scorePct: number;
  sectionAFailures: AuditResult[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isFormula(val: unknown): val is { formula: string } {
  return (
    typeof val === "object" &&
    val !== null &&
    "formula" in val &&
    typeof (val as { formula: string }).formula === "string"
  );
}

function getFormula(cell: ExcelJS.Cell): string | null {
  const val = cell.value;
  if (isFormula(val)) return val.formula;
  if (typeof val === "string" && val.startsWith("=")) return val.slice(1);
  return null;
}

function getCellText(cell: ExcelJS.Cell): string {
  const val = cell.value;
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  if (isFormula(val)) return `=${val.formula}`;
  return String(val);
}

function isCrossSheet(formula: string): boolean {
  return formula.includes("!");
}

// ---------------------------------------------------------------------------
// Main audit function
// ---------------------------------------------------------------------------

export function auditWorkbook(wb: ExcelJS.Workbook): AuditReport {
  const results: AuditResult[] = [];
  const sheetNames = wb.worksheets.map((ws) => ws.name);

  // ====================================================================
  // SECTION A — GATING (pass/fail)
  // ====================================================================

  // A1: Balance Sheet Integrity Checks
  const checksSheet = wb.getWorksheet("Checks");
  if (checksSheet) {
    const labels: string[] = [];
    checksSheet.eachRow((row) => {
      const label = getCellText(row.getCell(1));
      if (label) labels.push(label);
    });

    const hasBsCheck = labels.some(
      (l) => l.includes("BS Balance") || l.toLowerCase().includes("balance")
    );
    const hasCashCheck = labels.some(
      (l) => l.includes("Cash Tie") || l.toLowerCase().includes("cash tie")
    );
    const hasReCheck = labels.some((l) => l.includes("RE") || l.includes("Retained"));
    const hasCfsCheck = labels.some(
      (l) => l.includes("Net Change") || l.includes("CFO+CFI")
    );

    results.push({
      checkId: "A1.1",
      section: "A",
      gating: true,
      passed: hasBsCheck,
      description: "BS balance check formula present",
      details: hasBsCheck ? undefined : "Missing BS balance check in Checks tab",
    });
    results.push({
      checkId: "A1.2",
      section: "A",
      gating: true,
      passed: hasCashCheck,
      description: "Cash tie-out check formula present",
    });
    results.push({
      checkId: "A1.3",
      section: "A",
      gating: true,
      passed: hasReCheck,
      description: "RE continuity check formula present",
    });
    results.push({
      checkId: "A1.4",
      section: "A",
      gating: true,
      passed: hasCfsCheck,
      description: "CFS reconciliation check formula present",
    });
  } else {
    results.push({
      checkId: "A1",
      section: "A",
      gating: true,
      passed: false,
      description: "Integrity checks tab present",
      details: "No 'Checks' tab found",
    });
  }

  // A1.5: Balance Check row on BS
  const bsSheet = wb.getWorksheet("Balance Sheet");
  if (bsSheet) {
    let hasBalanceCheckRow = false;
    bsSheet.eachRow((row) => {
      const label = getCellText(row.getCell(1)).toLowerCase();
      if (label.includes("balance check")) {
        for (let c = 3; c <= Math.min(10, row.cellCount); c++) {
          const f = getFormula(row.getCell(c));
          if (f) {
            hasBalanceCheckRow = true;
            break;
          }
        }
      }
    });
    results.push({
      checkId: "A1.5",
      section: "A",
      gating: true,
      passed: hasBalanceCheckRow,
      description: "Balance Check row on BS with formula",
    });
  }

  // A2: No Excel Errors
  let errorCount = 0;
  const errorCells: string[] = [];
  let unprotectedDivs = 0;

  for (const ws of wb.worksheets) {
    ws.eachRow((row, rowNum) => {
      row.eachCell((cell, colNum) => {
        const text = getCellText(cell);
        // Check for error values
        if (typeof cell.value === "object" && cell.value !== null && "error" in cell.value) {
          errorCount++;
          errorCells.push(`${ws.name}!${cell.address}`);
        }
        // Check for unprotected division
        const formula = getFormula(cell);
        if (formula && formula.includes("/") && !formula.includes("IF(") && !formula.includes("IFERROR(")) {
          unprotectedDivs++;
        }
      });
    });
  }

  results.push({
    checkId: "A2.1",
    section: "A",
    gating: true,
    passed: errorCount === 0,
    description: "No visible Excel error codes",
    details: errorCount > 0 ? `${errorCount} errors: ${errorCells.slice(0, 3).join(", ")}` : undefined,
  });
  results.push({
    checkId: "A2.2",
    section: "A",
    gating: true,
    passed: unprotectedDivs === 0,
    description: "All division formulas wrapped in IFERROR/IF",
    details: unprotectedDivs > 0 ? `${unprotectedDivs} unprotected divisions` : undefined,
  });

  // A3: Circular Reference Management
  const isSheet = wb.getWorksheet("Income Statement");
  let interestManaged = false;
  if (isSheet) {
    isSheet.eachRow((row) => {
      const label = getCellText(row.getCell(1)).toLowerCase();
      if (label.includes("interest") && label.includes("expense")) {
        for (let c = 4; c <= Math.min(10, row.cellCount); c++) {
          const formula = getFormula(row.getCell(c));
          if (formula && (formula.includes("IFERROR") || formula.includes("IF("))) {
            interestManaged = true;
            break;
          }
        }
      }
    });
  }
  results.push({
    checkId: "A3",
    section: "A",
    gating: true,
    passed: interestManaged,
    description: "Interest circularity managed (beginning-balance or IFERROR)",
  });

  // A4: No Hardcoded Constants in Projected Formulas
  let hardcodedCount = 0;
  const allowedNums = new Set(["365", "12", "100", "1000", "2", "4", "0", "1", "3", "0.5"]);
  for (const sheetName of ["Income Statement", "Balance Sheet", "Cash Flow"]) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) continue;
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        const formula = getFormula(cell);
        if (!formula) return;
        // Strip cell references before scanning
        const stripped = formula
          .replace(/'[^']*'![A-Z]+\d+/g, "")
          .replace(/[A-Z]{1,3}\d+/g, "");
        const nums = stripped.match(/\d+\.?\d*/g) || [];
        for (const n of nums) {
          if (!allowedNums.has(n) && parseFloat(n) !== 0) {
            hardcodedCount++;
            break;
          }
        }
      });
    });
  }
  results.push({
    checkId: "A4",
    section: "A",
    gating: true,
    passed: hardcodedCount === 0,
    description: "No material hardcoded constants in projected formulas",
    details: hardcodedCount > 0 ? `${hardcodedCount} formulas with embedded constants` : undefined,
  });

  // A5: Consistent Formulas Across Rows — check structure matches across periods
  let inconsistentRows = 0;
  for (const sheetName of ["Income Statement", "Balance Sheet", "Cash Flow"]) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) continue;
    ws.eachRow((row) => {
      const structures: string[] = [];
      row.eachCell((cell) => {
        const f = getFormula(cell);
        if (f) {
          // Normalize column refs to check structural consistency
          structures.push(f.replace(/[A-Z]+(\d+)/g, "X$1"));
        }
      });
      if (new Set(structures).size > 1 && structures.length >= 2) {
        inconsistentRows++;
      }
    });
  }
  results.push({
    checkId: "A5",
    section: "A",
    gating: true,
    passed: inconsistentRows <= 5,
    description: "Consistent formula structure across time periods",
    details: inconsistentRows > 0 ? `${inconsistentRows} rows with structural inconsistencies` : undefined,
  });

  // A6: Negative Numbers with Parentheses
  let badNegFormats = 0;
  for (const sheetName of ["Income Statement", "Balance Sheet", "Cash Flow"]) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) continue;
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        if (Number(cell.col) === 1) return;
        const fmt = cell.numFmt || "";
        if (fmt && fmt.includes("#") && !fmt.includes("%")) {
          if (fmt.includes("-") && !fmt.includes("(")) {
            badNegFormats++;
          }
        }
      });
    });
  }
  results.push({
    checkId: "A6",
    section: "A",
    gating: true,
    passed: badNegFormats === 0,
    description: "Negative numbers displayed with parentheses",
    details: badNegFormats > 0 ? `${badNegFormats} cells use minus signs` : undefined,
  });

  // A7: No Placeholders
  const scanTerms = ["TBD", "XXX", "PLACEHOLDER", "TODO", "FIXME", "INSERT", "lorem ipsum"];
  let placeholderCount = 0;
  for (const ws of wb.worksheets) {
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        const text = getCellText(cell).toLowerCase();
        if (scanTerms.some((t) => text.includes(t.toLowerCase()))) {
          placeholderCount++;
        }
      });
    });
  }
  results.push({
    checkId: "A7",
    section: "A",
    gating: true,
    passed: placeholderCount === 0,
    description: "No placeholder text or client errors",
    details: placeholderCount > 0 ? `${placeholderCount} placeholder cells found` : undefined,
  });

  // ====================================================================
  // SECTION B — SCORED QUALITY
  // ====================================================================

  // B1: Color Coding (check font colors)
  let blueInputs = 0;
  let greenCross = 0;
  let blackSame = 0;
  for (const sheetName of ["Income Statement", "Balance Sheet", "Cash Flow", "Assumptions"]) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) continue;
    ws.eachRow((row, rowNum) => {
      if (rowNum <= 1) return;
      row.eachCell((cell) => {
        if (Number(cell.col) === 1) return;
        const formula = getFormula(cell);
        const fontColor = (cell.font?.color?.argb || "").slice(-6).toUpperCase();
        if (!formula && fontColor === "0000CC") blueInputs++;
        else if (formula && isCrossSheet(formula) && fontColor === "006100") greenCross++;
        else if (formula && !isCrossSheet(formula) && fontColor === "000000") blackSame++;
      });
    });
  }
  results.push({
    checkId: "B1",
    section: "B",
    gating: false,
    passed: blueInputs + greenCross + blackSame > 20,
    description: `Color coding: ${blueInputs} blue inputs, ${blackSame} black formulas, ${greenCross} green cross-sheet`,
  });

  // B3: Print Hygiene
  let gridlinesOn = 0;
  let badTabs = 0;
  for (const ws of wb.worksheets) {
    const view = ws.views?.[0];
    if (view && view.showGridLines !== false) gridlinesOn++;
    if (["Sheet1", "Sheet2", "Sheet3"].includes(ws.name)) badTabs++;
  }
  results.push({
    checkId: "B3.1",
    section: "B",
    gating: false,
    passed: gridlinesOn === 0,
    description: "Gridlines hidden on all tabs",
    details: gridlinesOn > 0 ? `${gridlinesOn} tabs with visible gridlines` : undefined,
  });
  results.push({
    checkId: "B3.3",
    section: "B",
    gating: false,
    passed: badTabs === 0,
    description: "No default tab names",
  });

  // B4: Tab order
  const expectedOrder = ["assumption", "revenue", "expense", "income", "balance", "cash", "metric", "check"];
  let lastIdx = -1;
  let orderOk = true;
  for (const keyword of expectedOrder) {
    const idx = sheetNames.findIndex((s) => s.toLowerCase().includes(keyword));
    if (idx !== -1) {
      if (idx < lastIdx) orderOk = false;
      lastIdx = idx;
    }
  }
  results.push({
    checkId: "B4",
    section: "B",
    gating: false,
    passed: orderOk,
    description: "Tabs logically ordered (Assumptions → Statements → Metrics → Checks)",
  });

  // B5: RE Roll-forward
  let hasReRollforward = false;
  if (bsSheet) {
    bsSheet.eachRow((row) => {
      const label = getCellText(row.getCell(1)).toLowerCase();
      if (label.includes("retained")) {
        for (let c = 4; c <= Math.min(10, row.cellCount); c++) {
          const f = getFormula(row.getCell(c));
          if (f && f.includes("Income Statement")) {
            hasReRollforward = true;
            break;
          }
        }
      }
    });
  }
  results.push({
    checkId: "B5",
    section: "B",
    gating: false,
    passed: hasReRollforward,
    description: "Retained earnings uses roll-forward formula",
  });

  // ====================================================================
  // SECTION C — 3-STATEMENT SPECIFIC
  // ====================================================================

  const linkages: Record<string, boolean> = {
    "NI → CFS": false,
    "D&A → CFS": false,
    "WC → CFS": false,
    "Cash → BS": false,
  };

  const cfsSheet = wb.getWorksheet("Cash Flow");
  if (cfsSheet) {
    cfsSheet.eachRow((row) => {
      const label = getCellText(row.getCell(1)).toLowerCase();
      for (let c = 4; c <= Math.min(10, row.cellCount); c++) {
        const f = getFormula(row.getCell(c));
        if (!f) continue;
        if (label.includes("net income") && f.includes("Income Statement")) linkages["NI → CFS"] = true;
        if (label.includes("depreciation") && f.includes("Income Statement")) linkages["D&A → CFS"] = true;
        if (label.includes("receivable") && f.includes("Balance Sheet")) linkages["WC → CFS"] = true;
        break;
      }
    });
  }
  if (bsSheet) {
    bsSheet.eachRow((row) => {
      const label = getCellText(row.getCell(1)).toLowerCase();
      if (label.includes("cash") && !label.includes("total")) {
        for (let c = 4; c <= Math.min(10, row.cellCount); c++) {
          const f = getFormula(row.getCell(c));
          if (f && f.includes("Cash Flow")) {
            linkages["Cash → BS"] = true;
            break;
          }
        }
      }
    });
  }

  for (const [name, found] of Object.entries(linkages)) {
    results.push({
      checkId: `C1.${name}`,
      section: "C",
      gating: false,
      passed: found,
      description: `Cross-sheet formula linkage: ${name}`,
    });
  }

  // C1.WC: Working capital driven by Assumptions
  let wcByDrivers = false;
  if (bsSheet) {
    bsSheet.eachRow((row) => {
      const label = getCellText(row.getCell(1)).toLowerCase();
      if (label.includes("receivable") || label.includes("payable")) {
        for (let c = 3; c <= Math.min(10, row.cellCount); c++) {
          const f = getFormula(row.getCell(c));
          if (f && f.includes("Assumptions")) {
            wcByDrivers = true;
            return;
          }
        }
      }
    });
  }
  results.push({
    checkId: "C1.WC",
    section: "C",
    gating: false,
    passed: wcByDrivers,
    description: "Working capital driven by DSO/DIO/DPO from Assumptions tab",
  });

  // ====================================================================
  // SECTION D — AI-SPECIFIC
  // ====================================================================

  // D4: Placeholder Scan (aggressive)
  let aiPlaceholders = 0;
  const suspiciousTerms = ["assume", "example", "placeholder", "generic", "typical"];
  for (const ws of wb.worksheets) {
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        const text = getCellText(cell).toLowerCase();
        if (text.length > 5 && suspiciousTerms.some((t) => text.includes(t))) {
          aiPlaceholders++;
        }
      });
    });
  }
  results.push({
    checkId: "D4",
    section: "D",
    gating: false,
    passed: aiPlaceholders === 0,
    description: "No AI placeholder or generic text",
    details: aiPlaceholders > 0 ? `${aiPlaceholders} suspicious cells` : undefined,
  });

  // D5: Inter-tab links are formulas
  let crossSheetFormulas = 0;
  for (const sheetName of ["Income Statement", "Balance Sheet", "Cash Flow"]) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) continue;
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        const f = getFormula(cell);
        if (f && isCrossSheet(f)) crossSheetFormulas++;
      });
    });
  }
  results.push({
    checkId: "D5",
    section: "D",
    gating: false,
    passed: crossSheetFormulas > 10,
    description: `Inter-tab links are formula references (${crossSheetFormulas} cross-sheet formulas)`,
  });

  // D1: Propagation — Assumptions tab is referenced
  let assumptionsReferenced = false;
  for (const sheetName of ["Income Statement", "Balance Sheet", "Cash Flow"]) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) continue;
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        const f = getFormula(cell);
        if (f && f.includes("Assumptions")) assumptionsReferenced = true;
      });
    });
    if (assumptionsReferenced) break;
  }
  results.push({
    checkId: "D1",
    section: "D",
    gating: false,
    passed: assumptionsReferenced,
    description: "Assumptions tab drives projected values (propagation chain exists)",
  });

  // ====================================================================
  // Build report
  // ====================================================================

  const sectionAResults = results.filter((r) => r.gating);
  const sectionAPass = sectionAResults.every((r) => r.passed);
  const totalPassed = results.filter((r) => r.passed).length;

  return {
    results,
    sectionAPass,
    totalPassed,
    total: results.length,
    scorePct: results.length > 0 ? (totalPassed / results.length) * 100 : 0,
    sectionAFailures: sectionAResults.filter((r) => !r.passed),
  };
}
