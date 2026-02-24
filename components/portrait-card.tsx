"use client"

import { Download, Loader2, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { PortraitStyle, ProcessingStatus } from "@/lib/types"

interface PortraitCardProps {
  style: PortraitStyle
  imageUrl: string | null
  status: ProcessingStatus
  prompt?: string
}

const styleLabels: Record<PortraitStyle, { title: string; badge: string }> = {
  medical: { title: "Медицинский портрет", badge: "Белый халат" },
  corporate: { title: "Корпоративный портрет", badge: "Деловой" },
}

export function PortraitCard({ style, imageUrl, status, prompt }: PortraitCardProps) {
  const label = styleLabels[style]

  function handleDownload() {
    if (!imageUrl) return
    const a = document.createElement("a")
    a.href = imageUrl
    a.download = `portrait-${style}-${Date.now()}.png`
    a.click()
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm">{label.title}</CardTitle>
          <Badge variant="secondary" className="text-[10px]">{label.badge}</Badge>
        </div>
        {imageUrl && (
          <Button variant="ghost" size="icon" className="size-8" onClick={handleDownload}>
            <Download className="size-4" />
            <span className="sr-only">Скачать портрет</span>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-border bg-muted/30">
          {status === "generating" && (
            <div className="flex size-full flex-col items-center justify-center gap-2">
              <Loader2 className="size-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Генерация...</span>
            </div>
          )}
          {status === "analyzing" && (
            <div className="flex size-full flex-col items-center justify-center gap-2">
              <Loader2 className="size-6 animate-spin text-accent" />
              <span className="text-xs text-muted-foreground">Анализ фото...</span>
            </div>
          )}
          {status === "idle" && !imageUrl && (
            <div className="flex size-full flex-col items-center justify-center gap-2">
              <ImageIcon className="size-6 text-muted-foreground/40" />
              <span className="text-xs text-muted-foreground">Ожидание генерации</span>
            </div>
          )}
          {status === "complete" && imageUrl && (
            <img
              src={imageUrl}
              alt={style === "medical" ? "Сгенерированный медицинский портрет" : "Сгенерированный корпоративный портрет"}
              className="size-full object-cover"
            />
          )}
          {status === "error" && (
            <div className="flex size-full flex-col items-center justify-center gap-2 p-4">
              <span className="text-xs text-destructive">Ошибка генерации</span>
            </div>
          )}
        </div>
        {prompt && status === "complete" && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              Показать промпт
            </summary>
            <p className="mt-1 rounded border border-border bg-muted/30 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
              {prompt}
            </p>
          </details>
        )}
      </CardContent>
    </Card>
  )
}
