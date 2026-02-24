"use client"

import { X, Download, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  /** Кнопка «Сгенерировать» для этого сотрудника (только при status === "pending") */
  onGenerate?: () => void
}

export function BatchPortraitCard({
  item,
  index,
  isCurrent,
  isProcessing,
  onRemove,
  onNameChange,
  showNameInput = false,
  onGenerate,
}: BatchPortraitCardProps) {
  const isActive = isCurrent && (item.status === "analyzing" || item.status === "generating")
  const showPlaceholder = !item.medicalUrl || !item.corporateUrl

  return (
    <div
      className={cn(
        "relative flex flex-col gap-2 rounded-lg border bg-card p-3 transition-colors",
        isActive && "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
      )}
    >
      {!isProcessing && item.status === "pending" && onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1 z-10 size-7 rounded-full bg-red-500 text-white hover:bg-red-600"
          onClick={onRemove}
          aria-label="Удалить"
        >
          <X className="size-3.5" />
        </Button>
      )}

      <div className="flex gap-3">
        {/* Исходное фото — увеличенное (~3x от прежнего миниатюра) */}
        <div className="w-[7.5rem] shrink-0 overflow-hidden rounded-md border border-border bg-muted">
          <img
            src={item.preview}
            alt=""
            className="aspect-[3/4] w-full object-cover"
          />
        </div>

        {/* Блок «Стало»: два слота */}
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Стало</p>
          <div className="grid grid-cols-2 gap-2">
            {/* Медицинский */}
            <div className="flex flex-col gap-0.5">
              {item.medicalUrl ? (
                <div className="overflow-hidden rounded border border-border bg-muted">
                  <img
                    src={item.medicalUrl}
                    alt="Медицинский"
                    className="aspect-[3/4] w-full object-cover"
                  />
                </div>
              ) : (
                <div
                  className={cn(
                    "flex aspect-[3/4] w-full items-center justify-center rounded border border-dashed border-border bg-muted/50",
                    isActive && "animate-pulse border-primary/30 bg-primary/5"
                  )}
                >
                  {isActive ? (
                    <Loader2 className="size-6 animate-spin text-primary" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </div>
              )}
              <span className="text-[10px] text-muted-foreground">Медицинский</span>
            </div>
            {/* Корпоративный */}
            <div className="flex flex-col gap-0.5">
              {item.corporateUrl ? (
                <div className="overflow-hidden rounded border border-border bg-muted">
                  <img
                    src={item.corporateUrl}
                    alt="Корпоративный"
                    className="aspect-[3/4] w-full object-cover"
                  />
                </div>
              ) : (
                <div
                  className={cn(
                    "flex aspect-[3/4] w-full items-center justify-center rounded border border-dashed border-border bg-muted/50",
                    isActive && "animate-pulse border-primary/30 bg-primary/5"
                  )}
                >
                  {isActive ? (
                    <Loader2 className="size-6 animate-spin text-primary" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </div>
              )}
              <span className="text-[10px] text-muted-foreground">Корпоративный</span>
            </div>
          </div>
        </div>
      </div>

      {/* Имя и статус */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {showNameInput && onNameChange ? (
          <Input
            value={item.name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Введите имя"
            disabled={isProcessing}
            className="h-7 text-xs"
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
          {item.status === "complete" && item.medicalUrl && (
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
              <Download className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {item.status === "error" && item.error && (
        <p className="text-[10px] text-destructive">{item.error}</p>
      )}
    </div>
  )
}
