"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type {
  DDAssessmentInsert,
  DDItemInsert,
  DDFindingInsert,
  QoEAdjustmentInsert,
  DataRoomDocumentInsert,
} from "@/lib/supabase/types";

// ─── DD Assessments ──────────────────────────────────────────────────

export async function saveAssessment(
  companyId: string,
  data: Omit<DDAssessmentInsert, "company_id">
) {
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("dd_assessments")
    .upsert({
      ...data,
      company_id: companyId,
    });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/companies/${companyId}/diligence`);
}

export async function getLatestAssessment(companyId: string) {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("dd_assessments")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error && error.code !== "PGRST116") throw new Error(error.message);
  return data;
}

// ─── DD Items (Checklist) ────────────────────────────────────────────

export async function upsertDDItem(
  companyId: string,
  data: Omit<DDItemInsert, "company_id">
) {
  const supabase = await createClient();
  const payload = { ...data, company_id: companyId };
  const { error } = data.id
    ? await (supabase as any).from("dd_items").update(payload).eq("id", data.id)
    : await (supabase as any).from("dd_items").insert(payload);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/companies/${companyId}/diligence`);
}

export async function updateDDItemStatus(
  companyId: string,
  itemId: string,
  status: string
) {
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("dd_items")
    .update({ status })
    .eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/companies/${companyId}/diligence`);
}

export async function getDDItems(companyId: string) {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("dd_items")
    .select("*")
    .eq("company_id", companyId)
    .order("priority", { ascending: true })
    .order("category", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function bulkCreateDDItems(
  companyId: string,
  items: Omit<DDItemInsert, "company_id">[]
) {
  const supabase = await createClient();
  const payload = items.map((item) => ({ ...item, company_id: companyId }));
  const { error } = await (supabase as any).from("dd_items").insert(payload);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/companies/${companyId}/diligence`);
}

// ─── Data Room Documents ─────────────────────────────────────────────

export async function upsertDataRoomDoc(
  companyId: string,
  data: Omit<DataRoomDocumentInsert, "company_id">
) {
  const supabase = await createClient();
  const payload = { ...data, company_id: companyId };
  const { error } = data.id
    ? await (supabase as any).from("data_room_documents").update(payload).eq("id", data.id)
    : await (supabase as any).from("data_room_documents").insert(payload);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/companies/${companyId}/diligence`);
}

export async function getDataRoomDocs(companyId: string) {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("data_room_documents")
    .select("*")
    .eq("company_id", companyId)
    .order("folder", { ascending: true })
    .order("subfolder", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateDocStatus(
  companyId: string,
  docId: string,
  status: string
) {
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("data_room_documents")
    .update({ status })
    .eq("id", docId);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/companies/${companyId}/diligence`);
}

// ─── DD Findings ─────────────────────────────────────────────────────

export async function createFinding(
  companyId: string,
  data: Omit<DDFindingInsert, "company_id">
) {
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("dd_findings")
    .insert({ ...data, company_id: companyId });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/companies/${companyId}/diligence`);
}

export async function bulkCreateFindings(
  companyId: string,
  findings: Omit<DDFindingInsert, "company_id">[]
) {
  const supabase = await createClient();
  const payload = findings.map((f) => ({ ...f, company_id: companyId }));
  const { error } = await (supabase as any).from("dd_findings").insert(payload);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/companies/${companyId}/diligence`);
}

export async function getFindings(companyId: string) {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("dd_findings")
    .select("*")
    .eq("company_id", companyId)
    .order("severity", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function resolveFinding(
  companyId: string,
  findingId: string,
  resolved: boolean
) {
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("dd_findings")
    .update({
      resolved,
      resolved_at: resolved ? new Date().toISOString() : null,
    })
    .eq("id", findingId);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/companies/${companyId}/diligence`);
}

// ─── QoE Adjustments ─────────────────────────────────────────────────

export async function createQoEAdjustment(
  companyId: string,
  data: Omit<QoEAdjustmentInsert, "company_id">
) {
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("qoe_adjustments")
    .insert({ ...data, company_id: companyId });
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/companies/${companyId}/diligence`);
}

export async function getQoEAdjustments(companyId: string) {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("qoe_adjustments")
    .select("*")
    .eq("company_id", companyId)
    .order("period_date", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function deleteQoEAdjustment(
  companyId: string,
  adjustmentId: string
) {
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("qoe_adjustments")
    .delete()
    .eq("id", adjustmentId);
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/companies/${companyId}/diligence`);
}
