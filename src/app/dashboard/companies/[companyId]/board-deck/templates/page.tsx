import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Presentation, Check } from "lucide-react";
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
import { DECK_TEMPLATES, SECTION_TYPE_DEFINITIONS } from "@/lib/constants";
import { createDeck } from "../actions";

// ---------------------------------------------------------------------------
// Template card
// ---------------------------------------------------------------------------

function TemplateCard({
  template,
  companyId,
}: {
  template: (typeof DECK_TEMPLATES)[number];
  companyId: string;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
            <Presentation className="w-5 h-5 text-blue-400" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base">{template.name}</CardTitle>
            <CardDescription className="mt-1 text-sm leading-snug">
              {template.description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Section list */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Included sections
          </p>
          <ul className="space-y-1">
            {template.sections.map((sectionType) => {
              const def = SECTION_TYPE_DEFINITIONS.find(
                (d) => d.type === sectionType
              );
              return (
                <li
                  key={sectionType}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  <span>{def?.label ?? sectionType}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Badge variant="outline" className="text-xs">
            {template.sections.length} sections
          </Badge>
        </div>

        <form action={createDeck} className="pt-1">
          <input type="hidden" name="companyId" value={companyId} />
          <input type="hidden" name="templateId" value={template.id} />
          <input type="hidden" name="title" value={template.name} />
          <Button type="submit" className="w-full" size="sm">
            Use this template
          </Button>
        </form>
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

export default async function TemplateGalleryPage({ params }: PageProps) {
  const { companyId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/dashboard/companies/${companyId}/board-deck`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Board Decks
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold">Template Gallery</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Choose a template to create a new board deck pre-populated with
          relevant sections.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {DECK_TEMPLATES.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            companyId={companyId}
          />
        ))}
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
