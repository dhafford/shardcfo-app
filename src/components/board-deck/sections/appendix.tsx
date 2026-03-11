import { SlideHeader } from "@/components/board-deck/sections/financial-summary"
import type { SlideProps } from "@/components/board-deck/sections/title-slide"

const DEFAULT_ITEMS = [
  { title: "Monthly P&L Detail", description: "Full month-by-month income statement with actuals vs. budget" },
  { title: "Balance Sheet", description: "Current assets, liabilities, and equity as of period end" },
  { title: "Cash Flow Statement", description: "Operating, investing, and financing activities" },
  { title: "Headcount Detail", description: "Team breakdown by department, level, and location" },
  { title: "Pipeline & Bookings Report", description: "Sales pipeline by stage, ACV, and close date" },
  { title: "Cap Table Summary", description: "Fully diluted ownership — last updated at Series A close" },
]

export function Appendix({ config, slideNumber, totalSlides, company }: SlideProps) {
  const periodLabel = (config.periodLabel as string) || "Q1 2025"
  const notes = (config.notes as string) || ""

  const itemsRaw = (config.items as string) || ""
  const items = itemsRaw
    ? itemsRaw.split("\n").filter(Boolean).map((line) => {
        const [title, ...rest] = line.split("|")
        return { title: title.trim(), description: rest.join("|").trim() }
      })
    : DEFAULT_ITEMS

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
        title="Appendix"
        period={periodLabel}
        slideNumber={slideNumber}
        totalSlides={totalSlides}
      />

      <div style={{ flex: 1, padding: "24px 32px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Supporting Materials
          </p>
          {notes && (
            <p style={{ fontSize: 11, color: "#94a3b8", maxWidth: 400, textAlign: "right" }}>{notes}</p>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 12,
          }}
        >
          {items.map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                padding: "12px 16px",
                background: "#f8fafc",
                borderRadius: 8,
                border: "1px solid #f1f5f9",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: "#e0e7ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: "#4338ca" }}>{i + 1}</span>
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 3 }}>
                  {item.title}
                </p>
                <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: "auto",
            padding: "10px 16px",
            background: "#f8fafc",
            borderRadius: 6,
            border: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            Confidential — Prepared for board use only. Please contact management for additional detail.
          </span>
        </div>
      </div>
    </div>
  )
}
