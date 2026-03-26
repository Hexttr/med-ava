export type PortraitStyle = "medical" | "corporate"
export type FeedbackVoteValue = "like" | "dislike"

export type ProcessingStatus = "idle" | "uploading" | "analyzing" | "generating" | "complete" | "error"

export interface GeneratedPortrait {
  id: string
  originalUrl: string
  medicalUrl: string | null
  corporateUrl: string | null
  employeeName: string
  status: ProcessingStatus
  error?: string
  medicalPrompt?: string
  corporatePrompt?: string
  createdAt: string
}

export interface BatchJob {
  id: string
  portraits: GeneratedPortrait[]
  totalCount: number
  completedCount: number
  status: "pending" | "processing" | "complete" | "error"
  createdAt: string
}

export interface AnalysisResult {
  description: string
  identityAnchors: string
}

export interface OrganizationEmployee {
  id: string
  name: string
  photoUrl: string
}

export interface Organization {
  id: string
  name: string
  photoUrl: string | null
  employees: OrganizationEmployee[]
  createdAt: number
  updatedAt: number
}

/** Один уровень отделов (плоский список). */
export interface Department {
  id: string
  name: string
  createdAt: number
}

/** Сотрудник: в корне (departmentId === null) или в отделе. */
export interface Employee {
  id: string
  name: string
  /** Оригинал — для генерации. */
  photoUrl: string
  /** Сжатое превью — для отображения в списке. Если нет — использовать photoUrl. */
  thumbnailUrl?: string
  departmentId: string | null
  departmentName?: string
  createdAt: number
}

export interface GalleryStyleFeedbackSummary {
  likes: number
  dislikes: number
}

export interface GalleryImageComment {
  text: string
  updatedAt: number
}

export interface GalleryImageComments {
  medical: GalleryImageComment | null
  corporate: GalleryImageComment | null
}

export interface GalleryViewerVotes {
  medical: FeedbackVoteValue | null
  corporate: FeedbackVoteValue | null
}

export interface GalleryFeedbackSummary {
  medical: GalleryStyleFeedbackSummary
  corporate: GalleryStyleFeedbackSummary
  viewerVotes?: GalleryViewerVotes
}

export interface GalleryItem {
  id: string
  name: string
  medicalUrl: string | null
  corporateUrl: string | null
  medicalPreviewUrl?: string | null
  corporatePreviewUrl?: string | null
  createdAt: number
  /** Для фильтра по отделу в галерее. */
  employeeId?: string
  departmentId?: string
  departmentName?: string
  feedback?: GalleryFeedbackSummary
}

export interface PublicReviewSearchResult {
  employeeId: string
  name: string
  departmentName?: string
}

export interface PublicReviewEmployee {
  employeeId: string
  name: string
  departmentName?: string
  originalUrl: string | null
  galleryItemId: string | null
  medicalUrl: string | null
  corporateUrl: string | null
  hasGeneratedSet: boolean
  viewerVotes: GalleryViewerVotes
}

export interface PublicReviewEmployeeResponse extends PublicReviewEmployee {
  feedback: GalleryFeedbackSummary
}

export interface PublicReviewVoteResponse {
  galleryItemId: string
  employeeId: string
  feedback: GalleryFeedbackSummary
  viewerVotes: GalleryViewerVotes
}

export interface PublicReviewCommentResponse {
  galleryItemId: string
  employeeId: string
  style: PortraitStyle
  comments: GalleryImageComments
}

export interface PublicReviewCatalogEmployee {
  employeeId: string
  name: string
  departmentId: string | null
  departmentName?: string
  originalUrl: string | null
  galleryItemId: string
  medicalUrl: string | null
  corporateUrl: string | null
  hasGeneratedSet: boolean
  feedback: GalleryFeedbackSummary
  viewerVotes: GalleryViewerVotes
  comments: GalleryImageComments
}

export interface PublicReviewCatalogDepartment {
  departmentId: string | null
  name: string
  employeeCount: number
  employees: PublicReviewCatalogEmployee[]
}

export interface PublicReviewCatalogResponse {
  departments: PublicReviewCatalogDepartment[]
  totalEmployees: number
}
