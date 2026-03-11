"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, subMonths, startOfMonth } from "date-fns";
import { useCallback } from "react";

type Granularity = "monthly" | "quarterly" | "annual";

interface PeriodSelectorProps {
  className?: string;
}

const PERIOD_PRESETS = [
  { label: "Last 3 months", months: 3 },
  { label: "Last 6 months", months: 6 },
  { label: "Last 12 months", months: 12 },
  { label: "Year to date", months: -1 },
  { label: "Last 24 months", months: 24 },
];

export function PeriodSelector({ className }: PeriodSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentRange = searchParams.get("range") || "12";
  const currentGranularity =
    (searchParams.get("granularity") as Granularity) || "monthly";

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(key, value);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <Select value={currentRange} onValueChange={(v) => { if (v) updateParams("range", v) }}>
        <SelectTrigger className="w-[160px] h-8 text-sm" aria-label="Select date range">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIOD_PRESETS.map((preset) => (
            <SelectItem
              key={preset.months}
              value={String(preset.months)}
            >
              {preset.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentGranularity}
        onValueChange={(v) => { if (v) updateParams("granularity", v) }}
      >
        <SelectTrigger className="w-[120px] h-8 text-sm" aria-label="Select granularity">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="monthly">Monthly</SelectItem>
          <SelectItem value="quarterly">Quarterly</SelectItem>
          <SelectItem value="annual">Annual</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function getDateRangeFromParams(searchParams: {
  range?: string;
  granularity?: string;
}): { startDate: Date; endDate: Date; granularity: Granularity } {
  const now = startOfMonth(new Date());
  const months = parseInt(searchParams.range || "12", 10);
  const granularity = (searchParams.granularity as Granularity) || "monthly";

  let startDate: Date;
  if (months === -1) {
    // Year to date
    startDate = new Date(now.getFullYear(), 0, 1);
  } else {
    startDate = subMonths(now, months - 1);
  }

  return { startDate, endDate: now, granularity };
}
