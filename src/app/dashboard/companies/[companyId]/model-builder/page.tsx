import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { fetchHistoricals } from "../projections/actions";
import { ModelBuilderClient } from "./model-builder-client";

export default async function ModelBuilderPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: company } = await (supabase as any)
    .from("companies")
    .select("id, name, industry")
    .eq("id", companyId)
    .single();

  if (!company) redirect("/dashboard");

  const { historicals, error } = await fetchHistoricals(companyId);

  return (
    <ModelBuilderClient
      companyId={(company as { id: string }).id}
      companyName={(company as { name: string }).name}
      industry={(company as { industry: string | null }).industry || "other"}
      historicals={historicals}
      error={error}
    />
  );
}
