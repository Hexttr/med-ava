import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { saveEmployeePhotoFromBuffer } from "@/lib/storage"
import { validateImageFile } from "@/lib/upload-validation"
import { logger } from "@/lib/logger"
import { enforceTrustedOrigin } from "@/lib/request-security"

const MAX_FILES = 100
const MAX_TOTAL_SIZE = 100 * 1024 * 1024 // 100 MB суммарно

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

export async function POST(request: NextRequest) {
  try {
    const originError = enforceTrustedOrigin(request)
    if (originError) return originError

    const formData = await request.formData()
    const departmentId = formData.get("departmentId") as string | null
    const files = formData.getAll("photo") as File[]

    if (!files.length) {
      return NextResponse.json({ error: "Нет файлов для загрузки" }, { status: 400 })
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Максимум ${MAX_FILES} файлов за один раз` },
        { status: 400 }
      )
    }

    const validFiles = files.filter((f) => f && f.size > 0 && f.type?.startsWith("image/"))
    if (validFiles.length === 0) {
      return NextResponse.json({ error: "Нет допустимых изображений" }, { status: 400 })
    }

    const totalSize = validFiles.reduce((s, f) => s + f.size, 0)
    if (totalSize > MAX_TOTAL_SIZE) {
      return NextResponse.json(
        {
          error:
            `Суммарный размер файлов превышает ${MAX_TOTAL_SIZE / 1024 / 1024} MB. ` +
            `Уменьшите количество фото в пачке или загрузите их в несколько подходов.`,
        },
        { status: 400 }
      )
    }

    const database = getDb()
    if (departmentId) {
      const dept = database.prepare("SELECT id FROM departments WHERE id = ?").get(departmentId)
      if (!dept) {
        return NextResponse.json({ error: "Отдел не найден" }, { status: 404 })
      }
    }

    const results: Array<{ id: string; name: string; photoUrl: string; thumbnailUrl: string; departmentId: string | null; createdAt: number; departmentName?: string }> = []
    const errors: string[] = []

    function nameFromFilename(filename: string): string {
      const base = filename.replace(/\.[^.]+$/, "").trim()
      return base || "Сотрудник"
    }

    for (const file of validFiles) {
      try {
        const validation = validateImageFile(file)
        if (!validation.ok) {
          errors.push(`${file.name}: ${validation.error}`)
          continue
        }
        const buf = Buffer.from(await file.arrayBuffer())
        const mime = file.type || "image/jpeg"
        const empId = crypto.randomUUID()
        const { path: photoPath, thumbnailPath } = await saveEmployeePhotoFromBuffer(buf, empId, mime)
        const now = Date.now()
        const empName = nameFromFilename(file.name)
        database
          .prepare(
            "INSERT INTO employees (id, name, photo_path, thumbnail_path, department_id, created_at) VALUES (?, ?, ?, ?, ?, ?)"
          )
          .run(empId, empName, photoPath, thumbnailPath, departmentId, now)
        const row = database
          .prepare(
            `SELECT e.id, e.name, e.photo_path, e.thumbnail_path, e.department_id, e.created_at, d.name AS department_name
             FROM employees e
             LEFT JOIN departments d ON e.department_id = d.id
             WHERE e.id = ?`
          )
          .get(empId) as Parameters<typeof toResponse>[0]
        results.push(toResponse(row))
      } catch (e) {
        errors.push(`${file.name}: ${e instanceof Error ? e.message : "Ошибка"}`)
        logger.warn("EMPLOYEES_BATCH", "Ошибка при добавлении", { file: file.name, error: e })
      }
    }

    return NextResponse.json({
      created: results.length,
      employees: results,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (e) {
    logger.error("EMPLOYEES_BATCH", "POST error", { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json({ error: "Не удалось добавить сотрудников" }, { status: 500 })
  }
}
