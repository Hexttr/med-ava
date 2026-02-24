import { NextRequest, NextResponse } from "next/server"
import path from "path"
import fs from "fs/promises"
import { getUploadsDir } from "@/lib/db"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  try {
    const pathSegments = (await params).path
    if (!pathSegments?.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    const relative = path.join(...pathSegments)
    if (relative.includes("..") || path.isAbsolute(relative)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const base = getUploadsDir()
    const fullPath = path.join(base, relative)
    const stat = await fs.stat(fullPath).catch(() => null)
    if (!stat?.isFile()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    const buf = await fs.readFile(fullPath)
    const ext = path.extname(fullPath).toLowerCase()
    const mime =
      ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg"
    return new NextResponse(buf, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, max-age=86400",
      },
    })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
}
