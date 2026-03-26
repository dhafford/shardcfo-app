"use server";

import { requireAuth } from "@/lib/supabase/require-auth";

// ---------------------------------------------------------------------------
// Fetch all files across all companies owned by the current user
// ---------------------------------------------------------------------------

export interface DashboardFile {
  id: string;
  company_id: string;
  company_name: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  category: string;
  storage_path: string;
  notes: string | null;
  created_at: string;
}

export async function fetchAllFiles(): Promise<{
  files: DashboardFile[];
  error: string | null;
}> {
  const { supabase } = await requireAuth();

  const { data, error } = await (supabase as any)
    .from("company_files")
    .select("id, company_id, file_name, file_size, mime_type, category, storage_path, notes, created_at, companies(name)")
    .order("created_at", { ascending: false });

  if (error) {
    return { files: [], error: error.message };
  }

  const files: DashboardFile[] = (data ?? []).map((row: any) => ({
    id: row.id,
    company_id: row.company_id,
    company_name: row.companies?.name ?? "Unknown",
    file_name: row.file_name,
    file_size: row.file_size,
    mime_type: row.mime_type,
    category: row.category,
    storage_path: row.storage_path,
    notes: row.notes,
    created_at: row.created_at,
  }));

  return { files, error: null };
}
