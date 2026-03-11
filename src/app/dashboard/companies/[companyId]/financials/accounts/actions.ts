"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { AccountInsert, AccountUpdate } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AccountFormData {
  account_number: string;
  name: string;
  category: string;
  subcategory?: string | null;
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
    account_number: data.account_number.trim(),
    name: data.name.trim(),
    category: data.category,
    subcategory: data.subcategory?.trim() || null,
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
    ...(data.account_number !== undefined && { account_number: data.account_number.trim() }),
    ...(data.category !== undefined && { category: data.category }),
    ...(data.subcategory !== undefined && { subcategory: data.subcategory?.trim() || null }),
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
  account_number: string;
  name: string;
  category: string;
  subcategory?: string;
  display_order: number;
}

const TEMPLATES: Record<TemplateType, TemplateAccount[]> = {
  saas: [
    // Revenue
    { account_number: "4000", name: "Subscription Revenue (ARR)", category: "revenue", subcategory: "arr", display_order: 10 },
    { account_number: "4010", name: "Monthly Recurring Revenue", category: "revenue", subcategory: "mrr", display_order: 20 },
    { account_number: "4020", name: "Professional Services", category: "revenue", subcategory: "services", display_order: 30 },
    { account_number: "4030", name: "Implementation Fees", category: "revenue", subcategory: "services", display_order: 40 },
    // COGS
    { account_number: "5000", name: "Hosting & Infrastructure", category: "cogs", display_order: 100 },
    { account_number: "5010", name: "Customer Support", category: "cogs", display_order: 110 },
    { account_number: "5020", name: "Third-Party Software", category: "cogs", display_order: 120 },
    // Sales & Marketing
    { account_number: "6000", name: "Sales Salaries", category: "opex", subcategory: "sales_marketing", display_order: 200 },
    { account_number: "6010", name: "Marketing Spend", category: "opex", subcategory: "sales_marketing", display_order: 210 },
    { account_number: "6020", name: "Advertising", category: "opex", subcategory: "sales_marketing", display_order: 220 },
    // R&D
    { account_number: "6100", name: "Engineering Salaries", category: "opex", subcategory: "research_development", display_order: 300 },
    { account_number: "6110", name: "Development Tools", category: "opex", subcategory: "research_development", display_order: 310 },
    // G&A
    { account_number: "6200", name: "Executive Salaries", category: "opex", subcategory: "general_administrative", display_order: 400 },
    { account_number: "6210", name: "Finance & Legal", category: "opex", subcategory: "general_administrative", display_order: 410 },
    { account_number: "6220", name: "Office & Facilities", category: "opex", subcategory: "general_administrative", display_order: 420 },
    { account_number: "6230", name: "Insurance", category: "opex", subcategory: "general_administrative", display_order: 430 },
  ],
  ecommerce: [
    { account_number: "4000", name: "Product Sales", category: "revenue", display_order: 10 },
    { account_number: "4010", name: "Shipping Revenue", category: "revenue", display_order: 20 },
    { account_number: "5000", name: "Cost of Goods Sold", category: "cogs", display_order: 100 },
    { account_number: "5010", name: "Fulfillment & Shipping", category: "cogs", display_order: 110 },
    { account_number: "5020", name: "Returns & Refunds", category: "cogs", display_order: 120 },
    { account_number: "6000", name: "Marketing & Advertising", category: "opex", subcategory: "sales_marketing", display_order: 200 },
    { account_number: "6010", name: "Platform Fees", category: "opex", subcategory: "sales_marketing", display_order: 210 },
    { account_number: "6100", name: "Technology", category: "opex", subcategory: "research_development", display_order: 300 },
    { account_number: "6200", name: "General & Administrative", category: "opex", subcategory: "general_administrative", display_order: 400 },
    { account_number: "6210", name: "Warehouse & Operations", category: "opex", subcategory: "general_administrative", display_order: 410 },
  ],
  professional_services: [
    { account_number: "4000", name: "Consulting Revenue", category: "revenue", subcategory: "services", display_order: 10 },
    { account_number: "4010", name: "Retainer Revenue", category: "revenue", subcategory: "services", display_order: 20 },
    { account_number: "4020", name: "Project Revenue", category: "revenue", subcategory: "services", display_order: 30 },
    { account_number: "5000", name: "Contractor Costs", category: "cogs", display_order: 100 },
    { account_number: "5010", name: "Billable Expenses", category: "cogs", display_order: 110 },
    { account_number: "6000", name: "Business Development", category: "opex", subcategory: "sales_marketing", display_order: 200 },
    { account_number: "6100", name: "Staff Salaries", category: "opex", subcategory: "general_administrative", display_order: 300 },
    { account_number: "6110", name: "Benefits & HR", category: "opex", subcategory: "general_administrative", display_order: 310 },
    { account_number: "6200", name: "Rent & Utilities", category: "opex", subcategory: "general_administrative", display_order: 400 },
    { account_number: "6210", name: "Professional Fees", category: "opex", subcategory: "general_administrative", display_order: 410 },
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
    account_number: t.account_number,
    name: t.name,
    category: t.category,
    subcategory: t.subcategory ?? null,
    display_order: t.display_order,
    is_active: true,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("accounts").insert(inserts);
  if (error) return { success: false, error: error.message, created: 0 };

  revalidatePath(`/dashboard/companies/${companyId}/financials/accounts`);
  return { success: true, created: inserts.length };
}
