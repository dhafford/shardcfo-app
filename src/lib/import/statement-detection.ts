/**
 * Detects the financial statement type for each sheet in a workbook.
 *
 * Uses a weighted scoring algorithm combining:
 *   1. Tab name keywords (40% weight)
 *   2. First-column content keywords (60% weight)
 *
 * Returns a StatementType per sheet with a confidence score.
 */

import type { ParsedSheet } from "./xlsx-parser";

// ── Types ────────────────────────────────────────────────────────────────────

export type StatementType =
  | "income_statement"
  | "balance_sheet"
  | "cash_flow"
  | "equity"
  | "supporting_schedule"
  | "unknown";

export interface SheetClassification {
  sheetName: string;
  sheetIndex: number;
  detectedType: StatementType;
  confidence: number;
  signals: string[];
}

// ── Tab name keywords ────────────────────────────────────────────────────────

const TAB_NAME_KEYWORDS: Record<StatementType, string[]> = {
  income_statement: [
    "profit and loss", "p&l", "income statement", "income stmt",
    "pnl", "profit loss", "pl statement", "statement of operations",
    "statement of income",
  ],
  balance_sheet: [
    "balance sheet", "bal sheet", "statement of position", "sofp",
    "statement of financial position", "bs ",
  ],
  cash_flow: [
    "cash flow", "statement of cash", "cashflow", "scf",
    "cash flows",
  ],
  equity: [
    "changes in equity", "stockholder", "shareholder",
    "statement of equity", "owners equity",
  ],
  supporting_schedule: [
    "detail", "schedule", "supplement", "appendix", "notes",
    "aging", "headcount", "summary", "breakdown", "analysis",
  ],
  unknown: [],
};

// ── Content keywords (first column values) ───────────────────────────────────

const CONTENT_KEYWORDS: Record<StatementType, string[]> = {
  income_statement: [
    "revenue", "net revenue", "total revenue",
    "sales", "net sales",
    "cost of goods", "cost of revenue", "cost of sales", "cogs",
    "gross profit", "gross margin",
    "operating expense", "operating income",
    "ebitda", "ebit",
    "net income", "net loss", "net profit",
    "research and development", "r&d",
    "sales and marketing", "selling",
    "general and administrative", "g&a",
  ],
  balance_sheet: [
    "total assets", "total liabilities",
    "current assets", "non-current assets", "noncurrent assets",
    "fixed assets", "other assets",
    "accounts receivable", "inventory", "prepaid",
    "property plant", "property, plant",
    "accounts payable", "accrued",
    "current liabilities", "long-term liabilities", "non-current liabilities",
    "stockholders equity", "shareholders equity",
    "retained earnings", "total equity",
    "total liabilities and", "total liabilities &",
    "goodwill", "intangible",
  ],
  cash_flow: [
    "operating activities", "cash from operations",
    "investing activities", "cash from investing",
    "financing activities", "cash from financing",
    "net change in cash", "net increase",
    "capital expenditure", "capex",
    "cash and cash equivalents",
    "cash at beginning", "cash at end",
    "proceeds from",
  ],
  equity: [
    "common stock", "preferred stock",
    "additional paid-in", "paid in capital",
    "treasury stock",
    "comprehensive income", "comprehensive loss",
    "beginning balance", "ending balance",
    "dividends declared",
  ],
  supporting_schedule: [],
  unknown: [],
};

// ── Non-data sheet patterns ──────────────────────────────────────────────────

const NON_DATA_TAB_PATTERNS = [
  "chart", "pivot", "dashboard", "toc", "instructions",
  "cover", "index", "contents", "graphs",
];

// ── Scoring ──────────────────────────────────────────────────────────────────

const TAB_NAME_WEIGHT = 0.4;
const CONTENT_WEIGHT = 0.6;

function scoreTabName(sheetName: string, type: StatementType): number {
  const normalized = sheetName.toLowerCase().trim();
  const keywords = TAB_NAME_KEYWORDS[type];
  if (!keywords || keywords.length === 0) return 0;

  for (const kw of keywords) {
    if (normalized.includes(kw) || normalized === kw.trim()) {
      return 1.0;
    }
  }
  return 0;
}

function scoreContent(firstColumnValues: string[], type: StatementType): number {
  const keywords = CONTENT_KEYWORDS[type];
  if (!keywords || keywords.length === 0) return 0;

  let hits = 0;
  const maxHits = Math.min(keywords.length, 8);

  for (const value of firstColumnValues) {
    const normalized = value.toLowerCase().trim();
    for (const kw of keywords) {
      if (normalized.includes(kw)) {
        hits++;
        break;
      }
    }
  }

  return Math.min(hits / maxHits, 1.0);
}

// ── Public API ───────────────────────────────────────────────────────────────

export function classifySheet(
  sheetName: string,
  sheetIndex: number,
  firstColumnValues: string[],
  _headers: string[],
): SheetClassification {
  const signals: string[] = [];

  // Check for non-data sheets first
  const normalizedName = sheetName.toLowerCase().trim();
  for (const pattern of NON_DATA_TAB_PATTERNS) {
    if (normalizedName.includes(pattern)) {
      signals.push(`Tab name matches non-data pattern: "${pattern}"`);
      return {
        sheetName,
        sheetIndex,
        detectedType: "supporting_schedule",
        confidence: 0.7,
        signals,
      };
    }
  }

  // Check for too few rows
  const nonEmptyValues = firstColumnValues.filter((v) => v.trim().length > 0);
  if (nonEmptyValues.length < 3) {
    signals.push(`Only ${nonEmptyValues.length} non-empty rows — too few for a financial statement`);
    return {
      sheetName,
      sheetIndex,
      detectedType: "supporting_schedule",
      confidence: 0.5,
      signals,
    };
  }

  // Score each statement type
  const types: StatementType[] = [
    "income_statement",
    "balance_sheet",
    "cash_flow",
    "equity",
  ];

  let bestType: StatementType = "unknown";
  let bestScore = 0;

  for (const type of types) {
    const tabScore = scoreTabName(sheetName, type);
    const contentScore = scoreContent(firstColumnValues, type);
    const totalScore = tabScore * TAB_NAME_WEIGHT + contentScore * CONTENT_WEIGHT;

    if (tabScore > 0) {
      signals.push(`Tab name matches ${type} keywords (score: ${tabScore.toFixed(2)})`);
    }
    if (contentScore > 0) {
      signals.push(`Content matches ${type} keywords (score: ${contentScore.toFixed(2)}, ${Math.round(contentScore * Math.min(CONTENT_KEYWORDS[type].length, 8))} hits)`);
    }

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestType = type;
    }
  }

  // Threshold: require at least 0.15 to classify
  if (bestScore < 0.15) {
    signals.push(`Best score ${bestScore.toFixed(2)} below threshold — classified as unknown`);
    return {
      sheetName,
      sheetIndex,
      detectedType: "unknown",
      confidence: bestScore,
      signals,
    };
  }

  return {
    sheetName,
    sheetIndex,
    detectedType: bestType,
    confidence: Math.min(bestScore, 1.0),
    signals,
  };
}

export function classifyAllSheets(sheets: ParsedSheet[]): SheetClassification[] {
  return sheets.map((sheet, index) => {
    // Extract first column values (first non-header column data)
    const firstColumnValues: string[] = [];
    const firstHeader = sheet.headers[0] || "";

    // Add the first header if it looks like data
    if (firstHeader) firstColumnValues.push(firstHeader);

    // Add first 30 rows of the first column
    for (let i = 0; i < Math.min(sheet.rows.length, 30); i++) {
      const row = sheet.rows[i];
      const value = row[firstHeader] ?? Object.values(row)[0] ?? "";
      if (value) firstColumnValues.push(String(value));
    }

    return classifySheet(sheet.name, index, firstColumnValues, sheet.headers);
  });
}

/** Human-readable labels for statement types. */
export const STATEMENT_TYPE_LABELS: Record<StatementType, string> = {
  income_statement: "Income Statement",
  balance_sheet: "Balance Sheet",
  cash_flow: "Cash Flow",
  equity: "Statement of Equity",
  supporting_schedule: "Supporting Schedule",
  unknown: "Unknown",
};
