import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { saveBase64Image, removeFile } from "@/lib/storage"

function toResponse(row: {
  id: string
  name: string
  photo_path: string
  department_id: string | null
  created_at: number
  department_name?: string
}) {
  return {
    id: row.id,
    name: row.name,
    photoUrl: `/api/files/${row.photo_path.replace(/\\/g, "/")}`,
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
        `SELECT e.id, e.name, e.photo_path, e.department_id, e.created_at, d.name AS department_name
         FROM employees e
         LEFT JOIN departments d ON e.department_id = d.id
         WHERE e.id = ?`
      )
      .get(id) as {
      id: string
      name: string
      photo_path: string
      department_id: string | null
      created_at: number
      department_name?: string
    } | undefined
    if (!row) {
      return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 })
    }
    return NextResponse.json(toResponse(row))
  } catch (e) {
    console.error("[API] employees/[id] GET", e)
    return NextResponse.json({ error: "Не удалось загрузить сотрудника" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const database = getDb()
    const existing = database
      .prepare("SELECT id, name, photo_path, department_id FROM employees WHERE id = ?")
      .get(id) as { id: string; name: string; photo_path: string; department_id: string | null } | undefined
    if (!existing) {
      return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 })
    }

    let name = existing.name
    if (body.name !== undefined) name = String(body.name).trim() || "Сотрудник"

    let photoPath = existing.photo_path
    if (body.photoUrl !== undefined) {
      await removeFile(existing.photo_path)
      if (body.photoUrl && typeof body.photoUrl === "string") {
        photoPath = await saveBase64Image(body.photoUrl, "employees", id)
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
      .prepare("UPDATE employees SET name = ?, photo_path = ?, department_id = ? WHERE id = ?")
      .run(name, photoPath, departmentId, id)

    const row = database
      .prepare(
        `SELECT e.id, e.name, e.photo_path, e.department_id, e.created_at, d.name AS department_name
         FROM employees e
         LEFT JOIN departments d ON e.department_id = d.id
         WHERE e.id = ?`
      )
      .get(id) as {
      id: string
      name: string
      photo_path: string
      department_id: string | null
      created_at: number
      department_name?: string
    }
    return NextResponse.json(toResponse(row))
  } catch (e) {
    console.error("[API] employees/[id] PATCH", e)
    return NextResponse.json({ error: "Не удалось обновить сотрудника" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const database = getDb()
    const row = database.prepare("SELECT photo_path FROM employees WHERE id = ?").get(id) as
      | { photo_path: string }
      | undefined
    if (!row) {
      return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 })
    }
    await removeFile(row.photo_path)
    database.prepare("DELETE FROM employees WHERE id = ?").run(id)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[API] employees/[id] DELETE", e)
    return NextResponse.json({ error: "Не удалось удалить сотрудника" }, { status: 500 })
  }
}
