import type { GalleryItem } from "@/lib/types"

const BASE = "/api/gallery"

export async function fetchGallery(params?: { departmentId?: string }): Promise<GalleryItem[]> {
  const url = params?.departmentId
    ? `${BASE}?departmentId=${encodeURIComponent(params.departmentId)}`
    : BASE
  const res = await fetch(url)
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  return data
}

export async function addGalleryItem(body: {
  name: string
  medicalUrl: string
  corporateUrl: string
  employeeId?: string
}): Promise<GalleryItem> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Не удалось добавить в галерею")
  }
  return res.json()
}

export async function deleteGalleryItem(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Не удалось удалить")
}
