"use client"

import { useEffect, useState } from "react"
import { ImageIcon, ArrowRight } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface GalleryItem {
  id: string
  name: string
  medicalUrl: string
  corporateUrl: string
  createdAt: number
}

const GALLERY_KEY = "eam_gallery"

export function useGallery() {
  const [items, setItems] = useState<GalleryItem[]>([])

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(GALLERY_KEY)
      if (stored) setItems(JSON.parse(stored))
    } catch {
      // ignore
    }
  }, [])

  function addItem(item: Omit<GalleryItem, "id" | "createdAt">) {
    const newItem: GalleryItem = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    }
    const updated = [newItem, ...items]
    setItems(updated)
    try {
      sessionStorage.setItem(GALLERY_KEY, JSON.stringify(updated))
    } catch {
      // sessionStorage full or unavailable
    }
    return newItem
  }

  function clearGallery() {
    setItems([])
    try {
      sessionStorage.removeItem(GALLERY_KEY)
    } catch {
      // ignore
    }
  }

  return { items, addItem, clearGallery }
}

export function GalleryClient() {
  const [items, setItems] = useState<GalleryItem[]>([])

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(GALLERY_KEY)
      if (stored) setItems(JSON.parse(stored))
    } catch {
      // ignore
    }
  }, [])

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

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Card key={item.id}>
          <CardContent className="flex flex-col gap-3 pt-4">
            <p className="text-sm font-medium text-foreground">{item.name}</p>
            <div className="grid grid-cols-2 gap-2">
              {item.medicalUrl && (
                <div className="flex flex-col gap-1">
                  <div className="aspect-[3/4] overflow-hidden rounded-md border border-border">
                    <img
                      src={item.medicalUrl}
                      alt={`${item.name} — Медицинский`}
                      className="size-full object-cover"
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">Медицинский</span>
                </div>
              )}
              {item.corporateUrl && (
                <div className="flex flex-col gap-1">
                  <div className="aspect-[3/4] overflow-hidden rounded-md border border-border">
                    <img
                      src={item.corporateUrl}
                      alt={`${item.name} — Корпоративный`}
                      className="size-full object-cover"
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">Корпоративный</span>
                </div>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {new Date(item.createdAt).toLocaleString()}
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
