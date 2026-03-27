import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ImportPageClient } from "./import-page-client";

interface ImportPageProps {
  params: Promise<{ companyId: string }>;
}

export default async function ImportPage({ params }: ImportPageProps) {
  const { companyId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-base font-semibold">Import Data</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a .csv or .xlsx file to view its contents.
        </p>
      </div>

      <div className="rounded-lg border bg-white p-6">
        <ImportPageClient companyId={companyId} />
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
