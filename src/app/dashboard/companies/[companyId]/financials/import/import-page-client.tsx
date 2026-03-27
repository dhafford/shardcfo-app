"use client";

import { DataImportWizard } from "@/components/financials/data-import-wizard";
import { QboImportViewer } from "@/components/financials/qbo-import-viewer";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

interface ImportPageClientProps {
  companyId: string;
}

export function ImportPageClient({ companyId }: ImportPageClientProps) {
  return (
    <Tabs defaultValue={0}>
      <TabsList variant="line">
        <TabsTrigger>Import Data</TabsTrigger>
        <TabsTrigger>
          Import Data (Beta)
          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-100 text-violet-700">
            NEW
          </span>
        </TabsTrigger>
      </TabsList>

      <TabsContent className="pt-4">
        <DataImportWizard companyId={companyId} />
      </TabsContent>

      <TabsContent className="pt-4">
        <QboImportViewer companyId={companyId} />
      </TabsContent>
    </Tabs>
  );
}
