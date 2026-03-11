"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import type { SlideProps } from "@/components/board-deck/sections/title-slide"

const BRAND = {
  primary: "#1a1a2e",
  accent: "#3b82f6",
  text: "#1e293b",
}

const PLACEHOLDER_DATA = [
  { period: "Oct", revenue: 1_820_000, grossProfit: 1_300_000, ebitda: 420_000 },
  { period: "Nov", revenue: 1_950_000, grossProfit: 1_400_000, ebitda: 490_000 },
  { period: "Dec", revenue: 2_100_000, grossProfit: 1_510_000, ebitda: 560_000 },
  { period: "Jan", revenue: 2_250_000, grossProfit: 1_620_000, ebitda: 630_000 },
  { period: "Feb", revenue: 2_380_000, grossProfit: 1_720_000, ebitda: 700_000 },
  { period: "Mar", revenue: 2_540_000, grossProfit: 1_840_000, ebitda: 790_000 },
]

const SUMMARY_ROWS = [
  { label: "Total Revenue", value: "$2.54M", change: "+18.4%", positive: true },
  { label: "Gross Profit", value: "$1.84M", change: "+14.2%", positive: true },
  { label: "Gross Margin", value: "72.4%", change: "+0.8pp", positive: true },
  { label: "EBITDA", value: "$790K", change: "+25.4%", positive: true },
  { label: "EBITDA Margin", value: "31.1%", change: "+1.8pp", positive: true },
  { label: "Net Income", value: "$310K", change: "+38.2%", positive: true },
]

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

export function FinancialSummary({ config, slideNumber, totalSlides, company }: SlideProps) {
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
      {/* Header */}
      <SlideHeader
        company={company}
        title="Financial Summary"
        period={periodLabel}
        slideNumber={slideNumber}
        totalSlides={totalSlides}
      />

      {/* Body */}
      <div style={{ flex: 1, display: "flex", gap: 0, overflow: "hidden" }}>
        {/* Left: P&L summary table */}
        <div
          style={{
            width: 320,
            padding: "20px 24px",
            borderRight: "1px solid #f1f5f9",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            P&amp;L Snapshot — {periodLabel}
          </p>
          {SUMMARY_ROWS.map((row) => (
            <div
              key={row.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 0",
                borderBottom: "1px solid #f8fafc",
              }}
            >
              <span style={{ fontSize: 12, color: BRAND.text }}>{row.label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: BRAND.text, fontVariantNumeric: "tabular-nums" }}>
                  {row.value}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: row.positive ? "#16a34a" : "#dc2626",
                    background: row.positive ? "#f0fdf4" : "#fef2f2",
                    padding: "2px 5px",
                    borderRadius: 4,
                  }}
                >
                  {row.change}
                </span>
              </div>
            </div>
          ))}
          {notes && (
            <p style={{ fontSize: 10, color: "#94a3b8", marginTop: 12, lineHeight: 1.5 }}>{notes}</p>
          )}
        </div>

        {/* Right: chart */}
        <div style={{ flex: 1, padding: "20px 24px", display: "flex", flexDirection: "column" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Trailing 6-Month Trend
          </p>
          <div style={{ flex: 1 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={PLACEHOLDER_DATA} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={52} />
                <Tooltip formatter={(v: unknown) => fmt(typeof v === "number" ? v : 0)} contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e2e8f0" }} />
                <Bar dataKey="revenue" fill={BRAND.accent} radius={[3, 3, 0, 0]} name="Revenue" />
                <Bar dataKey="grossProfit" fill="#22c55e" radius={[3, 3, 0, 0]} name="Gross Profit" />
                <Bar dataKey="ebitda" fill="#8b5cf6" radius={[3, 3, 0, 0]} name="EBITDA" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

export function SlideHeader({
  company,
  title,
  period,
  slideNumber,
  totalSlides,
}: {
  company: { name: string }
  title: string
  period: string
  slideNumber: number
  totalSlides: number
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 28px 12px",
        borderBottom: "2px solid #3b82f6",
        background: BRAND.primary,
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 5,
            background: BRAND.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ color: "white", fontWeight: 700, fontSize: 11 }}>
            {company.name.charAt(0)}
          </span>
        </div>
        <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 11 }}>{company.name}</span>
        <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>·</span>
        <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 600 }}>
          {title}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            color: "#93c5fd",
            fontSize: 10,
            fontWeight: 600,
            background: "rgba(59,130,246,0.2)",
            padding: "2px 8px",
            borderRadius: 4,
          }}
        >
          {period}
        </span>
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>
          {slideNumber} / {totalSlides}
        </span>
      </div>
    </div>
  )
}
