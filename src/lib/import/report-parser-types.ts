/**
 * Shared types and utilities for accounting platform report parsers.
 *
 * QuickBooks and Xero both export P&L / Balance Sheet reports as
 * hierarchical CSVs. These parsers normalise them into a flat row
 * format that the existing generic import pipeline can consume.
 */

export interface FlatRow {
  account_code: string;
  account_name: string;
  account_type: string; // maps to public.accounts.category
  amount: string;
  date: string; // YYYY-MM-01
}

export interface ParsedReport {
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
  errors: string[];
  source: "quickbooks" | "xero";
}

/** The 8 account categories in public.accounts.category */
export type AccountCategory =
  | "revenue"
  | "cogs"
  | "operating_expense"
  | "other_income"
  | "other_expense"
  | "asset"
  | "liability"
  | "equity";

/** Normalised output headers — same order as FlatRow keys */
export const REPORT_HEADERS = [
  "account_code",
  "account_name",
  "account_type",
  "amount",
  "date",
] as const;
