"use client"

import { useState, useCallback } from "react"
import { Sparkles, AlertCircle, Settings, Loader2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PhotoUploader } from "@/components/photo-uploader"
import { PortraitCard } from "@/components/portrait-card"
import { Progress } from "@/components/ui/progress"
import type { ProcessingStatus } from "@/lib/types"

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
  const [medicalPrompt, setMedicalPrompt] = useState<string>("")
  const [corporatePrompt, setCorporatePrompt] = useState<string>("")
  const [progress, setProgress] = useState(0)

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile)
    const url = URL.createObjectURL(selectedFile)
    setPreview(url)
    setMedicalUrl(null)
    setCorporateUrl(null)
    setMedicalPrompt("")
    setCorporatePrompt("")
    setStatus("idle")
    setProgress(0)
  }, [])

  const handleClear = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview)
    setFile(null)
    setPreview(null)
    setMedicalUrl(null)
    setCorporateUrl(null)
    setMedicalPrompt("")
    setCorporatePrompt("")
    setStatus("idle")
    setProgress(0)
  }, [preview])

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
      setMedicalPrompt(analysis.medicalPrompt)
      setCorporatePrompt(analysis.corporatePrompt)
      setProgress(30)

      // Step 2: Generate medical portrait
      setStatus("generating")
      setProgress(40)

      const medicalRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: analysis.medicalPrompt,
          style: "medical",
        }),
      })

      if (!medicalRes.ok) {
        const err = await medicalRes.json()
        throw new Error(err.error || "Ошибка генерации медицинского портрета")
      }

      const medicalData = await medicalRes.json()
      setMedicalUrl(medicalData.imageUrl)
      setProgress(70)

      // Step 3: Generate corporate portrait
      const corporateRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: analysis.corporatePrompt,
          style: "corporate",
        }),
      })

      if (!corporateRes.ok) {
        const err = await corporateRes.json()
        throw new Error(err.error || "Ошибка генерации корпоративного портрета")
      }

      const corporateData = await corporateRes.json()
      setCorporateUrl(corporateData.imageUrl)
      setProgress(100)
      setStatus("complete")

      // Сохраняем в галерею (sessionStorage)
      try {
        const GALLERY_KEY = "eam_gallery"
        const stored = sessionStorage.getItem(GALLERY_KEY)
        const items = stored ? JSON.parse(stored) : []
        const name = employeeName.trim() || "Сотрудник"
        items.unshift({
          id: crypto.randomUUID(),
          name,
          medicalUrl: medicalData.imageUrl,
          corporateUrl: corporateData.imageUrl,
          createdAt: Date.now(),
        })
        sessionStorage.setItem(GALLERY_KEY, JSON.stringify(items))
      } catch {
        // sessionStorage переполнен или недоступен
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

  const isProcessing = status === "analyzing" || status === "generating"

  return (
    <div className="flex flex-col gap-6">
      {isProcessing && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {status === "analyzing" ? "Анализ фото..." : "Генерация портретов..."}
            </span>
            <span className="text-sm font-mono text-muted-foreground">{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        {/* Left: Upload */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="employee-name">Имя сотрудника</Label>
            <Input
              id="employee-name"
              placeholder="Введите имя сотрудника"
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              disabled={isProcessing}
            />
          </div>
          <PhotoUploader
            onFileSelect={handleFileSelect}
            currentPreview={preview}
            onClear={handleClear}
            disabled={isProcessing}
          />
          <Button
            onClick={handleGenerate}
            disabled={!file || isProcessing}
            className="w-full"
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

        {/* Right: Results */}
        <div className="grid gap-4 sm:grid-cols-2">
          <PortraitCard
            style="medical"
            imageUrl={medicalUrl}
            status={medicalUrl ? "complete" : status === "generating" && !medicalUrl ? "generating" : status === "analyzing" ? "analyzing" : "idle"}
            prompt={medicalPrompt}
          />
          <PortraitCard
            style="corporate"
            imageUrl={corporateUrl}
            status={corporateUrl ? "complete" : status === "generating" && medicalUrl && !corporateUrl ? "generating" : status}
            prompt={corporatePrompt}
          />
        </div>
      </div>
    </div>
  )
}
