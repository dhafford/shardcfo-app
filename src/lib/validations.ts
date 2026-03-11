/**
 * Zod validation schemas for all ShardCFO forms.
 *
 * Uses Zod v4 API. Each schema exports:
 *  - The schema itself (e.g. CreateCompanySchema)
 *  - Its inferred TypeScript type (e.g. CreateCompanyInput)
 *
 * Conventions:
 *  - Required string fields use .min(1) to reject empty strings.
 *  - Optional fields use .optional() (produces T | undefined).
 *  - Nullable fields that can be explicitly null use .nullable().
 *  - Monetary amounts are numbers with .min(0).
 *  - Rate/percentage values are stored as decimals (0.15 = 15%), validated 0–1.
 */

import { z } from "zod";
import {
  SUPPORTED_CURRENCIES,
  SUPPORTED_FUNDING_STAGES,
  MAX_IMPORT_FILE_SIZE_BYTES,
  MAX_PROJECTION_MONTHS,
} from "@/lib/constants";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

const periodSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Period must be in YYYY-MM format");

const currencySchema = z.enum(
  SUPPORTED_CURRENCIES as unknown as [string, ...string[]]
);

const fundingStageSchema = z.enum(
  SUPPORTED_FUNDING_STAGES.map((s) => s.value) as [string, ...string[]]
);

const decimalRateSchema = z.number().min(0).max(1);

const positiveMoneySchema = z.number().min(0);

// ---------------------------------------------------------------------------
// Company
// ---------------------------------------------------------------------------

export const CreateCompanySchema = z.object({
  name: z.string().min(1, "Company name is required").max(200),
  website: z.url().optional(),
  currency: currencySchema.default("USD"),
  fundingStage: fundingStageSchema.optional(),
  foundedYear: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear())
    .optional(),
  description: z.string().max(1000).optional(),
});

export type CreateCompanyInput = z.infer<typeof CreateCompanySchema>;

export const UpdateCompanySchema = CreateCompanySchema.partial();

export type UpdateCompanyInput = z.infer<typeof UpdateCompanySchema>;

// ---------------------------------------------------------------------------
// Chart of Accounts
// ---------------------------------------------------------------------------

const ACCOUNT_TYPES = [
  "revenue",
  "cogs",
  "operating_expense",
  "other_income",
  "other_expense",
] as const;

export const CreateAccountSchema = z.object({
  name: z.string().min(1, "Account name is required").max(200),
  type: z.enum(ACCOUNT_TYPES),
  subcategory: z.string().min(1, "Subcategory is required").max(100),
  description: z.string().max(500).optional(),
  /** Whether this account should appear in board reporting. */
  isVisibleInReports: z.boolean().default(true),
});

export type CreateAccountInput = z.infer<typeof CreateAccountSchema>;

export const UpdateAccountSchema = CreateAccountSchema.partial();

export type UpdateAccountInput = z.infer<typeof UpdateAccountSchema>;

// ---------------------------------------------------------------------------
// Line Item / Metric Entry
// ---------------------------------------------------------------------------

export const MetricEntrySchema = z.object({
  accountId: z.string().min(1, "Account is required"),
  date: z.iso.date(),
  amount: z.number().min(0, "Amount must be non-negative"),
  description: z.string().max(500).optional(),
});

export type MetricEntryInput = z.infer<typeof MetricEntrySchema>;

// ---------------------------------------------------------------------------
// MRR Snapshot
// ---------------------------------------------------------------------------

export const MrrSnapshotSchema = z.object({
  period: periodSchema,
  mrr: positiveMoneySchema,
  newMrr: positiveMoneySchema,
  expansionMrr: positiveMoneySchema,
  contractionMrr: positiveMoneySchema,
  churnedMrr: positiveMoneySchema,
  reactivationMrr: positiveMoneySchema,
});

export type MrrSnapshotInput = z.infer<typeof MrrSnapshotSchema>;

// ---------------------------------------------------------------------------
// Customer Snapshot
// ---------------------------------------------------------------------------

export const CustomerSnapshotSchema = z.object({
  period: periodSchema,
  activeCustomers: z.number().int().min(0),
  newCustomers: z.number().int().min(0),
  churnedCustomers: z.number().int().min(0),
});

export type CustomerSnapshotInput = z.infer<typeof CustomerSnapshotSchema>;

// ---------------------------------------------------------------------------
// Data Import
// ---------------------------------------------------------------------------

const IMPORT_TYPES = ["line_items", "mrr_snapshots", "customer_snapshots", "budget"] as const;

export const ImportDataSchema = z.object({
  importType: z.enum(IMPORT_TYPES),
  /** Client-side file size validation — bytes. */
  fileSizeBytes: z
    .number()
    .max(MAX_IMPORT_FILE_SIZE_BYTES, "File must be under 10 MB"),
  fileName: z.string().min(1),
  /** "YYYY-MM" override for the period when the file doesn't contain dates. */
  overridePeriod: periodSchema.optional(),
  /** When true, existing data for the period will be replaced rather than appended. */
  replaceExisting: z.boolean().default(false),
});

export type ImportDataInput = z.infer<typeof ImportDataSchema>;

// ---------------------------------------------------------------------------
// Scenario
// ---------------------------------------------------------------------------

const HirePlanItemSchema = z.object({
  monthOffset: z.number().int().min(0).max(MAX_PROJECTION_MONTHS - 1),
  headcount: z.number().int().min(1),
  monthlySalaryPerPerson: positiveMoneySchema,
});

const FundraisingEventSchema = z.object({
  closeDate: periodSchema,
  amount: z.number().min(1, "Fundraise amount must be greater than zero"),
});

export const CreateScenarioSchema = z.object({
  name: z.string().min(1, "Scenario name is required").max(200),
  description: z.string().max(1000).optional(),
  projectionMonths: z
    .number()
    .int()
    .min(1)
    .max(MAX_PROJECTION_MONTHS)
    .default(12),
  mrrGrowthRate: decimalRateSchema.optional(),
  cogsPercentage: decimalRateSchema.optional(),
  otherOpexGrowthRate: decimalRateSchema.optional(),
  employerBurdenRate: decimalRateSchema.optional(),
  hirePlan: z.array(HirePlanItemSchema).optional(),
  fundraisingEvents: z.array(FundraisingEventSchema).optional(),
});

export type CreateScenarioInput = z.infer<typeof CreateScenarioSchema>;

export const UpdateScenarioSchema = CreateScenarioSchema.partial();

export type UpdateScenarioInput = z.infer<typeof UpdateScenarioSchema>;

// ---------------------------------------------------------------------------
// Board Deck
// ---------------------------------------------------------------------------

const BOARD_DECK_SECTIONS = [
  "executive_summary",
  "financial_overview",
  "saas_metrics",
  "runway",
  "variance",
  "scenario",
  "appendix",
] as const;

export const CreateBoardDeckSchema = z.object({
  title: z.string().min(1, "Deck title is required").max(200),
  periodFrom: periodSchema,
  periodTo: periodSchema,
  sections: z
    .array(z.enum(BOARD_DECK_SECTIONS))
    .min(1, "Select at least one section"),
  includeCommentary: z.boolean().default(true),
  logoUrl: z.url().optional(),
  /** Primary brand color hex string, e.g. "#1d4ed8". */
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color")
    .optional(),
}).refine(
  (data) => data.periodFrom <= data.periodTo,
  { message: "Period from must be before or equal to period to", path: ["periodTo"] }
);

export type CreateBoardDeckInput = z.infer<typeof CreateBoardDeckSchema>;

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

export const CreateBudgetLineSchema = z.object({
  accountId: z.string().min(1),
  period: periodSchema,
  budgetedAmount: positiveMoneySchema,
  notes: z.string().max(500).optional(),
});

export type CreateBudgetLineInput = z.infer<typeof CreateBudgetLineSchema>;

export const BulkCreateBudgetSchema = z.object({
  lines: z.array(CreateBudgetLineSchema).min(1, "At least one budget line is required"),
});

export type BulkCreateBudgetInput = z.infer<typeof BulkCreateBudgetSchema>;

// ---------------------------------------------------------------------------
// Auth / User profile
// ---------------------------------------------------------------------------

export const UpdateUserProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  avatarUrl: z.url().optional(),
});

export type UpdateUserProfileInput = z.infer<typeof UpdateUserProfileSchema>;

// ---------------------------------------------------------------------------
// Re-export of enum literals for runtime use in UI components
// ---------------------------------------------------------------------------

export const ACCOUNT_TYPE_OPTIONS = ACCOUNT_TYPES.map((type) => ({
  value: type,
  label: type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" "),
}));

export const IMPORT_TYPE_OPTIONS = IMPORT_TYPES.map((type) => ({
  value: type,
  label: type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" "),
}));

export const BOARD_DECK_SECTION_OPTIONS = BOARD_DECK_SECTIONS.map((s) => ({
  value: s,
  label: s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" "),
}));
