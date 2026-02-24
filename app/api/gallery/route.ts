import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { saveBase64Image } from "@/lib/storage"

function toItemResponse(row: {
  id: string
  name: string
  medical_path: string
  corporate_path: string
  organization_id: string | null
  organization_name: string | null
  created_at: number
}) {
  return {
    id: row.id,
    name: row.name,
    medicalUrl: `/api/files/${row.medical_path.replace(/\\/g, "/")}`,
    corporateUrl: `/api/files/${row.corporate_path.replace(/\\/g, "/")}`,
    organizationId: row.organization_id ?? undefined,
    organizationName: row.organization_name ?? undefined,
    createdAt: row.created_at,
  }
}

export async function GET() {
  try {
    const database = getDb()
    const rows = database.prepare(
      "SELECT id, name, medical_path, corporate_path, organization_id, organization_name, created_at FROM gallery_items ORDER BY created_at DESC"
    ).all() as Array<{
      id: string
      name: string
      medical_path: string
      corporate_path: string
      organization_id: string | null
      organization_name: string | null
      created_at: number
    }>
    return NextResponse.json(rows.map(toItemResponse))
  } catch (e) {
    console.error("[API] gallery GET", e)
    return NextResponse.json({ error: "Не удалось загрузить галерею" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const name = String(body?.name ?? "Сотрудник").trim()
    const medicalUrl = body?.medicalUrl
    const corporateUrl = body?.corporateUrl
    if (!medicalUrl || !corporateUrl || typeof medicalUrl !== "string" || typeof corporateUrl !== "string") {
      return NextResponse.json({ error: "Требуются medicalUrl и corporateUrl" }, { status: 400 })
    }
    const id = crypto.randomUUID()
    const now = Date.now()
    const organizationId = body.organizationId ?? null
    const organizationName = body.organizationName ?? null

    const medicalPath = await saveBase64Image(medicalUrl, "gallery", `${id}_medical`)
    const corporatePath = await saveBase64Image(corporateUrl, "gallery", `${id}_corporate`)

    const database = getDb()
    database.prepare(
      "INSERT INTO gallery_items (id, name, medical_path, corporate_path, organization_id, organization_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(id, name, medicalPath, corporatePath, organizationId, organizationName, now)

    const row = database.prepare(
      "SELECT id, name, medical_path, corporate_path, organization_id, organization_name, created_at FROM gallery_items WHERE id = ?"
    ).get(id) as {
      id: string
      name: string
      medical_path: string
      corporate_path: string
      organization_id: string | null
      organization_name: string | null
      created_at: number
    }
    return NextResponse.json(toItemResponse(row))
  } catch (e) {
    console.error("[API] gallery POST", e)
    return NextResponse.json({ error: "Не удалось добавить в галерею" }, { status: 500 })
  }
}
