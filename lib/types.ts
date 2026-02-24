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

export interface GalleryItem {
  id: string
  name: string
  medicalUrl: string
  corporateUrl: string
  createdAt: number
  organizationId?: string
  organizationName?: string
}
