"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Sparkles, AlertCircle, Settings, Loader2, Upload, Download } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PortraitCard } from "@/components/portrait-card"
import { GenerateModeSwitch } from "@/components/generate-mode-switch"
import { Progress } from "@/components/ui/progress"
import type { ProcessingStatus } from "@/lib/types"
import type { Department } from "@/lib/types"
import { fetchDepartments, createEmployee } from "@/lib/structure-api"
import { addGalleryItem, updateGalleryItem } from "@/lib/gallery-api"
import { fileToDataUrl } from "@/lib/file-utils"

interface GenerateClientProps {
  hasApiKey: boolean
}

export function GenerateClient({ hasApiKey }: GenerateClientProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [employeeName, setEmployeeName] = useState("")
  const [status, setStatus] = useState<ProcessingStatus>("idle")
  const [medicalUrl, setMedicalUrl] = useState<string | null>(null)
  const [corporateUrl, setCorporateUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("")
  const [galleryItemId, setGalleryItemId] = useState<string | null>(null)
  const [regeneratingStyle, setRegeneratingStyle] = useState<"medical" | "corporate" | null>(null)
  const [generateMode, setGenerateMode] = useState<"all" | "medical" | "corporate">("all")
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchDepartments().then(setDepartments).catch(() => [])
  }, [])

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile)
    const url = URL.createObjectURL(selectedFile)
    setPreview(url)
    setMedicalUrl(null)
    setCorporateUrl(null)
    setGalleryItemId(null)
    setStatus("idle")
    setProgress(0)
  }, [])

  const handleClear = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview)
    setFile(null)
    setPreview(null)
    setMedicalUrl(null)
    setCorporateUrl(null)
    setGalleryItemId(null)
    setStatus("idle")
    setProgress(0)
  }, [preview])

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

  async function handleGenerate() {
    if (!file) return

    try {
      setStatus("analyzing")
      setProgress(10)

      const formData = new FormData()
      formData.append("photo", file)
      formData.append("employeeName", employeeName || "Сотрудник")

      // Step 1: Analyze photo
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      })

      if (!analyzeRes.ok) {
        const err = await analyzeRes.json().catch(() => ({}))
        const msg = typeof err?.error === "string" ? err.error : "Ошибка анализа"
        throw new Error(msg)
      }

      const analysis = await analyzeRes.json()
      setProgress(30)

      const reference = await fileToBase64(file)

      const genMedical = generateMode === "all" || generateMode === "medical"
      const genCorporate = generateMode === "all" || generateMode === "corporate"

      setStatus("generating")
      setProgress(40)

      let medicalData: { imageUrl: string } | null = null
      let corporateData: { imageUrl: string } | null = null

      if (genMedical) {
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
        if (!medicalRes.ok) {
          const err = await medicalRes.json()
          throw new Error(err.error || "Ошибка генерации медицинского портрета")
        }
        medicalData = await medicalRes.json()
        setMedicalUrl(medicalData.imageUrl)
      }
      setProgress(genMedical && genCorporate ? 70 : 100)

      if (genCorporate) {
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
        if (!corporateRes.ok) {
          const err = await corporateRes.json()
          throw new Error(err.error || "Ошибка генерации корпоративного портрета")
        }
        corporateData = await corporateRes.json()
        setCorporateUrl(corporateData.imageUrl)
      }
      setProgress(100)
      setStatus("complete")

      const name = employeeName.trim() || "Сотрудник"
      let employeeId: string | undefined

      if (file) {
        try {
          const dataUrl = await fileToDataUrl(file)
          const emp = await createEmployee({
            name,
            photoUrl: dataUrl,
            departmentId: selectedDepartmentId || undefined,
          })
          employeeId = emp.id
        } catch {
          // ignore
        }
      }

      if (medicalData?.imageUrl || corporateData?.imageUrl) {
        try {
          const item = await addGalleryItem({
            name,
            medicalUrl: medicalData?.imageUrl,
            corporateUrl: corporateData?.imageUrl,
            employeeId,
          })
          setGalleryItemId(item.id)
        } catch {
          // ignore
        }
      }

      toast.success("Портреты успешно сгенерированы")
    } catch (error) {
      setStatus("error")
      toast.error(error instanceof Error ? error.message : "Ошибка генерации")
    }
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

  const handleRegenerateOne = useCallback(
    async (style: "medical" | "corporate") => {
      if (!file) return
      setRegeneratingStyle(style)
      try {
        const formData = new FormData()
        formData.append("photo", file)
        formData.append("employeeName", employeeName || "Сотрудник")
        const analyzeRes = await fetch("/api/analyze", { method: "POST", body: formData })
        if (!analyzeRes.ok) throw new Error("Ошибка анализа")
        const analysis = await analyzeRes.json()
        const reference = await fileToBase64(file)
        const prompt = style === "medical" ? analysis.medicalPrompt : analysis.corporatePrompt
        const genRes = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            style,
            referencePhotoBase64: reference.base64,
            referencePhotoMimeType: reference.mimeType,
          }),
        })
        if (!genRes.ok) {
          const err = await genRes.json().catch(() => ({}))
          throw new Error(err.error || "Ошибка генерации")
        }
        const data = await genRes.json()
        const newUrl = data.imageUrl
        if (style === "medical") setMedicalUrl(newUrl)
        else setCorporateUrl(newUrl)
        if (galleryItemId) {
          await updateGalleryItem(galleryItemId, { [style === "medical" ? "medicalUrl" : "corporateUrl"]: newUrl })
        }
        toast.success("Портрет перегенерирован")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Ошибка")
      } finally {
        setRegeneratingStyle(null)
      }
    },
    [file, employeeName, galleryItemId]
  )

  const isProcessing = status === "analyzing" || status === "generating"
  const genMedical = generateMode === "all" || generateMode === "medical"
  const genCorporate = generateMode === "all" || generateMode === "corporate"
  const medicalStatus = medicalUrl ? "complete" : genMedical && status === "generating" ? "generating" : status === "analyzing" ? "analyzing" : "idle"
  const corporateStatus = corporateUrl ? "complete" : genCorporate && status === "generating" ? "generating" : status

  return (
    <div className="flex min-w-0 flex-col overflow-x-hidden">
      {isProcessing && (
        <div className="mb-6 min-w-0 flex flex-col gap-2 overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {status === "analyzing" ? "Анализ фото..." : "Генерация портретов..."}
            </span>
            <span className="text-sm font-mono text-muted-foreground">{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5 min-w-0" />
        </div>
      )}

      {/* Верхняя строка: ФИО, Отдел, кнопка, фильтр режима */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="employee-name">ФИО сотрудника</Label>
            <Input
              id="employee-name"
              placeholder="Введите имя (необяз)"
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              disabled={isProcessing}
              className="w-full min-w-[180px]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Отдел</Label>
            <Select
              value={selectedDepartmentId || "_none"}
              onValueChange={(v) => setSelectedDepartmentId(v === "_none" ? "" : v)}
              disabled={isProcessing}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Без отдела" />
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
          </div>
          <Button
            onClick={handleGenerate}
            disabled={!file || isProcessing}
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Обработка...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 size-4" />
                Сгенерировать портреты
              </>
            )}
          </Button>
          </div>
          <GenerateModeSwitch
            value={generateMode}
            onChange={(v) => setGenerateMode(v)}
            disabled={isProcessing}
          />
        </div>
      </div>

      {/* Было — Стало */}
      <div className="mt-8 grid max-w-[70%] grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Было: вставка фото, после загрузки — превью */}
        <Card className="overflow-hidden gap-0">
          <div className="flex items-center border-b border-border px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">Было</span>
          </div>
          <div
            className="relative aspect-[3/4] w-full overflow-hidden bg-muted/30"
            onDragOver={(e) => {
              e.preventDefault()
              if (isProcessing) return
            }}
            onDrop={(e) => {
              e.preventDefault()
              if (isProcessing) return
              const f = e.dataTransfer.files?.[0]
              if (f?.type.startsWith("image/")) handleFileSelect(f)
            }}
            onClick={() => {
              if (isProcessing) return
              if (!preview) fileInputRef.current?.click()
            }}
            role={preview ? undefined : "button"}
            tabIndex={preview ? undefined : 0}
            onKeyDown={(e) => {
              if (preview) return
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFileSelect(f)
                e.target.value = ""
              }}
            />
            {preview ? (
              <>
                <img src={preview} alt="Исходное фото" className="size-full object-cover object-top" />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute right-1.5 bottom-1.5 z-10 size-7 rounded-none shadow-md opacity-90 hover:opacity-100"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const a = document.createElement("a")
                    a.href = preview
                    a.download = "original.jpg"
                    a.click()
                  }}
                  aria-label="Скачать"
                  title="Скачать"
                >
                  <Download className="size-3.5" />
                </Button>
              </>
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <Upload className="size-8 opacity-50" />
                <span className="text-xs">Вставьте или перетащите фото</span>
              </div>
            )}
          </div>
        </Card>
        <PortraitCard
          style="medical"
          imageUrl={medicalUrl}
          status={medicalStatus}
          labelLeft="Стало"
          onRegenerate={status === "complete" ? handleRegenerateOne : undefined}
          regeneratingStyle={regeneratingStyle}
        />
        <PortraitCard
          style="corporate"
          imageUrl={corporateUrl}
          status={corporateStatus}
          labelLeft="Стало"
          onRegenerate={status === "complete" ? handleRegenerateOne : undefined}
          regeneratingStyle={regeneratingStyle}
        />
      </div>
    </div>
  )
}
