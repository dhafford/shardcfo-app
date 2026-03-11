import { redirect } from "next/navigation";
import Link from "next/link";
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
import { EmptyState } from "@/components/shared/empty-state";
import {
  GitBranch,
  PlusCircle,
  TrendingUp,
  Calendar,
  ArrowRight,
} from "lucide-react";
import { createScenario } from "./actions";
import type { ScenarioRow } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ScenarioCard({
  scenario,
  companyId,
}: {
  scenario: ScenarioRow;
  companyId: string;
}) {
  const assumptions = scenario.assumptions as Record<string, unknown> | null;
  const mrrGrowth = typeof assumptions?.mrrGrowthRate === "number"
    ? `${(assumptions.mrrGrowthRate * 100).toFixed(1)}% MoM MRR growth`
    : null;
  const projMonths =
    typeof assumptions?.projectionMonths === "number"
      ? `${assumptions.projectionMonths}-month projection`
      : null;

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base truncate">{scenario.name}</CardTitle>
            {scenario.description && (
              <CardDescription className="mt-0.5 line-clamp-2">
                {scenario.description}
              </CardDescription>
            )}
          </div>
          <Badge className="shrink-0 text-xs bg-blue-100 text-blue-800">
            {scenario.is_active ? "active" : "inactive"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Key assumptions summary */}
        <div className="space-y-1.5">
          {mrrGrowth && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="w-3.5 h-3.5 shrink-0" />
              <span>{mrrGrowth}</span>
            </div>
          )}
          {projMonths && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>{projMonths}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Link
            href={`/dashboard/companies/${companyId}/scenarios/${scenario.id}`}
            className="flex-1 inline-flex items-center justify-center gap-1 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 py-1 text-[0.8rem] font-medium transition-colors hover:bg-muted"
          >
            Edit
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            href={`/dashboard/companies/${companyId}/scenarios?compare=${scenario.id}`}
            className="inline-flex items-center justify-center rounded-[min(var(--radius-md),12px)] px-2.5 py-1 text-[0.8rem] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Compare
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
  searchParams: Promise<{ compare?: string }>;
}

export default async function ScenariosPage({
  params,
  searchParams,
}: PageProps) {
  const { companyId } = await params;
  await searchParams; // consume

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: scenariosRaw } = await (supabase as any)
    .from("scenarios")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  const scenarioList = (scenariosRaw ?? []) as import("@/lib/supabase/types").ScenarioRow[];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Scenarios</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Model different growth and spending assumptions to project financial
            outcomes.
          </p>
        </div>

        <form action={createScenario}>
          <input type="hidden" name="companyId" value={companyId} />
          <input type="hidden" name="scenarioType" value="custom" />
          <input type="hidden" name="name" value="New Scenario" />
          <Button type="submit" size="sm" className="gap-1.5">
            <PlusCircle className="w-4 h-4" />
            New scenario
          </Button>
        </form>
      </div>

      {scenarioList.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="No scenarios yet"
          description="Create a scenario to model different growth assumptions and project your financials up to 24 months out."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scenarioList.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              companyId={companyId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export const dynamic = "force-dynamic";
