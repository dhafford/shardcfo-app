"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { SlideHeader } from "@/components/board-deck/sections/financial-summary"
import type { SlideProps } from "@/components/board-deck/sections/title-slide"

const METRICS_GRID = [
  { label: "ARR", value: "$8.48M", change: "+23.2%", positive: true },
  { label: "MRR", value: "$707K", change: "+23.2%", positive: true },
  { label: "MoM Growth", value: "3.8%", change: "+0.3pp", positive: true },
  { label: "NDR", value: "118%", change: "+4pp", positive: true },
  { label: "GRR", value: "93%", change: "+1pp", positive: true },
  { label: "Logo Churn", value: "1.2%", change: "-0.3pp", positive: true },
  { label: "CAC", value: "$4,200", change: "-8.4%", positive: true },
  { label: "LTV:CAC", value: "5.2x", change: "+0.4x", positive: true },
  { label: "Payback", value: "14mo", change: "-2mo", positive: true },
]

const ARR_TREND = [
  { month: "Oct", arr: 6.8 },
  { month: "Nov", arr: 7.1 },
  { month: "Dec", arr: 7.45 },
  { month: "Jan", arr: 7.82 },
  { month: "Feb", arr: 8.1 },
  { month: "Mar", arr: 8.48 },
]

export function SaasMetrics({ config, slideNumber, totalSlides, company }: SlideProps) {
  const periodLabel = (config.periodLabel as string) || "Q1 2025"

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
        title="SaaS Metrics"
        period={periodLabel}
        slideNumber={slideNumber}
        totalSlides={totalSlides}
      />

      <div style={{ flex: 1, display: "flex", gap: 0, overflow: "hidden" }}>
        {/* Left: metrics grid */}
        <div style={{ flex: 1, padding: "16px 20px 16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Key Metrics — {periodLabel}
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
            }}
          >
            {METRICS_GRID.map((metric) => (
              <div
                key={metric.label}
                style={{
                  background: "#f8fafc",
                  borderRadius: 8,
                  padding: "10px 14px",
                  border: "1px solid #f1f5f9",
                }}
              >
                <p style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                  {metric.label}
                </p>
                <p style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", fontVariantNumeric: "tabular-nums" }}>
                  {metric.value}
                </p>
                <p style={{ fontSize: 10, color: metric.positive ? "#16a34a" : "#dc2626", fontWeight: 500, marginTop: 2 }}>
                  {metric.change} vs prior period
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: ARR trend chart */}
        <div style={{ width: 260, padding: "16px 24px 16px 16px", borderLeft: "1px solid #f1f5f9", display: "flex", flexDirection: "column" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            ARR Trajectory
          </p>
          <div style={{ flex: 1 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ARR_TREND} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <YAxis
                  tickFormatter={(v) => `$${v}M`}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  domain={[6, 9]}
                />
                <Tooltip formatter={(v: unknown) => `$${typeof v === "number" ? v : 0}M`} contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e2e8f0" }} />
                <Line type="monotone" dataKey="arr" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: "#3b82f6" }} name="ARR ($M)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div
            style={{
              marginTop: 12,
              padding: "8px 10px",
              background: "#eff6ff",
              borderRadius: 6,
              border: "1px solid #dbeafe",
            }}
          >
            <p style={{ fontSize: 10, color: "#1d4ed8", fontWeight: 600 }}>Rule of 40: 54</p>
            <p style={{ fontSize: 10, color: "#3b82f6" }}>23.2% growth + 31.1% EBITDA margin</p>
          </div>
        </div>
      </div>
    </div>
  )
}
