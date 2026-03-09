"use client"

export type PortraitStyle = "medical" | "corporate"
export type GenerateMode = "all" | "medical" | "corporate"

export interface PortraitAnalysis {
  description?: string
  medicalPrompt: string
  corporatePrompt: string
}

export interface ReferencePhoto {
  base64: string
  mimeType: string
}

export async function fileFromUrl(url: string, filename: string): Promise<File> {
  const response = await fetch(url)
  const blob = await response.blob()
  return new File([blob], filename, { type: blob.type || "image/jpeg" })
}

export async function fileToReferencePhoto(file: File): Promise<ReferencePhoto> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1]! : dataUrl
      resolve({ base64, mimeType: file.type || "image/jpeg" })
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export async function referencePhotoFromUrl(url: string, filename: string): Promise<{
  file: File
  reference: ReferencePhoto
}> {
  const file = await fileFromUrl(url, filename)
  const reference = await fileToReferencePhoto(file)
  return { file, reference }
}

export async function analyzePortrait(file: File, employeeName: string): Promise<PortraitAnalysis> {
  const formData = new FormData()
  formData.append("photo", file)
  formData.append("employeeName", employeeName || "Сотрудник")

  const response = await fetch("/api/analyze", {
    method: "POST",
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(typeof error?.error === "string" ? error.error : "Ошибка анализа")
  }

  return response.json()
}

export async function generatePortrait(
  prompt: string,
  style: PortraitStyle,
  reference: ReferencePhoto
): Promise<string> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      style,
      referencePhotoBase64: reference.base64,
      referencePhotoMimeType: reference.mimeType,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || "Ошибка генерации")
  }

  const data = await response.json() as { imageUrl: string }
  return data.imageUrl
}

export async function generatePortraitSet(
  analysis: PortraitAnalysis,
  reference: ReferencePhoto,
  mode: GenerateMode
): Promise<{ medicalUrl: string | null; corporateUrl: string | null }> {
  const medicalRequested = mode === "all" || mode === "medical"
  const corporateRequested = mode === "all" || mode === "corporate"

  const result = { medicalUrl: null as string | null, corporateUrl: null as string | null }

  if (medicalRequested) {
    result.medicalUrl = await generatePortrait(analysis.medicalPrompt, "medical", reference)
  }

  if (corporateRequested) {
    result.corporateUrl = await generatePortrait(analysis.corporatePrompt, "corporate", reference)
  }

  return result
}
