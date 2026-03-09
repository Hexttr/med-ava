"use client"

/* eslint-disable @next/next/no-img-element */

import { X, Download, Loader2, AlertCircle, CheckCircle2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export interface BatchPortraitCardItem {
  id: string
  name: string
  /** Сжатое превью для отображения */
  preview: string
  /** Оригинал для скачивания (если отличается от preview) */
  originalUrl?: string
  status: "pending" | "analyzing" | "generating" | "complete" | "error"
  medicalUrl: string | null
  corporateUrl: string | null
  error?: string
  departmentId?: string
  departmentName?: string
}

export interface DepartmentOption {
  id: string
  name: string
}

interface BatchPortraitCardProps {
  item: BatchPortraitCardItem
  index: number
  isCurrent: boolean
  isProcessing: boolean
  departments?: DepartmentOption[]
  onRemove?: () => void
  onNameChange?: (name: string) => void
  onDepartmentChange?: (employeeId: string, departmentId: string | null) => void
  showNameInput?: boolean
  onGenerate?: () => void
  onRegenerate?: () => void
  onRegenerateOne?: (style: "medical" | "corporate") => void
  regeneratingStyle?: "medical" | "corporate" | null
}

function resolvePreviewUrl(preview: string): string {
  if (preview.startsWith("http") || preview.startsWith("data:")) return preview
  return `${typeof window !== "undefined" ? window.location.origin : ""}${preview}`
}

export function BatchPortraitCard({
  item,
  isCurrent,
  isProcessing,
  departments = [],
  onRemove,
  onNameChange,
  onDepartmentChange,
  showNameInput = false,
  onGenerate,
  onRegenerate,
  onRegenerateOne,
  regeneratingStyle = null,
}: BatchPortraitCardProps) {
  const isActive = isCurrent && (item.status === "analyzing" || item.status === "generating")

  return (
    <Card
      className={cn(
        "relative w-full overflow-hidden border border-border bg-card shadow-sm transition-shadow hover:shadow-md",
        isActive && "ring-1 ring-primary/20"
      )}
    >
      {!isProcessing && onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1.5 top-1.5 z-10 size-6 rounded-none bg-red-500 text-white hover:bg-red-600"
          onClick={onRemove}
          aria-label="Удалить сотрудника"
        >
          <X className="size-3.5" />
        </Button>
      )}
      <CardContent className="gap-0 p-0">
        {/* Три колонки: Было, Медицинский, Корпоративный — как на одиночной обработке */}
        <div className="grid grid-cols-3 gap-0">
          {/* Было */}
          <div className="flex flex-col border-r border-border">
            <div className="flex items-center border-b border-border px-2 py-2">
              <span className="text-xs font-medium text-muted-foreground">Было</span>
            </div>
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted/30">
              <img
                src={resolvePreviewUrl(item.preview)}
                alt=""
                className="size-full object-cover object-top"
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute right-1.5 bottom-1.5 z-10 size-7 rounded-none shadow-md opacity-90 hover:opacity-100"
                onClick={() => {
                  const url = resolvePreviewUrl(item.originalUrl ?? item.preview)
                  const a = document.createElement("a")
                  a.href = url
                  a.download = `${item.name || "photo"}-original.jpg`
                  a.click()
                }}
                aria-label="Скачать исходное фото"
                title="Скачать"
              >
                <Download className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* Стало — медицинский */}
          <div className="flex flex-col border-r border-border">
            <div className="flex items-center border-b border-border px-2 py-2">
              <span className="text-xs font-medium text-muted-foreground">Стало</span>
            </div>
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted/30">
              {regeneratingStyle === "medical" ? (
                <div className="flex size-full flex-col items-center justify-center gap-1">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  <span className="text-[10px] text-muted-foreground">Генерирую...</span>
                </div>
              ) : item.medicalUrl ? (
                <>
                  <img src={item.medicalUrl} alt="Медицинский" className="size-full object-cover object-top" />
                  <div className="absolute right-1.5 bottom-1.5 z-10 flex gap-1">
                    {onRegenerateOne && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="size-7 rounded-none shadow-md opacity-90 hover:opacity-100"
                        onClick={() => onRegenerateOne("medical")}
                        aria-label="Повторить"
                        title="Повторить"
                      >
                        <RotateCcw className="size-3.5" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="size-7 rounded-none shadow-md opacity-90 hover:opacity-100"
                      onClick={() => {
                        const a = document.createElement("a")
                        a.href = item.medicalUrl!
                        a.download = `${item.name || "photo"}-medical.png`
                        a.click()
                      }}
                      aria-label="Скачать"
                      title="Скачать"
                    >
                      <Download className="size-3.5" />
                    </Button>
                  </div>
                </>
              ) : onRegenerateOne && item.status === "complete" ? (
                <div className="flex size-full flex-col items-center justify-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="size-10 rounded-none shadow-md"
                    onClick={() => onRegenerateOne("medical")}
                    aria-label="Сгенерировать медицинский"
                    title="Сгенерировать"
                  >
                    <RotateCcw className="size-5" />
                  </Button>
                  <span className="text-[10px] text-muted-foreground">Сгенерировать</span>
                </div>
              ) : (
                <div
                  className={cn(
                    "flex size-full flex-col items-center justify-center gap-1",
                    isActive && "animate-pulse bg-primary/5"
                  )}
                >
                  {isActive ? (
                    <Loader2 className="size-4 animate-spin text-primary" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Стало — корпоративный */}
          <div className="flex flex-col">
            <div className="flex items-center border-b border-border px-2 py-2">
              <span className="text-xs font-medium text-muted-foreground">Стало</span>
            </div>
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted/30">
              {regeneratingStyle === "corporate" ? (
                <div className="flex size-full flex-col items-center justify-center gap-1">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  <span className="text-[10px] text-muted-foreground">Генерирую...</span>
                </div>
              ) : item.corporateUrl ? (
                <>
                  <img src={item.corporateUrl} alt="Корпоративный" className="size-full object-cover object-top" />
                  <div className="absolute right-1.5 bottom-1.5 z-10 flex gap-1">
                    {onRegenerateOne && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="size-7 rounded-none shadow-md opacity-90 hover:opacity-100"
                        onClick={() => onRegenerateOne("corporate")}
                        aria-label="Повторить"
                        title="Повторить"
                      >
                        <RotateCcw className="size-3.5" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="size-7 rounded-none shadow-md opacity-90 hover:opacity-100"
                      onClick={() => {
                        const a = document.createElement("a")
                        a.href = item.corporateUrl!
                        a.download = `${item.name || "photo"}-corporate.png`
                        a.click()
                      }}
                      aria-label="Скачать"
                      title="Скачать"
                    >
                      <Download className="size-3.5" />
                    </Button>
                  </div>
                </>
              ) : onRegenerateOne && item.status === "complete" ? (
                <div className="flex size-full flex-col items-center justify-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="size-10 rounded-none shadow-md"
                    onClick={() => onRegenerateOne("corporate")}
                    aria-label="Сгенерировать корпоративный"
                    title="Сгенерировать"
                  >
                    <RotateCcw className="size-5" />
                  </Button>
                  <span className="text-[10px] text-muted-foreground">Сгенерировать</span>
                </div>
              ) : (
                <div
                  className={cn(
                    "flex size-full flex-col items-center justify-center gap-1",
                    isActive && "animate-pulse bg-primary/5"
                  )}
                >
                  {isActive ? (
                    <Loader2 className="size-4 animate-spin text-primary" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Имя, отдел и кнопка — по 33% ширины */}
        <div className="grid grid-cols-3 gap-2 border-t border-border px-3 py-2">
          <div className="min-w-0">
            {showNameInput && onNameChange ? (
              <Input
                value={item.name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="Введите имя"
                disabled={isProcessing}
                className="h-8 w-full min-w-0 text-sm"
              />
            ) : (
              <span className="flex h-8 items-center truncate text-sm font-medium text-foreground">
                {item.name || "—"}
              </span>
            )}
          </div>
          <div className="min-w-0">
            {departments.length > 0 && onDepartmentChange ? (
              <Select
                value={item.departmentId ?? "_none"}
                onValueChange={(v) => onDepartmentChange(item.id, v === "_none" ? null : v)}
                disabled={isProcessing}
              >
                <SelectTrigger className="h-8 w-full min-w-0 text-sm">
                  <SelectValue placeholder="Отдел" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Без отдела</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="flex h-8 items-center text-sm text-muted-foreground">—</span>
            )}
          </div>
          <div className="flex min-h-8 min-w-0 items-center">
            {(item.status === "pending" || item.status === "error") && onGenerate && (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {item.status === "error" && (
                  <span title={item.error} className="flex shrink-0">
                    <AlertCircle className="size-3.5 text-destructive" />
                  </span>
                )}
                <Button
                  type="button"
                  size="sm"
                  className="h-8 flex-1 shrink-0 text-sm"
                  onClick={onGenerate}
                  disabled={isProcessing}
                >
                  {item.status === "error" ? "Повторить" : "Сгенерировать"}
                </Button>
              </div>
            )}
            {(item.status === "analyzing" || item.status === "generating") && (
              <Button type="button" size="sm" className="h-8 w-full shrink-0 text-sm" disabled>
                <Loader2 className="mr-2 size-4 shrink-0 animate-spin" />
                Генерация...
              </Button>
            )}
            {item.status === "complete" && onRegenerate && (
              <Button
                type="button"
                size="sm"
                className="h-8 w-full shrink-0 text-sm"
                onClick={onRegenerate}
                disabled={isProcessing || !!regeneratingStyle}
              >
                {regeneratingStyle ? (
                  <>
                    <Loader2 className="mr-2 size-4 shrink-0 animate-spin" />
                    <span className="truncate">Генерирую...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 size-4 shrink-0" />
                    <span className="truncate">Перегенерировать</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>

      {item.status === "error" && item.error && (
        <p className="border-t border-border px-3 py-1.5 text-xs text-destructive">
          {item.error}
        </p>
      )}
    </Card>
  )
}
