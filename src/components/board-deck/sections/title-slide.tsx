import type { CompanyRow } from "@/lib/supabase/types"

export interface SlideProps {
  config: Record<string, unknown>
  slideNumber: number
  totalSlides: number
  company: CompanyRow
}

const BRAND = {
  primary: "#1a1a2e",
  accent: "#3b82f6",
  text: "#1e293b",
}

export function TitleSlide({ config, slideNumber, totalSlides, company }: SlideProps) {
  const presentationTitle =
    (config.presentationTitle as string) || "Board of Directors Meeting"
  const subtitle = (config.subtitle as string) || "Confidential — Not for Distribution"
  const periodLabel = (config.periodLabel as string) || "Q1 2025"
  const date =
    (config.date as string) ||
    new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })

  return (
    <div
      style={{
        width: 960,
        height: 540,
        background: `linear-gradient(135deg, ${BRAND.primary} 0%, #16213e 60%, #0f3460 100%)`,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Decorative accent bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: BRAND.accent,
        }}
      />

      {/* Decorative circle */}
      <div
        style={{
          position: "absolute",
          right: -80,
          bottom: -80,
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "rgba(59,130,246,0.08)",
          border: "1px solid rgba(59,130,246,0.15)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 20,
          bottom: 20,
          width: 240,
          height: 240,
          borderRadius: "50%",
          background: "rgba(59,130,246,0.05)",
          border: "1px solid rgba(59,130,246,0.1)",
        }}
      />

      {/* Header: company name */}
      <div style={{ padding: "40px 60px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: BRAND.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ color: "white", fontWeight: 700, fontSize: 16 }}>
            {company.name.charAt(0)}
          </span>
        </div>
        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: 500 }}>
          {company.name}
        </span>
      </div>

      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 60px",
        }}
      >
        <div
          style={{
            display: "inline-block",
            background: "rgba(59,130,246,0.2)",
            border: "1px solid rgba(59,130,246,0.4)",
            borderRadius: 6,
            padding: "4px 12px",
            marginBottom: 24,
            alignSelf: "flex-start",
          }}
        >
          <span style={{ color: "#93c5fd", fontSize: 12, fontWeight: 600, letterSpacing: "0.1em" }}>
            {periodLabel}
          </span>
        </div>

        <h1
          style={{
            color: "white",
            fontSize: 44,
            fontWeight: 700,
            lineHeight: 1.15,
            margin: 0,
            maxWidth: 600,
          }}
        >
          {presentationTitle}
        </h1>
        <p
          style={{
            color: "rgba(255,255,255,0.55)",
            fontSize: 18,
            marginTop: 16,
            fontWeight: 400,
          }}
        >
          {subtitle}
        </p>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "0 60px 32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          paddingTop: 20,
        }}
      >
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{date}</span>
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>
          {slideNumber} / {totalSlides}
        </span>
      </div>
    </div>
  )
}
