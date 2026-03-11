"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { AccountInsert, AccountRow, FinancialPeriodRow, LineItemInsert } from "@/lib/supabase/types";

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
}

// ---------------------------------------------------------------------------
// processImport
// ---------------------------------------------------------------------------

export async function processImport(input: ProcessImportInput): Promise<ProcessImportResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, imported: 0, failed: input.rows.length, errors: ["Not authenticated."] };
  }

  const { rows, mapping, companyId, financialPeriodId } = input;

  // Reverse mapping: app field -> import column header
  const reverseMap: Record<string, string> = {};
  for (const [header, field] of Object.entries(mapping)) {
    if (field) reverseMap[field] = header;
  }

  // Create a data_imports record to track this import (using actual schema columns)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawImportRecord, error: importRecordError } = await (supabase as any)
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

  // Fetch accounts for this company to resolve names/account numbers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawAccounts } = await (supabase as any)
    .from("accounts")
    .select("id, account_number, name")
    .eq("company_id", companyId);

  const accounts = (rawAccounts ?? []) as Pick<AccountRow, "id" | "account_number" | "name">[];
  const accountByNumber = new Map(accounts.map((a) => [a.account_number.toLowerCase(), a.id]));
  const accountByName = new Map(accounts.map((a) => [a.name.toLowerCase(), a.id]));

  // Process each row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed, +1 for header

    try {
      const rawCode = reverseMap["account_code"] ? row[reverseMap["account_code"]] : "";
      const rawName = reverseMap["account_name"] ? row[reverseMap["account_name"]] : "";
      const rawAmount = reverseMap["amount"] ? row[reverseMap["amount"]] : "";
      const rawPeriodDate = reverseMap["period_date"] ? row[reverseMap["period_date"]] : "";

      let accountId: string | null = null;
      if (rawCode) accountId = accountByNumber.get(rawCode.toLowerCase()) ?? null;
      if (!accountId && rawName) accountId = accountByName.get(rawName.toLowerCase()) ?? null;

      if (!accountId) {
        errors.push(`Row ${rowNum}: Could not resolve account "${rawCode || rawName}".`);
        failed++;
        continue;
      }

      const cleanedAmount = rawAmount.replace(/[$,\s]/g, "");
      const amount = parseFloat(cleanedAmount);
      if (isNaN(amount)) {
        errors.push(`Row ${rowNum}: Invalid amount "${rawAmount}".`);
        failed++;
        continue;
      }

      let periodId = financialPeriodId ?? null;
      if (!periodId && rawPeriodDate) {
        // Look up period by period_date (the actual column name)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: rawPeriod } = await (supabase as any)
          .from("financial_periods")
          .select("id")
          .eq("company_id", companyId)
          .eq("period_date", rawPeriodDate)
          .maybeSingle();
        const period = rawPeriod as Pick<FinancialPeriodRow, "id"> | null;
        periodId = period?.id ?? null;
      }

      if (!periodId) {
        errors.push(`Row ${rowNum}: Could not resolve financial period "${rawPeriodDate}".`);
        failed++;
        continue;
      }

      const lineItem: LineItemInsert = {
        period_id: periodId,
        account_id: accountId,
        amount,
        notes: `import:${importId}`,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: lineItemError } = await (supabase as any).from("line_items").upsert(lineItem);

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

  // Update import record with final status (using actual schema columns)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("data_imports").update({
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
  };
}

// ---------------------------------------------------------------------------
// createAccounts — create new accounts during import mapping
// ---------------------------------------------------------------------------

export async function createAccounts(
  companyId: string,
  newAccounts: Array<{ account_number?: string; name: string; category: string }>
): Promise<{ created: number; errors: string[] }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { created: 0, errors: ["Not authenticated."] };
  }

  const errors: string[] = [];
  let created = 0;

  for (const acc of newAccounts) {
    if (!acc.name.trim()) {
      errors.push("Account name is required.");
      continue;
    }
    if (!acc.account_number?.trim()) {
      errors.push(`Account number is required for "${acc.name}".`);
      continue;
    }

    const insert: AccountInsert = {
      company_id: companyId,
      account_number: acc.account_number.trim(),
      name: acc.name.trim(),
      category: acc.category,
      is_active: true,
      display_order: 0,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("accounts").insert(insert);
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
