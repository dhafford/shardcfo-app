"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuth } from "@/lib/supabase/require-auth";
import type { Json } from "@/lib/supabase/types";

// ─── Validation schema ─────────────────────────────────────────────────────────

const MONTH_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const createCompanySchema = z.object({
  name: z.string().min(1, "Company name is required").max(200),
  legal_entity: z.string().max(200).optional(),
  industry: z.string().max(100).optional(),
  stage: z.string().max(50).optional(),
  fiscal_year_end_month: z.coerce
    .number()
    .int()
    .min(1)
    .max(12)
    .default(12),
  currency: z
    .string()
    .length(3, "Currency must be a 3-letter ISO code")
    .toUpperCase()
    .default("USD"),
  founded_year: z.coerce
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 1)
    .optional(),
});

// ─── Helpers ───────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

// ─── Action ────────────────────────────────────────────────────────────────────

export interface CreateCompanyState {
  errors?: Record<string, string[]>;
  message?: string;
}

export async function createCompany(
  _prev: CreateCompanyState,
  formData: FormData
): Promise<CreateCompanyState> {
  let user: Awaited<ReturnType<typeof requireAuth>>["user"];
  let supabase: Awaited<ReturnType<typeof requireAuth>>["supabase"];
  try {
    ({ user, supabase } = await requireAuth({ redirect: false }));
  } catch {
    return { message: "You must be signed in to create a company." };
  }

  // Validate
  const raw = {
    name: formData.get("name"),
    legal_entity: formData.get("legal_entity") || undefined,
    industry: formData.get("industry") || undefined,
    stage: formData.get("stage") || undefined,
    fiscal_year_end_month: formData.get("fiscal_year_end_month") || 12,
    currency: formData.get("currency") || "USD",
    founded_year: formData.get("founded_year") || undefined,
  };

  const parsed = createCompanySchema.safeParse(raw);

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    return { errors };
  }

  const { name, industry, fiscal_year_end_month, currency, founded_year } =
    parsed.data;

  const legalEntity = parsed.data.legal_entity;
  const stage = parsed.data.stage;

  // Store founded_year in metadata JSONB (not a column on companies)
  const metadata: Record<string, unknown> = {};
  if (founded_year) metadata.founded_year = founded_year;

  const { data: companyRaw, error } = await supabase
    .from("companies")
    .insert({
      name,
      owner_id: user.id,
      legal_entity: legalEntity || null,
      industry: industry || null,
      stage: stage || null,
      fiscal_year_end_month,
      currency,
      status: "active" as const,
      metadata: metadata as Json,
    })
    .select("id")
    .single();

  const company = companyRaw as { id: string } | null;

  if (error || !company) {
    return {
      message: error?.message ?? "Failed to create company. Please try again.",
    };
  }

  redirect(`/dashboard/companies/${company.id}`);
}
