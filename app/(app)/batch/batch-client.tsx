"use client"

import { useState, useCallback, useRef, useEffect } from "react"
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
  Building2,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Organization, OrganizationEmployee } from "@/lib/types"
import { BatchPortraitCard } from "@/components/batch-portrait-card"
import { fetchAllOrganizations, fetchOrganizationById } from "@/lib/organizations-api"
import { addGalleryItem } from "@/lib/gallery-api"

interface BatchItem {
  id: string
  name: string
  status: "pending" | "analyzing" | "generating" | "complete" | "error"
  medicalUrl: string | null
  corporateUrl: string | null
  error?: string
  file?: File
  photoUrl?: string
  preview: string
}

interface BatchClientProps {
  hasApiKey: boolean
}

async function dataUrlToFile(dataUrl: string, fileName: string): Promise<File> {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  return new File([blob], fileName, { type: blob.type || "image/jpeg" })
}

function fileToBase64(f: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1]! : dataUrl
      resolve({ base64, mimeType: f.type || "image/jpeg" })
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(f)
  })
}

function dataUrlToBase64(dataUrl: string): { base64: string; mimeType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return { base64: "", mimeType: "image/jpeg" }
  return { base64: match[2], mimeType: match[1] }
}

export function BatchClient({ hasApiKey }: BatchClientProps) {
  const [mode, setMode] = useState<"upload" | "organization">("upload")
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>("")
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [orgEmployees, setOrgEmployees] = useState<OrganizationEmployee[]>([])
  const [items, setItems] = useState<BatchItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchAllOrganizations().then(setOrganizations).catch(() => {})
  }, [])

  useEffect(() => {
    if (mode === "organization" && selectedOrganizationId) {
      fetchOrganizationById(selectedOrganizationId).then((org) => {
        if (!org) {
          setOrgEmployees([])
          setItems([])
          return
        }
        setOrgEmployees(org.employees)
        setItems(
          org.employees.map((e) => ({
            id: e.id,
            name: e.name,
            status: "pending" as const,
            medicalUrl: null,
            corporateUrl: null,
            photoUrl: e.photoUrl,
            preview: e.photoUrl,
          }))
        )
      })
    } else if (mode === "organization") {
      setOrgEmployees([])
      setItems([])
    }
  }, [mode, selectedOrganizationId])

  const handleFiles = useCallback((files: FileList) => {
    const newItems: BatchItem[] = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        name: "",
        status: "pending" as const,
        medicalUrl: null,
        corporateUrl: null,
      }))
    setItems((prev) => [...prev, ...newItems])
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id)
      if (item?.file && item.preview?.startsWith("blob:")) URL.revokeObjectURL(item.preview)
      return prev.filter((i) => i.id !== id)
    })
  }, [])

  const clearAll = useCallback(() => {
    items.forEach((item) => {
      if (item.file && item.preview?.startsWith("blob:")) URL.revokeObjectURL(item.preview)
    })
    setItems([])
    setCurrentIndex(-1)
  }, [items])

  const handleOrgEmployeeChange = useCallback((id: string, data: { name: string }) => {
    setItems((prev) => prev.map((e) => (e.id === id ? { ...e, name: data.name } : e)))
  }, [])

  const handleOrgEmployeeRemove = useCallback((id: string) => {
    setItems((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const handleOrgFilesAdded = useCallback((files: File[]) => {
    const newItems: BatchItem[] = files
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        name: "",
        status: "pending" as const,
        medicalUrl: null,
        corporateUrl: null,
      }))
    setItems((prev) => [...prev, ...newItems])
  }, [])

  const selectedOrg = selectedOrganizationId
    ? organizations.find((o) => o.id === selectedOrganizationId)
    : null

  async function processBatch() {
    if (items.length === 0) return
    if (mode === "organization") {
      const withoutName = items.filter((i) => !String(i.name ?? "").trim())
      if (withoutName.length > 0) {
        toast.error("Заполните имя у всех сотрудников")
        return
      }
    }

    setIsProcessing(true)
    const orgId = mode === "organization" ? selectedOrganizationId : null
    const orgName = selectedOrg?.name

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.status === "complete") continue

      setCurrentIndex(i)

      try {
        setItems((prev) =>
          prev.map((p) => (p.id === item.id ? { ...p, status: "analyzing" } : p))
        )

        const file = item.file ?? (await dataUrlToFile(item.photoUrl!, `${item.name?.trim() || "photo"}.jpg`))
        const formData = new FormData()
        formData.append("photo", file)
        formData.append("employeeName", item.name?.trim() || "Сотрудник")

        const analyzeRes = await fetch("/api/analyze", { method: "POST", body: formData })
        if (!analyzeRes.ok) throw new Error("Ошибка анализа")

        const analysis = await analyzeRes.json()
        const reference = item.file
          ? await fileToBase64(item.file)
          : dataUrlToBase64(item.photoUrl!)

        setItems((prev) =>
          prev.map((p) => (p.id === item.id ? { ...p, status: "generating" } : p))
        )

        const medicalRes = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: analysis.medicalPrompt,
            style: "medical",
            referencePhotoBase64: reference.base64,
            referencePhotoMimeType: reference.mimeType,
          }),
        })
        let medicalUrl: string | null = null
        if (medicalRes.ok) {
          const data = await medicalRes.json()
          medicalUrl = data.imageUrl
        }

        const corporateRes = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: analysis.corporatePrompt,
            style: "corporate",
            referencePhotoBase64: reference.base64,
            referencePhotoMimeType: reference.mimeType,
          }),
        })
        let corporateUrl: string | null = null
        if (corporateRes.ok) {
          const data = await corporateRes.json()
          corporateUrl = data.imageUrl
        }

        setItems((prev) =>
          prev.map((p) =>
            p.id === item.id ? { ...p, status: "complete", medicalUrl, corporateUrl } : p
          )
        )

        if (medicalUrl && corporateUrl) {
          try {
            await addGalleryItem({
              name: item.name?.trim() || "Сотрудник",
              medicalUrl,
              corporateUrl,
              organizationId: orgId || undefined,
              organizationName: orgName ?? undefined,
            })
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
      {/* Mode switch */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex rounded-lg border border-border p-1">
          <button
            type="button"
            onClick={() => setMode("upload")}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === "upload" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Upload className="size-4" />
            Загрузить фото
          </button>
          <button
            type="button"
            onClick={() => setMode("organization")}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === "organization" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 className="size-4" />
            По организации
          </button>
        </div>

        {mode === "organization" && (
          <Select
            value={selectedOrganizationId || "_none"}
            onValueChange={(v) => setSelectedOrganizationId(v === "_none" ? "" : v)}
            disabled={isProcessing}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Выберите организацию" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">Выберите организацию</SelectItem>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name} ({org.employees.length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Upload area — only in upload mode */}
      {mode === "upload" && !isProcessing && (
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

      {/* Add employees (org mode only) */}
      {mode === "organization" && selectedOrganizationId && !isProcessing && (
        <div
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 py-4 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            if (e.dataTransfer.files?.length) handleOrgFilesAdded(Array.from(e.dataTransfer.files))
          }}
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
              if (e.target.files?.length) handleOrgFilesAdded(Array.from(e.target.files))
              e.target.value = ""
            }}
          />
          <Upload className="size-5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Добавить сотрудников (фото)</span>
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

      {/* Сетка карточек: исходник + «Стало» (до 3 в ряд на больших экранах) */}
      {items.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, idx) => (
            <BatchPortraitCard
              key={item.id}
              item={{
                id: item.id,
                name: item.name,
                preview: item.photoUrl ?? item.preview,
                status: item.status,
                medicalUrl: item.medicalUrl,
                corporateUrl: item.corporateUrl,
                error: item.error,
              }}
              index={idx}
              isCurrent={idx === currentIndex}
              isProcessing={isProcessing}
              onRemove={mode === "organization" || mode === "upload" ? () => removeItem(item.id) : undefined}
              onNameChange={mode === "organization" ? (name) => handleOrgEmployeeChange(item.id, { name }) : undefined}
              showNameInput={mode === "organization"}
            />
          ))}
        </div>
      )}
    </div>
  )
}
