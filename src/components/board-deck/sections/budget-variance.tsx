"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { SlideHeader } from "@/components/board-deck/sections/financial-summary"
import type { SlideProps } from "@/components/board-deck/sections/title-slide"

const VARIANCE_DATA = [
  { category: "Revenue", variance: 90_000 },
  { category: "COGS", variance: 20_000 },
  { category: "S&M", variance: -30_000 },
  { category: "R&D", variance: 30_000 },
  { category: "G&A", variance: -10_000 },
  { category: "EBITDA", variance: 140_000 },
]

const DETAIL_ROWS = [
  { item: "Total Revenue", actual: "$2.54M", budget: "$2.45M", variance: "+$90K", pct: "+3.7%", positive: true },
  { item: "COGS", actual: "$700K", budget: "$720K", variance: "-$20K", pct: "-2.8%", positive: true },
  { item: "Gross Profit", actual: "$1.84M", budget: "$1.73M", variance: "+$110K", pct: "+6.4%", positive: true },
  { item: "Sales & Marketing", actual: "$680K", budget: "$650K", variance: "+$30K", pct: "+4.6%", positive: false },
  { item: "R&D", actual: "$890K", budget: "$920K", variance: "-$30K", pct: "-3.3%", positive: true },
  { item: "G&A", actual: "$310K", budget: "$300K", variance: "+$10K", pct: "+3.3%", positive: false },
  { item: "EBITDA", actual: "$790K", budget: "$650K", variance: "+$140K", pct: "+21.5%", positive: true },
]

function fmt(v: number) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `${v > 0 ? "+" : ""}$${Math.abs(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

export function BudgetVariance({ config, slideNumber, totalSlides, company }: SlideProps) {
  const periodLabel = (config.periodLabel as string) || "Q1 2025"
  const notes = (config.notes as string) || ""

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
        title="Budget Variance"
        period={periodLabel}
        slideNumber={slideNumber}
        totalSlides={totalSlides}
      />

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left: variance chart */}
        <div style={{ flex: 1, padding: "16px 16px 16px 24px", display: "flex", flexDirection: "column" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            Variance vs. Budget (Actual minus Budget)
          </p>
          <div style={{ flex: 1 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={VARIANCE_DATA} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={true} vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={52} />
                <Tooltip formatter={(v: unknown) => fmt(typeof v === "number" ? v : 0)} contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e2e8f0" }} />
                <Bar dataKey="variance" radius={[3, 3, 0, 0]} name="Variance">
                  {VARIANCE_DATA.map((entry) => (
                    <Cell key={entry.category} fill={entry.variance >= 0 ? "#22c55e" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: detail table */}
        <div style={{ width: 340, padding: "16px 24px 16px 12px", borderLeft: "1px solid #f1f5f9", display: "flex", flexDirection: "column" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            Line Item Detail
          </p>
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 60px 60px 48px 36px",
                gap: 4,
                padding: "0 0 5px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              {["Item", "Actual", "Budget", "Var", "%"].map((h) => (
                <span key={h} style={{ fontSize: 9, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>{h}</span>
              ))}
            </div>
            {DETAIL_ROWS.map((row) => (
              <div
                key={row.item}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 60px 60px 48px 36px",
                  gap: 4,
                  padding: "5px 0",
                  borderBottom: "1px solid #f8fafc",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 10, color: "#475569" }}>{row.item}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: "#1e293b" }}>{row.actual}</span>
                <span style={{ fontSize: 10, color: "#64748b" }}>{row.budget}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: row.positive ? "#16a34a" : "#dc2626" }}>
                  {row.variance}
                </span>
                <span style={{ fontSize: 10, color: row.positive ? "#16a34a" : "#dc2626" }}>
                  {row.pct}
                </span>
              </div>
            ))}
          </div>
          {notes && (
            <div
              style={{
                marginTop: 12,
                padding: "8px 10px",
                background: "#f8fafc",
                borderRadius: 6,
                border: "1px solid #f1f5f9",
              }}
            >
              <p style={{ fontSize: 10, color: "#64748b", lineHeight: 1.5 }}>{notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
