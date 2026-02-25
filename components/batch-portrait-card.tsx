"use client"

import { X, Download, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export interface BatchPortraitCardItem {
  id: string
  name: string
  preview: string
  status: "pending" | "analyzing" | "generating" | "complete" | "error"
  medicalUrl: string | null
  corporateUrl: string | null
  error?: string
}

interface BatchPortraitCardProps {
  item: BatchPortraitCardItem
  index: number
  isCurrent: boolean
  isProcessing: boolean
  onRemove?: () => void
  onNameChange?: (name: string) => void
  showNameInput?: boolean
  onGenerate?: () => void
}

function resolvePreviewUrl(preview: string): string {
  if (preview.startsWith("http") || preview.startsWith("data:")) return preview
  return `${typeof window !== "undefined" ? window.location.origin : ""}${preview}`
}

export function BatchPortraitCard({
  item,
  isCurrent,
  isProcessing,
  onRemove,
  onNameChange,
  showNameInput = false,
  onGenerate,
}: BatchPortraitCardProps) {
  const isActive = isCurrent && (item.status === "analyzing" || item.status === "generating")

  return (
    <Card
      className={cn(
        "relative overflow-hidden border border-border bg-card shadow-sm transition-shadow hover:shadow-md",
        isActive && "ring-1 ring-primary/20"
      )}
    >
      {!isProcessing && item.status === "pending" && onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 z-10 size-7 rounded-full bg-red-500 text-white hover:bg-red-600"
          onClick={onRemove}
          aria-label="Удалить"
        >
          <X className="size-3.5" />
        </Button>
      )}
      <CardContent className="gap-0 p-0">
        {/* Три колонки: Было, Медицинский, Корпоративный — как на одиночной обработке */}
        <div className="grid grid-cols-3 gap-0">
          {/* Было */}
          <div className="flex flex-col border-r border-border">
            <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
              <span className="text-xs font-medium text-muted-foreground">Было</span>
            </div>
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted/30">
              <img
                src={resolvePreviewUrl(item.preview)}
                alt=""
                className="size-full object-cover"
              />
            </div>
          </div>

          {/* Стало — медицинский */}
          <div className="flex flex-col border-r border-border">
            <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
              <span className="text-xs font-medium text-muted-foreground">Стало</span>
              {item.medicalUrl && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => {
                    const a = document.createElement("a")
                    a.href = item.medicalUrl!
                    a.download = `${item.name || "photo"}-medical.png`
                    a.click()
                  }}
                  aria-label="Скачать медицинский"
                >
                  <Download className="size-3" />
                </Button>
              )}
            </div>
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted/30">
              {item.medicalUrl ? (
                <img src={item.medicalUrl} alt="Медицинский" className="size-full object-cover" />
              ) : (
                <div
                  className={cn(
                    "flex size-full flex-col items-center justify-center gap-1",
                    isActive && "animate-pulse bg-primary/5"
                  )}
                >
                  {isActive ? (
                    <Loader2 className="size-5 animate-spin text-primary" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </div>
              )}
            </div>
            <span className="border-t border-border px-2 py-0.5 text-[10px] text-muted-foreground">
              Белый халат
            </span>
          </div>

          {/* Стало — корпоративный */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
              <span className="text-xs font-medium text-muted-foreground">Стало</span>
              {item.corporateUrl && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => {
                    const a = document.createElement("a")
                    a.href = item.corporateUrl!
                    a.download = `${item.name || "photo"}-corporate.png`
                    a.click()
                  }}
                  aria-label="Скачать корпоративный"
                >
                  <Download className="size-3" />
                </Button>
              )}
            </div>
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted/30">
              {item.corporateUrl ? (
                <img src={item.corporateUrl} alt="Корпоративный" className="size-full object-cover" />
              ) : (
                <div
                  className={cn(
                    "flex size-full flex-col items-center justify-center gap-1",
                    isActive && "animate-pulse bg-primary/5"
                  )}
                >
                  {isActive ? (
                    <Loader2 className="size-5 animate-spin text-primary" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </div>
              )}
            </div>
            <span className="border-t border-border px-2 py-0.5 text-[10px] text-muted-foreground">
              Деловой
            </span>
          </div>
        </div>

        {/* Имя и действия */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2">
          {showNameInput && onNameChange ? (
            <Input
              value={item.name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Введите имя"
              disabled={isProcessing}
              className="h-7 min-w-0 flex-1 text-xs"
            />
          ) : (
            <span className="truncate text-xs font-medium text-foreground">
              {item.name || "—"}
            </span>
          )}
          <div className="flex items-center gap-1">
            {item.status === "pending" && onGenerate && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={onGenerate}
                disabled={isProcessing}
              >
                Сгенерировать
              </Button>
            )}
            {item.status === "complete" && (
              <CheckCircle2 className="size-3.5 text-green-600" />
            )}
            {item.status === "error" && (
              <AlertCircle className="size-3.5 text-destructive" title={item.error} />
            )}
          </div>
        </div>
      </CardContent>

      {item.status === "error" && item.error && (
        <p className="border-t border-border px-3 py-1.5 text-[10px] text-destructive">
          {item.error}
        </p>
      )}
    </Card>
  )
}
