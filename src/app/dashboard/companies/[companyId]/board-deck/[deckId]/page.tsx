import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/supabase/require-auth";
import { DeckEditor } from "@/components/board-deck/deck-editor";
import type { DeckSection } from "@/components/board-deck/deck-editor";

interface PageProps {
  params: Promise<{ companyId: string; deckId: string }>;
}

export default async function DeckEditorPage({ params }: PageProps) {
  const { companyId, deckId } = await params;
  const { supabase } = await requireAuth();

  // Fetch deck and company in parallel
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

  // Parse sections from deck
  const rawSections = Array.isArray(deck.sections) ? deck.sections : [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initialSections: DeckSection[] = rawSections.map((s: any, i: number) => {
    const section = s as Record<string, unknown>;
    return {
      id: (section.id as string) || crypto.randomUUID(),
      type: (section.type as string) || "title_slide",
      config: (section.config as Record<string, unknown>) || {},
      order: typeof section.order === "number" ? section.order : i,
    };
  });

  return (
    // The deck editor fills all available height — the company layout's
    // scrollable wrapper provides the outer container.
    <div className="h-full">
      <DeckEditor
        deck={deck}
        company={company}
        initialSections={initialSections}
      />
    </div>
  );
}

export const dynamic = "force-dynamic";
