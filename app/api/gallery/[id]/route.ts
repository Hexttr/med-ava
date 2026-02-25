import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { removeFile } from "@/lib/storage"
import { logger } from "@/lib/logger"

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const database = getDb()
    const row = database.prepare(
      "SELECT medical_path, corporate_path FROM gallery_items WHERE id = ?"
    ).get(id) as { medical_path: string; corporate_path: string } | undefined
    if (!row) {
      return NextResponse.json({ error: "Не найдено" }, { status: 404 })
    }
    await removeFile(row.medical_path)
    await removeFile(row.corporate_path)
    database.prepare("DELETE FROM gallery_items WHERE id = ?").run(id)
    return NextResponse.json({ success: true })
  } catch (e) {
    logger.error("GALLERY", "DELETE error", { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json({ error: "Не удалось удалить" }, { status: 500 })
  }
}
