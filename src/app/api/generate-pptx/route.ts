import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { deckId } = body;

    if (!deckId) {
      return NextResponse.json(
        { error: "deckId is required" },
        { status: 400 }
      );
    }

    // Fetch deck data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deckRaw, error: deckError } = await (supabase as any)
      .from("board_decks")
      .select(
        `
        *,
        companies!inner(*)
      `
      )
      .eq("id", deckId)
      .single();

    const deck = deckRaw as {
      id: string
      title: string
      content: Record<string, unknown>
      companies: { name: string } | null
      period_start?: string
      period_end?: string
    } | null;

    if (deckError || !deck) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    // Dynamic import for pptxgenjs (server-only)
    const PptxGenJS = (await import("pptxgenjs")).default;
    const pptx = new PptxGenJS();

    pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
    pptx.author = "ShardCFO";
    pptx.title = deck.title;

    const BRAND = {
      primary: "1a1a2e",
      accent: "3b82f6",
      text: "1e293b",
      lightText: "64748b",
      white: "ffffff",
    };

    // Sections are stored in content.sections
    const deckContent = (deck.content ?? {}) as Record<string, unknown>
    const sections = (Array.isArray(deckContent.sections)
      ? deckContent.sections
      : []) as Array<{ type: string; config?: Record<string, unknown> }>;

    for (const section of sections) {
      const slide = pptx.addSlide();

      // Header bar
      slide.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: 0,
        w: "100%",
        h: 0.6,
        fill: { color: BRAND.primary },
      });

      // Company name in header
      slide.addText(deck.companies?.name || "Company", {
        x: 0.5,
        y: 0.1,
        w: 5,
        h: 0.4,
        fontSize: 14,
        color: BRAND.white,
        fontFace: "Arial",
        bold: true,
      });

      // Period in header
      slide.addText(
        `${deck.period_start} — ${deck.period_end}`,
        {
          x: 7,
          y: 0.1,
          w: 5,
          h: 0.4,
          fontSize: 10,
          color: BRAND.white,
          fontFace: "Arial",
          align: "right",
        }
      );

      switch (section.type) {
        case "title_slide":
          slide.addText(deck.companies?.name || "Company", {
            x: 1,
            y: 2,
            w: 11,
            h: 1.5,
            fontSize: 36,
            color: BRAND.primary,
            fontFace: "Arial",
            bold: true,
            align: "center",
          });
          slide.addText("Board of Directors Meeting", {
            x: 1,
            y: 3.5,
            w: 11,
            h: 0.6,
            fontSize: 18,
            color: BRAND.lightText,
            fontFace: "Arial",
            align: "center",
          });
          break;

        case "financial_summary":
          slide.addText("Financial Summary", {
            x: 0.5,
            y: 0.8,
            w: 8,
            h: 0.5,
            fontSize: 20,
            color: BRAND.text,
            fontFace: "Arial",
            bold: true,
          });

          const rows: Array<Array<{ text: string; options?: Record<string, unknown> }>> = [
            [
              { text: "Metric", options: { bold: true, color: BRAND.lightText } },
              { text: "Current", options: { bold: true, color: BRAND.lightText } },
              { text: "Prior", options: { bold: true, color: BRAND.lightText } },
              { text: "Change", options: { bold: true, color: BRAND.lightText } },
            ],
            ...["Revenue", "COGS", "Gross Profit", "OpEx", "EBITDA", "Net Income"].map(
              (m) => [
                { text: m },
                { text: "—" },
                { text: "—" },
                { text: "—" },
              ]
            ),
          ];

          slide.addTable(rows, {
            x: 0.5,
            y: 1.5,
            w: 12,
            fontSize: 11,
            fontFace: "Arial",
            border: { type: "solid", pt: 0.5, color: "e2e8f0" },
            colW: [3, 3, 3, 3],
          });
          break;

        case "key_highlights":
          slide.addText("Key Highlights", {
            x: 0.5,
            y: 0.8,
            w: 8,
            h: 0.5,
            fontSize: 20,
            color: BRAND.text,
            fontFace: "Arial",
            bold: true,
          });

          const highlights =
            (section.config?.highlights as string[]) || [
              "Key highlight 1",
              "Key highlight 2",
              "Key highlight 3",
            ];

          highlights.forEach((h, i) => {
            slide.addText(`• ${h}`, {
              x: 0.8,
              y: 1.5 + i * 0.6,
              w: 11,
              h: 0.5,
              fontSize: 14,
              color: BRAND.text,
              fontFace: "Arial",
            });
          });
          break;

        default:
          slide.addText(
            section.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            {
              x: 0.5,
              y: 0.8,
              w: 8,
              h: 0.5,
              fontSize: 20,
              color: BRAND.text,
              fontFace: "Arial",
              bold: true,
            }
          );
          slide.addText("Data visualization renders with live financial data.", {
            x: 0.5,
            y: 1.5,
            w: 11,
            h: 0.5,
            fontSize: 12,
            color: BRAND.lightText,
            fontFace: "Arial",
          });
      }

      // Footer with page number
      slide.addText(`${sections.indexOf(section) + 1}`, {
        x: 12,
        y: 7,
        w: 1,
        h: 0.3,
        fontSize: 9,
        color: BRAND.lightText,
        fontFace: "Arial",
        align: "right",
      });

      // Bottom accent line
      slide.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: 7.3,
        w: "100%",
        h: 0.05,
        fill: { color: BRAND.accent },
      });
    }

    const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;

    const safeTitle = deck.title.replace(/[^a-zA-Z0-9]/g, "_")
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${safeTitle}.pptx"`,
      },
    });
  } catch (error) {
    console.error("PPTX generation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
