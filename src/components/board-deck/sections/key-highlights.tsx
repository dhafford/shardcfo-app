import { SlideHeader } from "@/components/board-deck/sections/financial-summary"
import type { SlideProps } from "@/components/board-deck/sections/title-slide"

const DEFAULT_WINS = [
  "Closed $1.2M net new ARR — largest quarter in company history",
  "Launched AI-assisted reporting module with 98 customers onboarded in first 30 days",
  "NDR improved to 118% driven by expansion in mid-market segment",
  "Hired VP of Sales and 3 Account Executives — team fully ramped by April",
]

const DEFAULT_RISKS = [
  "SMB churn elevated at 2.1% — targeted intervention plan in progress",
  "Engineering hiring 6 weeks behind plan — may delay Q3 roadmap items",
]

export function KeyHighlights({ config, slideNumber, totalSlides, company }: SlideProps) {
  const periodLabel = (config.periodLabel as string) || "Q1 2025"
  const narrative =
    (config.narrative as string) ||
    "Q1 2025 was the strongest quarter in company history. Revenue exceeded budget by 3.7% and EBITDA came in $140K above plan, driven by strong new business and continued expansion from existing customers."

  const winsRaw = (config.wins as string) || ""
  const wins = winsRaw
    ? winsRaw.split("\n").filter(Boolean)
    : DEFAULT_WINS

  const risksRaw = (config.risks as string) || ""
  const risks = risksRaw
    ? risksRaw.split("\n").filter(Boolean)
    : DEFAULT_RISKS

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
        title="Key Highlights"
        period={periodLabel}
        slideNumber={slideNumber}
        totalSlides={totalSlides}
      />

      <div style={{ flex: 1, display: "flex", gap: 0, overflow: "hidden" }}>
        {/* Left: narrative */}
        <div
          style={{
            width: 340,
            padding: "24px 28px",
            borderRight: "1px solid #f1f5f9",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
              Executive Summary
            </p>
            <p style={{ fontSize: 13, color: "#334155", lineHeight: 1.7 }}>{narrative}</p>
          </div>
        </div>

        {/* Right: wins + risks */}
        <div style={{ flex: 1, padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Wins */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "#f0fdf4",
                  border: "1.5px solid #86efac",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: 11, color: "#16a34a" }}>✓</span>
              </div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#15803d", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Highlights &amp; Wins
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {wins.map((win, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#22c55e",
                      flexShrink: 0,
                      marginTop: 5,
                    }}
                  />
                  <p style={{ fontSize: 12, color: "#334155", lineHeight: 1.5 }}>{win}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Risks */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "#fff7ed",
                  border: "1.5px solid #fdba74",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: 11, color: "#ea580c" }}>!</span>
              </div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#c2410c", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Watch Items &amp; Risks
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {risks.map((risk, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#f97316",
                      flexShrink: 0,
                      marginTop: 5,
                    }}
                  />
                  <p style={{ fontSize: 12, color: "#334155", lineHeight: 1.5 }}>{risk}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
