import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { saveBase64Image, removeFile } from "@/lib/storage"
import path from "path"
import fs from "fs/promises"
import { getUploadsDir } from "@/lib/db"

function toOrgResponse(row: { id: string; name: string; photo_path: string | null; created_at: number; updated_at: number }) {
  return {
    id: row.id,
    name: row.name,
    photoUrl: row.photo_path ? `/api/files/${row.photo_path.replace(/\\/g, "/")}` : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toEmployeeResponse(row: { id: string; name: string; photo_path: string }) {
  return {
    id: row.id,
    name: row.name,
    photoUrl: `/api/files/${row.photo_path.replace(/\\/g, "/")}`,
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const database = getDb()
    const row = database.prepare("SELECT id, name, photo_path, created_at, updated_at FROM organizations WHERE id = ?").get(id) as { id: string; name: string; photo_path: string | null; created_at: number; updated_at: number } | undefined
    if (!row) {
      return NextResponse.json({ error: "Организация не найдена" }, { status: 404 })
    }
    const employees = database.prepare("SELECT id, name, photo_path FROM employees WHERE org_id = ?").all(id) as Array<{ id: string; name: string; photo_path: string }>
    return NextResponse.json({
      ...toOrgResponse(row),
      employees: employees.map(toEmployeeResponse),
    })
  } catch (e) {
    console.error("[API] organizations/[id] GET", e)
    return NextResponse.json({ error: "Не удалось загрузить организацию" }, { status: 500 })
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
    const existing = database.prepare("SELECT id, name, photo_path FROM organizations WHERE id = ?").get(id) as { id: string; name: string; photo_path: string | null } | undefined
    if (!existing) {
      return NextResponse.json({ error: "Организация не найдена" }, { status: 404 })
    }

    const name = body.name !== undefined ? String(body.name).trim() : existing.name
    const now = Date.now()
    let photoPath: string | null = existing.photo_path

    if (body.photoUrl !== undefined) {
      if (existing.photo_path) await removeFile(existing.photo_path)
      if (body.photoUrl && typeof body.photoUrl === "string") {
        photoPath = await saveBase64Image(body.photoUrl, path.join("organizations", id), "org")
      } else {
        photoPath = null
      }
    }

    if (body.employees !== undefined) {
      const oldEmployees = database.prepare("SELECT id, photo_path FROM employees WHERE org_id = ?").all(id) as Array<{ id: string; photo_path: string }>
      for (const e of oldEmployees) {
        await removeFile(e.photo_path)
      }
      database.prepare("DELETE FROM employees WHERE org_id = ?").run(id)

      const employeesInput = Array.isArray(body.employees) ? body.employees : []
      for (const emp of employeesInput) {
        const empId = String(emp?.id ?? crypto.randomUUID())
        const empName = String(emp?.name ?? "Сотрудник").trim()
        const photoUrl = emp?.photoUrl
        if (!photoUrl || typeof photoUrl !== "string") continue
        const empPhotoPath = await saveBase64Image(
          photoUrl,
          path.join("organizations", id),
          `employee_${empId}`
        )
        database.prepare(
          "INSERT INTO employees (id, org_id, name, photo_path) VALUES (?, ?, ?, ?)"
        ).run(empId, id, empName, empPhotoPath)
      }
    }

    database.prepare(
      "UPDATE organizations SET name = ?, photo_path = ?, updated_at = ? WHERE id = ?"
    ).run(name, photoPath, now, id)

    const row = database.prepare("SELECT id, name, photo_path, created_at, updated_at FROM organizations WHERE id = ?").get(id) as { id: string; name: string; photo_path: string | null; created_at: number; updated_at: number }
    const empRows = database.prepare("SELECT id, name, photo_path FROM employees WHERE org_id = ?").all(id) as Array<{ id: string; name: string; photo_path: string }>
    return NextResponse.json({
      ...toOrgResponse(row),
      employees: empRows.map(toEmployeeResponse),
    })
  } catch (e) {
    console.error("[API] organizations/[id] PATCH", e)
    return NextResponse.json({ error: "Не удалось обновить организацию" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const database = getDb()
    const row = database.prepare("SELECT photo_path FROM organizations WHERE id = ?").get(id) as { photo_path: string | null } | undefined
    if (!row) {
      return NextResponse.json({ error: "Организация не найдена" }, { status: 404 })
    }
    const base = getUploadsDir()
    const orgDir = path.join(base, "organizations", id)
    await fs.rm(orgDir, { recursive: true }).catch(() => {})
    database.prepare("DELETE FROM organizations WHERE id = ?").run(id)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[API] organizations/[id] DELETE", e)
    return NextResponse.json({ error: "Не удалось удалить организацию" }, { status: 500 })
  }
}
