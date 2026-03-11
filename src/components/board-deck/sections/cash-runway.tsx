"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import { SlideHeader } from "@/components/board-deck/sections/financial-summary"
import type { SlideProps } from "@/components/board-deck/sections/title-slide"

const RUNWAY_DATA = [
  { month: "Mar '25", cash: 12_400_000 },
  { month: "Apr", cash: 11_750_000 },
  { month: "May", cash: 11_100_000 },
  { month: "Jun", cash: 10_450_000 },
  { month: "Jul", cash: 9_800_000 },
  { month: "Aug", cash: 9_150_000 },
  { month: "Sep", cash: 8_500_000 },
  { month: "Oct", cash: 7_850_000 },
  { month: "Nov", cash: 7_200_000 },
  { month: "Dec", cash: 6_550_000 },
  { month: "Jan '26", cash: 5_900_000 },
  { month: "Feb", cash: 5_250_000 },
  { month: "Mar", cash: 4_600_000 },
]

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

export function CashRunway({ config, slideNumber, totalSlides, company }: SlideProps) {
  const periodLabel = (config.periodLabel as string) || "Q1 2025"
  const scenarioNote = (config.scenarioNote as string) || ""

  return (
    <div
      style={{
        width: 960,
        height: 540,
        background: "white",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Inter, system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      <SlideHeader
        company={company}
        title="Cash & Runway"
        period={periodLabel}
        slideNumber={slideNumber}
        totalSlides={totalSlides}
      />

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left: KPI cards */}
        <div style={{ width: 240, padding: "20px 20px 16px 24px", borderRight: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Cash Position
          </p>

          {[
            { label: "Cash on Hand", value: "$12.4M", sub: "as of March 31, 2025" },
            { label: "Monthly Burn Rate", value: "$650K", sub: "net cash consumed" },
            { label: "Gross Burn Rate", value: "$1.19M", sub: "total cash outflows" },
            { label: "Revenue Offset", value: "$540K", sub: "MRR recognized" },
            { label: "Projected Runway", value: "19 months", sub: "base case burn rate" },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                padding: "10px 12px",
                background: "#f8fafc",
                borderRadius: 7,
                border: "1px solid #f1f5f9",
              }}
            >
              <p style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {item.label}
              </p>
              <p style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", marginTop: 2 }}>{item.value}</p>
              <p style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{item.sub}</p>
            </div>
          ))}

          {scenarioNote && (
            <div
              style={{
                padding: "8px 10px",
                background: "#fffbeb",
                borderRadius: 6,
                border: "1px solid #fef3c7",
              }}
            >
              <p style={{ fontSize: 10, color: "#92400e", lineHeight: 1.5 }}>{scenarioNote}</p>
            </div>
          )}
        </div>

        {/* Right: chart */}
        <div style={{ flex: 1, padding: "20px 24px 16px 20px", display: "flex", flexDirection: "column" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            12-Month Cash Projection (Base Case)
          </p>
          <div style={{ flex: 1 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={RUNWAY_DATA} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={52} />
                <Tooltip formatter={(v: unknown) => fmt(typeof v === "number" ? v : 0)} contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e2e8f0" }} />
                <ReferenceLine y={3_000_000} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "$3M threshold", fill: "#f59e0b", fontSize: 9 }} />
                <Area type="monotone" dataKey="cash" stroke="#3b82f6" fill="url(#cashGrad)" strokeWidth={2.5} name="Cash Balance" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div
            style={{
              marginTop: 12,
              padding: "8px 12px",
              background: "#f0fdf4",
              borderRadius: 6,
              border: "1px solid #bbf7d0",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#16a34a",
                flexShrink: 0,
              }}
            />
            <p style={{ fontSize: 11, color: "#166534" }}>
              <strong>19-month runway</strong> provides sufficient buffer to reach cash-flow breakeven in Q3 2026.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
