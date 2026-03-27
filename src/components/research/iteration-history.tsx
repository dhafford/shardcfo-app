"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, MessageSquare } from "lucide-react";
import { ResearchStream } from "./research-stream";
import { cn } from "@/lib/utils";
import type { ResearchIterationRow } from "@/lib/supabase/types";

interface IterationHistoryProps {
  iterations: ResearchIterationRow[];
  className?: string;
}

export function IterationHistory({
  iterations,
  className,
}: IterationHistoryProps) {
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set());

  if (iterations.length === 0) return null;

  const toggle = (num: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(num)) {
        next.delete(num);
      } else {
        next.add(num);
      }
      return next;
    });
  };

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Previous Iterations
      </p>
      {iterations.map((iteration) => {
        const isOpen = expanded.has(iteration.iteration_num);
        return (
          <Card key={iteration.id} className="overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(iteration.iteration_num)}
              className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors"
            >
              {isOpen ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
              <Badge variant="outline" className="shrink-0">
                #{iteration.iteration_num}
              </Badge>
              <span className="text-sm truncate flex-1">
                {iteration.user_prompt.slice(0, 120)}
                {iteration.user_prompt.length > 120 ? "..." : ""}
              </span>
              {iteration.output_tokens && (
                <span className="text-xs text-muted-foreground shrink-0">
                  {iteration.output_tokens.toLocaleString()} tokens
                </span>
              )}
            </button>

            {isOpen && (
              <div className="border-t px-4 py-4 space-y-3">
                {iteration.generated_prompt && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      Research Prompt
                    </p>
                    <div className="rounded-md border bg-slate-50 p-3 text-xs leading-relaxed whitespace-pre-wrap max-h-[150px] overflow-y-auto">
                      {iteration.generated_prompt}
                    </div>
                  </div>
                )}
                {iteration.result_markdown && (
                  <ResearchStream markdown={iteration.result_markdown} />
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
