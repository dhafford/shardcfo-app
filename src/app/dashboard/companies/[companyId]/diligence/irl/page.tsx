import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/supabase/require-auth";
import { IRLTrackerClient } from "@/components/diligence/irl-tracker-client";
import type { CompanyRow, DDItemRow } from "@/lib/supabase/types";

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export default async function IRLPage({ params }: PageProps) {
  const { companyId } = await params;
  const { supabase } = await requireAuth();

  const { data: companyRaw } = await supabase
    .from("companies")
    .select("id, name, stage, status")
    .eq("id", companyId)
    .single();

  const company = companyRaw as CompanyRow | null;
  if (!company) notFound();

  const { data: itemsRaw } = await supabase
    .from("dd_items")
    .select("*")
    .eq("company_id", companyId)
    .order("priority", { ascending: true })
    .order("category", { ascending: true });

  const items = (itemsRaw ?? []) as DDItemRow[];
  const companyStage = company.stage ?? "seed";
  const hasExistingItems = items.length > 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Information Request List</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Track the status of each diligence request. Generate items from the
          standard IRL template or manage them individually.
        </p>
      </div>

      <IRLTrackerClient
        items={items}
        companyId={companyId}
        companyStage={companyStage}
        hasExistingItems={hasExistingItems}
      />
    </div>
  );
}

export const dynamic = "force-dynamic";
