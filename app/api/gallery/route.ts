import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { saveBase64Image } from "@/lib/storage"
import { validateBase64Image } from "@/lib/upload-validation"
import { logger } from "@/lib/logger"
import { enforceTrustedOrigin } from "@/lib/request-security"

function toItemResponse(row: {
  id: string
  name: string
  employee_name: string | null
  medical_path: string | null
  corporate_path: string | null
  employee_id: string | null
  department_id: string | null
  department_name: string | null
  created_at: number
}) {
  return {
    id: row.id,
    name: row.employee_name ?? row.name,
    medicalUrl: row.medical_path ? `/api/files/${row.medical_path.replace(/\\/g, "/")}` : null,
    corporateUrl: row.corporate_path ? `/api/files/${row.corporate_path.replace(/\\/g, "/")}` : null,
    employeeId: row.employee_id ?? undefined,
    departmentId: row.department_id ?? undefined,
    departmentName: row.department_name ?? undefined,
    createdAt: row.created_at,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const departmentId = searchParams.get("departmentId") ?? undefined
    const employeeId = searchParams.get("employeeId") ?? undefined
    const database = getDb()
    let rows: Array<{
      id: string
      name: string
      employee_name: string | null
      medical_path: string
      corporate_path: string
      employee_id: string | null
      department_id: string | null
      department_name: string | null
      created_at: number
    }>
    if (employeeId && employeeId !== "") {
      rows = database
        .prepare(
          `SELECT g.id, g.name, g.medical_path, g.corporate_path, g.employee_id, e.name AS employee_name, e.department_id AS department_id, d.name AS department_name, g.created_at
           FROM gallery_items g
           LEFT JOIN employees e ON g.employee_id = e.id
           LEFT JOIN departments d ON e.department_id = d.id
           WHERE g.employee_id = ?
           ORDER BY g.created_at DESC`
        )
        .all(employeeId) as typeof rows
    } else if (departmentId && departmentId !== "") {
      rows = database
        .prepare(
          `SELECT g.id, g.name, g.medical_path, g.corporate_path, g.employee_id, e.name AS employee_name, e.department_id AS department_id, d.name AS department_name, g.created_at
           FROM gallery_items g
           LEFT JOIN employees e ON g.employee_id = e.id
           LEFT JOIN departments d ON e.department_id = d.id
           WHERE e.department_id = ?
           ORDER BY g.created_at DESC`
        )
        .all(departmentId) as typeof rows
    } else {
      rows = database
        .prepare(
          `SELECT g.id, g.name, g.medical_path, g.corporate_path, g.employee_id, e.name AS employee_name, e.department_id AS department_id, d.name AS department_name, g.created_at
           FROM gallery_items g
           LEFT JOIN employees e ON g.employee_id = e.id
           LEFT JOIN departments d ON e.department_id = d.id
           ORDER BY g.created_at DESC`
        )
        .all() as typeof rows
    }
    return NextResponse.json(rows.map(toItemResponse))
  } catch (e) {
    logger.error("GALLERY", "GET error", { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json({ error: "Не удалось загрузить галерею" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const originError = enforceTrustedOrigin(request)
    if (originError) return originError

    const body = await request.json()
    const name = String(body?.name ?? "Сотрудник").trim()
    const medicalUrl = body?.medicalUrl
    const corporateUrl = body?.corporateUrl
    const hasMedical = medicalUrl && typeof medicalUrl === "string"
    const hasCorporate = corporateUrl && typeof corporateUrl === "string"
    if (!hasMedical && !hasCorporate) {
      return NextResponse.json({ error: "Требуется medicalUrl или corporateUrl" }, { status: 400 })
    }
    if (hasMedical) {
      const medValid = validateBase64Image(medicalUrl)
      if (!medValid.ok) return NextResponse.json({ error: medValid.error }, { status: 400 })
    }
    if (hasCorporate) {
      const corpValid = validateBase64Image(corporateUrl)
      if (!corpValid.ok) return NextResponse.json({ error: corpValid.error }, { status: 400 })
    }
    const employeeId = body?.employeeId ?? null
    const database = getDb()
    if (employeeId) {
      const emp = database
        .prepare(
          "SELECT e.department_id, d.name FROM employees e LEFT JOIN departments d ON e.department_id = d.id WHERE e.id = ?"
        )
        .get(employeeId) as { department_id: string | null; name: string | null } | undefined
      if (emp) {
        // Touch the employee relationship early to validate that the referenced employee exists.
        void emp.department_id
        void emp.name
      }
    }
    const id = crypto.randomUUID()
    const now = Date.now()
    let medicalPath: string | null = null
    let corporatePath: string | null = null
    if (hasMedical) medicalPath = await saveBase64Image(medicalUrl!, "gallery", `${id}_medical`)
    if (hasCorporate) corporatePath = await saveBase64Image(corporateUrl!, "gallery", `${id}_corporate`)
    database
      .prepare(
        "INSERT INTO gallery_items (id, name, medical_path, corporate_path, employee_id, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(id, name, medicalPath, corporatePath, employeeId, now)
    const row = database
      .prepare(
        `SELECT g.id, g.name, g.medical_path, g.corporate_path, g.employee_id, e.department_id AS department_id, d.name AS department_name, g.created_at
         FROM gallery_items g
         LEFT JOIN employees e ON g.employee_id = e.id
         LEFT JOIN departments d ON e.department_id = d.id
         WHERE g.id = ?`
      )
      .get(id) as {
      id: string
      name: string
      employee_name: string | null
      medical_path: string
      corporate_path: string
      employee_id: string | null
      department_id: string | null
      department_name: string | null
      created_at: number
    }
    return NextResponse.json(toItemResponse(row))
  } catch (e) {
    logger.error("GALLERY", "POST error", { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json({ error: "Не удалось добавить в галерею" }, { status: 500 })
  }
}
