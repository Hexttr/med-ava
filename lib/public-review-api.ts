import type {
  FeedbackVoteValue,
  ReviewImageStyle,
  PublicReviewCatalogResponse,
  PublicReviewCommentResponse,
  PublicReviewEmployeeResponse,
  PublicReviewSearchResult,
  PublicReviewVoteResponse,
} from "@/lib/types"

const CATALOG_BASE = "/api/public/review/catalog"
const SEARCH_BASE = "/api/public/review/search"
const EMPLOYEE_BASE = "/api/public/review/employee"
const VOTE_BASE = "/api/public/review/vote"
const COMMENT_BASE = "/api/public/review/comment"

export async function fetchPublicReviewCatalog(): Promise<PublicReviewCatalogResponse> {
  const res = await fetch(CATALOG_BASE, {
    cache: "no-store",
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Не удалось загрузить каталог")
  }
  return res.json()
}

export async function searchPublicReview(query: string): Promise<PublicReviewSearchResult[]> {
  const res = await fetch(`${SEARCH_BASE}?q=${encodeURIComponent(query)}`, {
    cache: "no-store",
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Не удалось выполнить поиск")
  }
  return res.json()
}

export async function fetchPublicReviewEmployee(employeeId: string): Promise<PublicReviewEmployeeResponse> {
  const res = await fetch(`${EMPLOYEE_BASE}/${encodeURIComponent(employeeId)}`, {
    cache: "no-store",
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Не удалось загрузить сотрудника")
  }
  return res.json()
}

export async function submitPublicReviewVote(body: {
  employeeId: string
  galleryItemId: string
  style: ReviewImageStyle
  vote: FeedbackVoteValue
}): Promise<PublicReviewVoteResponse> {
  const res = await fetch(VOTE_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Не удалось сохранить голос")
  }
  return res.json()
}

export async function submitPublicReviewComment(body: {
  employeeId: string
  galleryItemId: string
  style: ReviewImageStyle
  commentText: string
}): Promise<PublicReviewCommentResponse> {
  const res = await fetch(COMMENT_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Не удалось сохранить отзыв")
  }
  return res.json()
}
