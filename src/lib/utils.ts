import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatMonths(value: number): string {
  return `${value.toFixed(0)} mo`;
}

export function getRunwayColor(months: number): string {
  if (months >= 18) return "text-green-600";
  if (months >= 12) return "text-green-500";
  if (months >= 6) return "text-amber-500";
  return "text-red-600";
}

export function getRunwayBgColor(months: number): string {
  if (months >= 18) return "bg-green-500";
  if (months >= 12) return "bg-green-400";
  if (months >= 6) return "bg-amber-400";
  return "bg-red-500";
}

export function getStageLabel(stage: string | null): string {
  const labels: Record<string, string> = {
    pre_seed: "Pre-Seed",
    seed: "Seed",
    series_a: "Series A",
    series_b: "Series B",
    series_c: "Series C",
    growth: "Growth",
    public: "Public",
  };
  return labels[stage || ""] || stage || "—";
}

export function getStageColor(stage: string | null): string {
  const colors: Record<string, string> = {
    pre_seed: "bg-slate-100 text-slate-700",
    seed: "bg-emerald-100 text-emerald-700",
    series_a: "bg-blue-100 text-blue-700",
    series_b: "bg-violet-100 text-violet-700",
    series_c: "bg-purple-100 text-purple-700",
    growth: "bg-amber-100 text-amber-700",
    public: "bg-slate-200 text-slate-800",
  };
  return colors[stage || ""] || "bg-slate-100 text-slate-700";
}
