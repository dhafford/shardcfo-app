import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { PROMPT_GENERATOR_SYSTEM } from "@/lib/research/prompts";

const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 4096;

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const question: string | undefined = body.question;

  if (!question || question.trim().length < 10) {
    return NextResponse.json(
      { error: "Question must be at least 10 characters." },
      { status: 400 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Anthropic API key not configured." },
      { status: 500 }
    );
  }

  try {
    const client = new Anthropic();
    const start = Date.now();

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: PROMPT_GENERATOR_SYSTEM,
      messages: [{ role: "user", content: question.trim() }],
    });

    const latencyMs = Date.now() - start;
    const firstBlock = response.content[0];
    const prompt =
      firstBlock && firstBlock.type === "text" ? firstBlock.text : "";

    return NextResponse.json({
      prompt,
      meta: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        latencyMs,
      },
    });
  } catch (err) {
    console.error("[RESEARCH] Prompt generation failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Prompt generation failed." },
      { status: 500 }
    );
  }
}
