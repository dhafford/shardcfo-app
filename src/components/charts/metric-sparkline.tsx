"use client";

import { cn } from "@/lib/utils";

interface MetricSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

export function MetricSparkline({
  data,
  width = 100,
  height = 28,
  color = "#3b82f6",
  className,
}: MetricSparklineProps) {
  if (data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const padding = 2;

  const points = data
    .map((v, i) => {
      const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
      const y = padding + (1 - (v - min) / range) * (height - 2 * padding);
      return `${x},${y}`;
    })
    .join(" ");

  const lastPoint = data[data.length - 1];
  const lastX = width - padding;
  const lastY = padding + (1 - (lastPoint - min) / range) * (height - 2 * padding);

  return (
    <svg
      width={width}
      height={height}
      className={cn("inline-block", className)}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r="2" fill={color} />
    </svg>
  );
}
