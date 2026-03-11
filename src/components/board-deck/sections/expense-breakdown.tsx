"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { SlideHeader } from "@/components/board-deck/sections/financial-summary"
import type { SlideProps } from "@/components/board-deck/sections/title-slide"

const EXPENSE_DATA = [
  { dept: "S&M", actual: 680_000, budget: 650_000 },
  { dept: "R&D", actual: 890_000, budget: 920_000 },
  { dept: "G&A", actual: 310_000, budget: 300_000 },
  { dept: "COGS", actual: 700_000, budget: 720_000 },
]

const DEPT_ROWS = [
  { dept: "Sales & Marketing", actual: "$680K", budget: "$650K", variance: "+$30K", over: true },
  { dept: "Research & Development", actual: "$890K", budget: "$920K", variance: "-$30K", over: false },
  { dept: "General & Administrative", actual: "$310K", budget: "$300K", variance: "+$10K", over: true },
  { dept: "Cost of Goods Sold", actual: "$700K", budget: "$720K", variance: "-$20K", over: false },
]

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

export function ExpenseBreakdown({ config, slideNumber, totalSlides, company }: SlideProps) {
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
        title="Expense Breakdown"
        period={periodLabel}
        slideNumber={slideNumber}
        totalSlides={totalSlides}
      />

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left: chart */}
        <div style={{ flex: 1, padding: "20px 20px 16px 24px", display: "flex", flexDirection: "column" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            Actual vs. Budget by Department
          </p>
          <div style={{ flex: 1 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={EXPENSE_DATA} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="dept" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={52} />
                <Tooltip formatter={(v: unknown) => fmt(typeof v === "number" ? v : 0)} contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e2e8f0" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="actual" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Actual" />
                <Bar dataKey="budget" fill="#e2e8f0" radius={[3, 3, 0, 0]} name="Budget" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: table */}
        <div style={{ width: 300, padding: "20px 24px 16px", borderLeft: "1px solid #f1f5f9", display: "flex", flexDirection: "column" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Variance Detail
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 60px 60px 60px",
                gap: 4,
                padding: "0 0 6px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              {["Department", "Actual", "Budget", "Var"].map((h) => (
                <span key={h} style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>{h}</span>
              ))}
            </div>
            {DEPT_ROWS.map((row) => (
              <div
                key={row.dept}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 60px 60px 60px",
                  gap: 4,
                  padding: "7px 0",
                  borderBottom: "1px solid #f8fafc",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 11, color: "#475569" }}>{row.dept}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#1e293b" }}>{row.actual}</span>
                <span style={{ fontSize: 11, color: "#64748b" }}>{row.budget}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: row.over ? "#dc2626" : "#16a34a" }}>
                  {row.variance}
                </span>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 16,
              padding: 10,
              background: "#f8fafc",
              borderRadius: 6,
              border: "1px solid #f1f5f9",
            }}
          >
            <p style={{ fontSize: 11, fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>Total OpEx: $1.88M</p>
            <p style={{ fontSize: 10, color: "#64748b" }}>Net variance: -$10K under budget (0.5%)</p>
          </div>
          {notes && (
            <p style={{ fontSize: 10, color: "#94a3b8", marginTop: 12, lineHeight: 1.5 }}>{notes}</p>
          )}
        </div>
      </div>
    </div>
  )
}
