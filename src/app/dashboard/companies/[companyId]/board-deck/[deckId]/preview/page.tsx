import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAuth } from "@/lib/supabase/require-auth";
import { DeckPreviewNavigator } from "./navigator";
import type { DeckSection } from "@/components/board-deck/deck-editor";

interface PageProps {
  params: Promise<{ companyId: string; deckId: string }>;
}

export default async function DeckPreviewPage({ params }: PageProps) {
  const { companyId, deckId } = await params;
  const { supabase } = await requireAuth();

  const [{ data: deck }, { data: company }] = await Promise.all([
    supabase
      .from("board_decks")
      .select("*")
      .eq("id", deckId)
      .eq("company_id", companyId)
      .single(),
    supabase.from("companies").select("*").eq("id", companyId).single(),
  ]);

  if (!deck || !company) {
    notFound();
  }

  const rawSections = Array.isArray(deck.sections) ? deck.sections : [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sections: DeckSection[] = rawSections
    .map((s: any, i: number) => {
      const section = s as Record<string, unknown>;
      return {
        id: (section.id as string) || String(i),
        type: (section.type as string) || "title_slide",
        config: (section.config as Record<string, unknown>) || {},
        order: typeof section.order === "number" ? section.order : i,
      };
    })
    .sort((a: DeckSection, b: DeckSection) => a.order - b.order);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-700 bg-slate-800">
        <Link
          href={`/dashboard/companies/${companyId}/board-deck/${deckId}`}
          className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to editor
        </Link>
        <p className="text-sm font-medium text-white truncate max-w-xs">
          {deck.title}
        </p>
        {/* Spacer to keep title centered */}
        <div className="w-28" />
      </div>

      {/* Client navigator handles slide prev/next interactions */}
      <DeckPreviewNavigator sections={sections} company={company} />
    </div>
  );
}

export const dynamic = "force-dynamic";
