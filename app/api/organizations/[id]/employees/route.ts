import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { saveBase64Image } from "@/lib/storage"
import path from "path"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orgId } = await params
    const body = await request.json()
    const name = String(body?.name ?? "Сотрудник").trim()
    const photoUrl = body?.photoUrl
    if (!photoUrl || typeof photoUrl !== "string") {
      return NextResponse.json({ error: "Требуется photoUrl" }, { status: 400 })
    }
    const database = getDb()
    const org = database.prepare("SELECT id FROM organizations WHERE id = ?").get(orgId)
    if (!org) {
      return NextResponse.json({ error: "Организация не найдена" }, { status: 404 })
    }
    const empId = crypto.randomUUID()
    const photoPath = await saveBase64Image(
      photoUrl,
      path.join("organizations", orgId),
      `employee_${empId}`
    )
    database.prepare(
      "INSERT INTO employees (id, org_id, name, photo_path) VALUES (?, ?, ?, ?)"
    ).run(empId, orgId, name, photoPath)
    return NextResponse.json({
      id: empId,
      name,
      photoUrl: `/api/files/${photoPath.replace(/\\/g, "/")}`,
    })
  } catch (e) {
    console.error("[API] organizations/[id]/employees POST", e)
    return NextResponse.json({ error: "Не удалось добавить сотрудника" }, { status: 500 })
  }
}
