"use client"

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, useCallback } from "react"
import { ImageIcon, ArrowRight, X, Download, FolderTree } from "lucide-react"
import Link from "next/link"
import JSZip from "jszip"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { GalleryFeedbackBadges } from "@/components/gallery-feedback-badges"
import type { GalleryItem } from "@/lib/types"
import type { Department } from "@/lib/types"
import { fetchGallery, deleteGalleryItem } from "@/lib/gallery-api"
import { buildPortraitArchiveBaseName, ensureUniqueArchiveBaseName } from "@/lib/file-utils"
import { fetchDepartments } from "@/lib/structure-api"

function GalleryPreviewImage({
  previewUrl,
  fullUrl,
  alt,
}: {
  previewUrl?: string | null
  fullUrl: string
  alt: string
}) {
  const [failed, setFailed] = useState(false)
  const src = !failed && previewUrl ? previewUrl : fullUrl

  return (
    <img
      src={src}
      alt={alt}
      className="size-full object-cover"
      draggable={false}
      onError={() => {
        if (previewUrl) setFailed(true)
      }}
    />
  )
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

export function GalleryClient() {
  const [items, setItems] = useState<GalleryItem[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [filterDepartmentId, setFilterDepartmentId] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const loadItems = useCallback(async (departmentId?: string) => {
    try {
      const list = await fetchGallery(departmentId ? { departmentId } : undefined)
      setItems(list)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDepartments().then(setDepartments).catch(() => [])
  }, [])

  useEffect(() => {
    loadItems(filterDepartmentId || undefined)
  }, [loadItems, filterDepartmentId])

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
      const baseName = buildPortraitArchiveBaseName(item.name)
      if (item.medicalUrl) {
        const blob = await urlToBlob(item.medicalUrl)
        const ext = getExtension(blob.type || "image/png")
        zip.file(`medical/${baseName}.${ext}`, blob)
      }
      if (item.corporateUrl) {
        const blob = await urlToBlob(item.corporateUrl)
        const ext = getExtension(blob.type || "image/png")
        zip.file(`corporate/${baseName}.${ext}`, blob)
      }
      const content = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(content)
      const a = document.createElement("a")
      a.href = url
      a.download = `${baseName}.zip`
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
      const usedFileNames = new Set<string>()
      for (const item of items) {
        const baseName = ensureUniqueArchiveBaseName(
          buildPortraitArchiveBaseName(item.name),
          usedFileNames
        )
        if (item.medicalUrl) {
          const blob = await urlToBlob(item.medicalUrl)
          const ext = getExtension(blob.type || "image/png")
          zip.file(`medical/${baseName}.${ext}`, blob)
        }
        if (item.corporateUrl) {
          const blob = await urlToBlob(item.corporateUrl)
          const ext = getExtension(blob.type || "image/png")
          zip.file(`corporate/${baseName}.${ext}`, blob)
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

  const singleItems = [...items].sort((a, b) => a.name.localeCompare(b.name, "ru"))

  if (loading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <p className="text-sm text-muted-foreground">Загрузка галереи...</p>
        </CardContent>
      </Card>
    )
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex size-16 items-center justify-center rounded-none bg-muted">
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
          className="absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-none bg-red-500 text-white shadow hover:bg-red-600"
          aria-label="Удалить"
        >
          <X className="size-4" />
        </button>
        <CardContent className="flex flex-col gap-3 pb-4 pt-4">
          <p className="pr-8 text-sm font-medium text-foreground">{item.name}</p>
          <div className="grid grid-cols-2 gap-2">
            {item.medicalUrl && (
              <div className="space-y-2">
                <div className="flex min-h-5 items-center justify-between gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Медицинский
                  </span>
                  <GalleryFeedbackBadges summary={item.feedback?.medical} />
                </div>
                <button
                  type="button"
                  onClick={() => setLightboxUrl(item.medicalUrl)}
                  className="aspect-[3/4] w-full overflow-hidden rounded-none border border-border text-left transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <GalleryPreviewImage
                    key={`${item.medicalPreviewUrl ?? "none"}|${item.medicalUrl}`}
                    previewUrl={item.medicalPreviewUrl}
                    fullUrl={item.medicalUrl}
                    alt={item.name}
                  />
                </button>
              </div>
            )}
            {item.corporateUrl && (
              <div className="space-y-2">
                <div className="flex min-h-5 items-center justify-between gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Корпоративный
                  </span>
                  <GalleryFeedbackBadges summary={item.feedback?.corporate} />
                </div>
                <button
                  type="button"
                  onClick={() => setLightboxUrl(item.corporateUrl)}
                  className="aspect-[3/4] w-full overflow-hidden rounded-none border border-border text-left transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <GalleryPreviewImage
                    key={`${item.corporatePreviewUrl ?? "none"}|${item.corporateUrl}`}
                    previewUrl={item.corporatePreviewUrl}
                    fullUrl={item.corporateUrl}
                    alt={item.name}
                  />
                </button>
              </div>
            )}
          </div>
          <div className="-mt-1 flex items-center justify-between gap-2">
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
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
          <Select
            value={filterDepartmentId || "_all"}
            onValueChange={(v) => setFilterDepartmentId(v === "_all" ? "" : v)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Все отделы" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Все отделы</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  <span className="flex items-center gap-2">
                    <FolderTree className="size-3.5" />
                    {d.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={downloadAll}>
            <Download className="mr-2 size-4" />
            Скачать все
          </Button>
      </div>

      <section>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {singleItems.map((item) => renderCard(item))}
        </div>
      </section>

      <Dialog open={!!lightboxUrl} onOpenChange={(open) => !open && setLightboxUrl(null)}>
        <DialogContent showCloseButton={false} className="max-w-[95vw] max-h-[95vh] border-0 bg-black/95 p-0 overflow-hidden">
          <DialogTitle className="sr-only">Просмотр фото</DialogTitle>
          {lightboxUrl && (
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              className="absolute right-2 top-2 z-10 rounded-none bg-white/20 p-1.5 text-white hover:bg-white/30"
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
