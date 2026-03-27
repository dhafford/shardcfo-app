"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Loader2,
  BookOpen,
  Clock,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createSession, deleteSession } from "./actions";
import type { ResearchSessionRow } from "@/lib/supabase/types";

interface ResearchListClientProps {
  sessions: ResearchSessionRow[];
}

export function ResearchListClient({ sessions: initialSessions }: ResearchListClientProps) {
  const router = useRouter();
  const [sessions, setSessions] =
    React.useState<ResearchSessionRow[]>(initialSessions);
  const [showNewForm, setShowNewForm] = React.useState(false);
  const [question, setQuestion] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const handleCreate = async () => {
    if (!question.trim() || question.trim().length < 10) return;
    setCreating(true);

    const { session, error } = await createSession(question.trim());

    if (session && !error) {
      router.push(`/dashboard/research/${session.id}`);
    } else {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await deleteSession(id);
    if (!error) {
      setSessions((prev) => prev.filter((s) => s.id !== id));
    }
    setDeletingId(null);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* New research */}
      {showNewForm ? (
        <Card className="p-5 space-y-3">
          <label className="text-sm font-medium text-slate-700">
            What strategic finance question do you want to research?
          </label>
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g., What is the optimal capital structure for a Series B SaaS company with $8M ARR?"
            className="min-h-[100px] resize-y"
            autoFocus
          />
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowNewForm(false);
                setQuestion("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || question.trim().length < 10}
              size="sm"
            >
              {creating ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4 mr-1.5" />
              )}
              Start Research
            </Button>
          </div>
        </Card>
      ) : (
        <Button onClick={() => setShowNewForm(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          New Research
        </Button>
      )}

      {/* Session list */}
      {sessions.length === 0 && !showNewForm && (
        <Card className="p-12 text-center">
          <BookOpen className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">
            No research sessions yet
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Start a new research session to get deep strategic finance insights
          </p>
        </Card>
      )}

      {sessions.length > 0 && (
        <div className="space-y-2">
          {sessions.map((s) => (
            <Card
              key={s.id}
              className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer group"
              onClick={() => router.push(`/dashboard/research/${s.id}`)}
            >
              <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{s.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge
                    variant={s.status === "active" ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {s.status}
                  </Badge>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {formatDate(s.created_at)}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(s.id);
                }}
                disabled={deletingId === s.id}
              >
                {deletingId === s.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                )}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
