import { subMonths, startOfMonth } from "date-fns";

export type Granularity = "monthly" | "quarterly" | "annual";

/**
 * Parses date range from URL search params.
 * Safe to call from both server and client components.
 */
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
