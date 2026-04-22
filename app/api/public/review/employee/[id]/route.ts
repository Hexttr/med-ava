import { NextRequest, NextResponse } from "next/server"

import { getDb } from "@/lib/db"
import {
  emptySharedVotes,
  getGallerySharedVotesForGalleryItem,
} from "@/lib/gallery-feedback"
import { logger } from "@/lib/logger"
import { checkRateLimit } from "@/lib/rate-limit"
import { getClientIp, withNoStore } from "@/lib/request-security"
import { type PublicReviewEmployee } from "@/lib/types"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(request)
    const { allowed, resetIn } = checkRateLimit(`public-review-employee:${ip}`, {
      maxRequests: 60,
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

    const { id } = await params
    const database = getDb()
    const employee = database.prepare(
      `SELECT e.id, e.name, e.photo_path, e.thumbnail_path, d.name AS department_name
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE e.id = ?`
    ).get(id) as {
      id: string
      name: string
      photo_path: string
      thumbnail_path: string | null
      department_name: string | null
    } | undefined

    if (!employee) {
      return withNoStore(NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 }))
    }

    const latestGalleryItem = database.prepare(
      `SELECT id, medical_path, corporate_path
       FROM gallery_items
       WHERE employee_id = ? AND (medical_path IS NOT NULL OR corporate_path IS NOT NULL)
       ORDER BY created_at DESC
       LIMIT 1`
    ).get(id) as {
      id: string
      medical_path: string | null
      corporate_path: string | null
    } | undefined

    const sharedVotes = latestGalleryItem
      ? getGallerySharedVotesForGalleryItem(database, latestGalleryItem.id)
      : emptySharedVotes()

    const payload: PublicReviewEmployee = {
      employeeId: employee.id,
      name: employee.name,
      departmentName: employee.department_name ?? undefined,
      originalUrl: `/api/public/review/image/employee/${employee.id}`,
      galleryItemId: latestGalleryItem?.id ?? null,
      medicalUrl: latestGalleryItem?.medical_path ? `/api/public/review/image/gallery/${latestGalleryItem.id}?style=medical` : null,
      corporateUrl: latestGalleryItem?.corporate_path ? `/api/public/review/image/gallery/${latestGalleryItem.id}?style=corporate` : null,
      hasGeneratedSet: Boolean(latestGalleryItem?.medical_path || latestGalleryItem?.corporate_path),
      sharedVotes,
    }

    return withNoStore(NextResponse.json(payload))
  } catch (error) {
    logger.error("PUBLIC_REVIEW", "Employee error", { error: error instanceof Error ? error.message : String(error) })
    return withNoStore(
      NextResponse.json({ error: "Не удалось загрузить карточку сотрудника" }, { status: 500 })
    )
  }
}
