/**
 * Banker Bible Audit — validates Excel workbook output against the full
 * quality rubric from banker_bible.md (Sections A–D).
 *
 * This runs server-side against an ExcelJS Workbook object BEFORE the
 * buffer is sent to the client. It returns a structured AuditReport
 * that can be displayed in the UI or used to gate downloads.
 *
 * Ported from promptforge/banker_audit.py with TypeScript adaptations.
 *
 * Coverage:
 *   Section A (gating): A1–A7 (balance, errors, circularity, hardcodes,
 *                        consistency, negatives, placeholders)
 *   Section B (scored):  B1–B5 (colors, formats, hygiene, architecture,
 *                        roll-forwards)
 *   Section C (3-stmt):  C1 full linkage chain, WC drivers
 *   Section D (AI):      D1 propagation, D2 formula coverage, D4 placeholders,
 *                        D5 inter-tab links
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

function getResultValue(cell: ExcelJS.Cell): number | null {
  const val = cell.value;
  if (typeof val === "number") return val;
  if (isFormula(val) && typeof val.result === "number") return val.result;
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

/** Detect projected columns by header labels ending in "E" (e.g., "FY 2025E") */
function findProjectedCols(ws: ExcelJS.Worksheet): { firstProj: number; lastDataCol: number; histCount: number } {
  const headerRow = ws.getRow(1);
  let firstProj = -1;
  let lastDataCol = 1;
  let histCount = 0;

  headerRow.eachCell((cell, colNum) => {
    if (colNum === 1) return;
    const text = getCellText(cell).trim();
    if (!text) return;
    lastDataCol = colNum;
    if (/\d{2,4}E$/i.test(text)) {
      if (firstProj === -1) firstProj = colNum;
    } else {
      histCount++;
    }
  });

  return { firstProj, lastDataCol, histCount };
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
  const bsSheet = wb.getWorksheet("Balance Sheet");
  const isSheet = wb.getWorksheet("Income Statement");
  const cfsSheet = wb.getWorksheet("Cash Flow");

  // A1.1: Balance Check row exists AND value ≈ 0
  if (bsSheet) {
    let hasBalanceCheckRow = false;
    let balanceCheckPasses = true;
    bsSheet.eachRow((row) => {
      const label = getCellText(row.getCell(1)).toLowerCase();
      if (label.includes("balance check")) {
        for (let c = 2; c <= Math.min(20, row.cellCount || 20); c++) {
          const f = getFormula(row.getCell(c));
          if (f) {
            hasBalanceCheckRow = true;
            // Also verify the cached result ≈ 0
            const result = getResultValue(row.getCell(c));
            if (result !== null && Math.abs(result) > 0.01) {
              balanceCheckPasses = false;
            }
          }
        }
      }
    });
    results.push({
      checkId: "A1.1",
      section: "A",
      gating: true,
      passed: hasBalanceCheckRow,
      description: "Balance Check row on BS with formula",
    });
    results.push({
      checkId: "A1.2",
      section: "A",
      gating: true,
      passed: balanceCheckPasses,
      description: "Balance sheet balances in all periods (check ≈ 0)",
      details: !balanceCheckPasses ? "Balance check row has non-zero values" : undefined,
    });
  } else {
    results.push({
      checkId: "A1.1",
      section: "A",
      gating: true,
      passed: false,
      description: "Balance Sheet tab exists",
      details: "No 'Balance Sheet' tab found",
    });
  }

  // A1.3: CFS ending cash = BS cash (formula tie-out)
  {
    let cashTied = false;
    if (bsSheet) {
      bsSheet.eachRow((row) => {
        const label = getCellText(row.getCell(1)).toLowerCase();
        if (label.includes("cash") && !label.includes("total") && !label.includes("change") && !label.includes("check")) {
          for (let c = 3; c <= Math.min(20, row.cellCount || 20); c++) {
            const f = getFormula(row.getCell(c));
            if (f && f.includes("Cash Flow")) {
              cashTied = true;
              break;
            }
          }
        }
      });
    }
    results.push({
      checkId: "A1.3",
      section: "A",
      gating: true,
      passed: cashTied,
      description: "BS Cash references CFS Ending Cash (cash tie-out)",
    });
  }

  // A1.4: CFS Net Income references IS Net Income
  {
    let niTied = false;
    if (cfsSheet) {
      cfsSheet.eachRow((row) => {
        const label = getCellText(row.getCell(1)).toLowerCase();
        if (label.includes("net income")) {
          for (let c = 3; c <= Math.min(20, row.cellCount || 20); c++) {
            const f = getFormula(row.getCell(c));
            if (f && f.includes("Income Statement")) {
              niTied = true;
              break;
            }
          }
        }
      });
    }
    results.push({
      checkId: "A1.4",
      section: "A",
      gating: true,
      passed: niTied,
      description: "CFS Net Income references IS Net Income",
    });
  }

  // A1.5: CFS Beginning Cash T = Ending Cash T-1 (formula references prior col)
  {
    let begCashTied = false;
    if (cfsSheet) {
      cfsSheet.eachRow((row) => {
        const label = getCellText(row.getCell(1)).toLowerCase();
        if (label.includes("beginning cash")) {
          for (let c = 3; c <= Math.min(20, row.cellCount || 20); c++) {
            const f = getFormula(row.getCell(c));
            if (f && f.includes("Balance Sheet")) {
              begCashTied = true;
              break;
            }
          }
        }
      });
    }
    results.push({
      checkId: "A1.5",
      section: "A",
      gating: true,
      passed: begCashTied,
      description: "CFS Beginning Cash references prior period BS Cash",
    });
  }

  // A2: No Excel Errors
  let errorCount = 0;
  const errorCells: string[] = [];
  let unprotectedDivs = 0;

  for (const ws of wb.worksheets) {
    ws.eachRow((row) => {
      row.eachCell((cell) => {
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
  let interestManaged = false;
  if (isSheet) {
    isSheet.eachRow((row) => {
      const label = getCellText(row.getCell(1)).toLowerCase();
      if (label.includes("interest") && label.includes("expense")) {
        for (let c = 4; c <= Math.min(10, row.cellCount || 10); c++) {
          const formula = getFormula(row.getCell(c));
          if (formula) {
            // Interest from Assumptions tab (beginning-balance method) OR wrapped in IF/IFERROR
            if (formula.includes("Assumptions") || formula.includes("IFERROR") || formula.includes("IF(")) {
              interestManaged = true;
              break;
            }
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
  const hardcodedDetails: string[] = [];
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
            if (hardcodedDetails.length < 3) {
              hardcodedDetails.push(`${sheetName}!${cell.address}: "${n}" in formula`);
            }
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
    details: hardcodedCount > 0 ? `${hardcodedCount} formulas with embedded constants: ${hardcodedDetails.join("; ")}` : undefined,
  });

  // A5: Consistent Formulas Across Rows — check structure matches across periods
  let inconsistentRows = 0;
  const inconsistentDetails: string[] = [];
  for (const sheetName of ["Income Statement", "Balance Sheet", "Cash Flow"]) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) continue;
    const { firstProj, lastDataCol } = findProjectedCols(ws);
    if (firstProj < 0) continue;

    ws.eachRow((row, rowNum) => {
      if (rowNum <= 1) return;
      const structures: string[] = [];
      // Only check projected columns (year 2+ since year 1 can differ by design)
      for (let c = firstProj + 1; c <= lastDataCol; c++) {
        const f = getFormula(row.getCell(c));
        if (f) {
          // Normalize column refs to check structural consistency
          structures.push(f.replace(/[A-Z]+(\d+)/g, "X$1").replace(/'[^']*'/g, "'REF'"));
        }
      }
      if (structures.length >= 2 && new Set(structures).size > 1) {
        inconsistentRows++;
        if (inconsistentDetails.length < 2) {
          inconsistentDetails.push(`${sheetName} row ${rowNum}: ${getCellText(row.getCell(1)).trim()}`);
        }
      }
    });
  }
  results.push({
    checkId: "A5",
    section: "A",
    gating: true,
    passed: inconsistentRows <= 3,
    description: "Consistent formula structure across time periods (year 2+)",
    details: inconsistentRows > 0 ? `${inconsistentRows} inconsistent rows: ${inconsistentDetails.join("; ")}` : undefined,
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
  for (const sheetName of ["Income Statement", "Balance Sheet", "Cash Flow", "Basic Assumptions"]) {
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

  // B2: Number Formatting Consistency
  {
    let currencyCells = 0;
    let percentCells = 0;
    let unformattedDataCells = 0;
    for (const sheetName of ["Income Statement", "Balance Sheet", "Cash Flow"]) {
      const ws = wb.getWorksheet(sheetName);
      if (!ws) continue;
      ws.eachRow((row, rowNum) => {
        if (rowNum <= 1) return;
        row.eachCell((cell) => {
          if (Number(cell.col) === 1) return;
          const val = getResultValue(cell) ?? (typeof cell.value === "number" ? cell.value : null);
          if (val === null) return;
          const fmt = cell.numFmt || "";
          if (fmt.includes("#") || fmt.includes("0")) {
            if (fmt.includes("%")) percentCells++;
            else currencyCells++;
          } else if (Math.abs(val) > 0.001) {
            unformattedDataCells++;
          }
        });
      });
    }
    results.push({
      checkId: "B2",
      section: "B",
      gating: false,
      passed: unformattedDataCells === 0,
      description: `Number formatting: ${currencyCells} currency, ${percentCells} percent, ${unformattedDataCells} unformatted`,
      details: unformattedDataCells > 0 ? `${unformattedDataCells} data cells lack number format` : undefined,
    });
  }

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
    checkId: "B3.2",
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

  // B5: Roll-forward Schedules
  {
    let hasReRollforward = false;
    let hasPpeRollforward = false;
    let hasDebtRollforward = false;

    if (bsSheet) {
      bsSheet.eachRow((row) => {
        const label = getCellText(row.getCell(1)).toLowerCase();
        for (let c = 4; c <= Math.min(10, row.cellCount || 10); c++) {
          const f = getFormula(row.getCell(c));
          if (!f) continue;
          // RE = prior + NI - divs
          if (label.includes("retained") && f.includes("Income Statement")) hasReRollforward = true;
          // PPE = prior + capex - depreciation
          if ((label.includes("pp&e") || label.includes("ppe")) && f.includes("Assumptions")) hasPpeRollforward = true;
          // Debt = prior + new - repay
          if (label.includes("long-term debt") && f.includes("Assumptions")) hasDebtRollforward = true;
          break;
        }
      });
    }

    results.push({
      checkId: "B5.1",
      section: "B",
      gating: false,
      passed: hasReRollforward,
      description: "Retained Earnings uses roll-forward (prior + NI − divs)",
    });
    results.push({
      checkId: "B5.2",
      section: "B",
      gating: false,
      passed: hasPpeRollforward,
      description: "PP&E uses roll-forward (prior + capex − D&A)",
    });
    results.push({
      checkId: "B5.3",
      section: "B",
      gating: false,
      passed: hasDebtRollforward,
      description: "Debt schedule uses roll-forward (prior + new − repay)",
    });
  }

  // ====================================================================
  // SECTION C — 3-STATEMENT SPECIFIC
  // ====================================================================

  // C1: Full IS → BS → CFS linkage chain
  const linkages: Record<string, boolean> = {
    "NI → CFS": false,
    "D&A → CFS": false,
    "SBC → CFS": false,
    "WC → CFS": false,
    "Cash → BS": false,
    "CapEx → CFS": false,
  };

  if (cfsSheet) {
    cfsSheet.eachRow((row) => {
      const label = getCellText(row.getCell(1)).toLowerCase();
      for (let c = 4; c <= Math.min(10, row.cellCount || 10); c++) {
        const f = getFormula(row.getCell(c));
        if (!f) continue;
        if (label.includes("net income") && f.includes("Income Statement")) linkages["NI → CFS"] = true;
        if ((label.includes("d&a") || label.includes("depreciation")) && f.includes("Income Statement")) linkages["D&A → CFS"] = true;
        if (label.includes("sbc") && f.includes("Income Statement")) linkages["SBC → CFS"] = true;
        if (label.includes("receivable") && f.includes("Balance Sheet")) linkages["WC → CFS"] = true;
        if (label.includes("capex") && (f.includes("Income Statement") || f.includes("Assumptions") || f.includes("Cost"))) linkages["CapEx → CFS"] = true;
        break;
      }
    });
  }
  if (bsSheet) {
    bsSheet.eachRow((row) => {
      const label = getCellText(row.getCell(1)).toLowerCase();
      if (label.includes("cash") && !label.includes("total") && !label.includes("change") && !label.includes("check")) {
        for (let c = 4; c <= Math.min(20, row.cellCount || 20); c++) {
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
        for (let c = 3; c <= Math.min(10, row.cellCount || 10); c++) {
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
    description: "Working capital driven by DSO/DPO from Assumptions tab",
  });

  // ====================================================================
  // SECTION D — AI-SPECIFIC
  // ====================================================================

  // D1: Propagation — Assumptions tab is referenced from all 3 statements
  {
    const stmtRefs: Record<string, boolean> = {
      "Income Statement": false,
      "Balance Sheet": false,
      "Cash Flow": false,
    };
    for (const sheetName of Object.keys(stmtRefs)) {
      const ws = wb.getWorksheet(sheetName);
      if (!ws) continue;
      ws.eachRow((row) => {
        row.eachCell((cell) => {
          const f = getFormula(cell);
          if (f && f.includes("Assumptions")) stmtRefs[sheetName] = true;
        });
      });
    }
    const allRef = Object.values(stmtRefs).every(Boolean);
    const refCount = Object.values(stmtRefs).filter(Boolean).length;
    results.push({
      checkId: "D1",
      section: "D",
      gating: false,
      passed: allRef,
      description: `Assumptions tab drives all 3 statements (${refCount}/3 reference Assumptions)`,
      details: !allRef
        ? `Missing references: ${Object.entries(stmtRefs).filter(([, v]) => !v).map(([k]) => k).join(", ")}`
        : undefined,
    });
  }

  // D2: FORMULA COVERAGE — the definitive hardcoded-value detector.
  // Every data cell in PROJECTED columns on IS/BS/CFS must be a formula
  // (or null/blank for spacer rows). A raw number in a projected cell
  // means a hardcoded computed value leaked through.
  {
    let hardcodedProjectedCells = 0;
    const hardcodedExamples: string[] = [];

    for (const sheetName of ["Income Statement", "Balance Sheet", "Cash Flow"]) {
      const ws = wb.getWorksheet(sheetName);
      if (!ws) continue;

      const { firstProj, lastDataCol } = findProjectedCols(ws);
      if (firstProj < 0) continue;

      ws.eachRow((row, rowNum) => {
        if (rowNum <= 1) return; // skip header
        const label = getCellText(row.getCell(1)).trim();
        if (!label) return; // skip blank spacer rows

        for (let c = firstProj; c <= lastDataCol; c++) {
          const cell = row.getCell(c);
          const val = cell.value;

          // Skip null/undefined/blank cells
          if (val === null || val === undefined || val === "") continue;

          // If it's a formula, that's correct
          if (isFormula(val)) continue;

          // If it's a raw number in a projected cell → hardcoded value
          if (typeof val === "number" && val !== 0) {
            hardcodedProjectedCells++;
            if (hardcodedExamples.length < 5) {
              hardcodedExamples.push(
                `${sheetName}!${cell.address} "${label}" = ${val}`
              );
            }
          }
        }
      });
    }

    results.push({
      checkId: "D2",
      section: "D",
      gating: true, // This is the critical AI check — make it GATING
      passed: hardcodedProjectedCells === 0,
      description: "All projected cells are formulas (no hardcoded computed values)",
      details: hardcodedProjectedCells > 0
        ? `${hardcodedProjectedCells} hardcoded projected cells: ${hardcodedExamples.join("; ")}`
        : undefined,
    });
  }

  // D2.R: Revenue Tab Formula Coverage
  // Every calculated revenue cell on Rev tabs must be a formula
  {
    let revHardcoded = 0;
    const revExamples: string[] = [];

    for (const ws of wb.worksheets) {
      if (!ws.name.startsWith("Rev")) continue;

      let inCalcSection = false;
      ws.eachRow((row, rowNum) => {
        if (rowNum <= 1) return;
        const label = getCellText(row.getCell(1)).trim().toLowerCase();
        if (label.includes("calculated") || label.includes("total revenue") || label.includes("revenue from")) {
          inCalcSection = true;
        }
        if (label.includes("yoy") || label.includes("note") || label.includes("this tab")) {
          inCalcSection = false;
        }

        if (!inCalcSection) return;
        if (!label) return;

        for (let c = 2; c <= Math.min(20, row.cellCount || 20); c++) {
          const cell = row.getCell(c);
          const val = cell.value;
          if (val === null || val === undefined || val === "") continue;
          if (isFormula(val)) continue;
          if (typeof val === "number" && val !== 0) {
            revHardcoded++;
            if (revExamples.length < 3) {
              revExamples.push(`${ws.name}!${cell.address} "${label}" = ${val}`);
            }
          }
        }
      });
    }

    results.push({
      checkId: "D2.R",
      section: "D",
      gating: true,
      passed: revHardcoded === 0,
      description: "Revenue tab calculated cells are formulas (not hardcoded)",
      details: revHardcoded > 0
        ? `${revHardcoded} hardcoded revenue cells: ${revExamples.join("; ")}`
        : undefined,
    });
  }

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

  // D5: Inter-tab links are formulas (count check)
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

  // D5.BS: BS historical seed values populated (carry-forward anchors)
  {
    let seedsPopulated = false;
    if (bsSheet) {
      const { histCount } = findProjectedCols(bsSheet);
      if (histCount > 0) {
        const lastHistCol = 1 + histCount;
        let populatedCount = 0;
        bsSheet.eachRow((row, rowNum) => {
          if (rowNum <= 1) return;
          const label = getCellText(row.getCell(1)).toLowerCase();
          // Check carry-forward rows
          if (label.includes("pp&e") || label.includes("goodwill") || label.includes("retained") || label.includes("common stock")) {
            const val = row.getCell(lastHistCol).value;
            if (val !== null && val !== undefined && val !== "") populatedCount++;
          }
        });
        seedsPopulated = populatedCount >= 3;
      } else {
        seedsPopulated = true; // no historicals = no seeds needed
      }
    }
    results.push({
      checkId: "D5.BS",
      section: "D",
      gating: false,
      passed: seedsPopulated,
      description: "BS historical seed values populated for carry-forward formulas",
    });
  }

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
