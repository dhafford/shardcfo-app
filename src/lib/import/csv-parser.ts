import Papa from "papaparse";

export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
  errors: string[];
}

export interface DetectedColumn {
  originalName: string;
  suggestedField: string | null;
  confidence: number;
  sampleValues: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Known financial column name patterns
const COLUMN_PATTERNS: Record<string, RegExp[]> = {
  account_code: [/^(account[\s_-]?code|acct[\s_-]?code|account[\s_-]?#|code)$/i],
  account_name: [/^(account[\s_-]?name|acct[\s_-]?name|name|description)$/i],
  account_type: [/^(account[\s_-]?type|acct[\s_-]?type|type|category)$/i],
  amount: [/^(amount|value|total|balance|net)$/i],
  date: [/^(date|period|month|year|period[\s_-]?date)$/i],
  debit: [/^(debit|dr)$/i],
  credit: [/^(credit|cr)$/i],
  period_label: [/^(period[\s_-]?label|fiscal[\s_-]?period|period[\s_-]?name)$/i],
};

export function parseCSV(file: File): Promise<ParsedCSV> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        const errors: string[] = [];

        if (results.errors.length > 0) {
          results.errors.slice(0, 5).forEach((err) => {
            errors.push(`Row ${err.row ?? "?"}: ${err.message}`);
          });
        }

        const headers = results.meta.fields ?? [];
        const rows = (results.data as Record<string, string>[]).map((row) => {
          const cleaned: Record<string, string> = {};
          for (const key of headers) {
            cleaned[key] = String(row[key] ?? "").trim();
          }
          return cleaned;
        });

        resolve({
          headers,
          rows,
          rowCount: rows.length,
          errors,
        });
      },
      error: (error) => {
        resolve({
          headers: [],
          rows: [],
          rowCount: 0,
          errors: [error.message],
        });
      },
    });
  });
}

export function detectColumns(headers: string[], sampleRows: Record<string, string>[]): DetectedColumn[] {
  return headers.map((header) => {
    const sampleValues = sampleRows
      .slice(0, 5)
      .map((row) => row[header] ?? "")
      .filter(Boolean);

    let bestField: string | null = null;
    let bestConfidence = 0;

    for (const [field, patterns] of Object.entries(COLUMN_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(header)) {
          const confidence = 0.9;
          if (confidence > bestConfidence) {
            bestField = field;
            bestConfidence = confidence;
          }
        }
      }
    }

    // Heuristic: if values look like numbers, suggest amount
    if (!bestField && sampleValues.length > 0) {
      const numericCount = sampleValues.filter((v) =>
        /^-?[\d,]+\.?\d*$/.test(v.replace(/[$,]/g, ""))
      ).length;
      if (numericCount / sampleValues.length > 0.7) {
        bestField = "amount";
        bestConfidence = 0.6;
      }
    }

    // Heuristic: if values look like dates, suggest date
    if (!bestField && sampleValues.length > 0) {
      const dateCount = sampleValues.filter((v) =>
        /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(v) ||
        /^\d{4}-\d{2}-\d{2}$/.test(v)
      ).length;
      if (dateCount / sampleValues.length > 0.7) {
        bestField = "date";
        bestConfidence = 0.65;
      }
    }

    return {
      originalName: header,
      suggestedField: bestField,
      confidence: bestConfidence,
      sampleValues,
    };
  });
}

export function validateData(
  rows: Record<string, string>[],
  mapping: Record<string, string>
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const requiredFields = ["account_name", "amount"];
  for (const field of requiredFields) {
    const mappedHeader = Object.entries(mapping).find(([, v]) => v === field)?.[0];
    if (!mappedHeader) {
      errors.push(`Required field "${field}" is not mapped to any column.`);
    }
  }

  if (rows.length === 0) {
    errors.push("No data rows found in the file.");
    return { isValid: false, errors, warnings };
  }

  if (rows.length > 10000) {
    warnings.push(`Large file: ${rows.length} rows. Import may take a moment.`);
  }

  const amountHeader = Object.entries(mapping).find(([, v]) => v === "amount")?.[0];
  if (amountHeader) {
    let invalidCount = 0;
    rows.slice(0, 100).forEach((row, i) => {
      const raw = row[amountHeader] ?? "";
      const cleaned = raw.replace(/[$,\s]/g, "");
      if (cleaned && isNaN(Number(cleaned))) {
        invalidCount++;
        if (invalidCount <= 3) {
          errors.push(`Row ${i + 2}: "${raw}" is not a valid number in the amount column.`);
        }
      }
    });
    if (invalidCount > 3) {
      errors.push(`...and ${invalidCount - 3} more invalid amount values.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
