"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Play, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResearchInputProps {
  /** Current step in the flow */
  mode: "question" | "generating" | "editing";
  /** The user's original question */
  question: string;
  onQuestionChange: (value: string) => void;
  /** The AI-generated prompt (available in editing mode) */
  generatedPrompt: string;
  onPromptChange: (value: string) => void;
  /** Callbacks */
  onGeneratePrompt: () => void;
  onRunResearch: (prompt: string) => void;
  /** Whether this is a follow-up iteration */
  isFollowUp?: boolean;
  /** Disable all controls */
  disabled?: boolean;
}

export function ResearchInput({
  mode,
  question,
  onQuestionChange,
  generatedPrompt,
  onPromptChange,
  onGeneratePrompt,
  onRunResearch,
  isFollowUp = false,
  disabled = false,
}: ResearchInputProps) {
  const [editingPrompt, setEditingPrompt] = React.useState(false);

  // Reset editing state when prompt changes externally
  React.useEffect(() => {
    setEditingPrompt(false);
  }, [generatedPrompt]);

  if (mode === "question") {
    return (
      <div className="space-y-3">
        <label className="text-sm font-medium text-slate-700">
          {isFollowUp
            ? "Follow-up question or refinement"
            : "What would you like to research?"}
        </label>
        <Textarea
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          placeholder={
            isFollowUp
              ? "Ask a follow-up question, request deeper analysis, or explore a different angle..."
              : "e.g., What is the optimal capital structure for a Series B SaaS company with $8M ARR looking to minimize dilution while maintaining 18+ months runway?"
          }
          className="min-h-[120px] resize-y"
          disabled={disabled}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {question.length} characters
          </span>
          <Button
            onClick={onGeneratePrompt}
            disabled={disabled || question.trim().length < 10}
          >
            <Sparkles className="w-4 h-4 mr-1.5" />
            Generate Research Prompt
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "generating") {
    return (
      <div className="flex items-center gap-3 py-8 justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Generating research prompt...</span>
      </div>
    );
  }

  // mode === "editing"
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">
          Research Prompt
        </label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEditingPrompt(!editingPrompt)}
          className="text-xs gap-1"
        >
          <Pencil className="w-3 h-3" />
          {editingPrompt ? "Preview" : "Edit"}
        </Button>
      </div>

      {editingPrompt ? (
        <Textarea
          value={generatedPrompt}
          onChange={(e) => onPromptChange(e.target.value)}
          className="min-h-[200px] resize-y font-mono text-sm"
          disabled={disabled}
        />
      ) : (
        <div
          className={cn(
            "rounded-md border bg-slate-50 p-4 text-sm leading-relaxed whitespace-pre-wrap",
            "max-h-[300px] overflow-y-auto"
          )}
        >
          {generatedPrompt}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {generatedPrompt.length} characters
        </span>
        <Button
          onClick={() => onRunResearch(generatedPrompt)}
          disabled={disabled || generatedPrompt.trim().length < 10}
        >
          <Play className="w-4 h-4 mr-1.5" />
          Run Research
        </Button>
      </div>
    </div>
  );
}
