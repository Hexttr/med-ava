export type PortraitStyle = "medical" | "corporate"

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
  medicalPrompt: string
  corporatePrompt: string
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

export interface GalleryItem {
  id: string
  name: string
  medicalUrl: string | null
  corporateUrl: string | null
  createdAt: number
  /** Для фильтра по отделу в галерее. */
  employeeId?: string
  departmentId?: string
  departmentName?: string
}
