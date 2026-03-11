"use client";

import { DataImportWizard } from "@/components/financials/data-import-wizard";
import { processImport } from "./actions";
import type { AccountRow } from "@/lib/supabase/types";

interface ImportPageClientProps {
  companyId: string;
  accounts: AccountRow[];
}

export function ImportPageClient({ companyId, accounts }: ImportPageClientProps) {
  return (
    <DataImportWizard
      companyId={companyId}
      accounts={accounts}
      onImport={processImport}
    />
  );
}
