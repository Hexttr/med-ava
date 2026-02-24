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
