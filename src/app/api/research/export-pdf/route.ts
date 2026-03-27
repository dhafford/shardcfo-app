import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { ResearchPdfDocument } from "@/components/research/research-pdf-document";
import type {
  ResearchSessionRow,
  ResearchIterationRow,
} from "@/lib/supabase/types";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const sessionId: string | undefined = body.sessionId;

  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId is required." },
      { status: 400 }
    );
  }

  // Fetch session
  const { data: session, error: sessionErr } = await supabase
    .from("research_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessionErr || !session) {
    return NextResponse.json(
      { error: "Session not found." },
      { status: 404 }
    );
  }

  // Fetch iterations
  const { data: iterations } = await supabase
    .from("research_iterations")
    .select("*")
    .eq("session_id", sessionId)
    .order("iteration_num", { ascending: true });

  const typedSession = session as ResearchSessionRow;
  const typedIterations = (iterations ?? []) as ResearchIterationRow[];

  try {
    const buffer = await renderToBuffer(
      ResearchPdfDocument({
        session: typedSession,
        iterations: typedIterations,
      })
    );

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="research-${sessionId.slice(0, 8)}.pdf"`,
      },
    });
  } catch (err) {
    console.error("[RESEARCH] PDF generation failed:", err);
    return NextResponse.json(
      { error: "PDF generation failed." },
      { status: 500 }
    );
  }
}
