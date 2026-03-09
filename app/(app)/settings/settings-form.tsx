"use client"

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Key, Save, Trash2, CheckCircle2, ExternalLink, Stethoscope, Building2, FileText, ImageIcon, FileTextIcon, Upload, Stamp } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MODEL_ANALYSIS_OPTIONS, MODEL_GENERATION_OPTIONS } from "@/lib/model-options"
import { cn } from "@/lib/utils"

interface AppSettingsData {
  organizationName: string
  backgroundMedical: string
  backgroundCorporate: string
  backgroundMedicalImage?: string
  backgroundCorporateImage?: string
  overlayLogoEnabled?: boolean
  overlayLogoPath?: string
  overlayLogoPosition?: "top-left" | "top-right" | "bottom-left" | "bottom-right"
  overlayLogoSizePercent?: number
  overlayLogoPadding?: number
  backgroundMode?: "description" | "image"
  modelAnalysis?: string
  modelGeneration?: string
  promptAnalysis: string
  promptUniversalFraming: string
  promptMedicalInstruction: string
  promptCorporateInstruction: string
  promptNegative: string
}

interface SettingsFormProps {
  hasKey: boolean
  appSettings?: AppSettingsData
}

export function SettingsForm({ hasKey, appSettings: initialAppSettings }: SettingsFormProps) {
  const router = useRouter()
  const [apiKey, setApiKey] = useState("")
  const [isPending, startTransition] = useTransition()
  const [savedSettings, setSavedSettings] = useState<AppSettingsData | undefined>(initialAppSettings)
  const [bgMedical, setBgMedical] = useState(initialAppSettings?.backgroundMedical ?? "")
  const [bgCorporate, setBgCorporate] = useState(initialAppSettings?.backgroundCorporate ?? "")
  const [bgMode, setBgMode] = useState<"description" | "image">(initialAppSettings?.backgroundMode ?? "description")
  const [bgMedicalFile, setBgMedicalFile] = useState<File | null>(null)
  const [bgCorporateFile, setBgCorporateFile] = useState<File | null>(null)
  const [clearMedicalRequested, setClearMedicalRequested] = useState(false)
  const [clearCorporateRequested, setClearCorporateRequested] = useState(false)
  const medicalFileRef = useRef<HTMLInputElement>(null)
  const corporateFileRef = useRef<HTMLInputElement>(null)
  const overlayLogoFileRef = useRef<HTMLInputElement>(null)
  const [promptAnalysis, setPromptAnalysis] = useState(initialAppSettings?.promptAnalysis ?? "")
  const [promptUniversalFraming, setPromptUniversalFraming] = useState(initialAppSettings?.promptUniversalFraming ?? "")
  const [promptMedicalInstruction, setPromptMedicalInstruction] = useState(initialAppSettings?.promptMedicalInstruction ?? "")
  const [promptCorporateInstruction, setPromptCorporateInstruction] = useState(initialAppSettings?.promptCorporateInstruction ?? "")
  const [promptNegative, setPromptNegative] = useState(initialAppSettings?.promptNegative ?? "")
  const [overlayLogoEnabled, setOverlayLogoEnabled] = useState(initialAppSettings?.overlayLogoEnabled ?? false)
  const [overlayLogoPosition, setOverlayLogoPosition] = useState<"top-left" | "top-right" | "bottom-left" | "bottom-right">(
    initialAppSettings?.overlayLogoPosition ?? "top-right"
  )
  const [overlayLogoSizePercent, setOverlayLogoSizePercent] = useState(initialAppSettings?.overlayLogoSizePercent ?? 16)
  const [overlayLogoPadding, setOverlayLogoPadding] = useState(initialAppSettings?.overlayLogoPadding ?? 24)
  const [overlayLogoFile, setOverlayLogoFile] = useState<File | null>(null)
  const [clearOverlayLogoRequested, setClearOverlayLogoRequested] = useState(false)
  const [overlayLogoPreviewUrl, setOverlayLogoPreviewUrl] = useState<string | null>(null)
  const [modelAnalysis, setModelAnalysis] = useState(initialAppSettings?.modelAnalysis ?? "gemini-2.5-flash")
  const [modelGeneration, setModelGeneration] = useState(initialAppSettings?.modelGeneration ?? "gemini-3-pro-image-preview")
  const [appPending, setAppPending] = useState(false)

  function syncFormWithSettings(settings: AppSettingsData) {
    setSavedSettings(settings)
    setBgMedical(settings.backgroundMedical ?? "")
    setBgCorporate(settings.backgroundCorporate ?? "")
    setBgMode(settings.backgroundMode ?? "description")
    setPromptAnalysis(settings.promptAnalysis ?? "")
    setPromptUniversalFraming(settings.promptUniversalFraming ?? "")
    setPromptMedicalInstruction(settings.promptMedicalInstruction ?? "")
    setPromptCorporateInstruction(settings.promptCorporateInstruction ?? "")
    setPromptNegative(settings.promptNegative ?? "")
    setOverlayLogoEnabled(settings.overlayLogoEnabled ?? false)
    setOverlayLogoPosition(settings.overlayLogoPosition ?? "top-right")
    setOverlayLogoSizePercent(settings.overlayLogoSizePercent ?? 16)
    setOverlayLogoPadding(settings.overlayLogoPadding ?? 24)
    setModelAnalysis(settings.modelAnalysis ?? "gemini-2.5-flash")
    setModelGeneration(settings.modelGeneration ?? "gemini-3-pro-image-preview")
  }

  useEffect(() => {
    if (initialAppSettings) {
      syncFormWithSettings(initialAppSettings)
    }
  }, [initialAppSettings])

  useEffect(() => {
    if (overlayLogoFile) {
      const objectUrl = URL.createObjectURL(overlayLogoFile)
      setOverlayLogoPreviewUrl(objectUrl)
      return () => URL.revokeObjectURL(objectUrl)
    }

    if (savedSettings?.overlayLogoPath && !clearOverlayLogoRequested) {
      setOverlayLogoPreviewUrl(`/api/files/${savedSettings.overlayLogoPath}`)
      return
    }

    setOverlayLogoPreviewUrl(null)
  }, [overlayLogoFile, savedSettings?.overlayLogoPath, clearOverlayLogoRequested])

  const isOverlayDirty =
    overlayLogoEnabled !== (savedSettings?.overlayLogoEnabled ?? false) ||
    overlayLogoPosition !== (savedSettings?.overlayLogoPosition ?? "top-right") ||
    overlayLogoSizePercent !== (savedSettings?.overlayLogoSizePercent ?? 16) ||
    overlayLogoPadding !== (savedSettings?.overlayLogoPadding ?? 24) ||
    overlayLogoFile !== null ||
    clearOverlayLogoRequested

  async function saveOverlayLogoAsset() {
    if (!overlayLogoFile && !clearOverlayLogoRequested) return true

    const fd = new FormData()
    if (overlayLogoFile) fd.append("overlayLogo", overlayLogoFile)
    if (clearOverlayLogoRequested) fd.append("clearLogo", "true")
    const overlayRes = await fetch("/api/settings/branding", {
      method: "POST",
      body: fd,
    })
    const overlayData = await overlayRes.json().catch(() => ({}))
    if (!overlayRes.ok) {
      toast.error(overlayData.error || "Не удалось сохранить логотип")
      return false
    }
    setSavedSettings(overlayData)
    setOverlayLogoFile(null)
    setClearOverlayLogoRequested(false)
    if (overlayLogoFileRef.current) overlayLogoFileRef.current.value = ""
    return true
  }

  async function saveOverlaySettingsOnly() {
    const res = await fetch("/api/settings/app", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        overlayLogoEnabled,
        overlayLogoPosition,
        overlayLogoSizePercent,
        overlayLogoPadding,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(data.error || "Не удалось сохранить настройки логотипа")
      return false
    }
    setSavedSettings(data)
    return true
  }

  function handleSaveKey() {
    if (!apiKey.trim()) {
      toast.error("Введите API-ключ")
      return
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/settings/key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ key: apiKey.trim() }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.status === 401) {
          router.push(data.redirect || "/login")
          return
        }
        if (res.ok && data.success) {
          toast.success("API-ключ сохранён в data/gemini-key")
          setApiKey("")
          router.refresh()
        } else {
          toast.error(data.error || "Не удалось сохранить ключ")
        }
      } catch {
        toast.error("Ошибка сети")
      }
    })
  }

  function handleRemoveKey() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/settings/key", { method: "DELETE", credentials: "include" })
        const data = await res.json().catch(() => ({}))
        if (res.status === 401) {
          router.push(data.redirect || "/login")
          return
        }
        if (res.ok && data.success) {
          toast.success("API-ключ удалён")
          router.refresh()
        } else {
          toast.error(data.error || "Не удалось удалить")
        }
      } catch {
        toast.error("Ошибка сети")
      }
    })
  }

  async function handleSaveAppSettings() {
    setAppPending(true)
    try {
      if (bgMode === "image" && (bgMedicalFile || bgCorporateFile || clearMedicalRequested || clearCorporateRequested)) {
        const fd = new FormData()
        if (bgMedicalFile) fd.append("backgroundMedical", bgMedicalFile)
        if (bgCorporateFile) fd.append("backgroundCorporate", bgCorporateFile)
        if (clearMedicalRequested) fd.append("clearMedical", "true")
        if (clearCorporateRequested) fd.append("clearCorporate", "true")
        const bgRes = await fetch("/api/settings/backgrounds", {
          method: "POST",
          body: fd,
        })
        const bgData = await bgRes.json().catch(() => ({}))
        if (!bgRes.ok) {
          toast.error(bgData.error || "Не удалось сохранить фоны")
          setAppPending(false)
          return
        }
        setSavedSettings(bgData)
        setBgMedicalFile(null)
        setBgCorporateFile(null)
        setClearMedicalRequested(false)
        setClearCorporateRequested(false)
        if (medicalFileRef.current) medicalFileRef.current.value = ""
        if (corporateFileRef.current) corporateFileRef.current.value = ""
      }
      if (!(await saveOverlayLogoAsset())) {
        setAppPending(false)
        return
      }
      const res = await fetch("/api/settings/app", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backgroundMedical: bgMedical.trim(),
          backgroundCorporate: bgCorporate.trim(),
          overlayLogoEnabled,
          overlayLogoPosition,
          overlayLogoSizePercent,
          overlayLogoPadding,
          backgroundMode: bgMode,
          modelAnalysis: modelAnalysis,
          modelGeneration: modelGeneration,
          promptAnalysis: promptAnalysis.trim(),
          promptUniversalFraming: promptUniversalFraming.trim(),
          promptMedicalInstruction: promptMedicalInstruction.trim(),
          promptCorporateInstruction: promptCorporateInstruction.trim(),
          promptNegative: promptNegative.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        syncFormWithSettings(data)
        toast.success("Настройки приложения сохранены")
        router.refresh()
      } else {
        toast.error(data.error || "Не удалось сохранить")
      }
    } catch {
      toast.error("Ошибка сети")
    } finally {
      setAppPending(false)
    }
  }

  async function handleSaveOverlaySection() {
    setAppPending(true)
    try {
      if (!(await saveOverlayLogoAsset())) return
      if (!(await saveOverlaySettingsOnly())) return
      setClearOverlayLogoRequested(false)
      toast.success("Настройки логотипа сохранены")
      router.refresh()
    } catch {
      toast.error("Ошибка сети")
    } finally {
      setAppPending(false)
    }
  }

  return (
    <div className="grid w-full max-w-full grid-cols-1 gap-6 lg:grid-cols-[minmax(0,462px)_1fr]">
      <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-none bg-primary/10">
              <Building2 className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Настройка фона</CardTitle>
              <CardDescription>
                Фоны для портретов: описание или изображения
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Фоны для портретов</Label>
            <Tabs value={bgMode} onValueChange={(v) => setBgMode(v as "description" | "image")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="description" className="gap-1.5">
                  <FileTextIcon className="size-4" />
                  Описание
                </TabsTrigger>
                <TabsTrigger value="image" className="gap-1.5">
                  <ImageIcon className="size-4" />
                  Изображения
                </TabsTrigger>
              </TabsList>
              <TabsContent value="description" className="mt-3 flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="bg-medical">Фон 1 — для медицинского портрета</Label>
                  <Textarea
                    id="bg-medical"
                    placeholder="Оставьте пустым для базовых настроек (светло-серый/белый)"
                    value={bgMedical}
                    onChange={(e) => setBgMedical(e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="bg-corporate">Фон 2 — для корпоративного портрета</Label>
                  <Textarea
                    id="bg-corporate"
                    placeholder="Оставьте пустым для базовых настроек (тёмно-серый/синий)"
                    value={bgCorporate}
                    onChange={(e) => setBgCorporate(e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                </div>
              </TabsContent>
              <TabsContent value="image" className="mt-3 flex flex-col gap-5">
                <p className="text-xs text-muted-foreground">
                  Изображения имеют высший приоритет. Если загружены — используются вместо описания.
                </p>
                <div className="flex flex-col gap-2">
                  <Label>Фон 1 — медицинский</Label>
                  {(bgMedicalFile || (savedSettings?.backgroundMedicalImage && !clearMedicalRequested)) && (
                    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2">
                      {bgMedicalFile ? (
                        <span className="text-sm">{bgMedicalFile.name}</span>
                      ) : savedSettings?.backgroundMedicalImage ? (
                        <img
                          src={`/api/files/${savedSettings.backgroundMedicalImage}`}
                          alt="Мед. фон"
                          className="h-12 w-12 rounded object-cover"
                        />
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setBgMedicalFile(null)
                          if (medicalFileRef.current) medicalFileRef.current.value = ""
                          if (savedSettings?.backgroundMedicalImage) setClearMedicalRequested(true)
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Input
                      ref={medicalFileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => setBgMedicalFile(e.target.files?.[0] ?? null)}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => medicalFileRef.current?.click()}
                    >
                      <Upload className="mr-2 size-4" />
                      {bgMedicalFile ? "Заменить" : "Загрузить изображение"}
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Фон 2 — корпоративный</Label>
                  {(bgCorporateFile || (savedSettings?.backgroundCorporateImage && !clearCorporateRequested)) && (
                    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2">
                      {bgCorporateFile ? (
                        <span className="text-sm">{bgCorporateFile.name}</span>
                      ) : savedSettings?.backgroundCorporateImage ? (
                        <img
                          src={`/api/files/${savedSettings.backgroundCorporateImage}`}
                          alt="Корп. фон"
                          className="h-12 w-12 rounded object-cover"
                        />
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setBgCorporateFile(null)
                          if (corporateFileRef.current) corporateFileRef.current.value = ""
                          if (savedSettings?.backgroundCorporateImage) setClearCorporateRequested(true)
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Input
                      ref={corporateFileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => setBgCorporateFile(e.target.files?.[0] ?? null)}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => corporateFileRef.current?.click()}
                    >
                      <Upload className="mr-2 size-4" />
                      {bgCorporateFile ? "Заменить" : "Загрузить изображение"}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          <Button onClick={handleSaveAppSettings} disabled={appPending}>
            <Save className="mr-2 size-4" />
            Сохранить настройки приложения
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-none bg-primary/10">
                <Stamp className="size-5 text-primary" />
              </div>
              <CardTitle className="text-base">Вставка логотипа</CardTitle>
            </div>
            <div className="flex items-center gap-3 rounded-full border border-border bg-muted/30 px-4 py-2 shadow-sm">
              <div className="space-y-0.5 text-right">
                <p className="text-sm font-medium text-foreground">Режим вставки</p>
                <p className="text-xs text-muted-foreground">{overlayLogoEnabled ? "Включен" : "Выключен"}</p>
              </div>
              <Switch checked={overlayLogoEnabled} onCheckedChange={setOverlayLogoEnabled} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Превью результата</Label>
            <div className="rounded-[2rem] border border-border/80 bg-white p-3 shadow-sm">
              <div className="relative aspect-[3/4] overflow-hidden rounded-[1.5rem] bg-slate-100">
                <img
                  src="/exz.jpg"
                  alt="Превью портрета"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-linear-to-t from-slate-950/12 via-transparent to-transparent" />
                {overlayLogoEnabled && overlayLogoPreviewUrl ? (
                  <img
                    src={overlayLogoPreviewUrl}
                    alt="Превью логотипа"
                    className={[
                      "absolute z-10 w-auto object-contain drop-shadow-[0_8px_24px_rgba(15,23,42,0.18)]",
                      overlayLogoPosition === "top-left" ? "left-0 top-0" : "",
                      overlayLogoPosition === "top-right" ? "right-0 top-0" : "",
                      overlayLogoPosition === "bottom-left" ? "bottom-0 left-0" : "",
                      overlayLogoPosition === "bottom-right" ? "bottom-0 right-0" : "",
                    ].join(" ")}
                    style={{
                      width: `${overlayLogoSizePercent}%`,
                      margin: `${overlayLogoPadding}px`,
                    }}
                  />
                ) : (
                  <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-slate-950/72 px-4 py-3 text-center text-xs leading-5 text-white backdrop-blur-sm">
                    Загрузите PNG и сохраните настройки, чтобы увидеть результат прямо на фото.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-background p-5 shadow-sm">
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <Label className="text-sm font-semibold">PNG-логотип</Label>
                  <p className="text-xs text-muted-foreground">Загрузите прозрачный PNG и при необходимости замените его здесь.</p>
                </div>
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px]">
                  Только PNG
                </Badge>
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-border/80 bg-muted/25 p-4">
                {overlayLogoPreviewUrl ? (
                  <div className="flex items-center gap-3">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-white p-3 shadow-sm">
                      <img
                        src={overlayLogoPreviewUrl}
                        alt="Логотип"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {overlayLogoFile ? overlayLogoFile.name : "Текущий логотип"}
                      </p>
                      <p className="text-xs leading-5 text-muted-foreground">
                        Используется для наложения на новые сгенерированные портреты.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Логотип еще не загружен</p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      После загрузки вы сразу увидите его в превью выше.
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Input
                    ref={overlayLogoFileRef}
                    type="file"
                    accept="image/png"
                    onChange={(e) => {
                      setOverlayLogoFile(e.target.files?.[0] ?? null)
                      setClearOverlayLogoRequested(false)
                    }}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => overlayLogoFileRef.current?.click()}
                  >
                    <Upload className="mr-2 size-4" />
                    {overlayLogoPreviewUrl ? "Заменить PNG" : "Загрузить PNG"}
                  </Button>
                  {overlayLogoPreviewUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-xl text-muted-foreground"
                      onClick={() => {
                        setOverlayLogoFile(null)
                        if (overlayLogoFileRef.current) overlayLogoFileRef.current.value = ""
                        if (savedSettings?.overlayLogoPath || overlayLogoPreviewUrl) {
                          setClearOverlayLogoRequested(true)
                        }
                      }}
                    >
                      <Trash2 className="mr-2 size-4" />
                      Удалить
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-background p-5 shadow-sm">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Положение логотипа</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "top-left", label: "Слева сверху" },
                    { value: "top-right", label: "Справа сверху" },
                    { value: "bottom-left", label: "Слева снизу" },
                    { value: "bottom-right", label: "Справа снизу" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setOverlayLogoPosition(option.value as typeof overlayLogoPosition)}
                      className={cn(
                        "rounded-2xl border px-3 py-3 text-left text-sm transition-colors",
                        overlayLogoPosition === option.value
                          ? "border-primary bg-primary/8 text-foreground shadow-sm"
                          : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <Label className="text-sm font-semibold">Размер логотипа</Label>
                  <div className="rounded-full bg-primary/8 px-3 py-1 text-sm font-medium text-primary">
                    {overlayLogoSizePercent}% ширины
                  </div>
                </div>
                <Slider
                  min={5}
                  max={35}
                  step={1}
                  value={[overlayLogoSizePercent]}
                  onValueChange={(values) => setOverlayLogoSizePercent(values[0] ?? 16)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="overlay-padding" className="text-sm font-semibold">Отступ от края</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="overlay-padding"
                    type="number"
                    min={0}
                    max={96}
                    value={overlayLogoPadding}
                    onChange={(e) => setOverlayLogoPadding(Math.min(96, Math.max(0, Number(e.target.value) || 0)))}
                    className="rounded-xl"
                  />
                  <span className="text-sm text-muted-foreground">px</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-3xl border border-border bg-background p-5 shadow-sm">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Сохранение</p>
              <p className="text-xs text-muted-foreground">Сначала измените параметры, затем сохраните этот блок.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px]">
                {isOverlayDirty ? "Есть несохраненные изменения" : "Все сохранено"}
              </Badge>
              <Button
                type="button"
                onClick={handleSaveOverlaySection}
                disabled={appPending}
                className="w-full rounded-xl px-5 sm:w-auto"
              >
                <Save className="mr-2 size-4" />
                Сохранить
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-none bg-primary/10">
              <Key className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">API-ключ Gemini</CardTitle>
              <CardDescription>
                Сохраняется в data/gemini-key (приоритет над GEMINI_API_KEY из .env)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {hasKey && (
            <div className="flex items-center justify-between rounded-none border border-border bg-muted/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-success" />
                <span className="text-sm text-foreground">Ключ настроен</span>
              </div>
              <Badge variant="secondary" className="text-xs">Активен</Badge>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="api-key">{hasKey ? "Заменить ключ" : "API-ключ"}</Label>
            <div className="flex gap-2">
              <Input
                id="api-key"
                type="password"
                placeholder="AIza..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="font-mono"
                onKeyDown={(e) => e.key === "Enter" && handleSaveKey()}
              />
              <Button onClick={handleSaveKey} disabled={isPending || !apiKey.trim()}>
                <Save className="mr-2 size-4" />
                Сохранить
              </Button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Модель для анализа</Label>
              <Select value={modelAnalysis} onValueChange={setModelAnalysis}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_ANALYSIS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Модель для генерации</Label>
              <Select value={modelGeneration} onValueChange={setModelGeneration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_GENERATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleSaveAppSettings} disabled={appPending}>
            <Save className="mr-2 size-4" />
            Сохранить модели
          </Button>
          {hasKey && (
            <Button variant="outline" size="sm" onClick={handleRemoveKey} disabled={isPending}>
              <Trash2 className="mr-2 size-4" />
              Удалить ключ
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            РФ/ограничения: включите VPN до запуска. В .env.local задайте <code className="rounded bg-muted px-1">EAM_HTTPS_PROXY=socks5://127.0.0.1:10808</code> под ваш v2ray.
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/diagnostic">
              <Stethoscope className="mr-2 size-4" />
              Диагностика сети
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">О движке генерации</CardTitle>
          <CardDescription>
            Конвейер генерации портретов NanoBanano
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p className="leading-relaxed">
            EAM использует двухэтапный конвейер: сначала Gemini анализирует загруженное фото и строит оптимальный промпт,
            затем NanoBanano генерирует два варианта портрета по этому промпту.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-none border border-border bg-muted/30 p-3">
              <p className="mb-1 text-xs font-medium text-foreground">Медицинский стиль</p>
              <p className="text-xs leading-relaxed">Белый халат, медицинская обстановка, нейтральный фон</p>
            </div>
            <div className="rounded-none border border-border bg-muted/30 p-3">
              <p className="mb-1 text-xs font-medium text-foreground">Корпоративный стиль</p>
              <p className="text-xs leading-relaxed">Деловой костюм, студийный свет, профессиональный портрет</p>
            </div>
          </div>
          <a
            href="https://ai.google.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Получить API-ключ Gemini
            <ExternalLink className="size-3" />
          </a>
        </CardContent>
      </Card>
      </div>

      <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-none bg-primary/10">
              <FileText className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Промпты для генерации</CardTitle>
              <CardDescription>
                Текущие значения (по умолчанию или сохранённые). Редактируйте и сохраните.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="prompt-analysis">Промпт анализа (шаблон)</Label>
                <Textarea
                  id="prompt-analysis"
                  placeholder="Оставьте пустым для значения по умолчанию. Подставка: {employeeName}"
                  value={promptAnalysis}
                  onChange={(e) => setPromptAnalysis(e.target.value)}
                  rows={6}
                  className="resize-none font-mono text-xs"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="prompt-framing">Универсальное кадрирование</Label>
                <Textarea
                  id="prompt-framing"
                  placeholder="Фраза о композиции портрета (head and upper torso...)"
                  value={promptUniversalFraming}
                  onChange={(e) => setPromptUniversalFraming(e.target.value)}
                  rows={2}
                  className="resize-none font-mono text-xs"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="prompt-medical">Инструкция для медицинского портрета</Label>
                <Textarea
                  id="prompt-medical"
                  placeholder="Подставка: {backdrop}"
                  value={promptMedicalInstruction}
                  onChange={(e) => setPromptMedicalInstruction(e.target.value)}
                  rows={2}
                  className="resize-none font-mono text-xs"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="prompt-corporate">Инструкция для корпоративного портрета</Label>
                <Textarea
                  id="prompt-corporate"
                  placeholder="Подставка: {backdrop}"
                  value={promptCorporateInstruction}
                  onChange={(e) => setPromptCorporateInstruction(e.target.value)}
                  rows={2}
                  className="resize-none font-mono text-xs"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="prompt-negative">Negative prompt (чего избегать)</Label>
                <Textarea
                  id="prompt-negative"
                  placeholder="blurry, distorted face, different identity..."
                  value={promptNegative}
                  onChange={(e) => setPromptNegative(e.target.value)}
                  rows={2}
                  className="resize-none font-mono text-xs"
                />
              </div>
          </div>
          <Button onClick={handleSaveAppSettings} disabled={appPending}>
            <Save className="mr-2 size-4" />
            Сохранить промпты
          </Button>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
