import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Archive, RotateCcw } from "lucide-react";
import { updateCompany, archiveCompany } from "./actions";
import {
  SUPPORTED_CURRENCIES,
  SUPPORTED_FUNDING_STAGES,
} from "@/lib/constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const INDUSTRY_OPTIONS = [
  "SaaS",
  "Fintech",
  "HealthTech",
  "EdTech",
  "E-commerce",
  "MarketTech",
  "DevTools",
  "Security",
  "AI / ML",
  "Data & Analytics",
  "Infrastructure",
  "Other",
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export default async function CompanySettingsPage({ params }: PageProps) {
  const { companyId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: companyRaw } = await (supabase as any)
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();

  const company = companyRaw as import("@/lib/supabase/types").CompanyRow | null;

  if (!company) notFound();

  // Determine if the current user is an admin
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileRaw } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const profile = profileRaw as Pick<import("@/lib/supabase/types").ProfileRow, "role"> | null;

  const isAdmin = profile?.role === "admin";
  const isArchived = company.status === "archived";

  const settings = (company.settings as Record<string, unknown>) ?? {};
  const fundingStage = (settings.funding_stage as string) ?? "";
  const legalEntity = (settings.legal_entity as string) ?? "";

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Company Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage details for {company.name}.
        </p>
      </div>

      {/* Company details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company Details</CardTitle>
          <CardDescription>
            Basic information about the company.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateCompany} className="space-y-4">
            <input type="hidden" name="companyId" value={companyId} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Company name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={company.name}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="legalEntity">Legal entity name</Label>
                <Input
                  id="legalEntity"
                  name="legalEntity"
                  defaultValue={legalEntity}
                  placeholder="e.g. Acme Corp. Inc."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="industry">Industry</Label>
                <Select
                  name="industry"
                  defaultValue={company.industry ?? ""}
                >
                  <SelectTrigger id="industry">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRY_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fundingStage">Funding stage</Label>
                <Select name="fundingStage" defaultValue={fundingStage}>
                  <SelectTrigger id="fundingStage">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_FUNDING_STAGES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fiscalYearEndMonth">Fiscal year end month</Label>
                <Select
                  name="fiscalYearEndMonth"
                  defaultValue={String(company.fiscal_year_end_month)}
                >
                  <SelectTrigger id="fiscalYearEndMonth">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((month, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="currency">Currency</Label>
                <Select name="currency" defaultValue={company.currency}>
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="foundedYear">Founded year</Label>
                <Input
                  id="foundedYear"
                  name="foundedYear"
                  type="number"
                  min={1900}
                  max={new Date().getFullYear() + 1}
                  defaultValue={company.founded_year ?? ""}
                  placeholder="e.g. 2020"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button type="submit" size="sm">
                Save changes
              </Button>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">
                  {company.status}
                </Badge>
                <span>Slug: {company.slug}</span>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Archive section */}
      {isAdmin && (
        <>
          <Separator />

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">Archive Company</h2>
            </div>

            <Card className="border-orange-200 bg-orange-50/50">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <p className="text-sm font-medium">
                      {isArchived
                        ? "This company is archived."
                        : "Archive this company"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isArchived
                        ? "Restoring will make the company active and visible to team members again."
                        : "Archiving hides the company from the default view and marks it inactive. Data is preserved and can be restored."}
                    </p>
                    <form action={archiveCompany}>
                      <input type="hidden" name="companyId" value={companyId} />
                      <input
                        type="hidden"
                        name="action"
                        value={isArchived ? "unarchive" : "archive"}
                      />
                      <Button
                        type="submit"
                        size="sm"
                        variant={isArchived ? "outline" : "destructive"}
                        className="mt-1 gap-1.5"
                      >
                        {isArchived ? (
                          <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            Restore company
                          </>
                        ) : (
                          <>
                            <Archive className="w-3.5 h-3.5" />
                            Archive company
                          </>
                        )}
                      </Button>
                    </form>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Danger zone */}
          <Separator />

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <h2 className="text-base font-semibold text-destructive">
                Danger Zone
              </h2>
            </div>

            <Card className="border-destructive/30">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-sm font-medium">Delete this company</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Permanently deletes the company and all associated
                      financial data, metrics, scenarios, and board decks.
                      This action cannot be undone.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled
                    title="Contact support to permanently delete a company"
                  >
                    Delete company
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Permanent deletion is intentionally disabled in the UI to
                  prevent accidental data loss. Contact support if you need
                  permanent deletion.
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

export const dynamic = "force-dynamic";
