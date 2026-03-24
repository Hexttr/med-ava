import fs from "fs/promises"
import path from "path"
import { NextRequest, NextResponse } from "next/server"

import { getDb, getUploadsDir } from "@/lib/db"

function getMimeType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === ".png") return "image/png"
  if (ext === ".webp") return "image/webp"
  return "image/jpeg"
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entity: string; id: string }> }
) {
  try {
    const { entity, id } = await params
    const database = getDb()
    let relativePath: string | null = null

    if (entity === "employee") {
      const row = database.prepare(
        "SELECT photo_path, thumbnail_path FROM employees WHERE id = ?"
      ).get(id) as { photo_path: string; thumbnail_path: string | null } | undefined
      relativePath = row ? row.thumbnail_path ?? row.photo_path : null
    } else if (entity === "gallery") {
      const style = request.nextUrl.searchParams.get("style")
      if (style !== "medical" && style !== "corporate") {
        return NextResponse.json({ error: "Некорректный стиль" }, { status: 400 })
      }

      const row = database.prepare(
        "SELECT medical_path, corporate_path FROM gallery_items WHERE id = ?"
      ).get(id) as { medical_path: string | null; corporate_path: string | null } | undefined
      relativePath = row ? (style === "medical" ? row.medical_path : row.corporate_path) : null
    } else {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (!relativePath) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const uploadsDir = path.resolve(getUploadsDir())
    const fullPath = path.resolve(path.join(uploadsDir, relativePath))
    if (!fullPath.startsWith(uploadsDir + path.sep) && fullPath !== uploadsDir) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const stat = await fs.stat(fullPath).catch(() => null)
    if (!stat?.isFile()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const buffer = await fs.readFile(fullPath)
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": getMimeType(fullPath),
        "Cache-Control": "public, max-age=86400",
      },
    })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
}
