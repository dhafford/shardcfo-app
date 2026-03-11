"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
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
import { createCompany, type CreateCompanyState } from "./actions";

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

const STAGE_OPTIONS = [
  { value: "pre_seed", label: "Pre-Seed" },
  { value: "seed", label: "Seed" },
  { value: "series_a", label: "Series A" },
  { value: "series_b", label: "Series B" },
  { value: "series_c", label: "Series C+" },
  { value: "growth", label: "Growth" },
  { value: "public", label: "Public" },
];

const INDUSTRY_OPTIONS = [
  "SaaS",
  "Fintech",
  "Healthtech",
  "E-commerce",
  "Marketplace",
  "Enterprise Software",
  "Consumer",
  "Hardware",
  "Climate Tech",
  "EdTech",
  "Other",
];

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "CAD", label: "CAD — Canadian Dollar" },
  { value: "AUD", label: "AUD — Australian Dollar" },
  { value: "SGD", label: "SGD — Singapore Dollar" },
];

const initialState: CreateCompanyState = {};

export default function NewCompanyPage() {
  const [state, formAction, isPending] = useActionState(
    createCompany,
    initialState
  );

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Back navigation */}
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Portfolio
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add New Company</CardTitle>
          <CardDescription>
            Create a new portfolio company. You can import financial data and
            configure metrics after setup.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {state.message && (
            <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {state.message}
            </div>
          )}

          <form action={formAction} className="space-y-5">
            {/* Company name */}
            <div className="space-y-1.5">
              <Label htmlFor="name">
                Company Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="Acme Corp"
                required
                aria-describedby={
                  state.errors?.name ? "name-error" : undefined
                }
              />
              {state.errors?.name && (
                <p id="name-error" className="text-xs text-destructive">
                  {state.errors.name[0]}
                </p>
              )}
            </div>

            {/* Legal entity */}
            <div className="space-y-1.5">
              <Label htmlFor="legal_entity">Legal Entity Name</Label>
              <Input
                id="legal_entity"
                name="legal_entity"
                placeholder="Acme Corp, Inc."
              />
              <p className="text-xs text-muted-foreground">
                The full legal name as registered. Optional.
              </p>
            </div>

            {/* Industry + Stage row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="industry">Industry</Label>
                <Select name="industry">
                  <SelectTrigger id="industry" aria-label="Industry">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRY_OPTIONS.map((ind) => (
                      <SelectItem key={ind} value={ind}>
                        {ind}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="stage">Stage</Label>
                <Select name="stage">
                  <SelectTrigger id="stage" aria-label="Company stage">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGE_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Fiscal year end + Currency row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="fiscal_year_end_month">
                  Fiscal Year End Month
                </Label>
                <Select
                  name="fiscal_year_end_month"
                  defaultValue="12"
                >
                  <SelectTrigger
                    id="fiscal_year_end_month"
                    aria-label="Fiscal year end month"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((month, idx) => (
                      <SelectItem key={idx + 1} value={String(idx + 1)}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {state.errors?.fiscal_year_end_month && (
                  <p className="text-xs text-destructive">
                    {state.errors.fiscal_year_end_month[0]}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="currency">Reporting Currency</Label>
                <Select name="currency" defaultValue="USD">
                  <SelectTrigger id="currency" aria-label="Reporting currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {state.errors?.currency && (
                  <p className="text-xs text-destructive">
                    {state.errors.currency[0]}
                  </p>
                )}
              </div>
            </div>

            {/* Founded year */}
            <div className="space-y-1.5">
              <Label htmlFor="founded_year">Founded Year</Label>
              <Input
                id="founded_year"
                name="founded_year"
                type="number"
                placeholder={String(new Date().getFullYear())}
                min={1900}
                max={new Date().getFullYear() + 1}
                className="w-32"
              />
            </div>

            {/* Submit */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                disabled={isPending}
                className="bg-[#1a1a2e] text-white hover:bg-[#1a1a2e]/90"
              >
                {isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Create Company
              </Button>
              <Link href="/dashboard">
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
