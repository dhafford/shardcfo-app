import { SlideHeader } from "@/components/board-deck/sections/financial-summary"
import type { SlideProps } from "@/components/board-deck/sections/title-slide"

const DEFAULT_ASKS = [
  "Approve Q2 2025 budget of $8.4M with 14% YoY increase",
  "Authorize hiring plan: 12 net new headcount across Engineering and Sales",
  "Approve expansion into European market — estimated $400K investment in H2",
]

const DEFAULT_DECISIONS = [
  "Ratify Q1 board resolutions presented in the written consent",
  "Approve equity grant pool refresh of 2.5% for new hire grants",
]

const DEFAULT_FYI = [
  "Series B process expected to kick off in Q3 2025 — banker selection underway",
  "SOC 2 Type II audit completed; report available upon request",
]

export function AsksAndDecisions({ config, slideNumber, totalSlides, company }: SlideProps) {
  const periodLabel = (config.periodLabel as string) || "Q1 2025"

  const asksRaw = (config.asks as string) || ""
  const asks = asksRaw ? asksRaw.split("\n").filter(Boolean) : DEFAULT_ASKS

  const decisionsRaw = (config.decisions as string) || ""
  const decisions = decisionsRaw ? decisionsRaw.split("\n").filter(Boolean) : DEFAULT_DECISIONS

  const fyiRaw = (config.fyi as string) || ""
  const fyi = fyiRaw ? fyiRaw.split("\n").filter(Boolean) : DEFAULT_FYI

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
        title="Asks & Decisions"
        period={periodLabel}
        slideNumber={slideNumber}
        totalSlides={totalSlides}
      />

      <div style={{ flex: 1, display: "flex", gap: 0, overflow: "hidden" }}>
        {/* Asks */}
        <div
          style={{
            flex: 1,
            padding: "24px 24px",
            borderRight: "1px solid #f1f5f9",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "#eff6ff",
                border: "1.5px solid #93c5fd",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: 12, color: "#2563eb", fontWeight: 700 }}>?</span>
            </div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Board Asks
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {asks.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#2563eb" }}>{i + 1}</span>
                </div>
                <p style={{ fontSize: 12, color: "#334155", lineHeight: 1.55 }}>{item}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right column: decisions + FYI */}
        <div style={{ flex: 1, padding: "24px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Decisions */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "#f0fdf4",
                  border: "1.5px solid #86efac",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: 12, color: "#16a34a" }}>✓</span>
              </div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#15803d", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Decisions Required
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {decisions.map((item, i) => (
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
                  <p style={{ fontSize: 12, color: "#334155", lineHeight: 1.5 }}>{item}</p>
                </div>
              ))}
            </div>
          </div>

          {/* FYI */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "#fefce8",
                  border: "1.5px solid #fde047",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: "#a16207" }}>i</span>
              </div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#a16207", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                FYI / Updates
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {fyi.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#eab308",
                      flexShrink: 0,
                      marginTop: 5,
                    }}
                  />
                  <p style={{ fontSize: 12, color: "#334155", lineHeight: 1.5 }}>{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
