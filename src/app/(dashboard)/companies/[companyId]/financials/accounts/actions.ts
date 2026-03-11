"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { AccountInsert, AccountUpdate, AccountType, AccountCategory } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AccountFormData {
  code?: string;
  name: string;
  account_type: AccountType;
  category?: AccountCategory;
  description?: string;
  parent_account_id?: string;
  display_order?: number;
}

interface ActionResult {
  success: boolean;
  error?: string;
  id?: string;
}

// ---------------------------------------------------------------------------
// createAccount
// ---------------------------------------------------------------------------

export async function createAccount(
  companyId: string,
  data: AccountFormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const insert: AccountInsert = {
    company_id: companyId,
    name: data.name.trim(),
    account_type: data.account_type,
    code: data.code?.trim() || null,
    category: data.category ?? null,
    description: data.description?.trim() || null,
    parent_account_id: data.parent_account_id || null,
    display_order: data.display_order ?? 0,
    is_active: true,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: created, error } = await (supabase as any)
    .from("accounts")
    .insert(insert)
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath(`/dashboard/companies/${companyId}/financials/accounts`);
  return { success: true, id: (created as { id: string }).id };
}

// ---------------------------------------------------------------------------
// updateAccount
// ---------------------------------------------------------------------------

export async function updateAccount(
  companyId: string,
  accountId: string,
  data: Partial<AccountFormData>
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const update: AccountUpdate = {
    ...(data.name !== undefined && { name: data.name.trim() }),
    ...(data.account_type !== undefined && { account_type: data.account_type }),
    ...(data.code !== undefined && { code: data.code?.trim() || null }),
    ...(data.category !== undefined && { category: data.category }),
    ...(data.description !== undefined && { description: data.description?.trim() || null }),
    ...(data.parent_account_id !== undefined && { parent_account_id: data.parent_account_id || null }),
    ...(data.display_order !== undefined && { display_order: data.display_order }),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("accounts")
    .update(update)
    .eq("id", accountId)
    .eq("company_id", companyId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/dashboard/companies/${companyId}/financials/accounts`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// archiveAccount
// ---------------------------------------------------------------------------

export async function archiveAccount(
  companyId: string,
  accountId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("accounts")
    .update({ is_active: false })
    .eq("id", accountId)
    .eq("company_id", companyId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/dashboard/companies/${companyId}/financials/accounts`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// initializeFromTemplate
// ---------------------------------------------------------------------------

type TemplateType = "saas" | "ecommerce" | "professional_services" | "blank";

interface TemplateAccount {
  code: string;
  name: string;
  account_type: AccountType;
  category?: AccountCategory;
  display_order: number;
}

const TEMPLATES: Record<TemplateType, TemplateAccount[]> = {
  saas: [
    // Revenue
    { code: "4000", name: "Subscription Revenue (ARR)", account_type: "revenue", category: "arr", display_order: 10 },
    { code: "4010", name: "Monthly Recurring Revenue", account_type: "revenue", category: "mrr", display_order: 20 },
    { code: "4020", name: "Professional Services", account_type: "revenue", category: "services", display_order: 30 },
    { code: "4030", name: "Implementation Fees", account_type: "revenue", category: "services", display_order: 40 },
    // COGS
    { code: "5000", name: "Hosting & Infrastructure", account_type: "cogs", display_order: 100 },
    { code: "5010", name: "Customer Support", account_type: "cogs", display_order: 110 },
    { code: "5020", name: "Third-Party Software", account_type: "cogs", display_order: 120 },
    // Sales & Marketing
    { code: "6000", name: "Sales Salaries", account_type: "opex", category: "sales_marketing", display_order: 200 },
    { code: "6010", name: "Marketing Spend", account_type: "opex", category: "sales_marketing", display_order: 210 },
    { code: "6020", name: "Advertising", account_type: "opex", category: "sales_marketing", display_order: 220 },
    // R&D
    { code: "6100", name: "Engineering Salaries", account_type: "opex", category: "research_development", display_order: 300 },
    { code: "6110", name: "Development Tools", account_type: "opex", category: "research_development", display_order: 310 },
    // G&A
    { code: "6200", name: "Executive Salaries", account_type: "opex", category: "general_administrative", display_order: 400 },
    { code: "6210", name: "Finance & Legal", account_type: "opex", category: "general_administrative", display_order: 410 },
    { code: "6220", name: "Office & Facilities", account_type: "opex", category: "general_administrative", display_order: 420 },
    { code: "6230", name: "Insurance", account_type: "opex", category: "general_administrative", display_order: 430 },
  ],
  ecommerce: [
    { code: "4000", name: "Product Sales", account_type: "revenue", display_order: 10 },
    { code: "4010", name: "Shipping Revenue", account_type: "revenue", display_order: 20 },
    { code: "5000", name: "Cost of Goods Sold", account_type: "cogs", display_order: 100 },
    { code: "5010", name: "Fulfillment & Shipping", account_type: "cogs", display_order: 110 },
    { code: "5020", name: "Returns & Refunds", account_type: "cogs", display_order: 120 },
    { code: "6000", name: "Marketing & Advertising", account_type: "opex", category: "sales_marketing", display_order: 200 },
    { code: "6010", name: "Platform Fees", account_type: "opex", category: "sales_marketing", display_order: 210 },
    { code: "6100", name: "Technology", account_type: "opex", category: "research_development", display_order: 300 },
    { code: "6200", name: "General & Administrative", account_type: "opex", category: "general_administrative", display_order: 400 },
    { code: "6210", name: "Warehouse & Operations", account_type: "opex", category: "general_administrative", display_order: 410 },
  ],
  professional_services: [
    { code: "4000", name: "Consulting Revenue", account_type: "revenue", category: "services", display_order: 10 },
    { code: "4010", name: "Retainer Revenue", account_type: "revenue", category: "services", display_order: 20 },
    { code: "4020", name: "Project Revenue", account_type: "revenue", category: "services", display_order: 30 },
    { code: "5000", name: "Contractor Costs", account_type: "cogs", display_order: 100 },
    { code: "5010", name: "Billable Expenses", account_type: "cogs", display_order: 110 },
    { code: "6000", name: "Business Development", account_type: "opex", category: "sales_marketing", display_order: 200 },
    { code: "6100", name: "Staff Salaries", account_type: "opex", category: "general_administrative", display_order: 300 },
    { code: "6110", name: "Benefits & HR", account_type: "opex", category: "general_administrative", display_order: 310 },
    { code: "6200", name: "Rent & Utilities", account_type: "opex", category: "general_administrative", display_order: 400 },
    { code: "6210", name: "Professional Fees", account_type: "opex", category: "general_administrative", display_order: 410 },
  ],
  blank: [],
};

export async function initializeFromTemplate(
  companyId: string,
  template: TemplateType
): Promise<ActionResult & { created: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated.", created: 0 };

  const templateAccounts = TEMPLATES[template];
  if (templateAccounts.length === 0 && template !== "blank") {
    return { success: false, error: "Unknown template.", created: 0 };
  }

  // Check if accounts already exist
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (supabase as any)
    .from("accounts")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);

  if ((count ?? 0) > 0) {
    return {
      success: false,
      error: "This company already has accounts. Archive or delete them first.",
      created: 0,
    };
  }

  if (templateAccounts.length === 0) {
    return { success: true, created: 0 };
  }

  const inserts: AccountInsert[] = templateAccounts.map((t) => ({
    company_id: companyId,
    code: t.code,
    name: t.name,
    account_type: t.account_type,
    category: t.category ?? null,
    display_order: t.display_order,
    is_active: true,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("accounts").insert(inserts);
  if (error) return { success: false, error: error.message, created: 0 };

  revalidatePath(`/dashboard/companies/${companyId}/financials/accounts`);
  return { success: true, created: inserts.length };
}
