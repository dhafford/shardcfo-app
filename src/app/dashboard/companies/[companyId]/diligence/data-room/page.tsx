import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/supabase/require-auth";
import { DataRoomClient } from "@/components/diligence/data-room-client";
import { DATA_ROOM_STRUCTURE } from "@/lib/constants";
import type { CompanyRow, DataRoomDocumentRow } from "@/lib/supabase/types";

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export default async function DataRoomPage({ params }: PageProps) {
  const { companyId } = await params;
  const { supabase } = await requireAuth();

  const { data: companyRaw } = await supabase
    .from("companies")
    .select("id, name, stage, status")
    .eq("id", companyId)
    .single();

  const company = companyRaw as CompanyRow | null;
  if (!company) notFound();

  const { data: docsRaw } = await supabase
    .from("data_room_documents")
    .select("*")
    .eq("company_id", companyId)
    .order("folder", { ascending: true })
    .order("subfolder", { ascending: true });

  const documents = (docsRaw ?? []) as DataRoomDocumentRow[];
  const companyStage = company.stage ?? "seed";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Data Room</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Organize and track diligence documents by folder. Required documents
          are highlighted based on your current funding stage.
        </p>
      </div>

      <DataRoomClient
        folders={DATA_ROOM_STRUCTURE}
        documents={documents}
        companyId={companyId}
        companyStage={companyStage}
      />
    </div>
  );
}

export const dynamic = "force-dynamic";
