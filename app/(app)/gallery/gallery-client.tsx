"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { ImageIcon, ArrowRight, X, Download, Building2 } from "lucide-react"
import Link from "next/link"
import JSZip from "jszip"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import type { GalleryItem } from "@/lib/types"
import { fetchGallery, addGalleryItem, deleteGalleryItem } from "@/lib/gallery-api"

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "_").trim() || "portrait"
}

async function urlToBlob(url: string): Promise<Blob> {
  const match = url.match(/^data:([^;]+);base64,(.+)$/)
  if (match) {
    const mime = match[1]
    const binary = atob(match[2])
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type: mime })
  }
  const res = await fetch(url)
  return res.blob()
}

function getExtension(mime: string): string {
  if (mime.includes("png")) return "png"
  if (mime.includes("webp")) return "webp"
  return "jpg"
}

export function useGallery() {
  const [items, setItems] = useState<GalleryItem[]>([])

  const load = useCallback(async () => {
    try {
      const list = await fetchGallery()
      setItems(list)
    } catch {
      setItems([])
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function addItem(item: Omit<GalleryItem, "id" | "createdAt">) {
    const newItem = await addGalleryItem({
      name: item.name,
      medicalUrl: item.medicalUrl,
      corporateUrl: item.corporateUrl,
      organizationId: item.organizationId,
      organizationName: item.organizationName,
    })
    await load()
    return newItem
  }

  function clearGallery() {
    setItems([])
  }

  return { items, addItem, clearGallery, load }
}

export function GalleryClient() {
  const [items, setItems] = useState<GalleryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const loadItems = useCallback(async () => {
    try {
      const list = await fetchGallery()
      setItems(list)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  async function removeItem(id: string) {
    try {
      await deleteGalleryItem(id)
      setItems((prev) => prev.filter((item) => item.id !== id))
      toast.success("Карточка удалена")
    } catch {
      toast.error("Не удалось удалить")
    }
  }

  async function downloadItem(item: GalleryItem) {
    try {
      const zip = new JSZip()
      const folderName = sanitizeFileName(item.name)
      if (item.medicalUrl) {
        const blob = await urlToBlob(item.medicalUrl)
        const ext = getExtension(blob.type || "image/png")
        zip.file(`${folderName}/medical.${ext}`, blob)
      }
      if (item.corporateUrl) {
        const blob = await urlToBlob(item.corporateUrl)
        const ext = getExtension(blob.type || "image/png")
        zip.file(`${folderName}/corporate.${ext}`, blob)
      }
      const content = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(content)
      const a = document.createElement("a")
      a.href = url
      a.download = `${folderName}.zip`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Архив скачан")
    } catch {
      toast.error("Не удалось создать архив")
    }
  }

  async function downloadAll() {
    if (items.length === 0) return
    try {
      const zip = new JSZip()
      for (const item of items) {
        const folderName = sanitizeFileName(item.name)
        if (item.medicalUrl) {
          const blob = await urlToBlob(item.medicalUrl)
          const ext = getExtension(blob.type || "image/png")
          zip.file(`${folderName}/medical.${ext}`, blob)
        }
        if (item.corporateUrl) {
          const blob = await urlToBlob(item.corporateUrl)
          const ext = getExtension(blob.type || "image/png")
          zip.file(`${folderName}/corporate.${ext}`, blob)
        }
      }
      const content = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(content)
      const a = document.createElement("a")
      a.href = url
      a.download = "gallery_all.zip"
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Архив со всеми портретами скачан")
    } catch {
      toast.error("Не удалось создать архив")
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <p className="text-sm text-muted-foreground">Загрузка галереи...</p>
        </CardContent>
      </Card>
    )
  }

  const singleItems = useMemo(
    () => items.filter((i) => !i.organizationId).sort((a, b) => b.createdAt - a.createdAt),
    [items]
  )
  const byOrganization = useMemo(() => {
    const map = new Map<string, { name: string; items: GalleryItem[] }>()
    for (const item of items) {
      if (!item.organizationId) continue
      const key = item.organizationId
      const existing = map.get(key)
      const name = item.organizationName ?? "Организация"
      if (!existing) {
        map.set(key, { name, items: [item] })
      } else {
        existing.items.push(item)
      }
    }
    for (const entry of map.values()) {
      entry.items.sort((a, b) => b.createdAt - a.createdAt)
    }
    return Array.from(map.entries()).map(([id, { name, items: orgItems }]) => ({
      id,
      name,
      items: orgItems,
    }))
  }, [items])

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <ImageIcon className="size-8 text-muted-foreground/50" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Портретов пока нет</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Здесь появятся портреты, сгенерированные в текущей сессии.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/generate">
                Одиночная обработка
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/batch">
                Пакетная обработка
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  function renderCard(item: GalleryItem) {
    return (
      <Card key={item.id} className="relative">
        <button
          type="button"
          onClick={() => removeItem(item.id)}
          className="absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600"
          aria-label="Удалить"
        >
          <X className="size-4" />
        </button>
        <CardContent className="flex flex-col gap-3 pt-4">
          <p className="pr-8 text-sm font-medium text-foreground">{item.name}</p>
          <div className="grid grid-cols-2 gap-2">
            {item.medicalUrl && (
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setLightboxUrl(item.medicalUrl)}
                  className="aspect-[3/4] overflow-hidden rounded-md border border-border text-left transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <img
                    src={item.medicalUrl}
                    alt={`${item.name} — Медицинский`}
                    className="size-full object-cover"
                    draggable={false}
                  />
                </button>
                <span className="text-[10px] text-muted-foreground">Медицинский</span>
              </div>
            )}
            {item.corporateUrl && (
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setLightboxUrl(item.corporateUrl)}
                  className="aspect-[3/4] overflow-hidden rounded-md border border-border text-left transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <img
                    src={item.corporateUrl}
                    alt={`${item.name} — Корпоративный`}
                    className="size-full object-cover"
                    draggable={false}
                  />
                </button>
                <span className="text-[10px] text-muted-foreground">Корпоративный</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground">
              {new Date(item.createdAt).toLocaleString()}
            </span>
            <Button variant="outline" size="sm" onClick={() => downloadItem(item)}>
              <Download className="mr-1 size-3.5" />
              Скачать
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Галерея</h2>
        <Button variant="outline" size="sm" onClick={downloadAll}>
          <Download className="mr-2 size-4" />
          Скачать все
        </Button>
      </div>

      {singleItems.length > 0 && (
        <section className="mb-8">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ImageIcon className="size-4" />
            Одиночные обработки
          </h3>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {singleItems.map((item) => renderCard(item))}
          </div>
        </section>
      )}

      {byOrganization.length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Building2 className="size-4" />
            По организациям
          </h3>
          <div className="flex flex-col gap-6">
            {byOrganization.map((org) => (
              <div key={org.id}>
                <h4 className="mb-2 text-sm font-semibold text-foreground">{org.name}</h4>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {org.items.map((item) => renderCard(item))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <Dialog open={!!lightboxUrl} onOpenChange={(open) => !open && setLightboxUrl(null)}>
        <DialogContent showCloseButton={false} className="max-w-[95vw] max-h-[95vh] border-0 bg-black/95 p-0 overflow-hidden">
          <DialogTitle className="sr-only">Просмотр фото</DialogTitle>
          {lightboxUrl && (
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              className="absolute right-2 top-2 z-10 rounded-full bg-white/20 p-1.5 text-white hover:bg-white/30"
              aria-label="Закрыть"
            >
              <X className="size-5" />
            </button>
          )}
          {lightboxUrl && (
            <img
              src={lightboxUrl}
              alt=""
              className="max-h-[95vh] w-auto max-w-full object-contain"
              onClick={(e) => e.stopPropagation()}
              draggable={false}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
