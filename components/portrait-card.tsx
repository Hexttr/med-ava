"use client"

import { Download, Loader2, ImageIcon, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { PortraitStyle, ProcessingStatus } from "@/lib/types"

interface PortraitCardProps {
  style: PortraitStyle
  imageUrl: string | null
  status: ProcessingStatus
  /** Левая метка (например «Стало») */
  labelLeft?: string
  showDownload?: boolean
  onRegenerate?: (style: PortraitStyle) => void
  regeneratingStyle?: PortraitStyle | null
}

export function PortraitCard({
  style,
  imageUrl,
  status,
  labelLeft = "Стало",
  showDownload = true,
  onRegenerate,
  regeneratingStyle = null,
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
        <div className="flex items-center border-b border-border px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">{labelLeft}</span>
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
          {status === "complete" && (regeneratingStyle === style ? (
            <div className="flex size-full flex-col items-center justify-center gap-2">
              <Loader2 className="size-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Генерирую...</span>
            </div>
          ) : imageUrl ? (
            <>
              <img
                src={imageUrl}
                alt={style === "medical" ? "Медицинский портрет" : "Корпоративный портрет"}
                className="size-full object-cover object-top"
              />
              <div className="absolute right-1.5 bottom-1.5 z-10 flex gap-1">
                {onRegenerate && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="size-7 rounded-none shadow-md opacity-90 hover:opacity-100"
                    onClick={() => onRegenerate(style)}
                    aria-label="Повторить"
                    title="Повторить"
                  >
                    <RotateCcw className="size-3.5" />
                  </Button>
                )}
                {showDownload && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="size-7 rounded-none shadow-md opacity-90 hover:opacity-100"
                    onClick={handleDownload}
                    aria-label="Скачать"
                    title="Скачать"
                  >
                    <Download className="size-3.5" />
                  </Button>
                )}
              </div>
            </>
          ) : null)}
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
