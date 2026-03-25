/**
 * Financial data ingester.
 *
 * Converts parsed Excel data (headers + rows from xlsx-parser.ts) into
 * a structured financial summary string suitable for LLM input.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IngestResult {
  /** Formatted text for LLM input. */
  financialText: string;
  /** Detected company name, or "Unknown Company". */
  companyName: string;
  /** Detected period labels (e.g. FY2022, FY2023, Q1 2023). */
  periods: string[];
  hasIncomeStatement: boolean;
  hasBalanceSheet: boolean;
  hasCashFlow: boolean;
  lineItemCount: number;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Section detection keywords
// ---------------------------------------------------------------------------

const IS_KEYWORDS = [
  "revenue", "net revenue", "total revenue", "sales", "net sales",
  "cost of", "cogs", "cost of goods", "gross profit", "gross margin",
  "operating", "opex", "ebitda", "ebit", "operating income",
  "interest expense", "interest income", "tax", "net income", "net loss",
  "r&d", "research", "s&m", "sales and marketing", "g&a", "general and admin",
  "sbc", "stock-based", "depreciation", "amortization",
];

const BS_KEYWORDS = [
  "assets", "total assets", "current assets", "liabilities", "total liabilities",
  "equity", "shareholders", "stockholders", "balance sheet",
  "cash and cash equivalents", "accounts receivable", "inventory",
  "prepaid", "ppe", "property", "plant", "equipment",
  "accounts payable", "accrued", "deferred revenue", "long-term debt",
  "retained earnings", "common stock", "goodwill", "intangible",
];

const CF_KEYWORDS = [
  "cash flow", "operating activities", "investing activities", "financing activities",
  "capex", "capital expenditure", "net change in cash", "beginning cash", "ending cash",
  "depreciation and amortization", "changes in working capital",
  "proceeds", "repayment", "debt issuance", "equity issuance",
];

// ---------------------------------------------------------------------------
// Period detection
// ---------------------------------------------------------------------------

/**
 * Return true if a column header looks like a financial period label.
 * Matches: FY2022, 2022, Q1 2023, Q1-23, Jan-24, FY22, LTM, NTM, H1 2023
 */
function isPeriodColumn(header: string): boolean {
  const h = header.trim();
  // Full year: FY2022, FY22, 2022, FY 2022
  if (/^(FY\s*)?20\d{2}$/i.test(h)) return true;
  // Short fiscal year: FY22, FY23
  if (/^FY\d{2}$/i.test(h)) return true;
  // Quarter: Q1 2023, Q1-23, Q1FY23, Q12023
  if (/^Q[1-4][\s-]?(20\d{2}|\d{2}|FY\d{2,4})$/i.test(h)) return true;
  // Month-year: Jan-24, Jan 2024, January 2024
  if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[\s-]?\d{2,4}$/i.test(h)) return true;
  // Half-year: H1 2023, H2-23
  if (/^H[12][\s-]?(20\d{2}|\d{2})$/i.test(h)) return true;
  // Projection labels: Y1, Y2, Year 1
  if (/^(Y\d|Year\s*\d)$/i.test(h)) return true;
  // LTM / NTM
  if (/^(LTM|NTM|TTM)$/i.test(h)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Number parsing
// ---------------------------------------------------------------------------

/**
 * Parse a financial cell value to a number, handling:
 * - Parentheses for negatives: (1,234) → -1234
 * - Currency symbols: $1,234
 * - Commas as thousands separators
 * - Percentage signs (left as-is but stripped)
 * - Trailing/leading whitespace
 */
function parseFinancialNumber(raw: string): number | null {
  if (!raw || raw.trim() === "" || raw.trim() === "-" || raw.trim() === "—") return null;

  let s = raw.trim();

  // Detect parentheses negatives: (1,234) or (1,234.56)
  const isNegative = /^\(.*\)$/.test(s);
  if (isNegative) {
    s = s.slice(1, -1);
  }

  // Strip currency symbols and commas
  s = s.replace(/[$€£¥,]/g, "");

  // Strip percentage sign
  s = s.replace(/%$/, "");

  const num = parseFloat(s);
  if (isNaN(num)) return null;

  return isNegative ? -num : num;
}

/** Format a number for display in the financial text output. */
function formatNumber(n: number): string {
  // Negative numbers in parens convention
  if (n < 0) {
    return `(${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 1 })})`;
  }
  return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

// ---------------------------------------------------------------------------
// Company name detection
// ---------------------------------------------------------------------------

/**
 * Attempt to extract a company name from the file name.
 * Strips extensions and common suffixes, title-cases the result.
 */
function detectCompanyName(fileName: string): string {
  // Remove extension
  let name = fileName.replace(/\.[^.]+$/, "");

  // Strip common financial suffixes
  name = name.replace(/[\s_-]*(financials?|model|p&l|is|bs|cf|3stmt|three.statement|forecast|budget|actuals?)[\s_-]*/gi, " ");

  // Replace underscores and hyphens with spaces, collapse whitespace
  name = name.replace(/[_-]/g, " ").replace(/\s+/g, " ").trim();

  if (!name) return "Unknown Company";

  // Title case
  return name.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

// ---------------------------------------------------------------------------
// Section classification
// ---------------------------------------------------------------------------

type SectionType = "income_statement" | "balance_sheet" | "cash_flow" | "unknown";

function classifyRow(label: string): SectionType {
  const lower = label.toLowerCase();

  // Check cash flow first (more specific keywords)
  if (CF_KEYWORDS.some((kw) => lower.includes(kw))) return "cash_flow";

  // Balance sheet keywords
  if (BS_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))) return "balance_sheet";

  // Income statement keywords
  if (IS_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))) return "income_statement";

  return "unknown";
}

// ---------------------------------------------------------------------------
// Main ingest function
// ---------------------------------------------------------------------------

/**
 * Convert parsed Excel data into a structured financial summary for LLM input.
 *
 * @param headers - Column header strings from the Excel sheet
 * @param rows    - Data rows as { [header]: cellValue } records
 * @param fileName - Original file name, used for company name detection
 */
export function ingestFinancials(
  headers: string[],
  rows: Record<string, string>[],
  fileName: string,
): IngestResult {
  const warnings: string[] = [];

  // ── Detect company name ──────────────────────────────────────────────────
  const companyName = detectCompanyName(fileName);

  // ── Find the label column (first non-period column) ──────────────────────
  const periodCols = headers.filter(isPeriodColumn);
  const labelCol = headers.find((h) => !isPeriodColumn(h)) ?? headers[0] ?? "";

  if (periodCols.length === 0) {
    warnings.push("No period columns detected. Looked for patterns like FY2022, Q1 2023, Y1, etc.");
  }

  if (!labelCol) {
    return {
      financialText: "",
      companyName,
      periods: periodCols,
      hasIncomeStatement: false,
      hasBalanceSheet: false,
      hasCashFlow: false,
      lineItemCount: 0,
      warnings: [...warnings, "No columns found in the data."],
    };
  }

  // ── Bucket rows by statement section ────────────────────────────────────
  type RowEntry = { label: string; values: Record<string, number | null> };

  const isRows: RowEntry[] = [];
  const bsRows: RowEntry[] = [];
  const cfRows: RowEntry[] = [];
  const unknownRows: RowEntry[] = [];

  let currentSection: SectionType = "unknown";

  for (const row of rows) {
    const rawLabel = (row[labelCol] ?? "").trim();
    if (!rawLabel) continue;

    // Check if this row is a section header (sets context for following rows)
    const rowSection = classifyRow(rawLabel);

    // Section header rows often have no numeric values — use them to set context
    const hasNumericValues = periodCols.some((col) => {
      const val = parseFinancialNumber(row[col] ?? "");
      return val !== null;
    });

    if (!hasNumericValues && rowSection !== "unknown") {
      currentSection = rowSection;
      continue;
    }

    // Determine section: prefer explicit classification, fall back to inherited context
    const effectiveSection = rowSection !== "unknown" ? rowSection : currentSection;

    // Parse numeric values for each period column
    const values: Record<string, number | null> = {};
    for (const col of periodCols) {
      values[col] = parseFinancialNumber(row[col] ?? "");
    }

    const entry: RowEntry = { label: rawLabel, values };

    switch (effectiveSection) {
      case "income_statement":
        isRows.push(entry);
        break;
      case "balance_sheet":
        bsRows.push(entry);
        break;
      case "cash_flow":
        cfRows.push(entry);
        break;
      default:
        unknownRows.push(entry);
        break;
    }
  }

  // If no section was detected but we have rows, treat everything as IS
  if (isRows.length === 0 && bsRows.length === 0 && cfRows.length === 0 && unknownRows.length > 0) {
    warnings.push("Could not detect statement sections. Treating all rows as Income Statement data.");
    isRows.push(...unknownRows);
  }

  // ── Format output text ───────────────────────────────────────────────────
  const lines: string[] = [];

  lines.push(`Company: ${companyName}`);
  lines.push(`Periods: ${periodCols.join(", ") || "None detected"}`);
  lines.push("");

  function renderSection(title: string, sectionRows: RowEntry[]): void {
    if (sectionRows.length === 0) return;
    lines.push(`=== ${title} ===`);
    for (const row of sectionRows) {
      const valParts = periodCols.map((col) => {
        const n = row.values[col];
        return n !== null ? formatNumber(n) : "N/A";
      });
      lines.push(`${row.label}: ${valParts.join(" | ")}`);
    }
    lines.push("");
  }

  renderSection("INCOME STATEMENT", isRows);
  renderSection("BALANCE SHEET", bsRows);
  renderSection("CASH FLOW STATEMENT", cfRows);

  if (unknownRows.length > 0 && (isRows.length > 0 || bsRows.length > 0 || cfRows.length > 0)) {
    warnings.push(`${unknownRows.length} row(s) could not be classified into a statement section.`);
  }

  const financialText = lines.join("\n").trim();
  const lineItemCount = isRows.length + bsRows.length + cfRows.length;

  if (lineItemCount === 0) {
    warnings.push("No line items with numeric values were found in the data.");
  }

  return {
    financialText,
    companyName,
    periods: periodCols,
    hasIncomeStatement: isRows.length > 0,
    hasBalanceSheet: bsRows.length > 0,
    hasCashFlow: cfRows.length > 0,
    lineItemCount,
    warnings,
  };
}
