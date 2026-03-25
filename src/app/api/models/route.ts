import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"

const MODELS_DIR = "/Users/davidhafford/Desktop/Projects/model/models"

export async function GET(request: NextRequest) {
  const filename = request.nextUrl.searchParams.get("file")
  if (!filename) {
    return NextResponse.json({ error: "Missing file parameter" }, { status: 400 })
  }

  // Sanitize: only allow alphanumeric, underscores, hyphens, and .xlsx extension
  if (!/^[\w-]+\.xlsx$/.test(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 })
  }

  const filePath = path.join(MODELS_DIR, filename)

  try {
    const fileBuffer = await readFile(filePath)
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }
}
