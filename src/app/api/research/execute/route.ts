import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { RESEARCH_EXECUTOR_SYSTEM } from "@/lib/research/prompts";

const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 16000;

interface PriorMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Anthropic API key not configured." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await request.json();
  const prompt: string | undefined = body.prompt;
  const priorIterations: PriorMessage[] = body.priorIterations ?? [];

  if (!prompt || prompt.trim().length < 10) {
    return new Response(
      JSON.stringify({ error: "Prompt must be at least 10 characters." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const client = new Anthropic();

  // Build messages: prior conversation context + current prompt
  const messages: Anthropic.MessageParam[] = [
    ...priorIterations.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: prompt.trim() },
  ];

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: RESEARCH_EXECUTOR_SYSTEM,
    messages,
  });

  // Convert SDK stream to a Web ReadableStream of UTF-8 text deltas
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        stream.on("text", (textDelta) => {
          controller.enqueue(encoder.encode(textDelta));
        });

        stream.on("error", (err) => {
          const errorMsg =
            err instanceof Error ? err.message : "Stream error";
          controller.enqueue(encoder.encode(`\n\n[ERROR: ${errorMsg}]`));
          controller.close();
        });

        stream.on("end", () => {
          // Append metadata as an HTML comment so it doesn't render in markdown
          const msg = stream.currentMessage;
          if (msg) {
            const meta = JSON.stringify({
              __meta: true,
              inputTokens: msg.usage.input_tokens,
              outputTokens: msg.usage.output_tokens,
            });
            controller.enqueue(encoder.encode(`\n\n<!--META:${meta}-->`));
          }
          controller.close();
        });
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to start stream";
        controller.enqueue(encoder.encode(`\n\n[ERROR: ${errorMsg}]`));
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
