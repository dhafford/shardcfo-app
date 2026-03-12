import { requireAuth } from "@/lib/supabase/require-auth";
import { notFound } from "next/navigation";
import { fetchFiles } from "./actions";
import { FilesClient } from "./files-client";

export default async function FilesPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const { supabase } = await requireAuth();

  const { data: company } = await (supabase as any)
    .from("companies")
    .select("id, name")
    .eq("id", companyId)
    .single();

  if (!company) notFound();

  const { files, error } = await fetchFiles(companyId);

  return (
    <FilesClient
      companyId={(company as { id: string }).id}
      companyName={(company as { name: string }).name}
      initialFiles={files}
      error={error}
    />
  );
}

export const dynamic = "force-dynamic";
