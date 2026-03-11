import React from "react";

const SLIDE_WIDTH = 960;
const SLIDE_HEIGHT = 540;

const BRAND = {
  primary: "#1a1a2e",
  accent: "#3b82f6",
  text: "#1e293b",
  lightText: "#64748b",
  background: "#ffffff",
  headerBg: "#f8fafc",
  green: "#16a34a",
  red: "#dc2626",
};

export interface SlideData {
  type: string;
  title?: string;
  companyName: string;
  companyLogo?: string;
  periodLabel: string;
  data?: Record<string, unknown>;
  config?: Record<string, unknown>;
  pageNumber: number;
  totalPages: number;
}

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function generateSlideHTML(slide: SlideData): string {
  const { type, companyName, periodLabel, pageNumber, totalPages, data } = slide;

  const header = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:24px 40px 12px;border-bottom:2px solid ${BRAND.accent};">
      <div style="font-size:14px;font-weight:600;color:${BRAND.primary};">${companyName}</div>
      <div style="font-size:11px;color:${BRAND.lightText};">${periodLabel}</div>
    </div>
  `;

  const footer = `
    <div style="position:absolute;bottom:16px;right:40px;font-size:10px;color:${BRAND.lightText};">
      ${pageNumber} / ${totalPages}
    </div>
  `;

  let content = "";

  switch (type) {
    case "title_slide":
      content = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;">
          <h1 style="font-size:36px;font-weight:700;color:${BRAND.primary};margin-bottom:16px;">${companyName}</h1>
          <h2 style="font-size:18px;font-weight:400;color:${BRAND.lightText};margin-bottom:8px;">Board of Directors Meeting</h2>
          <p style="font-size:14px;color:${BRAND.lightText};">${periodLabel}</p>
        </div>
      `;
      break;

    case "financial_summary": {
      const d = (data || {}) as Record<string, number>;
      content = `
        ${header}
        <div style="padding:24px 40px;">
          <h2 style="font-size:20px;font-weight:600;color:${BRAND.text};margin-bottom:20px;">Financial Summary</h2>
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr style="border-bottom:2px solid #e2e8f0;">
                <th style="text-align:left;padding:8px;color:${BRAND.lightText};">Metric</th>
                <th style="text-align:right;padding:8px;color:${BRAND.lightText};">Current Period</th>
                <th style="text-align:right;padding:8px;color:${BRAND.lightText};">Prior Period</th>
                <th style="text-align:right;padding:8px;color:${BRAND.lightText};">Change</th>
              </tr>
            </thead>
            <tbody>
              ${["Revenue", "COGS", "Gross Profit", "Operating Expenses", "EBITDA", "Net Income"]
                .map(
                  (metric) => `
                <tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="padding:8px;font-weight:${["Gross Profit", "EBITDA", "Net Income"].includes(metric) ? "600" : "400"};">${metric}</td>
                  <td style="text-align:right;padding:8px;font-family:monospace;">${formatCurrency(d[metric.toLowerCase().replace(/ /g, "_")] || 0)}</td>
                  <td style="text-align:right;padding:8px;font-family:monospace;color:${BRAND.lightText};">—</td>
                  <td style="text-align:right;padding:8px;font-family:monospace;">—</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
        ${footer}
      `;
      break;
    }

    case "key_highlights":
      content = `
        ${header}
        <div style="padding:24px 40px;">
          <h2 style="font-size:20px;font-weight:600;color:${BRAND.text};margin-bottom:20px;">Key Highlights</h2>
          <div style="display:flex;flex-direction:column;gap:12px;">
            ${((data?.highlights as string[]) || ["Highlight 1", "Highlight 2", "Highlight 3"])
              .map(
                (h: string) => `
              <div style="display:flex;align-items:flex-start;gap:8px;">
                <div style="width:6px;height:6px;border-radius:50%;background:${BRAND.accent};margin-top:6px;flex-shrink:0;"></div>
                <p style="font-size:14px;color:${BRAND.text};line-height:1.5;">${h}</p>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
        ${footer}
      `;
      break;

    case "asks_and_decisions":
      content = `
        ${header}
        <div style="padding:24px 40px;">
          <h2 style="font-size:20px;font-weight:600;color:${BRAND.text};margin-bottom:20px;">Asks & Decisions</h2>
          <div style="display:flex;flex-direction:column;gap:16px;">
            ${((data?.items as string[]) || ["Decision item 1", "Decision item 2"])
              .map(
                (item: string, i: number) => `
              <div style="padding:12px;border:1px solid #e2e8f0;border-radius:8px;">
                <p style="font-size:13px;color:${BRAND.text};">${i + 1}. ${item}</p>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
        ${footer}
      `;
      break;

    default:
      content = `
        ${header}
        <div style="padding:24px 40px;">
          <h2 style="font-size:20px;font-weight:600;color:${BRAND.text};margin-bottom:20px;">${slide.title || type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</h2>
          <p style="font-size:13px;color:${BRAND.lightText};">Data visualization for this section will render with live data.</p>
        </div>
        ${footer}
      `;
  }

  return `
    <div style="width:${SLIDE_WIDTH}px;height:${SLIDE_HEIGHT}px;background:${BRAND.background};position:relative;font-family:system-ui,-apple-system,sans-serif;overflow:hidden;">
      ${content}
    </div>
  `;
}

export { BRAND, SLIDE_WIDTH, SLIDE_HEIGHT, formatCurrency, formatPercent };
