import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResearchListClient } from "./page-client";
import type { ResearchSessionRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function ResearchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: sessions } = await supabase
    .from("research_sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Research Assistant
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Deep strategic finance research powered by AI
        </p>
      </div>
      <ResearchListClient
        sessions={(sessions ?? []) as ResearchSessionRow[]}
      />
    </div>
  );
}
