"use server";

import { requireAuth } from "@/lib/supabase/require-auth";
import { revalidatePath } from "next/cache";
import type {
  ResearchSessionRow,
  ResearchIterationRow,
} from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function createSession(
  title: string
): Promise<{ session: ResearchSessionRow | null; error: string | null }> {
  try {
    const { user, supabase } = await requireAuth({ redirect: false });

    const { data, error } = await supabase
      .from("research_sessions")
      .insert({ user_id: user.id, title: title.slice(0, 200) })
      .select("*")
      .single();

    if (error) return { session: null, error: error.message };

    revalidatePath("/dashboard/research");
    return { session: data as ResearchSessionRow, error: null };
  } catch (err) {
    return {
      session: null,
      error: err instanceof Error ? err.message : "Failed to create session",
    };
  }
}

export async function fetchSessions(): Promise<{
  sessions: ResearchSessionRow[];
  error: string | null;
}> {
  try {
    const { supabase } = await requireAuth({ redirect: false });

    const { data, error } = await supabase
      .from("research_sessions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return { sessions: [], error: error.message };
    return { sessions: (data ?? []) as ResearchSessionRow[], error: null };
  } catch (err) {
    return {
      sessions: [],
      error: err instanceof Error ? err.message : "Failed to fetch sessions",
    };
  }
}

export async function deleteSession(
  sessionId: string
): Promise<{ error: string | null }> {
  try {
    const { supabase } = await requireAuth({ redirect: false });

    const { error } = await supabase
      .from("research_sessions")
      .delete()
      .eq("id", sessionId);

    if (error) return { error: error.message };

    revalidatePath("/dashboard/research");
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to delete session",
    };
  }
}

export async function completeSession(
  sessionId: string
): Promise<{ error: string | null }> {
  try {
    const { supabase } = await requireAuth({ redirect: false });

    const { error } = await supabase
      .from("research_sessions")
      .update({ status: "completed" })
      .eq("id", sessionId);

    if (error) return { error: error.message };

    revalidatePath("/dashboard/research");
    return { error: null };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to complete session",
    };
  }
}

// ---------------------------------------------------------------------------
// Iterations
// ---------------------------------------------------------------------------

export async function saveIteration(params: {
  sessionId: string;
  iterationNum: number;
  userPrompt: string;
  generatedPrompt: string | null;
  resultMarkdown: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
}): Promise<{
  iteration: ResearchIterationRow | null;
  error: string | null;
}> {
  try {
    const { supabase } = await requireAuth({ redirect: false });

    const { data, error } = await supabase
      .from("research_iterations")
      .insert({
        session_id: params.sessionId,
        iteration_num: params.iterationNum,
        user_prompt: params.userPrompt,
        generated_prompt: params.generatedPrompt,
        result_markdown: params.resultMarkdown,
        input_tokens: params.inputTokens,
        output_tokens: params.outputTokens,
        latency_ms: params.latencyMs,
      })
      .select("*")
      .single();

    if (error) return { iteration: null, error: error.message };

    revalidatePath(`/dashboard/research/${params.sessionId}`);
    return { iteration: data as ResearchIterationRow, error: null };
  } catch (err) {
    return {
      iteration: null,
      error: err instanceof Error ? err.message : "Failed to save iteration",
    };
  }
}
