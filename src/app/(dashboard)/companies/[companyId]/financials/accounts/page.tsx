import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AccountsTable } from "./accounts-table";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

interface AccountsPageProps {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ show_archived?: string }>;
}

export default async function AccountsPage({ params, searchParams }: AccountsPageProps) {
  const { companyId } = await params;
  const sp = await searchParams;
  const showArchived = sp.show_archived === "true";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const query = supabase
    .from("accounts")
    .select("*")
    .eq("company_id", companyId)
    .order("display_order", { ascending: true })
    .order("account_type", { ascending: true });

  if (!showArchived) {
    query.eq("is_active", true);
  }

  const { data: accounts } = await query;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Chart of Accounts</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {accounts?.length ?? 0} accounts
            {showArchived ? " (including archived)" : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/companies/${companyId}/financials/accounts?show_archived=${showArchived ? "false" : "true"}`}
          >
            <Button variant="ghost" size="sm" className="text-xs">
              {showArchived ? "Hide archived" : "Show archived"}
            </Button>
          </Link>

          <Link href={`/dashboard/companies/${companyId}/financials/import`}>
            <Button variant="outline" size="sm">
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Bulk Import
            </Button>
          </Link>
        </div>
      </div>

      <AccountsTable
        companyId={companyId}
        accounts={accounts ?? []}
      />
    </div>
  );
}

export const dynamic = "force-dynamic";
