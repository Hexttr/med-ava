import { NextRequest, NextResponse } from "next/server"

import { getDb } from "@/lib/db"
import {
  emptyGalleryImageComments,
  getGallerySharedVotesMap,
  getGalleryImageCommentsMap,
} from "@/lib/gallery-feedback"
import { logger } from "@/lib/logger"
import { checkRateLimit } from "@/lib/rate-limit"
import { getClientIp, withNoStore } from "@/lib/request-security"
import type { PublicReviewCatalogDepartment, PublicReviewCatalogEmployee, PublicReviewCatalogResponse } from "@/lib/types"

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request)
    const { allowed, resetIn } = checkRateLimit(`public-review-catalog:${ip}`, {
      maxRequests: 30,
      windowMs: 60 * 1000,
    })

    if (!allowed) {
      return withNoStore(
        NextResponse.json(
          { error: `Слишком много запросов. Попробуйте снова через ${resetIn} сек.` },
          { status: 429 }
        )
      )
    }

    const database = getDb()
    const rows = database.prepare(
      `SELECT
         e.id AS employee_id,
         e.name AS employee_name,
         e.department_id,
         d.name AS department_name,
         g.id AS gallery_item_id,
         g.medical_path,
         g.corporate_path
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       INNER JOIN gallery_items g
         ON g.id = (
           SELECT gi.id
           FROM gallery_items gi
           WHERE gi.employee_id = e.id
             AND (gi.medical_path IS NOT NULL OR gi.corporate_path IS NOT NULL)
           ORDER BY gi.created_at DESC
           LIMIT 1
         )
       ORDER BY
         CASE WHEN d.name IS NULL OR d.name = '' THEN 1 ELSE 0 END,
         d.name COLLATE NOCASE ASC,
         e.name COLLATE NOCASE ASC`
    ).all() as Array<{
      employee_id: string
      employee_name: string
      department_id: string | null
      department_name: string | null
      gallery_item_id: string
      medical_path: string | null
      corporate_path: string | null
    }>

    const galleryItemIds = rows.map((row) => row.gallery_item_id)
    const commentsByItem = getGalleryImageCommentsMap(database, galleryItemIds)
    const sharedVotesByItem = getGallerySharedVotesMap(database, galleryItemIds)

    const departments = new Map<string, PublicReviewCatalogDepartment>()

    for (const row of rows) {
      const departmentKey = row.department_id ?? "__no_department__"
      const departmentName = row.department_name?.trim() || "Без отдела"
      const employee: PublicReviewCatalogEmployee = {
        employeeId: row.employee_id,
        name: row.employee_name,
        departmentId: row.department_id,
        departmentName: row.department_name ?? undefined,
        originalUrl: `/api/public/review/image/employee/${row.employee_id}`,
        galleryItemId: row.gallery_item_id,
        medicalUrl: row.medical_path ? `/api/public/review/image/gallery/${row.gallery_item_id}?style=medical` : null,
        corporateUrl: row.corporate_path ? `/api/public/review/image/gallery/${row.gallery_item_id}?style=corporate` : null,
        hasGeneratedSet: Boolean(row.medical_path || row.corporate_path),
        sharedVotes: sharedVotesByItem[row.gallery_item_id],
        comments: commentsByItem[row.gallery_item_id] ?? emptyGalleryImageComments(),
      }

      const department = departments.get(departmentKey) ?? {
        departmentId: row.department_id,
        name: departmentName,
        employeeCount: 0,
        employees: [],
      }
      department.employees.push(employee)
      department.employeeCount += 1
      departments.set(departmentKey, department)
    }

    const payload: PublicReviewCatalogResponse = {
      departments: Array.from(departments.values()),
      totalEmployees: rows.length,
    }

    return withNoStore(NextResponse.json(payload))
  } catch (error) {
    logger.error("PUBLIC_REVIEW", "Catalog error", { error: error instanceof Error ? error.message : String(error) })
    return withNoStore(
      NextResponse.json({ error: "Не удалось загрузить каталог отделов" }, { status: 500 })
    )
  }
}
