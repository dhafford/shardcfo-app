"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/supabase/require-auth";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/supabase/types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// ---------------------------------------------------------------------------
// updateCompany
// ---------------------------------------------------------------------------

export async function updateCompany(formData: FormData) {
  const { user, supabase } = await requireAuth({ redirect: false });

  const companyId = formData.get("companyId") as string;
  if (!companyId) throw new Error("companyId is required");

  // Verify the caller has edit rights
  await assertEditAccess(supabase, user.id, companyId);

  const name = formData.get("name") as string | null;
  const industry = (formData.get("industry") as string) || null;
  const fiscalYearEndMonthRaw = formData.get("fiscalYearEndMonth") as string | null;
  const currency = (formData.get("currency") as string) || null;
  const foundedYearRaw = formData.get("foundedYear") as string | null;

  // Fetch existing metadata to merge (not overwrite) the JSONB
  const { data: existing } = await supabase
    .from("companies")
    .select("metadata, legal_entity, stage")
    .eq("id", companyId)
    .single();

  const existingMetadata =
    (existing?.metadata as Record<string, unknown>) ?? {};

  // Merge new metadata fields from form
  const fundingStage = formData.get("fundingStage") as string | null;
  const legalEntity = formData.get("legalEntity") as string | null;

  if (foundedYearRaw) {
    const year = parseInt(foundedYearRaw, 10);
    if (year >= 1900 && year <= new Date().getFullYear() + 1) {
      existingMetadata.founded_year = year;
    }
  }
  if (fundingStage) existingMetadata.funding_stage = fundingStage;

  const updates: Record<string, unknown> = {
    metadata: existingMetadata,
  };

  if (name) updates.name = name;
  if (industry !== null) updates.industry = industry || null;
  if (currency) updates.currency = currency;
  if (legalEntity !== null) updates.legal_entity = legalEntity || null;
  if (fundingStage) updates.stage = fundingStage;

  if (fiscalYearEndMonthRaw) {
    const month = parseInt(fiscalYearEndMonthRaw, 10);
    if (month >= 1 && month <= 12) {
      updates.fiscal_year_end_month = month;
    }
  }

  const { error } = await supabase
    .from("companies")
    .update(updates)
    .eq("id", companyId);

  if (error) {
    throw new Error(`Failed to update company: ${error.message}`);
  }

  revalidatePath(`/dashboard/companies/${companyId}/settings`);
  revalidatePath(`/dashboard/companies/${companyId}`);
}

// ---------------------------------------------------------------------------
// archiveCompany
// ---------------------------------------------------------------------------

export async function archiveCompany(formData: FormData) {
  const { user, supabase } = await requireAuth({ redirect: false });

  const companyId = formData.get("companyId") as string;
  if (!companyId) throw new Error("companyId is required");

  // Verify admin-only access
  await assertAdminAccess(supabase, user.id);

  const action = formData.get("action") as string; // "archive" | "unarchive"
  const newStatus = action === "unarchive" ? "active" : "archived";

  const { error } = await supabase
    .from("companies")
    .update({ status: newStatus })
    .eq("id", companyId);

  if (error) {
    throw new Error(`Failed to ${action} company: ${error.message}`);
  }

  revalidatePath(`/dashboard/companies/${companyId}/settings`);
  revalidatePath(`/dashboard/companies/${companyId}`);

  if (newStatus === "archived") {
    redirect("/dashboard");
  }
}

// ---------------------------------------------------------------------------
// Access helpers
// ---------------------------------------------------------------------------

async function assertEditAccess(supabase: SupabaseClient, userId: string, companyId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (!profile) throw new Error("Profile not found");

  const role = profile.role as UserRole;
  if (role === "viewer") throw new Error("Viewers may not edit company settings");

  // Verify user owns this company
  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("owner_id", userId)
    .single();

  if (!company) throw new Error("You do not have access to this company");
}

async function assertAdminAccess(supabase: SupabaseClient, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (!profile || profile.role !== "admin") {
    throw new Error("Only admins may perform this action");
  }
}
