"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface KpiCardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  trend?: "up" | "down" | "flat";
  trendIsPositive?: boolean; // whether "up" is good (true for revenue, false for burn)
  unit?: string;
  sparklineData?: number[];
  className?: string;
}

function MiniSparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 80;
  const height = 24;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      className="text-slate-400"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KpiCard({
  title,
  value,
  change,
  changeLabel,
  trend,
  trendIsPositive = true,
  sparklineData,
  className,
}: KpiCardProps) {
  const isPositive =
    trend === "up" ? trendIsPositive : trend === "down" ? !trendIsPositive : true;

  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {title}
            </p>
            <p className="text-2xl font-semibold tracking-tight font-mono tabular-nums">
              {value}
            </p>
          </div>
          {sparklineData && sparklineData.length > 1 && (
            <MiniSparkline data={sparklineData} />
          )}
        </div>
        {change !== undefined && (
          <div className="mt-2 flex items-center gap-1.5">
            {trend === "up" && (
              <TrendingUp
                className={cn(
                  "w-3.5 h-3.5",
                  isPositive ? "text-green-600" : "text-red-600"
                )}
              />
            )}
            {trend === "down" && (
              <TrendingDown
                className={cn(
                  "w-3.5 h-3.5",
                  isPositive ? "text-green-600" : "text-red-600"
                )}
              />
            )}
            {trend === "flat" && (
              <Minus className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span
              className={cn(
                "text-xs font-medium",
                isPositive ? "text-green-600" : "text-red-600",
                trend === "flat" && "text-slate-500"
              )}
            >
              {change > 0 ? "+" : ""}
              {change.toFixed(1)}%
            </span>
            {changeLabel && (
              <span className="text-xs text-muted-foreground">
                {changeLabel}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
