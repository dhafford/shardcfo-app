import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAllFiles } from "../actions";
import { AllFilesClient } from "./files-page-client";

export const dynamic = "force-dynamic";

export default async function AllFilesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { files, error } = await fetchAllFiles();

  // Build a unique list of companies for the filter dropdown
  const companyMap = new Map<string, string>();
  for (const f of files) {
    if (!companyMap.has(f.company_id)) {
      companyMap.set(f.company_id, f.company_name);
    }
  }
  const companies = Array.from(companyMap, ([id, name]) => ({ id, name })).sort(
    (a, b) => a.name.localeCompare(b.name)
  );

  return <AllFilesClient files={files} companies={companies} error={error} />;
}
