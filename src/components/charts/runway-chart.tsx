"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RunwayChartProps {
  data: Array<{
    period: string;
    projected: number;
    optimistic?: number;
    pessimistic?: number;
    isActual?: boolean;
  }>;
  title?: string;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export function RunwayChart({
  data,
  title = "Cash Runway Projection",
}: RunwayChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={formatCurrency}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={60}
            />
            <Tooltip
              formatter={(value: unknown) => [formatCurrency(typeof value === "number" ? value : 0)]}
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid #e2e8f0",
              }}
            />
            <ReferenceLine y={0} stroke="#dc2626" strokeDasharray="3 3" />
            {data.some((d) => d.pessimistic !== undefined) && (
              <Area
                type="monotone"
                dataKey="pessimistic"
                stroke="none"
                fill="#dc2626"
                fillOpacity={0.05}
                name="Pessimistic"
              />
            )}
            {data.some((d) => d.optimistic !== undefined) && (
              <Area
                type="monotone"
                dataKey="optimistic"
                stroke="none"
                fill="#16a34a"
                fillOpacity={0.05}
                name="Optimistic"
              />
            )}
            <Area
              type="monotone"
              dataKey="projected"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.1}
              strokeWidth={2}
              name="Projected"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
