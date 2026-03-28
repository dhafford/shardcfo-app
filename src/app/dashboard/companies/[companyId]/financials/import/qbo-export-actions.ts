"use server";

import { requireAuth } from "@/lib/supabase/require-auth";
import { revalidatePath } from "next/cache";
import type { AccountRow, FinancialPeriodRow } from "@/lib/supabase/types";
import type { AccountCategory } from "@/lib/import/report-parser-types";
import {
  resolveCategory,
  inferBSCategory,
  parseColumnDate,
  isExportableRow,
  collectExportableRows,
  makeRowKey,
  type CategoryMapping,
  type QboParsedRow,
} from "@/lib/import/qbo-section-mapping";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Mirrors the ParsedSection from qbo-import-viewer.tsx */
interface ParsedSection {
  name: string;
  depth: number;
  rows: QboParsedRow[];
  total: Record<string, number | null>;
}

/** Mirrors the ParsedReport from qbo-import-viewer.tsx */
interface ParsedReport {
  report_type: string;
  company_name: string;
  report_basis: string;
  period: { start_date: string; end_date: string };
  columns: string[];
  sections: ParsedSection[];
  validation_warnings: string[];
  warnings: string[];
}

export interface ExportParsedReportInput {
  companyId: string;
  report: ParsedReport;
  reclassifications: Record<
    string,
    { category: AccountCategory; subcategory: string | null }
  >;
  fileName: string;
}

export interface ExportResult {
  success: boolean;
  accountsCreated: number;
  accountsUpdated: number;
  periodsCreated: number;
  lineItemsUpserted: number;
  skippedRows: number;
  errors: string[];
  importId: string | null;
}

// ---------------------------------------------------------------------------
// Export action
// ---------------------------------------------------------------------------

export async function exportParsedReport(
  input: ExportParsedReportInput,
): Promise<ExportResult> {
  const { supabase } = await requireAuth({ redirect: false });
  const { companyId, report, reclassifications, fileName } = input;

  const errors: string[] = [];
  let accountsCreated = 0;
  let accountsUpdated = 0;
  let periodsCreated = 0;
  let lineItemsUpserted = 0;
  let skippedRows = 0;

  // 1. Create audit trail
  const { data: importRec, error: importErr } = await supabase
    .from("data_imports")
    .insert({
      company_id: companyId,
      file_name: fileName,
      file_url: "",
      file_type: "qbo_beta",
      status: "processing",
      row_count: 0,
      mapping_config: { report_type: report.report_type, columns: report.columns },
      error_log: null,
    })
    .select("id")
    .single();

  if (importErr || !importRec) {
    return {
      success: false,
      accountsCreated: 0,
      accountsUpdated: 0,
      periodsCreated: 0,
      lineItemsUpserted: 0,
      skippedRows: 0,
      errors: [`Failed to create import record: ${importErr?.message ?? "unknown"}`],
      importId: null,
    };
  }

  const importId = (importRec as { id: string }).id;

  // 2. Pre-fetch existing accounts
  const { data: rawAccounts } = await supabase
    .from("accounts")
    .select("id, account_number, name, category, subcategory")
    .eq("company_id", companyId);

  const accounts = (rawAccounts ?? []) as Pick<
    AccountRow,
    "id" | "account_number" | "name" | "category" | "subcategory"
  >[];
  const accountByCode = new Map(
    accounts.map((a) => [a.account_number.toLowerCase(), a]),
  );
  const accountByName = new Map(
    accounts.map((a) => [a.name.toLowerCase(), a]),
  );

  // 3. Pre-fetch existing periods
  const { data: rawPeriods } = await supabase
    .from("financial_periods")
    .select("id, period_date")
    .eq("company_id", companyId);

  const periodCache = new Map<string, string>();
  for (const p of (rawPeriods ?? []) as Pick<FinancialPeriodRow, "id" | "period_date">[]) {
    periodCache.set(String(p.period_date), p.id);
  }

  // 4. Parse column dates
  const dateColumns: Array<{ colLabel: string; periodDate: string }> = [];
  for (const col of report.columns) {
    const pd = parseColumnDate(col);
    if (pd) {
      dateColumns.push({ colLabel: col, periodDate: pd });
    }
  }

  // Fallback: if no date columns found (single "Total" column), use period.end_date
  if (dateColumns.length === 0 && report.period.end_date) {
    const fallbackDate = report.period.end_date.replace(/-\d{2}$/, "-01");
    dateColumns.push({ colLabel: report.columns[0] || "Total", periodDate: fallbackDate });
  }

  if (dateColumns.length === 0) {
    await _finalizeImport(supabase, importId, "failed", ["No date columns found and no period end_date available."]);
    return {
      success: false, accountsCreated, accountsUpdated, periodsCreated,
      lineItemsUpserted, skippedRows, errors: ["No date columns found."], importId,
    };
  }

  // 5. Resolve/create periods for each date column
  for (const { periodDate } of dateColumns) {
    if (!periodCache.has(periodDate)) {
      const { data: created, error: createErr } = await supabase
        .from("financial_periods")
        .insert({
          company_id: companyId,
          period_date: periodDate,
          period_type: "actual",
          status: "draft",
        })
        .select("id")
        .single();

      if (createErr) {
        // Race condition: try fetching
        const { data: existing } = await supabase
          .from("financial_periods")
          .select("id")
          .eq("company_id", companyId)
          .eq("period_date", periodDate)
          .eq("period_type", "actual")
          .maybeSingle();

        if (existing) {
          periodCache.set(periodDate, (existing as { id: string }).id);
        } else {
          errors.push(`Failed to create period ${periodDate}: ${createErr.message}`);
          continue;
        }
      } else {
        periodCache.set(periodDate, (created as { id: string }).id);
        periodsCreated++;
      }
    }
  }

  // 6. Walk sections, collect leaf rows, resolve accounts, build line_items
  const lineItemBatch: Array<{
    period_id: string;
    account_id: string;
    amount: number;
    notes: string;
  }> = [];

  for (const section of report.sections) {
    // Skip computed sections (no rows)
    if (section.rows.length === 0) {
      skippedRows++;
      continue;
    }

    const sectionMapping = resolveCategory(section.name);
    const collected = collectExportableRows(section.rows);

    for (const { row, ancestorNames } of collected) {
      const rowKey = makeRowKey(section.name, row);

      // Determine category: reclassification override > section mapping
      let mapping: CategoryMapping;
      if (reclassifications[rowKey]) {
        mapping = reclassifications[rowKey];
      } else if (sectionMapping) {
        // For BS "LIABILITIES AND EQUITY", infer from ancestors
        if (
          section.name.toLowerCase().includes("liabilities") &&
          section.name.toLowerCase().includes("equity")
        ) {
          mapping = {
            category: inferBSCategory(ancestorNames),
            subcategory: null,
          };
        } else {
          mapping = sectionMapping;
        }
      } else {
        errors.push(`No category mapping for section "${section.name}", row "${row.account_name}". Skipping.`);
        skippedRows++;
        continue;
      }

      // Resolve or create account
      const accountId = await _resolveOrCreateAccount(
        supabase,
        companyId,
        row,
        mapping,
        accountByCode,
        accountByName,
        reclassifications[rowKey] != null, // force update if reclassified
      );

      if (!accountId) {
        errors.push(`Failed to resolve account for "${row.account_name}". Skipping.`);
        skippedRows++;
        continue;
      }

      if (accountId.created) accountsCreated++;
      if (accountId.updated) accountsUpdated++;

      // Build line_items for each date column
      for (const { colLabel, periodDate } of dateColumns) {
        const periodId = periodCache.get(periodDate);
        if (!periodId) continue;

        const amount = row.amounts[colLabel];
        if (amount === null || amount === undefined) continue;

        lineItemBatch.push({
          period_id: periodId,
          account_id: accountId.id,
          amount,
          notes: `import:${importId}`,
        });
      }
    }
  }

  // 7. Batch upsert line_items
  const BATCH_SIZE = 100;
  for (let i = 0; i < lineItemBatch.length; i += BATCH_SIZE) {
    const chunk = lineItemBatch.slice(i, i + BATCH_SIZE);
    const { error: upsertErr } = await supabase
      .from("line_items")
      .upsert(chunk, { onConflict: "period_id,account_id" });

    if (upsertErr) {
      errors.push(`Batch upsert error (rows ${i}-${i + chunk.length}): ${upsertErr.message}`);
    } else {
      lineItemsUpserted += chunk.length;
    }
  }

  // 8. Finalize
  const success = errors.length === 0 || lineItemsUpserted > 0;
  await _finalizeImport(
    supabase,
    importId,
    success ? "imported" : "failed",
    errors,
    lineItemsUpserted,
  );

  revalidatePath(`/dashboard/companies/${companyId}/financials`);
  revalidatePath(`/dashboard/companies/${companyId}/financials/accounts`);

  return {
    success,
    accountsCreated,
    accountsUpdated,
    periodsCreated,
    lineItemsUpserted,
    skippedRows,
    errors: errors.slice(0, 20),
    importId,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function _resolveOrCreateAccount(
  supabase: Awaited<ReturnType<typeof requireAuth>>["supabase"],
  companyId: string,
  row: QboParsedRow,
  mapping: CategoryMapping,
  byCode: Map<string, Pick<AccountRow, "id" | "account_number" | "name" | "category" | "subcategory">>,
  byName: Map<string, Pick<AccountRow, "id" | "account_number" | "name" | "category" | "subcategory">>,
  forceUpdate: boolean,
): Promise<{ id: string; created: boolean; updated: boolean } | null> {
  // Try match by account_code
  if (row.account_code) {
    const existing = byCode.get(row.account_code.toLowerCase());
    if (existing) {
      // Update category if reclassified
      if (forceUpdate && existing.category !== mapping.category) {
        await supabase
          .from("accounts")
          .update({
            category: mapping.category,
            subcategory: mapping.subcategory,
          })
          .eq("id", existing.id);
        return { id: existing.id, created: false, updated: true };
      }
      return { id: existing.id, created: false, updated: false };
    }
  }

  // Try match by name
  const nameKey = row.account_name.toLowerCase();
  const existingByName = byName.get(nameKey);
  if (existingByName) {
    if (forceUpdate && existingByName.category !== mapping.category) {
      await supabase
        .from("accounts")
        .update({
          category: mapping.category,
          subcategory: mapping.subcategory,
        })
        .eq("id", existingByName.id);
      return { id: existingByName.id, created: false, updated: true };
    }
    return { id: existingByName.id, created: false, updated: false };
  }

  // Create new account
  const accountNumber = row.account_code || `QBO-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const { data: created, error: createErr } = await supabase
    .from("accounts")
    .insert({
      company_id: companyId,
      account_number: accountNumber,
      name: row.account_name,
      category: mapping.category,
      subcategory: mapping.subcategory,
      is_active: true,
    })
    .select("id")
    .single();

  if (createErr || !created) return null;

  const id = (created as { id: string }).id;

  // Update lookup maps for subsequent rows
  byCode.set(accountNumber.toLowerCase(), {
    id,
    account_number: accountNumber,
    name: row.account_name,
    category: mapping.category,
    subcategory: mapping.subcategory,
  });
  byName.set(nameKey, {
    id,
    account_number: accountNumber,
    name: row.account_name,
    category: mapping.category,
    subcategory: mapping.subcategory,
  });

  return { id, created: true, updated: false };
}

async function _finalizeImport(
  supabase: Awaited<ReturnType<typeof requireAuth>>["supabase"],
  importId: string,
  status: string,
  errors: string[],
  rowCount?: number,
) {
  await supabase
    .from("data_imports")
    .update({
      status,
      error_log: errors.length > 0 ? errors.slice(0, 100) : null,
      row_count: rowCount ?? 0,
    })
    .eq("id", importId);
}
