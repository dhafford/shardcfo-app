"use server";

import { requireAuth } from "@/lib/supabase/require-auth";
import { revalidatePath } from "next/cache";
import type { AccountRow, FinancialPeriodRow, LineItemInsert } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImportRow {
  [key: string]: string;
}

interface ColumnMapping {
  [importHeader: string]: string;
}

interface ProcessImportInput {
  rows: ImportRow[];
  mapping: ColumnMapping;
  companyId: string;
  financialPeriodId?: string;
}

interface ProcessImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
  importId?: string;
  accountsCreated?: number;
  periodsCreated?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeDateToFirstOfMonth(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // YYYY-MM or YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    if (m >= 1 && m <= 12 && y >= 1900 && y <= 2100) {
      return `${y}-${String(m).padStart(2, "0")}-01`;
    }
  }

  // MM/YYYY or MM-YYYY
  const mmYYYYMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (mmYYYYMatch) {
    const m = parseInt(mmYYYYMatch[1], 10);
    const y = parseInt(mmYYYYMatch[2], 10);
    if (m >= 1 && m <= 12) {
      return `${y}-${String(m).padStart(2, "0")}-01`;
    }
  }

  // MM/DD/YYYY or MM-DD-YYYY
  const usDateMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (usDateMatch) {
    const m = parseInt(usDateMatch[1], 10);
    const y = parseInt(usDateMatch[3], 10);
    if (m >= 1 && m <= 12) {
      return `${y}-${String(m).padStart(2, "0")}-01`;
    }
  }

  // "Month YYYY" or "Mon YYYY"
  const monthNames: Record<string, number> = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
    apr: 4, april: 4, may: 5, jun: 6, june: 6,
    jul: 7, july: 7, aug: 8, august: 8, sep: 9, september: 9,
    oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
  };
  const namedMatch = trimmed.match(/^([a-zA-Z]+)\s+(\d{4})$/);
  if (namedMatch) {
    const m = monthNames[namedMatch[1].toLowerCase()];
    const y = parseInt(namedMatch[2], 10);
    if (m) {
      return `${y}-${String(m).padStart(2, "0")}-01`;
    }
  }

  // YYYY only — treat as January of that year
  const yearOnly = trimmed.match(/^(\d{4})$/);
  if (yearOnly) {
    const y = parseInt(yearOnly[1], 10);
    if (y >= 1900 && y <= 2100) {
      return `${y}-01-01`;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// processImport
// ---------------------------------------------------------------------------

export async function processImport(input: ProcessImportInput): Promise<ProcessImportResult> {
  const { supabase } = await requireAuth({ redirect: false });

  const { rows, mapping, companyId, financialPeriodId } = input;

  // Reverse mapping: app field -> import column header
  const reverseMap: Record<string, string> = {};
  for (const [header, field] of Object.entries(mapping)) {
    if (field) reverseMap[field] = header;
  }

  // Create a data_imports record to track this import
  const { data: rawImportRecord, error: importRecordError } = await supabase
    .from("data_imports")
    .insert({
      company_id: companyId,
      file_name: "manual_import",
      file_url: "",
      file_type: "csv",
      status: "processing",
      row_count: rows.length,
      mapping_config: mapping,
      error_log: null,
    })
    .select("id")
    .single();

  const importRecord = rawImportRecord as Pick<{ id: string }, "id"> | null;

  if (importRecordError || !importRecord) {
    return {
      success: false,
      imported: 0,
      failed: rows.length,
      errors: ["Failed to create import record: " + (importRecordError?.message ?? "unknown")],
    };
  }

  const importId = importRecord.id;
  const errors: string[] = [];
  let imported = 0;
  let failed = 0;
  let accountsCreated = 0;
  let periodsCreated = 0;

  // Fetch accounts for this company — build lookup maps
  const { data: rawAccounts } = await supabase
    .from("accounts")
    .select("id, account_number, name, category")
    .eq("company_id", companyId);

  const accounts = (rawAccounts ?? []) as Pick<AccountRow, "id" | "account_number" | "name" | "category">[];
  const accountByNumber = new Map(accounts.map((a) => [a.account_number.toLowerCase(), a]));
  const accountByName = new Map(accounts.map((a) => [a.name.toLowerCase(), a]));

  // Cache for period lookups (period_date -> period_id)
  const periodCache = new Map<string, string>();

  // Pre-fetch all existing periods for this company
  const { data: rawPeriods } = await supabase
    .from("financial_periods")
    .select("id, period_date")
    .eq("company_id", companyId);

  for (const p of (rawPeriods ?? []) as Pick<FinancialPeriodRow, "id" | "period_date">[]) {
    // period_date comes as "YYYY-MM-DD" from postgres
    periodCache.set(String(p.period_date), p.id);
  }

  // Helper: resolve or create a financial period
  async function resolvePeriod(dateStr: string): Promise<string | null> {
    const normalized = normalizeDateToFirstOfMonth(dateStr);
    if (!normalized) return null;

    // Check cache first
    if (periodCache.has(normalized)) return periodCache.get(normalized)!;

    // Try to create the period
    const { data: created, error: createErr } = await supabase
      .from("financial_periods")
      .insert({
        company_id: companyId,
        period_date: normalized,
        period_type: "actual",
        status: "draft",
      })
      .select("id")
      .single();

    if (createErr) {
      // Might be a unique constraint violation (race condition) — try fetching
      const { data: existing } = await supabase
        .from("financial_periods")
        .select("id")
        .eq("company_id", companyId)
        .eq("period_date", normalized)
        .eq("period_type", "actual")
        .maybeSingle();

      if (existing) {
        const id = (existing as { id: string }).id;
        periodCache.set(normalized, id);
        return id;
      }
      return null;
    }

    const id = (created as { id: string }).id;
    periodCache.set(normalized, id);
    periodsCreated++;
    return id;
  }

  // Helper: resolve account with fuzzy matching fallback
  function resolveAccount(code: string, name: string): Pick<AccountRow, "id" | "account_number" | "name" | "category"> | null {
    // Exact match by account number
    if (code) {
      const byNumber = accountByNumber.get(code.toLowerCase());
      if (byNumber) return byNumber;
    }

    // Exact match by name
    if (name) {
      const byName = accountByName.get(name.toLowerCase());
      if (byName) return byName;
    }

    // Fuzzy match by name — find best match above threshold
    if (name) {
      const normalizedImport = name.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
      let bestMatch: typeof accounts[number] | null = null;
      let bestScore = 0;

      for (const acct of accounts) {
        const normalizedAcct = acct.name.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

        // Check substring containment
        if (normalizedAcct.includes(normalizedImport) || normalizedImport.includes(normalizedAcct)) {
          if (0.85 > bestScore) {
            bestScore = 0.85;
            bestMatch = acct;
          }
          continue;
        }

        // Word overlap (Jaccard)
        const aWords = new Set(normalizedImport.split(/\s+/));
        const bWords = new Set(normalizedAcct.split(/\s+/));
        const intersection = [...aWords].filter((w) => bWords.has(w)).length;
        const union = new Set([...aWords, ...bWords]).size;
        const score = union > 0 ? intersection / union : 0;

        if (score > bestScore) {
          bestScore = score;
          bestMatch = acct;
        }
      }

      // Require at least 60% confidence for fuzzy match
      if (bestMatch && bestScore >= 0.6) return bestMatch;
    }

    return null;
  }

  // Process each row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed, +1 for header

    try {
      const rawCode = reverseMap["account_code"] ? row[reverseMap["account_code"]] : "";
      const rawName = reverseMap["account_name"] ? row[reverseMap["account_name"]] : "";

      // Handle amount — support both single amount column and debit/credit
      let amount: number;
      const rawAmount = reverseMap["amount"] ? row[reverseMap["amount"]] : "";
      const rawDebit = reverseMap["debit"] ? row[reverseMap["debit"]] : "";
      const rawCredit = reverseMap["credit"] ? row[reverseMap["credit"]] : "";

      if (rawAmount) {
        const cleaned = rawAmount.replace(/[$,\s()]/g, "");
        // Handle parenthetical negatives: (1234) -> -1234
        const isNeg = rawAmount.includes("(") && rawAmount.includes(")");
        amount = parseFloat(cleaned);
        if (isNaN(amount)) {
          errors.push(`Row ${rowNum}: Invalid amount "${rawAmount}".`);
          failed++;
          continue;
        }
        if (isNeg) amount = -Math.abs(amount);
      } else if (rawDebit || rawCredit) {
        const debit = parseFloat((rawDebit || "0").replace(/[$,\s]/g, "")) || 0;
        const credit = parseFloat((rawCredit || "0").replace(/[$,\s]/g, "")) || 0;
        amount = debit - credit;
      } else {
        errors.push(`Row ${rowNum}: No amount, debit, or credit value found.`);
        failed++;
        continue;
      }

      // Resolve account with fuzzy matching
      let account = resolveAccount(rawCode, rawName);

      // Auto-create account if not found and we have a category from the import
      if (!account && (rawCode || rawName)) {
        const rawCategory = reverseMap["account_type"] ? row[reverseMap["account_type"]] : "";
        const rawSubcategory = reverseMap["__subcategory__"] ? row[reverseMap["__subcategory__"]] : "";
        const validCategories = [
          "revenue", "cogs", "operating_expense", "other_income",
          "other_expense", "asset", "liability", "equity",
        ];
        const category = validCategories.includes(rawCategory) ? rawCategory : "";

        if (category) {
          const accountNumber = rawCode?.trim() || `AUTO-${Date.now()}-${accountsCreated}`;
          const accountName = rawName?.trim() || accountNumber;

          const { data: created, error: createErr } = await supabase
            .from("accounts")
            .insert({
              company_id: companyId,
              account_number: accountNumber,
              name: accountName,
              category,
              subcategory: rawSubcategory || null,
              is_active: true,
              display_order: 0,
            })
            .select("id, account_number, name, category")
            .single();

          if (!createErr && created) {
            const newAcct = created as Pick<AccountRow, "id" | "account_number" | "name" | "category">;
            account = newAcct;
            accountByNumber.set(newAcct.account_number.toLowerCase(), newAcct);
            accountByName.set(newAcct.name.toLowerCase(), newAcct);
            accounts.push(newAcct);
            accountsCreated++;
          }
        }
      }

      if (!account) {
        errors.push(`Row ${rowNum}: Could not match account "${rawCode || rawName}" to any existing account.`);
        failed++;
        continue;
      }

      // Resolve period — support both "date" and "period_date" mappings
      let periodId = financialPeriodId ?? null;
      if (!periodId) {
        const rawDate = reverseMap["date"] ? row[reverseMap["date"]]
          : reverseMap["period_date"] ? row[reverseMap["period_date"]]
          : "";

        if (rawDate) {
          periodId = await resolvePeriod(rawDate);
        }
      }

      if (!periodId) {
        const rawDate = reverseMap["date"] ? row[reverseMap["date"]]
          : reverseMap["period_date"] ? row[reverseMap["period_date"]] : "(none)";
        errors.push(`Row ${rowNum}: Could not resolve financial period for "${rawDate}".`);
        failed++;
        continue;
      }

      const lineItem: LineItemInsert = {
        period_id: periodId,
        account_id: account.id,
        amount,
        notes: `import:${importId}`,
      };

      const { error: lineItemError } = await supabase
        .from("line_items")
        .upsert(lineItem, { onConflict: "period_id,account_id" });

      if (lineItemError) {
        errors.push(`Row ${rowNum}: ${lineItemError.message}`);
        failed++;
      } else {
        imported++;
      }
    } catch (err) {
      errors.push(`Row ${rowNum}: ${err instanceof Error ? err.message : "Unexpected error."}`);
      failed++;
    }
  }

  // Update import record with final status
  await supabase.from("data_imports").update({
    status: failed === rows.length ? "failed" : "imported",
    error_log: errors.slice(0, 100),
  }).eq("id", importId);

  revalidatePath(`/dashboard/companies/${companyId}/financials`);

  return {
    success: imported > 0,
    imported,
    failed,
    errors: errors.slice(0, 20),
    importId,
    accountsCreated,
    periodsCreated,
  };
}

// ---------------------------------------------------------------------------
// createAccounts — create new accounts during import mapping
// ---------------------------------------------------------------------------

export async function createAccounts(
  companyId: string,
  newAccounts: Array<{ account_number?: string; name: string; category: string }>
): Promise<{ created: number; errors: string[] }> {
  const { supabase } = await requireAuth({ redirect: false });

  const errors: string[] = [];
  let created = 0;

  for (const acc of newAccounts) {
    if (!acc.name.trim()) {
      errors.push("Account name is required.");
      continue;
    }

    const accountNumber = acc.account_number?.trim() || `AUTO-${Date.now()}-${created}`;

    const insert = {
      company_id: companyId,
      account_number: accountNumber,
      name: acc.name.trim(),
      category: acc.category || "operating_expense",
      is_active: true,
      display_order: 0,
    };

    const { error } = await supabase.from("accounts").insert(insert);
    if (error) {
      errors.push(`Failed to create "${acc.name}": ${error.message}`);
    } else {
      created++;
    }
  }

  if (created > 0) {
    revalidatePath(`/dashboard/companies/${companyId}/financials/accounts`);
  }

  return { created, errors };
}

// ---------------------------------------------------------------------------
// Classification override persistence
// ---------------------------------------------------------------------------

export interface ClassificationOverride {
  category: string;
  sectionId: string;
  statementType: "income_statement" | "balance_sheet" | "cash_flow" | "equity" | "supporting_schedule" | "unknown";
  updatedAt: string;
}

export async function loadClassificationOverrides(
  companyId: string,
): Promise<Record<string, ClassificationOverride>> {
  const { supabase } = await requireAuth({ redirect: false });

  const { data } = await supabase
    .from("companies")
    .select("metadata")
    .eq("id", companyId)
    .single();

  if (!data) return {};

  const metadata = (data as { metadata: Record<string, unknown> }).metadata;
  const overrides = metadata?.import_overrides as Record<string, ClassificationOverride> | undefined;
  return overrides ?? {};
}

export async function saveClassificationOverrides(
  companyId: string,
  overrides: Array<{
    normalizedName: string;
    category: string;
    sectionId: string;
    statementType: string;
  }>,
): Promise<{ saved: number; errors: string[] }> {
  const { supabase } = await requireAuth({ redirect: false });
  const errors: string[] = [];

  if (overrides.length === 0) return { saved: 0, errors };

  // Fetch current metadata
  const { data: company } = await supabase
    .from("companies")
    .select("metadata")
    .eq("id", companyId)
    .single();

  if (!company) {
    return { saved: 0, errors: ["Company not found."] };
  }

  const metadata = ((company as { metadata: Record<string, unknown> }).metadata ?? {}) as Record<string, unknown>;
  const existing = (metadata.import_overrides ?? {}) as Record<string, ClassificationOverride>;

  // Merge new overrides
  const now = new Date().toISOString();
  for (const override of overrides) {
    existing[override.normalizedName] = {
      category: override.category,
      sectionId: override.sectionId,
      statementType: override.statementType,
      updatedAt: now,
    };
  }

  // Save back
  const updatedMetadata = { ...metadata, import_overrides: existing } as Record<string, unknown>;
  const { error } = await supabase
    .from("companies")
    .update({ metadata: updatedMetadata as never })
    .eq("id", companyId);

  if (error) {
    return { saved: 0, errors: [`Failed to save overrides: ${error.message}`] };
  }

  return { saved: overrides.length, errors };
}
