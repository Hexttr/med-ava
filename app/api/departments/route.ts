import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"

function toResponse(row: { id: string; name: string; created_at: number }) {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  }
}

export async function GET() {
  try {
    const database = getDb()
    const rows = database
      .prepare("SELECT id, name, created_at FROM departments ORDER BY name ASC")
      .all() as Array<{ id: string; name: string; created_at: number }>
    return NextResponse.json(rows.map(toResponse))
  } catch (e) {
    console.error("[API] departments GET", e)
    return NextResponse.json({ error: "Не удалось загрузить отделы" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const name = String(body?.name ?? "").trim()
    if (!name) {
      return NextResponse.json({ error: "Название обязательно" }, { status: 400 })
    }
    const id = crypto.randomUUID()
    const now = Date.now()
    const database = getDb()
    database.prepare("INSERT INTO departments (id, name, created_at) VALUES (?, ?, ?)").run(id, name, now)
    const row = database.prepare("SELECT id, name, created_at FROM departments WHERE id = ?").get(id) as {
      id: string
      name: string
      created_at: number
    }
    return NextResponse.json(toResponse(row))
  } catch (e) {
    console.error("[API] departments POST", e)
    return NextResponse.json({ error: "Не удалось создать отдел" }, { status: 500 })
  }
}
