"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  MessageSquarePlus,
} from "lucide-react";
import { ResearchInput } from "@/components/research/research-input";
import { ResearchStream } from "@/components/research/research-stream";
import { IterationHistory } from "@/components/research/iteration-history";
import {
  researchReducer,
  MAX_ITERATIONS,
  type ResearchFlowState,
} from "@/lib/research/types";
import { saveIteration, completeSession } from "../actions";
import type {
  ResearchSessionRow,
  ResearchIterationRow,
} from "@/lib/supabase/types";

interface SessionClientProps {
  session: ResearchSessionRow;
  iterations: ResearchIterationRow[];
}

export function SessionClient({ session, iterations: initialIterations }: SessionClientProps) {
  const [state, dispatch] = React.useReducer(researchReducer, {
    step: "input",
  } as ResearchFlowState);

  const [iterations, setIterations] =
    React.useState<ResearchIterationRow[]>(initialIterations);
  const [question, setQuestion] = React.useState("");
  const [editablePrompt, setEditablePrompt] = React.useState("");
  const [isExporting, setIsExporting] = React.useState(false);
  const [sessionStatus, setSessionStatus] = React.useState(session.status);

  const nextIterationNum = iterations.length + 1;
  const canIterate =
    nextIterationNum <= MAX_ITERATIONS && sessionStatus === "active";

  // Build conversation context from prior iterations
  const buildMessageHistory = React.useCallback(() => {
    const messages: { role: "user" | "assistant"; content: string }[] = [];
    for (const it of iterations) {
      messages.push({
        role: "user",
        content: it.generated_prompt || it.user_prompt,
      });
      if (it.result_markdown) {
        messages.push({ role: "assistant", content: it.result_markdown });
      }
    }
    return messages;
  }, [iterations]);

  // Step 1: Generate prompt from user question
  const handleGeneratePrompt = React.useCallback(async () => {
    dispatch({ type: "START_GENERATE", userQuestion: question });

    try {
      const res = await fetch("/api/research/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        dispatch({ type: "ERROR", message: err.error || "Failed to generate prompt" });
        return;
      }

      const data = await res.json();
      setEditablePrompt(data.prompt);
      dispatch({ type: "PROMPT_GENERATED", generatedPrompt: data.prompt });
    } catch (err) {
      dispatch({
        type: "ERROR",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }, [question]);

  // Step 2: Run streaming research
  const handleRunResearch = React.useCallback(
    async (prompt: string) => {
      dispatch({ type: "START_RESEARCH", prompt });
      const startTime = Date.now();

      try {
        const res = await fetch("/api/research/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            priorIterations: buildMessageHistory(),
          }),
        });

        if (!res.ok || !res.body) {
          const errText = await res.text();
          dispatch({
            type: "ERROR",
            message: errText || "Research execution failed",
          });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          dispatch({ type: "STREAM_CHUNK", text: fullText });
        }

        // Extract metadata trailer
        const metaMatch = fullText.match(/<!--META:(\{.*?\})-->/);
        const meta = metaMatch ? JSON.parse(metaMatch[1]) : null;
        const cleanText = fullText.replace(/<!--META:\{.*?\}-->/, "").trim();
        const latencyMs = Date.now() - startTime;

        // Persist iteration
        const { iteration } = await saveIteration({
          sessionId: session.id,
          iterationNum: nextIterationNum,
          userPrompt: question,
          generatedPrompt: editablePrompt || null,
          resultMarkdown: cleanText,
          inputTokens: meta?.inputTokens ?? null,
          outputTokens: meta?.outputTokens ?? null,
          latencyMs,
        });

        if (iteration) {
          setIterations((prev) => [...prev, iteration]);
        }

        dispatch({ type: "COMPLETE", result: cleanText });
        setQuestion("");
        setEditablePrompt("");
      } catch (err) {
        dispatch({
          type: "ERROR",
          message: err instanceof Error ? err.message : "Research failed",
        });
      }
    },
    [
      buildMessageHistory,
      session.id,
      nextIterationNum,
      question,
      editablePrompt,
    ]
  );

  // Export PDF
  const handleExportPdf = React.useCallback(async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/research/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });

      if (!res.ok) {
        throw new Error("PDF export failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `research-${session.id.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF export error:", err);
    } finally {
      setIsExporting(false);
    }
  }, [session.id]);

  // Complete session
  const handleComplete = React.useCallback(async () => {
    await completeSession(session.id);
    setSessionStatus("completed");
  }, [session.id]);

  // Start follow-up
  const handleStartFollowUp = () => {
    dispatch({ type: "RESET" });
  };

  // Determine input mode
  const inputMode =
    state.step === "generating-prompt"
      ? "generating"
      : state.step === "editing-prompt"
      ? "editing"
      : "question";

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            {session.title}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge
              variant={sessionStatus === "active" ? "default" : "secondary"}
            >
              {sessionStatus}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {iterations.length} / {MAX_ITERATIONS} iterations
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {iterations.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPdf}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-1.5" />
              )}
              Export PDF
            </Button>
          )}
          {sessionStatus === "active" && iterations.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleComplete}>
              <CheckCircle className="w-4 h-4 mr-1.5" />
              Complete
            </Button>
          )}
        </div>
      </div>

      {/* Iteration history */}
      <IterationHistory iterations={iterations} />

      {/* Current flow */}
      {sessionStatus === "completed" ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
          <p className="font-medium text-foreground">Research complete</p>
          <p className="mt-1">
            This session has {iterations.length} iteration
            {iterations.length !== 1 ? "s" : ""}. Use Export PDF to download
            the full report.
          </p>
        </Card>
      ) : (
        <>
          {/* Input / generating / editing step */}
          {(state.step === "input" ||
            state.step === "generating-prompt" ||
            state.step === "editing-prompt") && (
            <Card className="p-5">
              <ResearchInput
                mode={inputMode}
                question={question}
                onQuestionChange={setQuestion}
                generatedPrompt={editablePrompt}
                onPromptChange={setEditablePrompt}
                onGeneratePrompt={handleGeneratePrompt}
                onRunResearch={handleRunResearch}
                isFollowUp={iterations.length > 0}
                disabled={state.step === "generating-prompt"}
              />
            </Card>
          )}

          {/* Streaming research results */}
          {state.step === "researching" && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span className="text-sm font-medium text-blue-600">
                  Researching...
                </span>
              </div>
              <ResearchStream
                markdown={state.streamedText}
                isStreaming={true}
              />
            </Card>
          )}

          {/* Completed iteration */}
          {state.step === "complete" && (
            <Card className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-600">
                  Research complete
                </span>
              </div>
              <ResearchStream markdown={state.result} />
              {canIterate && (
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button onClick={handleStartFollowUp} size="sm">
                    <MessageSquarePlus className="w-4 h-4 mr-1.5" />
                    Ask Follow-up
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {MAX_ITERATIONS - nextIterationNum + 1} iterations remaining
                  </span>
                </div>
              )}
              {!canIterate && iterations.length >= MAX_ITERATIONS && (
                <p className="text-xs text-muted-foreground pt-2 border-t">
                  Maximum iterations reached. Export your results as PDF.
                </p>
              )}
            </Card>
          )}

          {/* Error state */}
          {state.step === "error" && (
            <Card className="p-5 border-red-200 bg-red-50">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-medium text-red-600">Error</span>
              </div>
              <p className="text-sm text-red-700">{state.message}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => dispatch({ type: "RESET" })}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Try again
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
