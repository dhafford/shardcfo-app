import { Text, View, StyleSheet } from "@react-pdf/renderer";
import React from "react";

// ---------------------------------------------------------------------------
// Lightweight markdown → @react-pdf/renderer elements
//
// Handles: headings (# ## ###), bold (**), italic (*), unordered lists (-),
// ordered lists (1.), tables (GFM), horizontal rules (---), and paragraphs.
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  h1: { fontSize: 18, fontWeight: "bold", marginTop: 16, marginBottom: 6 },
  h2: { fontSize: 15, fontWeight: "bold", marginTop: 14, marginBottom: 5 },
  h3: { fontSize: 12, fontWeight: "bold", marginTop: 10, marginBottom: 4 },
  paragraph: { fontSize: 10, lineHeight: 1.5, marginBottom: 6 },
  bold: { fontWeight: "bold" },
  italic: { fontStyle: "italic" },
  listItem: { fontSize: 10, lineHeight: 1.5, marginBottom: 2, paddingLeft: 12 },
  hr: { borderBottomWidth: 1, borderBottomColor: "#d1d5db", marginVertical: 10 },
  tableRow: { flexDirection: "row" as const, borderBottomWidth: 0.5, borderBottomColor: "#d1d5db" },
  tableHeaderRow: { flexDirection: "row" as const, borderBottomWidth: 1, borderBottomColor: "#374151", backgroundColor: "#f3f4f6" },
  tableCell: { fontSize: 9, padding: 4, flex: 1 },
  tableCellBold: { fontSize: 9, padding: 4, flex: 1, fontWeight: "bold" },
});

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match **bold** and *italic* patterns
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(React.createElement(Text, { key: `t-${lastIndex}` }, text.slice(lastIndex, match.index)));
    }
    if (match[2]) {
      // Bold
      parts.push(React.createElement(Text, { key: `b-${match.index}`, style: s.bold }, match[2]));
    } else if (match[3]) {
      // Italic
      parts.push(React.createElement(Text, { key: `i-${match.index}`, style: s.italic }, match[3]));
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(React.createElement(Text, { key: `t-${lastIndex}` }, text.slice(lastIndex)));
  }

  return parts.length > 0 ? parts : [React.createElement(Text, { key: "plain" }, text)];
}

export function markdownToPdfElements(markdown: string): React.ReactNode[] {
  const lines = markdown.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      elements.push(React.createElement(View, { key: `hr-${i}`, style: s.hr }));
      i++;
      continue;
    }

    // Headings
    if (trimmed.startsWith("### ")) {
      elements.push(
        React.createElement(Text, { key: `h3-${i}`, style: s.h3 }, trimmed.slice(4))
      );
      i++;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      elements.push(
        React.createElement(Text, { key: `h2-${i}`, style: s.h2 }, trimmed.slice(3))
      );
      i++;
      continue;
    }
    if (trimmed.startsWith("# ")) {
      elements.push(
        React.createElement(Text, { key: `h1-${i}`, style: s.h1 }, trimmed.slice(2))
      );
      i++;
      continue;
    }

    // GFM table (lines starting with |)
    if (trimmed.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }

      // Filter out separator rows (|---|---|)
      const dataRows = tableLines.filter((r) => !/^\|[\s\-:|]+\|$/.test(r));
      if (dataRows.length === 0) continue;

      const parseRow = (row: string) =>
        row
          .split("|")
          .map((c) => c.trim())
          .filter(Boolean);

      const headerCells = parseRow(dataRows[0]);

      // Header row
      elements.push(
        React.createElement(
          View,
          { key: `th-${i}`, style: s.tableHeaderRow },
          headerCells.map((cell, ci) =>
            React.createElement(Text, { key: `thc-${ci}`, style: s.tableCellBold }, cell)
          )
        )
      );

      // Data rows
      for (let ri = 1; ri < dataRows.length; ri++) {
        const cells = parseRow(dataRows[ri]);
        elements.push(
          React.createElement(
            View,
            { key: `tr-${i}-${ri}`, style: s.tableRow },
            cells.map((cell, ci) =>
              React.createElement(Text, { key: `td-${ci}`, style: s.tableCell }, cell)
            )
          )
        );
      }
      continue;
    }

    // Unordered list
    if (/^[-*]\s/.test(trimmed)) {
      elements.push(
        React.createElement(
          Text,
          { key: `ul-${i}`, style: s.listItem },
          ...renderInline("• " + trimmed.replace(/^[-*]\s+/, ""))
        )
      );
      i++;
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(trimmed)) {
      elements.push(
        React.createElement(
          Text,
          { key: `ol-${i}`, style: s.listItem },
          ...renderInline(trimmed)
        )
      );
      i++;
      continue;
    }

    // Default: paragraph
    elements.push(
      React.createElement(
        Text,
        { key: `p-${i}`, style: s.paragraph },
        ...renderInline(trimmed)
      )
    );
    i++;
  }

  return elements;
}
