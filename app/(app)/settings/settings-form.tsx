"use client"

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Key, Save, Trash2, CheckCircle2, ExternalLink, Stethoscope, Building2, FileText, ImageIcon, FileTextIcon, Upload, Stamp } from "lucide-react"
import { toast } from "sonner"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
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

type PromptSectionId = "analysis" | "framing" | "medical" | "corporate" | "negative"
type SettingsPatchPayload = Partial<Pick<
  AppSettingsData,
  | "backgroundMedical"
  | "backgroundCorporate"
  | "overlayLogoEnabled"
  | "overlayLogoPosition"
  | "overlayLogoSizePercent"
  | "overlayLogoPadding"
  | "backgroundMode"
  | "modelAnalysis"
  | "modelGeneration"
  | "promptAnalysis"
  | "promptUniversalFraming"
  | "promptMedicalInstruction"
  | "promptCorporateInstruction"
  | "promptNegative"
>>

function buildSettingsAssetPreviewUrl(assetPath: string): string {
  return `/api/files/${assetPath}?preview=${Date.now()}`
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
  const [bgMedicalPreviewUrl, setBgMedicalPreviewUrl] = useState<string | null>(null)
  const [bgCorporatePreviewUrl, setBgCorporatePreviewUrl] = useState<string | null>(null)
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
  const [savingSection, setSavingSection] = useState<"background" | "overlay" | "models" | `prompt:${PromptSectionId}` | null>(null)

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
    if (bgMedicalFile) {
      const objectUrl = URL.createObjectURL(bgMedicalFile)
      setBgMedicalPreviewUrl(objectUrl)
      return () => URL.revokeObjectURL(objectUrl)
    }

    if (savedSettings?.backgroundMedicalImage && !clearMedicalRequested) {
      setBgMedicalPreviewUrl(buildSettingsAssetPreviewUrl(savedSettings.backgroundMedicalImage))
      return
    }

    setBgMedicalPreviewUrl(null)
  }, [bgMedicalFile, savedSettings?.backgroundMedicalImage, clearMedicalRequested])

  useEffect(() => {
    if (bgCorporateFile) {
      const objectUrl = URL.createObjectURL(bgCorporateFile)
      setBgCorporatePreviewUrl(objectUrl)
      return () => URL.revokeObjectURL(objectUrl)
    }

    if (savedSettings?.backgroundCorporateImage && !clearCorporateRequested) {
      setBgCorporatePreviewUrl(buildSettingsAssetPreviewUrl(savedSettings.backgroundCorporateImage))
      return
    }

    setBgCorporatePreviewUrl(null)
  }, [bgCorporateFile, savedSettings?.backgroundCorporateImage, clearCorporateRequested])

  useEffect(() => {
    if (overlayLogoFile) {
      const objectUrl = URL.createObjectURL(overlayLogoFile)
      setOverlayLogoPreviewUrl(objectUrl)
      return () => URL.revokeObjectURL(objectUrl)
    }

    if (savedSettings?.overlayLogoPath && !clearOverlayLogoRequested) {
      setOverlayLogoPreviewUrl(buildSettingsAssetPreviewUrl(savedSettings.overlayLogoPath))
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

  const isBackgroundDirty =
    bgMedical.trim() !== (savedSettings?.backgroundMedical ?? "") ||
    bgCorporate.trim() !== (savedSettings?.backgroundCorporate ?? "") ||
    bgMode !== (savedSettings?.backgroundMode ?? "description") ||
    bgMedicalFile !== null ||
    bgCorporateFile !== null ||
    clearMedicalRequested ||
    clearCorporateRequested

  const isModelsDirty =
    modelAnalysis !== (savedSettings?.modelAnalysis ?? "gemini-2.5-flash") ||
    modelGeneration !== (savedSettings?.modelGeneration ?? "gemini-3-pro-image-preview")

  const promptDirty = {
    analysis: promptAnalysis.trim() !== (savedSettings?.promptAnalysis ?? ""),
    framing: promptUniversalFraming.trim() !== (savedSettings?.promptUniversalFraming ?? ""),
    medical: promptMedicalInstruction.trim() !== (savedSettings?.promptMedicalInstruction ?? ""),
    corporate: promptCorporateInstruction.trim() !== (savedSettings?.promptCorporateInstruction ?? ""),
    negative: promptNegative.trim() !== (savedSettings?.promptNegative ?? ""),
  } satisfies Record<PromptSectionId, boolean>

  const dirtyPromptCount = Object.values(promptDirty).filter(Boolean).length

  async function patchAppSettings(payload: SettingsPatchPayload, errorMessage: string) {
    const res = await fetch("/api/settings/app", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(data.error || errorMessage)
      return null
    }
    return data as AppSettingsData
  }

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
    const data = await patchAppSettings(
      {
        overlayLogoEnabled,
        overlayLogoPosition,
        overlayLogoSizePercent,
        overlayLogoPadding,
      },
      "Не удалось сохранить настройки логотипа"
    )
    if (!data) return null
    setSavedSettings(data)
    return data
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

  async function handleSaveBackgroundSection() {
    setSavingSection("background")
    try {
      if (bgMedicalFile || bgCorporateFile || clearMedicalRequested || clearCorporateRequested) {
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

      const data = await patchAppSettings(
        {
          backgroundMedical: bgMedical.trim(),
          backgroundCorporate: bgCorporate.trim(),
          backgroundMode: bgMode,
        },
        "Не удалось сохранить настройки фона"
      )
      if (!data) return

      setSavedSettings(data)
      setBgMedical(data.backgroundMedical ?? "")
      setBgCorporate(data.backgroundCorporate ?? "")
      setBgMode(data.backgroundMode ?? "description")
      toast.success("Настройка фона сохранена")
      router.refresh()
    } catch {
      toast.error("Ошибка сети")
    } finally {
      setSavingSection(null)
    }
  }

  async function handleSaveOverlaySection() {
    setSavingSection("overlay")
    try {
      if (!(await saveOverlayLogoAsset())) return
      const data = await saveOverlaySettingsOnly()
      if (!data) return
      setOverlayLogoEnabled(data.overlayLogoEnabled ?? false)
      setOverlayLogoPosition(data.overlayLogoPosition ?? "top-right")
      setOverlayLogoSizePercent(data.overlayLogoSizePercent ?? 16)
      setOverlayLogoPadding(data.overlayLogoPadding ?? 24)
      setClearOverlayLogoRequested(false)
      toast.success("Настройки логотипа сохранены")
      router.refresh()
    } catch {
      toast.error("Ошибка сети")
    } finally {
      setSavingSection(null)
    }
  }

  async function handleSaveModelsSection() {
    setSavingSection("models")
    try {
      const data = await patchAppSettings(
        {
          modelAnalysis,
          modelGeneration,
        },
        "Не удалось сохранить модели"
      )
      if (!data) return
      setSavedSettings(data)
      setModelAnalysis(data.modelAnalysis ?? "gemini-2.5-flash")
      setModelGeneration(data.modelGeneration ?? "gemini-3-pro-image-preview")
      toast.success("Модели сохранены")
      router.refresh()
    } catch {
      toast.error("Ошибка сети")
    } finally {
      setSavingSection(null)
    }
  }

  async function handleSavePromptSection(section: PromptSectionId) {
    setSavingSection(`prompt:${section}`)
    try {
      const payloadBySection: Record<PromptSectionId, SettingsPatchPayload> = {
        analysis: { promptAnalysis: promptAnalysis.trim() },
        framing: { promptUniversalFraming: promptUniversalFraming.trim() },
        medical: { promptMedicalInstruction: promptMedicalInstruction.trim() },
        corporate: { promptCorporateInstruction: promptCorporateInstruction.trim() },
        negative: { promptNegative: promptNegative.trim() },
      }
      const data = await patchAppSettings(payloadBySection[section], "Не удалось сохранить промпт")
      if (!data) return

      setSavedSettings(data)
      if (section === "analysis") setPromptAnalysis(data.promptAnalysis ?? "")
      if (section === "framing") setPromptUniversalFraming(data.promptUniversalFraming ?? "")
      if (section === "medical") setPromptMedicalInstruction(data.promptMedicalInstruction ?? "")
      if (section === "corporate") setPromptCorporateInstruction(data.promptCorporateInstruction ?? "")
      if (section === "negative") setPromptNegative(data.promptNegative ?? "")

      toast.success("Промпт сохранён")
      router.refresh()
    } catch {
      toast.error("Ошибка сети")
    } finally {
      setSavingSection(null)
    }
  }

  const promptSections: Array<{
    id: PromptSectionId
    title: string
    description: string
    placeholder: string
    tokens?: string[]
    rows: number
    value: string
    dirty: boolean
    setValue: (value: string) => void
  }> = [
    {
      id: "analysis",
      title: "Анализ исходного фото",
      description: "Главный шаблон анализа сотрудника перед генерацией. Обычно меняется реже остальных.",
      placeholder: "Оставьте пустым для значения по умолчанию. Подставка: {employeeName}",
      tokens: ["{employeeName}"],
      rows: 10,
      value: promptAnalysis,
      dirty: promptDirty.analysis,
      setValue: setPromptAnalysis,
    },
    {
      id: "framing",
      title: "Универсальное кадрирование",
      description: "Общая композиция, одинаковая для медицинского и корпоративного портрета.",
      placeholder: "Фраза о композиции портрета (head and upper torso...)",
      rows: 5,
      value: promptUniversalFraming,
      dirty: promptDirty.framing,
      setValue: setPromptUniversalFraming,
    },
    {
      id: "medical",
      title: "Медицинский стиль",
      description: "Инструкция, которая задаёт итоговый медицинский образ и фон.",
      placeholder: "Подставка: {backdrop}",
      tokens: ["{backdrop}"],
      rows: 6,
      value: promptMedicalInstruction,
      dirty: promptDirty.medical,
      setValue: setPromptMedicalInstruction,
    },
    {
      id: "corporate",
      title: "Корпоративный стиль",
      description: "Инструкция для делового варианта портрета с корпоративным фоном.",
      placeholder: "Подставка: {backdrop}",
      tokens: ["{backdrop}"],
      rows: 6,
      value: promptCorporateInstruction,
      dirty: promptDirty.corporate,
      setValue: setPromptCorporateInstruction,
    },
    {
      id: "negative",
      title: "Negative prompt",
      description: "Список дефектов и артефактов, которые генерация должна избегать.",
      placeholder: "blurry, distorted face, different identity...",
      rows: 5,
      value: promptNegative,
      dirty: promptDirty.negative,
      setValue: setPromptNegative,
    },
  ]

  return (
    <div className="flex w-full max-w-full flex-col gap-6">
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Card className="overflow-hidden border-border/80 shadow-sm">
            <CardHeader className="border-b border-border/70 pb-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                    <Building2 className="size-5" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-base">Настройка фона</CardTitle>
                    <CardDescription>Описание или изображения для двух сценариев генерации.</CardDescription>
                  </div>
                </div>
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px]">
                  {isBackgroundDirty ? "Есть изменения" : "Все сохранено"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <Tabs value={bgMode} onValueChange={(value) => setBgMode(value as "description" | "image")}>
                <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-muted/60 p-1">
                  <TabsTrigger value="description" className="gap-1.5 rounded-xl">
                    <FileTextIcon className="size-4" />
                    Описание
                  </TabsTrigger>
                  <TabsTrigger value="image" className="gap-1.5 rounded-xl">
                    <ImageIcon className="size-4" />
                    Изображения
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="description" className="mt-5 space-y-4">
                  <div className="space-y-2 rounded-3xl border border-border/70 bg-muted/20 p-5">
                    <Label htmlFor="bg-medical" className="text-sm font-semibold">Фон 1 — медицинский</Label>
                    <Textarea
                      id="bg-medical"
                      placeholder="Оставьте пустым для базовых настроек (светло-серый/белый)"
                      value={bgMedical}
                      onChange={(e) => setBgMedical(e.target.value)}
                      rows={3}
                      className="resize-none rounded-2xl"
                    />
                  </div>
                  <div className="space-y-2 rounded-3xl border border-border/70 bg-muted/20 p-5">
                    <Label htmlFor="bg-corporate" className="text-sm font-semibold">Фон 2 — корпоративный</Label>
                    <Textarea
                      id="bg-corporate"
                      placeholder="Оставьте пустым для базовых настроек (тёмно-серый/синий)"
                      value={bgCorporate}
                      onChange={(e) => setBgCorporate(e.target.value)}
                      rows={3}
                      className="resize-none rounded-2xl"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="image" className="mt-5 space-y-4">
                  <p className="text-xs leading-5 text-muted-foreground">
                    Если изображения загружены, они имеют приоритет над текстовым описанием.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-4 rounded-3xl border border-border/70 bg-muted/20 p-5">
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold">Фон 1 — медицинский</Label>
                        <p className="text-xs text-muted-foreground">Светлый фон или интерьер кабинета.</p>
                      </div>
                      {bgMedicalPreviewUrl ? (
                        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border/80 bg-background p-3">
                          <img
                            src={bgMedicalPreviewUrl}
                            alt="Медицинский фон"
                            className="h-16 w-16 rounded-2xl object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {bgMedicalFile ? bgMedicalFile.name : "Текущий фон"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {bgMedicalFile
                                ? "Этот файл будет сохранён после нажатия кнопки."
                                : "Используется для медицинского портрета."}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0 rounded-xl"
                            onClick={() => {
                              setBgMedicalFile(null)
                              if (medicalFileRef.current) medicalFileRef.current.value = ""
                              if (savedSettings?.backgroundMedicalImage) setClearMedicalRequested(true)
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-border/80 bg-background/70 px-4 py-5 text-sm text-muted-foreground">
                          Изображение ещё не загружено.
                        </div>
                      )}
                      <Input
                        ref={medicalFileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                          setBgMedicalFile(e.target.files?.[0] ?? null)
                          setClearMedicalRequested(false)
                        }}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full rounded-2xl"
                        onClick={() => medicalFileRef.current?.click()}
                      >
                        <Upload className="mr-2 size-4" />
                        {bgMedicalFile ? "Заменить изображение" : "Загрузить изображение"}
                      </Button>
                    </div>

                    <div className="space-y-4 rounded-3xl border border-border/70 bg-muted/20 p-5">
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold">Фон 2 — корпоративный</Label>
                        <p className="text-xs text-muted-foreground">Студийный или деловой корпоративный фон.</p>
                      </div>
                      {bgCorporatePreviewUrl ? (
                        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border/80 bg-background p-3">
                          <img
                            src={bgCorporatePreviewUrl}
                            alt="Корпоративный фон"
                            className="h-16 w-16 rounded-2xl object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {bgCorporateFile ? bgCorporateFile.name : "Текущий фон"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {bgCorporateFile
                                ? "Этот файл будет сохранён после нажатия кнопки."
                                : "Используется для корпоративного портрета."}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0 rounded-xl"
                            onClick={() => {
                              setBgCorporateFile(null)
                              if (corporateFileRef.current) corporateFileRef.current.value = ""
                              if (savedSettings?.backgroundCorporateImage) setClearCorporateRequested(true)
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-border/80 bg-background/70 px-4 py-5 text-sm text-muted-foreground">
                          Изображение ещё не загружено.
                        </div>
                      )}
                      <Input
                        ref={corporateFileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                          setBgCorporateFile(e.target.files?.[0] ?? null)
                          setClearCorporateRequested(false)
                        }}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full rounded-2xl"
                        onClick={() => corporateFileRef.current?.click()}
                      >
                        <Upload className="mr-2 size-4" />
                        {bgCorporateFile ? "Заменить изображение" : "Загрузить изображение"}
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex flex-col gap-3 rounded-3xl border border-border/70 bg-background p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Сохранение</p>
                  <p className="text-xs text-muted-foreground">Этот блок сохраняет только фон и его режим.</p>
                </div>
                <Button
                  type="button"
                  onClick={handleSaveBackgroundSection}
                  disabled={savingSection !== null}
                  className="w-full rounded-2xl sm:w-auto"
                >
                  <Save className="mr-2 size-4" />
                  {savingSection === "background" ? "Сохраняем..." : "Сохранить фон"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border/80 shadow-sm">
            <CardHeader className="border-b border-border/70 pb-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                    <Stamp className="size-5" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-base">Вставка логотипа</CardTitle>
                    <CardDescription>Логотип становится частью итогового изображения после генерации.</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-full border border-border/70 bg-muted/30 px-4 py-2">
                  <div className="space-y-0.5 text-right">
                    <p className="text-sm font-medium text-foreground">Режим вставки</p>
                    <p className="text-xs text-muted-foreground">{overlayLogoEnabled ? "Включен" : "Выключен"}</p>
                  </div>
                  <Switch checked={overlayLogoEnabled} onCheckedChange={setOverlayLogoEnabled} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
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
                        Загрузите PNG и сохраните параметры, чтобы увидеть итог прямо на превью.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-4 rounded-3xl border border-border/70 bg-muted/20 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <Label className="text-sm font-semibold">PNG-логотип</Label>
                      <p className="text-xs leading-5 text-muted-foreground">Загрузите прозрачный PNG и при необходимости замените его.</p>
                    </div>
                    <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px]">
                      Только PNG
                    </Badge>
                  </div>

                  <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-border/80 bg-background p-4">
                    {overlayLogoPreviewUrl ? (
                      <div className="flex items-center gap-3">
                        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border/70 bg-white p-3 shadow-sm">
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
                            Используется для наложения на новые портреты.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">Логотип еще не загружен</p>
                        <p className="text-xs leading-5 text-muted-foreground">
                          После загрузки он появится в превью выше.
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

                <div className="space-y-5 rounded-3xl border border-border/70 bg-muted/20 p-5">
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
                              : "border-border bg-background text-muted-foreground hover:bg-muted/40"
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
                        className="rounded-2xl"
                      />
                      <span className="text-sm text-muted-foreground">px</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-3xl border border-border/70 bg-background p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Сохранение</p>
                  <p className="text-xs text-muted-foreground">Этот блок сохраняет только вставку логотипа и её параметры.</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px]">
                    {isOverlayDirty ? "Есть изменения" : "Все сохранено"}
                  </Badge>
                  <Button
                    type="button"
                    onClick={handleSaveOverlaySection}
                    disabled={savingSection !== null}
                    className="w-full rounded-2xl sm:w-auto"
                  >
                    <Save className="mr-2 size-4" />
                    {savingSection === "overlay" ? "Сохраняем..." : "Сохранить логотип"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="overflow-hidden border-border/80 shadow-sm">
            <CardHeader className="border-b border-border/70 pb-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                    <Key className="size-5" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-base">Gemini и модели</CardTitle>
                    <CardDescription>Ключ доступа, выбор моделей и быстрый переход к сетевой диагностике.</CardDescription>
                  </div>
                </div>
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px]">
                  {isModelsDirty ? "Есть изменения" : "Все сохранено"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-4 rounded-3xl border border-border/70 bg-muted/20 p-5">
                {hasKey && (
                  <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background px-4 py-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-success" />
                      <span className="text-sm text-foreground">Ключ настроен</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">Активен</Badge>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="api-key">{hasKey ? "Заменить ключ" : "API-ключ"}</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="api-key"
                      type="password"
                      placeholder="AIza..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="rounded-2xl font-mono"
                      onKeyDown={(e) => e.key === "Enter" && handleSaveKey()}
                    />
                    <Button onClick={handleSaveKey} disabled={isPending || !apiKey.trim()} className="rounded-2xl sm:min-w-32">
                      <Save className="mr-2 size-4" />
                      Сохранить
                    </Button>
                  </div>
                </div>

                {hasKey && (
                  <Button variant="outline" size="sm" onClick={handleRemoveKey} disabled={isPending} className="rounded-2xl">
                    <Trash2 className="mr-2 size-4" />
                    Удалить ключ
                  </Button>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 rounded-3xl border border-border/70 bg-muted/20 p-5">
                  <Label>Модель для анализа</Label>
                  <Select value={modelAnalysis} onValueChange={setModelAnalysis}>
                    <SelectTrigger className="rounded-2xl">
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
                <div className="space-y-2 rounded-3xl border border-border/70 bg-muted/20 p-5">
                  <Label>Модель для генерации</Label>
                  <Select value={modelGeneration} onValueChange={setModelGeneration}>
                    <SelectTrigger className="rounded-2xl">
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

              <p className="rounded-3xl border border-border/70 bg-muted/20 px-4 py-3 text-xs leading-5 text-muted-foreground">
                Если доступ к Gemini ограничен по региону, включите VPN до запуска и при необходимости задайте
                <code className="mx-1 rounded bg-background px-1 py-0.5">EAM_HTTPS_PROXY=socks5://127.0.0.1:10808</code>
                в локальном окружении.
              </p>

              <div className="flex flex-col gap-3 rounded-3xl border border-border/70 bg-background p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Сохранение</p>
                  <p className="text-xs text-muted-foreground">Этот блок сохраняет только выбранные модели.</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button variant="outline" size="sm" asChild className="rounded-2xl">
                    <Link href="/diagnostic">
                      <Stethoscope className="mr-2 size-4" />
                      Диагностика сети
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSaveModelsSection}
                    disabled={savingSection !== null}
                    className="rounded-2xl"
                  >
                    <Save className="mr-2 size-4" />
                    {savingSection === "models" ? "Сохраняем..." : "Сохранить модели"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-muted/15 shadow-none">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">О движке генерации</CardTitle>
              <CardDescription>Короткая памятка для админа по текущему пайплайну.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p className="leading-relaxed">
                EAM использует двухэтапный конвейер: сначала Gemini анализирует загруженное фото и строит оптимальный промпт,
                затем NanoBanano генерирует два варианта портрета по этому промпту.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/70 bg-background px-4 py-3">
                  <p className="mb-1 text-xs font-medium text-foreground">Медицинский стиль</p>
                  <p className="text-xs leading-relaxed">Белый халат, медицинская обстановка, нейтральный фон.</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background px-4 py-3">
                  <p className="mb-1 text-xs font-medium text-foreground">Корпоративный стиль</p>
                  <p className="text-xs leading-relaxed">Деловой костюм, студийный свет, профессиональный портрет.</p>
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
      </div>

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/70 pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                <FileText className="size-5" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-base">Промпты для генерации</CardTitle>
                <CardDescription>Разверните только нужный раздел, отредактируйте его и сохраните прямо внутри.</CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px]">
              {dirtyPromptCount > 0 ? `${dirtyPromptCount} несохран.` : "Все сохранено"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <Accordion type="multiple" defaultValue={["analysis"]} className="w-full">
            {promptSections.map((section) => (
              <AccordionItem key={section.id} value={section.id} className="border-border/70">
                <AccordionTrigger className="group py-5 hover:no-underline">
                  <div className="flex flex-1 flex-col gap-3 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{section.title}</span>
                      {section.tokens?.map((token) => (
                        <Badge key={token} variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px]">
                          {token}
                        </Badge>
                      ))}
                      {section.dirty && (
                        <Badge variant="secondary" className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] text-primary">
                          Есть изменения
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm leading-6 text-muted-foreground">{section.description}</p>
                      <span className="shrink-0 text-xs font-medium text-primary/80 group-hover:text-primary">
                        Показать полностью
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 rounded-3xl border border-border/70 bg-muted/20 p-5">
                    <Textarea
                      id={`prompt-${section.id}`}
                      placeholder={section.placeholder}
                      value={section.value}
                      onChange={(e) => section.setValue(e.target.value)}
                      rows={section.rows}
                      className="resize-none rounded-2xl font-mono text-xs"
                    />
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs leading-5 text-muted-foreground">
                        После сохранения обновится только этот раздел промптов.
                      </p>
                      <Button
                        type="button"
                        onClick={() => handleSavePromptSection(section.id)}
                        disabled={savingSection !== null}
                        className="w-full rounded-2xl sm:w-auto"
                      >
                        <Save className="mr-2 size-4" />
                        {savingSection === `prompt:${section.id}` ? "Сохраняем..." : "Сохранить"}
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  )
}
