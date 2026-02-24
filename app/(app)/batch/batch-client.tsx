"use client"

import { useState, useCallback, useRef } from "react"
import {
  Upload,
  Sparkles,
  AlertCircle,
  Settings,
  X,
  CheckCircle2,
  Loader2,
  Download,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"

interface BatchItem {
  id: string
  file: File
  preview: string
  name: string
  status: "pending" | "analyzing" | "generating" | "complete" | "error"
  medicalUrl: string | null
  corporateUrl: string | null
  error?: string
}

interface BatchClientProps {
  hasApiKey: boolean
}

export function BatchClient({ hasApiKey }: BatchClientProps) {
  const [items, setItems] = useState<BatchItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback((files: FileList) => {
    const newItems: BatchItem[] = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        name: file.name.replace(/\.[^.]+$/, ""),
        status: "pending" as const,
        medicalUrl: null,
        corporateUrl: null,
      }))

    setItems((prev) => [...prev, ...newItems])
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer.files?.length) {
        handleFiles(e.dataTransfer.files)
      }
    },
    [handleFiles]
  )

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id)
      if (item) URL.revokeObjectURL(item.preview)
      return prev.filter((i) => i.id !== id)
    })
  }, [])

  const clearAll = useCallback(() => {
    items.forEach((item) => URL.revokeObjectURL(item.preview))
    setItems([])
    setCurrentIndex(-1)
  }, [items])

  async function processBatch() {
    if (items.length === 0) return

    setIsProcessing(true)

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.status === "complete") continue

      setCurrentIndex(i)

      try {
        // Update status to analyzing
        setItems((prev) =>
          prev.map((p) => (p.id === item.id ? { ...p, status: "analyzing" } : p))
        )

        // Step 1: Analyze
        const formData = new FormData()
        formData.append("photo", item.file)
        formData.append("employeeName", item.name)

        const analyzeRes = await fetch("/api/analyze", {
          method: "POST",
          body: formData,
        })

        if (!analyzeRes.ok) {
          throw new Error("Ошибка анализа")
        }

        const analysis = await analyzeRes.json()

        // Update status to generating
        setItems((prev) =>
          prev.map((p) => (p.id === item.id ? { ...p, status: "generating" } : p))
        )

        // Step 2: Generate medical
        const medicalRes = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: analysis.medicalPrompt, style: "medical" }),
        })

        let medicalUrl = null
        if (medicalRes.ok) {
          const data = await medicalRes.json()
          medicalUrl = data.imageUrl
        }

        // Step 3: Generate corporate
        const corporateRes = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: analysis.corporatePrompt, style: "corporate" }),
        })

        let corporateUrl = null
        if (corporateRes.ok) {
          const data = await corporateRes.json()
          corporateUrl = data.imageUrl
        }

        setItems((prev) =>
          prev.map((p) =>
            p.id === item.id
              ? { ...p, status: "complete", medicalUrl, corporateUrl }
              : p
          )
        )

        if (medicalUrl && corporateUrl) {
          try {
            const GALLERY_KEY = "eam_gallery"
            const stored = sessionStorage.getItem(GALLERY_KEY)
            const items = stored ? JSON.parse(stored) : []
            items.unshift({
              id: crypto.randomUUID(),
              name: item.name,
              medicalUrl,
              corporateUrl,
              createdAt: Date.now(),
            })
            sessionStorage.setItem(GALLERY_KEY, JSON.stringify(items))
          } catch {
            // ignore
          }
        }
      } catch (error) {
        setItems((prev) =>
          prev.map((p) =>
            p.id === item.id
              ? { ...p, status: "error", error: error instanceof Error ? error.message : "Ошибка" }
              : p
          )
        )
      }
    }

    setIsProcessing(false)
    setCurrentIndex(-1)
    toast.success("Пакетная обработка завершена")
  }

  if (!hasApiKey) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <AlertCircle className="size-8 text-destructive" />
          <div>
            <p className="text-sm font-medium text-foreground">Требуется API-ключ</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Настройте API-ключ Gemini в настройках перед генерацией портретов.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/settings">
              <Settings className="mr-2 size-4" />
              Открыть настройки
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const completedCount = items.filter((i) => i.status === "complete").length
  const totalCount = items.length
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div className="flex flex-col gap-6">
      {/* Upload area */}
      {!isProcessing && (
        <div
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-10 text-center transition-colors hover:border-primary/40 hover:bg-muted/50"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click()
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) handleFiles(e.target.files)
              e.target.value = ""
            }}
          />
          <Upload className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">
            Перетащите сюда несколько фото или нажмите для выбора
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            JPG, PNG, WebP. С каждого фото будут созданы два стиля портрета.
          </p>
        </div>
      )}

      {/* Controls */}
      {items.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">
                {totalCount} {totalCount === 1 ? "фото" : "фото"}
              </span>
              {completedCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {completedCount} готово
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isProcessing && (
                <Button variant="ghost" size="sm" onClick={clearAll}>
                  <Trash2 className="mr-2 size-4" />
                  Очистить всё
                </Button>
              )}
              <Button
                onClick={processBatch}
                disabled={isProcessing || items.length === 0}
                size="sm"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Обработка {currentIndex + 1}/{totalCount}...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 size-4" />
                    Сгенерировать все
                  </>
                )}
              </Button>
            </div>
          </div>

          {isProcessing && (
            <div className="flex flex-col gap-1">
              <Progress value={progressPercent} className="h-1.5" />
              <span className="text-xs text-muted-foreground">
                Обработка фото {currentIndex + 1} из {totalCount}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Queue list */}
      {items.length > 0 && (
        <ScrollArea className="max-h-[60vh]">
          <div className="flex flex-col gap-2">
            {items.map((item, idx) => (
              <Card
                key={item.id}
                className={
                  isProcessing && idx === currentIndex
                    ? "border-primary/30 bg-primary/5"
                    : ""
                }
              >
                <CardContent className="flex items-center gap-4 py-3">
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-md border border-border">
                    <img
                      src={item.preview}
                      alt={item.name}
                      className="size-full object-cover"
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">
                      {item.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.status === "pending" && "Ожидание..."}
                      {item.status === "analyzing" && "Анализ фото..."}
                      {item.status === "generating" && "Генерация портретов..."}
                      {item.status === "complete" && "Готово"}
                      {item.status === "error" && (item.error || "Ошибка")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.status === "complete" && (
                      <CheckCircle2 className="size-4 text-success" />
                    )}
                    {(item.status === "analyzing" || item.status === "generating") && (
                      <Loader2 className="size-4 animate-spin text-primary" />
                    )}
                    {item.status === "error" && (
                      <AlertCircle className="size-4 text-destructive" />
                    )}
                    {item.status === "complete" && item.medicalUrl && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => {
                          if (item.medicalUrl) {
                            const a = document.createElement("a")
                            a.href = item.medicalUrl
                            a.download = `${item.name}-medical.png`
                            a.click()
                          }
                        }}
                      >
                        <Download className="size-4" />
                        <span className="sr-only">Скачать медицинский</span>
                      </Button>
                    )}
                    {!isProcessing && item.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => removeItem(item.id)}
                      >
                        <X className="size-4" />
                        <span className="sr-only">Удалить</span>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
