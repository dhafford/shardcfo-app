"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { SlideHeader } from "@/components/board-deck/sections/financial-summary"
import type { SlideProps } from "@/components/board-deck/sections/title-slide"

const TREND_DATA = [
  { period: "Oct", arr: 6_800_000, services: 420_000 },
  { period: "Nov", arr: 7_100_000, services: 440_000 },
  { period: "Dec", arr: 7_450_000, services: 460_000 },
  { period: "Jan", arr: 7_820_000, services: 470_000 },
  { period: "Feb", arr: 8_100_000, services: 490_000 },
  { period: "Mar", arr: 8_480_000, services: 510_000 },
]

const PIE_DATA = [
  { name: "ARR", value: 8_480_000, color: "#3b82f6" },
  { name: "Professional Services", value: 510_000, color: "#8b5cf6" },
  { name: "Usage-Based", value: 240_000, color: "#22c55e" },
]

const STREAM_ROWS = [
  { stream: "Annual Recurring Revenue", q1: "$8.48M", growth: "+23.2%", pct: "92.3%" },
  { stream: "Professional Services", q1: "$510K", growth: "+8.5%", pct: "5.6%" },
  { stream: "Usage-Based Revenue", q1: "$240K", growth: "+47.1%", pct: "2.1%" },
]

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

export function RevenueBreakdown({ config, slideNumber, totalSlides, company }: SlideProps) {
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
        title="Revenue Breakdown"
        period={periodLabel}
        slideNumber={slideNumber}
        totalSlides={totalSlides}
      />

      <div style={{ flex: 1, display: "flex", gap: 0, overflow: "hidden" }}>
        {/* Left: trend chart */}
        <div style={{ flex: 1, padding: "20px 20px 16px 24px", display: "flex", flexDirection: "column" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            Revenue Trend (6 Months)
          </p>
          <div style={{ flex: 1 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={TREND_DATA} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="arrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="svcGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={52} />
                <Tooltip formatter={(v: unknown) => fmt(typeof v === "number" ? v : 0)} contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e2e8f0" }} />
                <Area type="monotone" dataKey="arr" stroke="#3b82f6" fill="url(#arrGrad)" strokeWidth={2} name="ARR" />
                <Area type="monotone" dataKey="services" stroke="#8b5cf6" fill="url(#svcGrad)" strokeWidth={2} name="Services" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: mix + table */}
        <div style={{ width: 280, padding: "20px 24px 16px", borderLeft: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              Revenue Mix
            </p>
            <div style={{ height: 120 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={PIE_DATA} cx="50%" cy="50%" innerRadius={30} outerRadius={55} dataKey="value" paddingAngle={2}>
                    {PIE_DATA.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => fmt(typeof v === "number" ? v : 0)} contentStyle={{ fontSize: 10, borderRadius: 6 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              By Stream
            </p>
            {STREAM_ROWS.map((row) => (
              <div
                key={row.stream}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "5px 0",
                  borderBottom: "1px solid #f8fafc",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "#475569" }}>{row.stream}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#1e293b" }}>{row.q1}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 10, color: "#16a34a" }}>{row.growth} YoY</span>
                  <span style={{ fontSize: 10, color: "#94a3b8" }}>{row.pct} of total</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
