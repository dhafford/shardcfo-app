import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  Presentation,
  PlusCircle,
  Eye,
  Pencil,
  Calendar,
  FileText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { createDeck } from "./actions";
import { DECK_TEMPLATES } from "@/lib/constants";
import type { BoardDeckRow } from "@/lib/supabase/types";


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  review: "bg-yellow-100 text-yellow-800",
  final: "bg-green-100 text-green-800",
  presented: "bg-blue-100 text-blue-800",
};

function formatDate(iso: string): string {
  try {
    return format(new Date(iso), "MMM d, yyyy");
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Template selection dialog content
// ---------------------------------------------------------------------------

function CreateDeckDialog({ companyId }: { companyId: string }) {
  return (
    <Dialog>
      <DialogTrigger>
        <Button size="sm" className="gap-1.5">
          <PlusCircle className="w-4 h-4" />
          Create New Deck
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Board Deck</DialogTitle>
          <DialogDescription>
            Choose a template to get started. You can add or remove sections
            after creating the deck.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          {DECK_TEMPLATES.map((template) => (
            <form key={template.id} action={createDeck}>
              <input type="hidden" name="companyId" value={companyId} />
              <input type="hidden" name="templateId" value={template.id} />
              <input type="hidden" name="title" value={template.name} />
              <button
                type="submit"
                className="w-full text-left rounded-lg border border-slate-200 p-4 hover:border-blue-400 hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                    <Presentation className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {template.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                      {template.description}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      {template.sections.length} sections
                    </p>
                  </div>
                </div>
              </button>
            </form>
          ))}

          <div className="pt-1">
            <Link
              href={`/dashboard/companies/${companyId}/board-deck/templates`}
              className="text-xs text-blue-600 hover:underline"
            >
              Browse all templates
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Deck card
// ---------------------------------------------------------------------------

function DeckCard({
  deck,
  companyId,
}: {
  deck: BoardDeckRow;
  companyId: string;
}) {
  const sections = (() => {
    const raw = deck.sections;
    if (!raw || !Array.isArray(raw)) return [];
    return raw as unknown[];
  })();

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base truncate">{deck.title}</CardTitle>
            {deck.title && (
              <CardDescription className="mt-0.5 line-clamp-2">
                {deck.period_start} — {deck.period_end}
              </CardDescription>
            )}
          </div>
          <Badge className={`shrink-0 text-xs ${STATUS_BADGE[deck.status]}`}>
            {deck.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          {deck.template_key && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span className="capitalize">
                {deck.template_key.replace(/_/g, " ")}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>Created {formatDate(deck.created_at)}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {sections.length} section{sections.length !== 1 ? "s" : ""}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Link
            href={`/dashboard/companies/${companyId}/board-deck/${deck.id}`}
            className="flex-1 inline-flex items-center justify-center gap-1 h-7 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] font-medium bg-primary text-primary-foreground transition-all hover:bg-primary/80"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </Link>
          <Link
            href={`/dashboard/companies/${companyId}/board-deck/${deck.id}/preview`}
            className="inline-flex items-center justify-center gap-1 h-7 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] font-medium border border-border bg-background hover:bg-muted transition-all"
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export default async function BoardDeckListPage({ params }: PageProps) {
  const { companyId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: decks } = await db
    .from("board_decks")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  const deckList: BoardDeckRow[] = decks ?? [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Board Decks</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create and manage board presentations for your company.
          </p>
        </div>
        <CreateDeckDialog companyId={companyId} />
      </div>

      {deckList.length === 0 ? (
        <EmptyState
          icon={Presentation}
          title="No board decks yet"
          description="Create a deck from a template to get started. Templates pre-populate with common sections you can customise."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deckList.map((deck) => (
            <DeckCard key={deck.id} deck={deck} companyId={companyId} />
          ))}
        </div>
      )}
    </div>
  );
}

export const dynamic = "force-dynamic";
