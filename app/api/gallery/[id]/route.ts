import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { removeFile, saveBase64Image } from "@/lib/storage"
import { validateBase64Image } from "@/lib/upload-validation"
import { logger } from "@/lib/logger"
import { enforceTrustedOrigin } from "@/lib/request-security"
import { deleteGalleryFeedbackForGalleryItems, emptyGalleryFeedbackSummary, getGalleryFeedbackMap } from "@/lib/gallery-feedback"

function toItemResponse(row: {
  id: string
  name: string
  medical_path: string | null
  corporate_path: string | null
  employee_id: string | null
  department_id: string | null
  department_name: string | null
  created_at: number
}, feedback = emptyGalleryFeedbackSummary()) {
  return {
    id: row.id,
    name: row.name,
    medicalUrl: row.medical_path ? `/api/files/${row.medical_path.replace(/\\/g, "/")}` : null,
    corporateUrl: row.corporate_path ? `/api/files/${row.corporate_path.replace(/\\/g, "/")}` : null,
    employeeId: row.employee_id ?? undefined,
    departmentId: row.department_id ?? undefined,
    departmentName: row.department_name ?? undefined,
    createdAt: row.created_at,
    feedback,
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const originError = enforceTrustedOrigin(request)
    if (originError) return originError

    const { id } = await params
    const body = await request.json()
    const medicalUrl = body?.medicalUrl
    const corporateUrl = body?.corporateUrl
    if ((!medicalUrl && !corporateUrl) || (medicalUrl && typeof medicalUrl !== "string") || (corporateUrl && typeof corporateUrl !== "string")) {
      return NextResponse.json({ error: "Требуется medicalUrl или corporateUrl" }, { status: 400 })
    }
    const database = getDb()
    const row = database
      .prepare("SELECT id, name, medical_path, corporate_path, employee_id FROM gallery_items WHERE id = ?")
      .get(id) as { id: string; name: string; medical_path: string | null; corporate_path: string | null; employee_id: string | null } | undefined
    if (!row) {
      return NextResponse.json({ error: "Не найдено" }, { status: 404 })
    }
    let medicalPath = row.medical_path
    let corporatePath = row.corporate_path
    const ts = Date.now()
    if (medicalUrl) {
      const valid = validateBase64Image(medicalUrl)
      if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 })
      if (row.medical_path) await removeFile(row.medical_path)
      medicalPath = await saveBase64Image(medicalUrl, "gallery", `${id}_medical_${ts}`)
    }
    if (corporateUrl) {
      const valid = validateBase64Image(corporateUrl)
      if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 })
      if (row.corporate_path) await removeFile(row.corporate_path)
      corporatePath = await saveBase64Image(corporateUrl, "gallery", `${id}_corporate_${ts}`)
    }
    database
      .prepare("UPDATE gallery_items SET medical_path = ?, corporate_path = ? WHERE id = ?")
      .run(medicalPath, corporatePath, id)
    const updated = database
      .prepare(
        `SELECT g.id, g.name, g.medical_path, g.corporate_path, g.employee_id, e.department_id AS department_id, d.name AS department_name, g.created_at
         FROM gallery_items g
         LEFT JOIN employees e ON g.employee_id = e.id
         LEFT JOIN departments d ON e.department_id = d.id
         WHERE g.id = ?`
      )
      .get(id) as Parameters<typeof toItemResponse>[0]
    const feedback = getGalleryFeedbackMap(database, [id])[id]
    return NextResponse.json(toItemResponse(updated, feedback))
  } catch (e) {
    logger.error("GALLERY", "PATCH error", { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json({ error: "Не удалось обновить" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const originError = enforceTrustedOrigin(request)
    if (originError) return originError

    const { id } = await params
    const database = getDb()
    const row = database.prepare(
      "SELECT medical_path, corporate_path FROM gallery_items WHERE id = ?"
    ).get(id) as { medical_path: string | null; corporate_path: string | null } | undefined
    if (!row) {
      return NextResponse.json({ error: "Не найдено" }, { status: 404 })
    }
    if (row.medical_path) await removeFile(row.medical_path)
    if (row.corporate_path) await removeFile(row.corporate_path)
    deleteGalleryFeedbackForGalleryItems(database, [id])
    database.prepare("DELETE FROM gallery_items WHERE id = ?").run(id)
    return NextResponse.json({ success: true })
  } catch (e) {
    logger.error("GALLERY", "DELETE error", { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json({ error: "Не удалось удалить" }, { status: 500 })
  }
}
