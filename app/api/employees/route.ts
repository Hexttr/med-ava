import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { saveBase64Image } from "@/lib/storage"
import path from "path"

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const departmentId = searchParams.get("departmentId") ?? undefined
    const database = getDb()
    let rows: Array<{
      id: string
      name: string
      photo_path: string
      department_id: string | null
      created_at: number
      department_name?: string
    }>
    if (departmentId === undefined || departmentId === "") {
      rows = database
        .prepare(
          `SELECT e.id, e.name, e.photo_path, e.department_id, e.created_at, d.name AS department_name
           FROM employees e
           LEFT JOIN departments d ON e.department_id = d.id
           ORDER BY e.created_at DESC`
        )
        .all() as typeof rows
    } else {
      rows = database
        .prepare(
          `SELECT e.id, e.name, e.photo_path, e.department_id, e.created_at, d.name AS department_name
           FROM employees e
           LEFT JOIN departments d ON e.department_id = d.id
           WHERE e.department_id = ?
           ORDER BY e.created_at DESC`
        )
        .all(departmentId) as typeof rows
    }
    return NextResponse.json(rows.map(toResponse))
  } catch (e) {
    console.error("[API] employees GET", e)
    return NextResponse.json({ error: "Не удалось загрузить сотрудников" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const name = String(body?.name ?? "Сотрудник").trim()
    const photoUrl = body?.photoUrl
    if (!photoUrl || typeof photoUrl !== "string") {
      return NextResponse.json({ error: "Требуется photoUrl" }, { status: 400 })
    }
    const departmentId = body?.departmentId ?? null
    const database = getDb()
    if (departmentId) {
      const dept = database.prepare("SELECT id FROM departments WHERE id = ?").get(departmentId)
      if (!dept) {
        return NextResponse.json({ error: "Отдел не найден" }, { status: 404 })
      }
    }
    const empId = crypto.randomUUID()
    const photoPath = await saveBase64Image(
      photoUrl,
      "employees",
      empId
    )
    const now = Date.now()
    database
      .prepare(
        "INSERT INTO employees (id, name, photo_path, department_id, created_at) VALUES (?, ?, ?, ?, ?)"
      )
      .run(empId, name || "Сотрудник", photoPath, departmentId, now)
    const row = database
      .prepare(
        `SELECT e.id, e.name, e.photo_path, e.department_id, e.created_at, d.name AS department_name
         FROM employees e
         LEFT JOIN departments d ON e.department_id = d.id
         WHERE e.id = ?`
      )
      .get(empId) as {
      id: string
      name: string
      photo_path: string
      department_id: string | null
      created_at: number
      department_name?: string
    }
    return NextResponse.json(toResponse(row))
  } catch (e) {
    console.error("[API] employees POST", e)
    return NextResponse.json({ error: "Не удалось добавить сотрудника" }, { status: 500 })
  }
}
