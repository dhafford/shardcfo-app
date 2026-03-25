/**
 * POST /api/forge/generate
 *
 * Runs the full PromptForge generation pipeline in a single request:
 *   1. Build system message from the seed prompt (or user-supplied prompt)
 *   2. Call Claude to generate a three-statement financial model as JSON
 *   3. Parse the raw JSON response
 *   4. Run pre-postprocessing validation  (rawValidation)
 *   5. Reconcile / postprocess the model
 *   6. Run post-postprocessing validation (cleanValidation)
 *   7. Classify the business type
 *   8. Return everything to the caller
 *
 * No auth middleware — this is an internal tool.
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { SEED_PROMPT, buildSystemMessage } from "@/lib/forge/prompt";
import { validate } from "@/lib/forge/validator";
import { reconcile } from "@/lib/forge/postprocessor";
import { classifyBusiness } from "@/lib/forge/builds";
import type { FinancialModel } from "@/lib/forge/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RequestBody {
  financialText: string;
  prompt?: string;
}

interface ValidationSummary {
  score: number;
  weightedScore: number;
  passed: number;
  total: number;
  criticalFailures: number;
  errorFailures: number;
  warnings: number;
}

interface ClassificationResult {
  businessType: string;
  confidence: number;
  revenueMethod: string;
  methodologyName: string;
}

interface MetaInfo {
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  stopReason: string;
}

interface GenerateResponse {
  model: FinancialModel | null;
  parseError?: boolean;
  rawResponse?: string;
  classification: ClassificationResult | null;
  rawValidation: ValidationSummary | null;
  cleanValidation: ValidationSummary | null;
  meta: MetaInfo;
}

// ---------------------------------------------------------------------------
// JSON extraction helpers
// ---------------------------------------------------------------------------

/**
 * Attempt three strategies to extract a JSON object from the model's text
 * output, in order of specificity:
 *   1. Direct JSON.parse (response is already clean JSON)
 *   2. Extract from a markdown code fence (```json ... ```)
 *   3. Brace-balance extraction (find outermost { ... })
 */
function extractJson(text: string): unknown {
  // Strategy 1: direct parse
  try {
    return JSON.parse(text);
  } catch {
    // fall through
  }

  // Strategy 2: markdown code fence
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // fall through
    }
  }

  // Strategy 3: outermost brace extraction
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      // fall through
    }
  }

  throw new Error("Could not parse JSON from model response");
}

// ---------------------------------------------------------------------------
// Validation summary helper
// ---------------------------------------------------------------------------

function summariseValidation(report: ReturnType<typeof validate>): ValidationSummary {
  return {
    score: report.score,
    weightedScore: report.weighted_score,
    passed: report.passed,
    total: report.total,
    criticalFailures: report.critical_failures.length,
    errorFailures: report.error_failures.length,
    warnings: report.warning_failures.length,
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

const GENERATION_MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 16000;

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Guard: API key must be present before creating the client
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set" },
      { status: 500 }
    );
  }

  const startMs = Date.now();

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body" },
      { status: 400 }
    );
  }

  const { financialText, prompt } = body;

  if (!financialText || typeof financialText !== "string") {
    return NextResponse.json(
      { error: "financialText is required and must be a string" },
      { status: 400 }
    );
  }

  const activePrompt = prompt ?? SEED_PROMPT;
  const systemMessage = buildSystemMessage(activePrompt);

  const client = new Anthropic();

  let rawText: string;
  let inputTokens: number;
  let outputTokens: number;
  let stopReason: string;

  try {
    const response = await client.messages.create({
      model: GENERATION_MODEL,
      max_tokens: MAX_TOKENS,
      system: systemMessage,
      messages: [
        {
          role: "user",
          content: `Generate a complete three-statement financial model from this data:\n\n${financialText}`,
        },
      ],
    });

    const firstBlock = response.content[0];
    rawText =
      firstBlock && firstBlock.type === "text" ? firstBlock.text : "";
    inputTokens = response.usage.input_tokens;
    outputTokens = response.usage.output_tokens;
    stopReason = response.stop_reason ?? "unknown";
  } catch (err) {
    console.error("[forge/generate] Anthropic API error:", err);
    return NextResponse.json(
      { error: "Generation failed", detail: String(err) },
      { status: 500 }
    );
  }

  const latencyMs = Date.now() - startMs;
  const meta: MetaInfo = {
    model: GENERATION_MODEL,
    inputTokens,
    outputTokens,
    latencyMs,
    stopReason,
  };

  // Parse JSON from the response text
  let parsed: FinancialModel;
  try {
    parsed = extractJson(rawText) as FinancialModel;
  } catch {
    console.warn("[forge/generate] JSON parse failed. rawText[:500]:", rawText.slice(0, 500));
    const failResponse: GenerateResponse = {
      model: null,
      parseError: true,
      rawResponse: rawText.slice(0, 500),
      classification: null,
      rawValidation: null,
      cleanValidation: null,
      meta,
    };
    return NextResponse.json(failResponse, { status: 200 });
  }

  // Raw validation (before postprocessing)
  let rawValidation: ValidationSummary | null = null;
  try {
    const rawReport = validate(parsed);
    rawValidation = summariseValidation(rawReport);
  } catch (err) {
    console.error("[forge/generate] Raw validation error:", err);
  }

  // Postprocessing / reconciliation
  let reconciled: FinancialModel = parsed;
  try {
    reconciled = reconcile(parsed) as FinancialModel;
  } catch (err) {
    console.error("[forge/generate] Postprocessor error:", err);
    // Continue with the unreconciled model rather than failing the request
  }

  // Clean validation (after postprocessing)
  let cleanValidation: ValidationSummary | null = null;
  try {
    const cleanReport = validate(reconciled);
    cleanValidation = summariseValidation(cleanReport);
  } catch (err) {
    console.error("[forge/generate] Clean validation error:", err);
  }

  // Business classification
  let classification: ClassificationResult | null = null;
  try {
    classification = classifyBusiness(reconciled);
  } catch (err) {
    console.error("[forge/generate] Classification error:", err);
  }

  const result: GenerateResponse = {
    model: reconciled,
    classification,
    rawValidation,
    cleanValidation,
    meta,
  };

  return NextResponse.json(result, { status: 200 });
}
