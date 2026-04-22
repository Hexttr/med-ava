import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"

import { getDb } from "@/lib/db"
import {
  getGallerySharedVotesForGalleryItem,
  isReviewImageStyle,
  isFeedbackVote,
} from "@/lib/gallery-feedback"
import { logger } from "@/lib/logger"
import { checkRateLimit } from "@/lib/rate-limit"
import { enforceTrustedOrigin, getClientIp, withNoStore } from "@/lib/request-security"
import type { FeedbackVoteValue } from "@/lib/types"

export async function POST(request: NextRequest) {
  try {
    const originError = enforceTrustedOrigin(request)
    if (originError) return originError

    const ip = getClientIp(request)
    const { allowed, resetIn } = checkRateLimit(`public-review-vote:${ip}`, {
      maxRequests: 20,
      windowMs: 60 * 1000,
    })

    if (!allowed) {
      return withNoStore(
        NextResponse.json(
          { error: `Слишком много попыток голосования. Попробуйте снова через ${resetIn} сек.` },
          { status: 429 }
        )
      )
    }

    const body = await request.json()
    const galleryItemId = String(body?.galleryItemId ?? "").trim()
    const employeeId = String(body?.employeeId ?? "").trim()
    const style = String(body?.style ?? "").trim()
    const vote = String(body?.vote ?? "").trim()

    if (!galleryItemId || !employeeId || !isReviewImageStyle(style) || !isFeedbackVote(vote)) {
      return withNoStore(
        NextResponse.json({ error: "Некорректные параметры голосования" }, { status: 400 })
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

    const ipHash = crypto.createHash("sha256").update(ip).digest("hex")
    const userAgentHash = crypto
      .createHash("sha256")
      .update(request.headers.get("user-agent") || "unknown")
      .digest("hex")
    const now = Date.now()

    const existingVote = database.prepare(
      `SELECT vote
       FROM gallery_feedback_votes
       WHERE gallery_item_id = ? AND style = ?`
    ).get(galleryItemId, style) as { vote: FeedbackVoteValue } | undefined

    if (existingVote?.vote === vote) {
      database.prepare(
        `DELETE FROM gallery_feedback_votes
         WHERE gallery_item_id = ? AND style = ?`
      ).run(galleryItemId, style)
    } else {
      database.prepare(
        `INSERT INTO gallery_feedback_votes (
           id,
           gallery_item_id,
           employee_id,
           style,
           vote,
           fingerprint_hash,
           ip_hash,
           user_agent_hash,
           created_at,
           updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(gallery_item_id, style)
         DO UPDATE SET
           employee_id = excluded.employee_id,
           vote = excluded.vote,
           fingerprint_hash = excluded.fingerprint_hash,
           ip_hash = excluded.ip_hash,
           user_agent_hash = excluded.user_agent_hash,
           updated_at = excluded.updated_at`
      ).run(
        crypto.randomUUID(),
        galleryItemId,
        employeeId,
        style,
        vote,
        null,
        ipHash,
        userAgentHash,
        now,
        now
      )
    }

    return withNoStore(
      NextResponse.json({
        galleryItemId,
        employeeId,
        sharedVotes: getGallerySharedVotesForGalleryItem(database, galleryItemId),
      })
    )
  } catch (error) {
    logger.error("PUBLIC_REVIEW", "Vote error", { error: error instanceof Error ? error.message : String(error) })
    return withNoStore(
      NextResponse.json({ error: "Не удалось сохранить голос" }, { status: 500 })
    )
  }
}
