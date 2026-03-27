"use client";

import { DataImportWizard } from "@/components/financials/data-import-wizard";

interface ImportPageClientProps {
  companyId: string;
}

export function ImportPageClient({ companyId }: ImportPageClientProps) {
  return <DataImportWizard companyId={companyId} />;
}
