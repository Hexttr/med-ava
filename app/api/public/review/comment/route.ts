import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"

import { getDb } from "@/lib/db"
import {
  deleteGalleryImageComment,
  getGalleryImageCommentsMap,
  getOrCreateReviewViewerId,
  hashFeedbackValue,
  isFeedbackStyle,
  REVIEW_VIEWER_COOKIE,
  upsertGalleryImageComment,
} from "@/lib/gallery-feedback"
import { logger } from "@/lib/logger"
import { checkRateLimit } from "@/lib/rate-limit"
import { enforceTrustedOrigin, getClientIp, withNoStore } from "@/lib/request-security"
import type { PublicReviewCommentResponse } from "@/lib/types"

const MAX_COMMENT_LENGTH = 240

function applyViewerCookie(response: NextResponse, viewerId: string) {
  response.cookies.set(REVIEW_VIEWER_COOKIE, viewerId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.EAM_HTTPS === "true",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  })
}

export async function POST(request: NextRequest) {
  try {
    const originError = enforceTrustedOrigin(request)
    if (originError) return originError

    const ip = getClientIp(request)
    const { allowed, resetIn } = checkRateLimit(`public-review-comment:${ip}`, {
      maxRequests: 12,
      windowMs: 60 * 1000,
    })

    if (!allowed) {
      return withNoStore(
        NextResponse.json(
          { error: `Слишком много попыток сохранить отзыв. Попробуйте снова через ${resetIn} сек.` },
          { status: 429 }
        )
      )
    }

    const body = await request.json()
    const galleryItemId = String(body?.galleryItemId ?? "").trim()
    const employeeId = String(body?.employeeId ?? "").trim()
    const style = String(body?.style ?? "").trim()
    const commentText = String(body?.commentText ?? "").trim()

    if (!galleryItemId || !employeeId || !isFeedbackStyle(style)) {
      return withNoStore(
        NextResponse.json({ error: "Некорректные параметры отзыва" }, { status: 400 })
      )
    }

    if (commentText.length > MAX_COMMENT_LENGTH) {
      return withNoStore(
        NextResponse.json({ error: `Отзыв должен быть не длиннее ${MAX_COMMENT_LENGTH} символов` }, { status: 400 })
      )
    }

    const database = getDb()
    const galleryItem = database.prepare(
      `SELECT id, employee_id, medical_path, corporate_path
       FROM gallery_items
       WHERE id = ? AND employee_id = ?`
    ).get(galleryItemId, employeeId) as {
      id: string
      employee_id: string
      medical_path: string | null
      corporate_path: string | null
    } | undefined

    if (!galleryItem) {
      return withNoStore(NextResponse.json({ error: "Набор портретов не найден" }, { status: 404 }))
    }

    if (style === "medical" && !galleryItem.medical_path) {
      return withNoStore(NextResponse.json({ error: "Медицинский портрет недоступен" }, { status: 400 }))
    }

    if (style === "corporate" && !galleryItem.corporate_path) {
      return withNoStore(NextResponse.json({ error: "Корпоративный портрет недоступен" }, { status: 400 }))
    }

    const { viewerId, isNew } = getOrCreateReviewViewerId(request.cookies.get(REVIEW_VIEWER_COOKIE)?.value)
    const fingerprintHash = hashFeedbackValue(viewerId)
    const ipHash = hashFeedbackValue(ip)

    if (commentText) {
      upsertGalleryImageComment(database, {
        id: crypto.randomUUID(),
        galleryItemId,
        employeeId,
        style,
        commentText,
        editorFingerprintHash: fingerprintHash,
        editorIpHash: ipHash,
        updatedAt: Date.now(),
      })
    } else {
      deleteGalleryImageComment(database, galleryItemId, style)
    }

    const comments = getGalleryImageCommentsMap(database, [galleryItemId])[galleryItemId]
    const responsePayload: PublicReviewCommentResponse = {
      galleryItemId,
      employeeId,
      style,
      comments,
    }

    const response = withNoStore(NextResponse.json(responsePayload))
    if (isNew) {
      applyViewerCookie(response, viewerId)
    }

    return response
  } catch (error) {
    logger.error("PUBLIC_REVIEW", "Comment error", { error: error instanceof Error ? error.message : String(error) })
    return withNoStore(
      NextResponse.json({ error: "Не удалось сохранить отзыв" }, { status: 500 })
    )
  }
}
