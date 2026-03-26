import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { saveEmployeePhoto, removeFile, removeGalleryImageFiles } from "@/lib/storage"
import { validateBase64Image } from "@/lib/upload-validation"
import { logger } from "@/lib/logger"
import { enforceTrustedOrigin } from "@/lib/request-security"
import { deleteGalleryCommentsForGalleryItems, deleteGalleryFeedbackForGalleryItems } from "@/lib/gallery-feedback"

function toResponse(row: {
  id: string
  name: string
  photo_path: string
  thumbnail_path: string | null
  department_id: string | null
  created_at: number
  department_name?: string
}) {
  const displayPath = row.thumbnail_path ?? row.photo_path
  return {
    id: row.id,
    name: row.name,
    photoUrl: `/api/files/${row.photo_path.replace(/\\/g, "/")}`,
    thumbnailUrl: `/api/files/${displayPath.replace(/\\/g, "/")}`,
    departmentId: row.department_id ?? null,
    departmentName: row.department_name,
    createdAt: row.created_at,
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const database = getDb()
    const row = database
      .prepare(
        `SELECT e.id, e.name, e.photo_path, e.thumbnail_path, e.department_id, e.created_at, d.name AS department_name
         FROM employees e
         LEFT JOIN departments d ON e.department_id = d.id
         WHERE e.id = ?`
      )
      .get(id) as {
      id: string
      name: string
      photo_path: string
      thumbnail_path: string | null
      department_id: string | null
      created_at: number
      department_name?: string
    } | undefined
    if (!row) {
      return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 })
    }
    return NextResponse.json(toResponse(row))
  } catch (e) {
    logger.error("EMPLOYEES", "GET by id error", { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json({ error: "Не удалось загрузить сотрудника" }, { status: 500 })
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
    const database = getDb()
    const existing = database
      .prepare("SELECT id, name, photo_path, thumbnail_path, department_id FROM employees WHERE id = ?")
      .get(id) as { id: string; name: string; photo_path: string; thumbnail_path: string | null; department_id: string | null } | undefined
    if (!existing) {
      return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 })
    }

    let name = existing.name
    if (body.name !== undefined) name = String(body.name).trim() || "Сотрудник"

    let photoPath = existing.photo_path
    let thumbnailPath: string | null = existing.thumbnail_path
    if (body.photoUrl !== undefined) {
      await removeFile(existing.photo_path)
      if (existing.thumbnail_path) await removeFile(existing.thumbnail_path)
      if (body.photoUrl && typeof body.photoUrl === "string") {
        const valid = validateBase64Image(body.photoUrl)
        if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 })
        const saved = await saveEmployeePhoto(body.photoUrl, id)
        photoPath = saved.path
        thumbnailPath = saved.thumbnailPath
      } else {
        thumbnailPath = null
      }
    }

    let departmentId: string | null = existing.department_id
    if (body.departmentId !== undefined) {
      departmentId = body.departmentId ? String(body.departmentId) : null
      if (departmentId) {
        const dept = database.prepare("SELECT id FROM departments WHERE id = ?").get(departmentId)
        if (!dept) {
          return NextResponse.json({ error: "Отдел не найден" }, { status: 400 })
        }
      }
    }

    database
      .prepare("UPDATE employees SET name = ?, photo_path = ?, thumbnail_path = ?, department_id = ? WHERE id = ?")
      .run(name, photoPath, thumbnailPath, departmentId, id)

    const row = database
      .prepare(
        `SELECT e.id, e.name, e.photo_path, e.thumbnail_path, e.department_id, e.created_at, d.name AS department_name
         FROM employees e
         LEFT JOIN departments d ON e.department_id = d.id
         WHERE e.id = ?`
      )
      .get(id) as {
      id: string
      name: string
      photo_path: string
      thumbnail_path: string | null
      department_id: string | null
      created_at: number
      department_name?: string
    }
    return NextResponse.json(toResponse(row))
  } catch (e) {
    logger.error("EMPLOYEES", "PATCH error", { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json({ error: "Не удалось обновить сотрудника" }, { status: 500 })
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
    const row = database.prepare("SELECT photo_path, thumbnail_path FROM employees WHERE id = ?").get(id) as
      | { photo_path: string; thumbnail_path: string | null }
      | undefined
    if (!row) {
      return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 })
    }
    // Удаляем записи галереи этого сотрудника и их файлы
    const galleryRows = database
      .prepare("SELECT id, medical_path, corporate_path FROM gallery_items WHERE employee_id = ?")
      .all(id) as Array<{ id: string; medical_path: string | null; corporate_path: string | null }>
    deleteGalleryFeedbackForGalleryItems(database, galleryRows.map((item) => item.id))
    deleteGalleryCommentsForGalleryItems(database, galleryRows.map((item) => item.id))
    for (const g of galleryRows) {
      if (g.medical_path) await removeGalleryImageFiles(g.medical_path).catch(() => {})
      if (g.corporate_path) await removeGalleryImageFiles(g.corporate_path).catch(() => {})
      database.prepare("DELETE FROM gallery_items WHERE id = ?").run(g.id)
    }
    await removeFile(row.photo_path)
    if (row.thumbnail_path) await removeFile(row.thumbnail_path)
    database.prepare("DELETE FROM employees WHERE id = ?").run(id)
    return NextResponse.json({ success: true })
  } catch (e) {
    logger.error("EMPLOYEES", "DELETE error", { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json({ error: "Не удалось удалить сотрудника" }, { status: 500 })
  }
}
