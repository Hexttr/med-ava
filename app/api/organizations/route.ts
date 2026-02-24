import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { saveBase64Image } from "@/lib/storage"
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

export async function GET() {
  try {
    const database = getDb()
    const orgs = database.prepare("SELECT id, name, photo_path, created_at, updated_at FROM organizations ORDER BY updated_at DESC").all() as Array<{ id: string; name: string; photo_path: string | null; created_at: number; updated_at: number }>
    const employees = database.prepare("SELECT id, org_id, name, photo_path FROM employees").all() as Array<{ id: string; org_id: string; name: string; photo_path: string }>
    const byOrg = new Map<string, typeof employees>()
    for (const e of employees) {
      if (!byOrg.has(e.org_id)) byOrg.set(e.org_id, [])
      byOrg.get(e.org_id)!.push(e)
    }
    const list = orgs.map((o) => ({
      ...toOrgResponse(o),
      employees: (byOrg.get(o.id) ?? []).map((e) => toEmployeeResponse(e)),
    }))
    return NextResponse.json(list)
  } catch (e) {
    console.error("[API] organizations GET", e)
    return NextResponse.json({ error: "Не удалось загрузить организации" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const name = String(body?.name ?? "").trim()
    if (!name) {
      return NextResponse.json({ error: "Название обязательно" }, { status: 400 })
    }
    const orgId = crypto.randomUUID()
    const now = Date.now()
    const employeesInput = Array.isArray(body.employees) ? body.employees : []

    let photoPath: string | null = null
    if (body.photoUrl && typeof body.photoUrl === "string") {
      photoPath = await saveBase64Image(body.photoUrl, path.join("organizations", orgId), "org")
    }

    const database = getDb()
    database.prepare(
      "INSERT INTO organizations (id, name, photo_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    ).run(orgId, name, photoPath, now, now)

    for (const emp of employeesInput) {
      const empId = String(emp?.id ?? crypto.randomUUID())
      const empName = String(emp?.name ?? "Сотрудник").trim()
      const photoUrl = emp?.photoUrl
      if (!photoUrl || typeof photoUrl !== "string") continue
      const empPhotoPath = await saveBase64Image(
        photoUrl,
        path.join("organizations", orgId),
        `employee_${empId}`
      )
      database.prepare(
        "INSERT INTO employees (id, org_id, name, photo_path) VALUES (?, ?, ?, ?)"
      ).run(empId, orgId, empName, empPhotoPath)
    }

    const row = database.prepare("SELECT id, name, photo_path, created_at, updated_at FROM organizations WHERE id = ?").get(orgId) as { id: string; name: string; photo_path: string | null; created_at: number; updated_at: number }
    const empRows = database.prepare("SELECT id, name, photo_path FROM employees WHERE org_id = ?").all(orgId) as Array<{ id: string; name: string; photo_path: string }>
    return NextResponse.json({
      ...toOrgResponse(row),
      employees: empRows.map(toEmployeeResponse),
    })
  } catch (e) {
    console.error("[API] organizations POST", e)
    return NextResponse.json({ error: "Не удалось создать организацию" }, { status: 500 })
  }
}
