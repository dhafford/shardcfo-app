"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface ResearchStreamProps {
  markdown: string;
  isStreaming?: boolean;
  className?: string;
}

export function ResearchStream({
  markdown,
  isStreaming = false,
  className,
}: ResearchStreamProps) {
  const endRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom during streaming
  React.useEffect(() => {
    if (isStreaming && endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [markdown, isStreaming]);

  if (!markdown && !isStreaming) {
    return null;
  }

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "prose prose-slate max-w-none",
          "prose-headings:font-semibold prose-headings:tracking-tight",
          "prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-2",
          "prose-h3:text-base prose-h3:mt-4 prose-h3:mb-1",
          "prose-p:text-sm prose-p:leading-relaxed",
          "prose-li:text-sm",
          "prose-table:text-sm",
          "prose-th:bg-slate-100 prose-th:px-3 prose-th:py-1.5 prose-th:text-left prose-th:font-medium",
          "prose-td:px-3 prose-td:py-1.5 prose-td:border-b prose-td:border-slate-200",
          "prose-strong:text-slate-900",
          "prose-code:text-xs prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded"
        )}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </div>

      {isStreaming && (
        <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-0.5 align-text-bottom" />
      )}

      <div ref={endRef} />
    </div>
  );
}
