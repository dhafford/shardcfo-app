"use server";

import { requireAuth } from "@/lib/supabase/require-auth";
import { revalidatePath } from "next/cache";
import type { FileCategory } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Fetch all files for a company
// ---------------------------------------------------------------------------

export async function fetchFiles(companyId: string) {
  const { supabase } = await requireAuth();

  const { data, error } = await (supabase as any)
    .from("company_files")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    return { files: [], error: error.message };
  }

  return { files: data ?? [], error: null };
}

// ---------------------------------------------------------------------------
// Register an uploaded file (metadata row — client uploads to storage first)
// ---------------------------------------------------------------------------

export async function registerFile(input: {
  companyId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: FileCategory;
  storagePath: string;
  notes?: string;
}) {
  const { user, supabase } = await requireAuth();

  const { error } = await (supabase as any).from("company_files").insert({
    company_id: input.companyId,
    file_name: input.fileName,
    file_size: input.fileSize,
    mime_type: input.mimeType,
    category: input.category,
    storage_path: input.storagePath,
    uploaded_by: user.id,
    notes: input.notes || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/dashboard/companies/${input.companyId}/files`);
  return { success: true, error: null };
}

// ---------------------------------------------------------------------------
// Delete a file (metadata + storage object)
// ---------------------------------------------------------------------------

export async function deleteFile(fileId: string, companyId: string) {
  const { supabase } = await requireAuth();

  // Fetch the file to get storage_path
  const { data: file } = await (supabase as any)
    .from("company_files")
    .select("storage_path")
    .eq("id", fileId)
    .single();

  if (!file) {
    return { success: false, error: "File not found" };
  }

  // Delete from storage
  await supabase.storage
    .from("company-files")
    .remove([(file as { storage_path: string }).storage_path]);

  // Delete metadata row
  const { error } = await (supabase as any)
    .from("company_files")
    .delete()
    .eq("id", fileId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/dashboard/companies/${companyId}/files`);
  return { success: true, error: null };
}

// ---------------------------------------------------------------------------
// Get a signed download URL for a file
// ---------------------------------------------------------------------------

export async function getDownloadUrl(storagePath: string) {
  const { supabase } = await requireAuth();

  const { data, error } = await supabase.storage
    .from("company-files")
    .createSignedUrl(storagePath, 300); // 5 minutes

  if (error || !data?.signedUrl) {
    return { url: null, error: error?.message ?? "Failed to create URL" };
  }

  return { url: data.signedUrl, error: null };
}

// ---------------------------------------------------------------------------
// Update file category or notes
// ---------------------------------------------------------------------------

export async function updateFile(
  fileId: string,
  companyId: string,
  updates: { category?: FileCategory; notes?: string },
) {
  const { supabase } = await requireAuth();

  const { error } = await (supabase as any)
    .from("company_files")
    .update(updates)
    .eq("id", fileId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/dashboard/companies/${companyId}/files`);
  return { success: true, error: null };
}
