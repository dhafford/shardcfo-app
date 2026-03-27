import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SessionClient } from "./session-client";
import type {
  ResearchSessionRow,
  ResearchIterationRow,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ sessionId: string }>;
}

export default async function ResearchSessionPage({ params }: Props) {
  const { sessionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: session } = await supabase
    .from("research_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (!session) notFound();

  const { data: iterations } = await supabase
    .from("research_iterations")
    .select("*")
    .eq("session_id", sessionId)
    .order("iteration_num", { ascending: true });

  return (
    <SessionClient
      session={session as ResearchSessionRow}
      iterations={(iterations ?? []) as ResearchIterationRow[]}
    />
  );
}
