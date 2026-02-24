import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"

function toResponse(row: { id: string; name: string; created_at: number }) {
  return {
    id: row.id,
    name: row.name,
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
      .prepare("SELECT id, name, created_at FROM departments WHERE id = ?")
      .get(id) as { id: string; name: string; created_at: number } | undefined
    if (!row) {
      return NextResponse.json({ error: "Отдел не найден" }, { status: 404 })
    }
    return NextResponse.json(toResponse(row))
  } catch (e) {
    console.error("[API] departments/[id] GET", e)
    return NextResponse.json({ error: "Не удалось загрузить отдел" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const name = body.name !== undefined ? String(body.name).trim() : undefined
    if (name === undefined) {
      return NextResponse.json({ error: "Нет данных для обновления" }, { status: 400 })
    }
    const database = getDb()
    const existing = database.prepare("SELECT id FROM departments WHERE id = ?").get(id)
    if (!existing) {
      return NextResponse.json({ error: "Отдел не найден" }, { status: 404 })
    }
    database.prepare("UPDATE departments SET name = ? WHERE id = ?").run(name, id)
    const row = database.prepare("SELECT id, name, created_at FROM departments WHERE id = ?").get(id) as {
      id: string
      name: string
      created_at: number
    }
    return NextResponse.json(toResponse(row))
  } catch (e) {
    console.error("[API] departments/[id] PATCH", e)
    return NextResponse.json({ error: "Не удалось обновить отдел" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const database = getDb()
    const existing = database.prepare("SELECT id FROM departments WHERE id = ?").get(id)
    if (!existing) {
      return NextResponse.json({ error: "Отдел не найден" }, { status: 404 })
    }
    // Сотрудники отдела переводим в корень (department_id = NULL)
    database.prepare("UPDATE employees SET department_id = NULL WHERE department_id = ?").run(id)
    database.prepare("DELETE FROM departments WHERE id = ?").run(id)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[API] departments/[id] DELETE", e)
    return NextResponse.json({ error: "Не удалось удалить отдел" }, { status: 500 })
  }
}
