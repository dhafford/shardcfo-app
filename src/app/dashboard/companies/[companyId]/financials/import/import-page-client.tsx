"use client";

import { DataImportWizard } from "@/components/financials/data-import-wizard";
import { processImport } from "./actions";
import type { AccountRow } from "@/lib/supabase/types";

interface ImportPageClientProps {
  companyId: string;
  accounts: AccountRow[];
  industry: string | null;
}

export function ImportPageClient({ companyId, accounts, industry }: ImportPageClientProps) {
  return (
    <DataImportWizard
      companyId={companyId}
      accounts={accounts}
      industry={industry}
      onImport={processImport}
    />
  );
}
