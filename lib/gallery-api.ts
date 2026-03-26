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
  medicalUrl?: string | null
  corporateUrl?: string | null
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

export async function fetchGalleryByEmployeeId(employeeId: string): Promise<GalleryItem[]> {
  const res = await fetch(`${BASE}?employeeId=${encodeURIComponent(employeeId)}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function updateGalleryItem(
  id: string,
  body: { medicalUrl?: string; corporateUrl?: string }
): Promise<GalleryItem> {
  const res = await fetch(`${BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Не удалось обновить")
  }
  return res.json()
}

export async function saveGalleryItemSet(body: {
  name: string
  medicalUrl?: string | null
  corporateUrl?: string | null
  employeeId?: string
}): Promise<GalleryItem> {
  const { medicalUrl, corporateUrl, ...rest } = body

  if (!medicalUrl && !corporateUrl) {
    throw new Error("Не указаны изображения для сохранения")
  }

  if (medicalUrl && corporateUrl) {
    const created = await addGalleryItem({
      ...rest,
      medicalUrl,
    })
    return updateGalleryItem(created.id, { corporateUrl })
  }

  return addGalleryItem(body)
}
