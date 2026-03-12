import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ImportPageClient } from "./import-page-client";
import type { CompanyRow } from "@/lib/supabase/types";

interface ImportPageProps {
  params: Promise<{ companyId: string }>;
}

export default async function ImportPage({ params }: ImportPageProps) {
  const { companyId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch company industry and accounts in parallel
  const [companyResult, accountsResult] = await Promise.all([
    supabase
      .from("companies")
      .select("industry")
      .eq("id", companyId)
      .single(),
    supabase
      .from("accounts")
      .select("*")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
  ]);

  const company = companyResult.data as Pick<CompanyRow, "industry"> | null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-base font-semibold">Import Financial Data</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a .csv or .xlsx file to import actuals or budget data into ShardCFO.
        </p>
      </div>

      <div className="rounded-lg border bg-white p-6">
        <ImportPageClient
          companyId={companyId}
          accounts={accountsResult.data ?? []}
          industry={company?.industry ?? null}
        />
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
