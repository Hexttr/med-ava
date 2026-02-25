"use client"

import { Download, Loader2, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { PortraitStyle, ProcessingStatus } from "@/lib/types"

interface PortraitCardProps {
  style: PortraitStyle
  imageUrl: string | null
  status: ProcessingStatus
  /** Левая метка (например «Стало») */
  labelLeft?: string
  /** Правая метка (например «Белый халат») */
  labelRight: string
  showDownload?: boolean
}

const styleLabels: Record<PortraitStyle, { labelRight: string }> = {
  medical: { labelRight: "Белый халат" },
  corporate: { labelRight: "Деловой" },
}

export function PortraitCard({
  style,
  imageUrl,
  status,
  labelLeft = "Стало",
  labelRight = styleLabels[style].labelRight,
  showDownload = true,
}: PortraitCardProps) {
  function handleDownload() {
    if (!imageUrl) return
    const a = document.createElement("a")
    a.href = imageUrl
    a.download = `portrait-${style}-${Date.now()}.png`
    a.click()
  }

  return (
    <Card className="overflow-hidden gap-0">
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">{labelLeft}</span>
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-foreground">{labelRight}</span>
            {showDownload && imageUrl && (
              <Button variant="ghost" size="icon" className="size-7" onClick={handleDownload}>
                <Download className="size-3.5" />
                <span className="sr-only">Скачать</span>
              </Button>
            )}
          </div>
        </div>
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted/30">
          {status === "generating" && (
            <div className="flex size-full flex-col items-center justify-center gap-2">
              <Loader2 className="size-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Генерация...</span>
            </div>
          )}
          {status === "analyzing" && (
            <div className="flex size-full flex-col items-center justify-center gap-2">
              <Loader2 className="size-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Анализ...</span>
            </div>
          )}
          {status === "idle" && !imageUrl && (
            <div className="flex size-full flex-col items-center justify-center gap-2">
              <ImageIcon className="size-8 text-muted-foreground/40" />
              <span className="text-xs text-muted-foreground">Ожидание</span>
            </div>
          )}
          {status === "complete" && imageUrl && (
            <img
              src={imageUrl}
              alt={style === "medical" ? "Медицинский портрет" : "Корпоративный портрет"}
              className="size-full object-cover"
            />
          )}
          {status === "error" && (
            <div className="flex size-full flex-col items-center justify-center gap-2 p-4">
              <span className="text-xs text-destructive">Ошибка</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
