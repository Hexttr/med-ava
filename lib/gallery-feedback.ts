import crypto from "crypto"
import type Database from "better-sqlite3"

import type {
  FeedbackVoteValue,
  GalleryFeedbackSummary,
  GalleryImageComments,
  GalleryViewerVotes,
  PortraitStyle,
} from "@/lib/types"

export const REVIEW_VIEWER_COOKIE = "eam_review_viewer"

function emptyStyleSummary() {
  return { likes: 0, dislikes: 0 }
}

export function emptyViewerVotes(): GalleryViewerVotes {
  return {
    medical: null,
    corporate: null,
  }
}

export function emptyGalleryFeedbackSummary(): GalleryFeedbackSummary {
  return {
    medical: emptyStyleSummary(),
    corporate: emptyStyleSummary(),
  }
}

export function emptyGalleryImageComments(): GalleryImageComments {
  return {
    medical: null,
    corporate: null,
  }
}

export function hashFeedbackValue(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex")
}

export function getOrCreateReviewViewerId(cookieValue: string | undefined): { viewerId: string; isNew: boolean } {
  const normalized = cookieValue?.trim()
  if (normalized && /^[a-f0-9-]{36}$/i.test(normalized)) {
    return { viewerId: normalized, isNew: false }
  }

  return {
    viewerId: crypto.randomUUID(),
    isNew: true,
  }
}

export function isFeedbackStyle(value: string): value is PortraitStyle {
  return value === "medical" || value === "corporate"
}

export function isFeedbackVote(value: string): value is FeedbackVoteValue {
  return value === "like" || value === "dislike"
}

export function getGalleryFeedbackMap(
  database: Database.Database,
  galleryItemIds: string[]
): Record<string, GalleryFeedbackSummary> {
  if (galleryItemIds.length === 0) return {}

  const placeholders = galleryItemIds.map(() => "?").join(", ")
  const rows = database.prepare(
    `SELECT gallery_item_id, style, vote, COUNT(*) AS total
     FROM gallery_feedback_votes
     WHERE gallery_item_id IN (${placeholders})
     GROUP BY gallery_item_id, style, vote`
  ).all(...galleryItemIds) as Array<{
    gallery_item_id: string
    style: PortraitStyle
    vote: FeedbackVoteValue
    total: number
  }>

  const feedbackByItem: Record<string, GalleryFeedbackSummary> = {}
  for (const itemId of galleryItemIds) {
    feedbackByItem[itemId] = emptyGalleryFeedbackSummary()
  }

  for (const row of rows) {
    const target = feedbackByItem[row.gallery_item_id] ?? emptyGalleryFeedbackSummary()
    const styleSummary = target[row.style]
    if (row.vote === "like") {
      styleSummary.likes = row.total
    } else {
      styleSummary.dislikes = row.total
    }
    feedbackByItem[row.gallery_item_id] = target
  }

  return feedbackByItem
}

export function getViewerVotesForGalleryItem(
  database: Database.Database,
  galleryItemId: string,
  fingerprintHash: string
): GalleryViewerVotes {
  const rows = database.prepare(
    `SELECT style, vote
     FROM gallery_feedback_votes
     WHERE gallery_item_id = ? AND fingerprint_hash = ?`
  ).all(galleryItemId, fingerprintHash) as Array<{
    style: PortraitStyle
    vote: FeedbackVoteValue
  }>

  const viewerVotes = emptyViewerVotes()
  for (const row of rows) {
    viewerVotes[row.style] = row.vote
  }

  return viewerVotes
}

export function getViewerVotesMapForGalleryItems(
  database: Database.Database,
  galleryItemIds: string[],
  fingerprintHash: string
): Record<string, GalleryViewerVotes> {
  if (galleryItemIds.length === 0) return {}

  const placeholders = galleryItemIds.map(() => "?").join(", ")
  const rows = database.prepare(
    `SELECT gallery_item_id, style, vote
     FROM gallery_feedback_votes
     WHERE fingerprint_hash = ? AND gallery_item_id IN (${placeholders})`
  ).all(fingerprintHash, ...galleryItemIds) as Array<{
    gallery_item_id: string
    style: PortraitStyle
    vote: FeedbackVoteValue
  }>

  const votesByItem: Record<string, GalleryViewerVotes> = {}
  for (const itemId of galleryItemIds) {
    votesByItem[itemId] = emptyViewerVotes()
  }

  for (const row of rows) {
    const target = votesByItem[row.gallery_item_id] ?? emptyViewerVotes()
    target[row.style] = row.vote
    votesByItem[row.gallery_item_id] = target
  }

  return votesByItem
}

export function getGalleryImageCommentsMap(
  database: Database.Database,
  galleryItemIds: string[]
): Record<string, GalleryImageComments> {
  if (galleryItemIds.length === 0) return {}

  const placeholders = galleryItemIds.map(() => "?").join(", ")
  const rows = database.prepare(
    `SELECT gallery_item_id, style, comment_text, updated_at
     FROM gallery_image_comments
     WHERE gallery_item_id IN (${placeholders})`
  ).all(...galleryItemIds) as Array<{
    gallery_item_id: string
    style: PortraitStyle
    comment_text: string
    updated_at: number
  }>

  const commentsByItem: Record<string, GalleryImageComments> = {}
  for (const itemId of galleryItemIds) {
    commentsByItem[itemId] = emptyGalleryImageComments()
  }

  for (const row of rows) {
    const target = commentsByItem[row.gallery_item_id] ?? emptyGalleryImageComments()
    target[row.style] = {
      text: row.comment_text,
      updatedAt: row.updated_at,
    }
    commentsByItem[row.gallery_item_id] = target
  }

  return commentsByItem
}

export function upsertGalleryImageComment(
  database: Database.Database,
  input: {
    id: string
    galleryItemId: string
    employeeId: string
    style: PortraitStyle
    commentText: string
    editorFingerprintHash: string
    editorIpHash: string
    updatedAt: number
  }
) {
  database.prepare(
    `INSERT INTO gallery_image_comments (
       id,
       gallery_item_id,
       employee_id,
       style,
       comment_text,
       editor_fingerprint_hash,
       editor_ip_hash,
       updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(gallery_item_id, style)
     DO UPDATE SET
       employee_id = excluded.employee_id,
       comment_text = excluded.comment_text,
       editor_fingerprint_hash = excluded.editor_fingerprint_hash,
       editor_ip_hash = excluded.editor_ip_hash,
       updated_at = excluded.updated_at`
  ).run(
    input.id,
    input.galleryItemId,
    input.employeeId,
    input.style,
    input.commentText,
    input.editorFingerprintHash,
    input.editorIpHash,
    input.updatedAt
  )
}

export function deleteGalleryImageComment(
  database: Database.Database,
  galleryItemId: string,
  style: PortraitStyle
) {
  database.prepare(
    `DELETE FROM gallery_image_comments
     WHERE gallery_item_id = ? AND style = ?`
  ).run(galleryItemId, style)
}

export function deleteGalleryFeedbackForGalleryItems(database: Database.Database, galleryItemIds: string[]) {
  if (galleryItemIds.length === 0) return

  const placeholders = galleryItemIds.map(() => "?").join(", ")
  database.prepare(
    `DELETE FROM gallery_feedback_votes
     WHERE gallery_item_id IN (${placeholders})`
  ).run(...galleryItemIds)
}

export function deleteGalleryCommentsForGalleryItems(database: Database.Database, galleryItemIds: string[]) {
  if (galleryItemIds.length === 0) return

  const placeholders = galleryItemIds.map(() => "?").join(", ")
  database.prepare(
    `DELETE FROM gallery_image_comments
     WHERE gallery_item_id IN (${placeholders})`
  ).run(...galleryItemIds)
}
