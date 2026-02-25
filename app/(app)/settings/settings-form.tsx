"use client"

import { useState, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Key, Save, Trash2, CheckCircle2, ExternalLink, Stethoscope, Building2, FileText } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface AppSettingsData {
  organizationName: string
  backgroundMedical: string
  backgroundCorporate: string
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
  const [orgName, setOrgName] = useState(initialAppSettings?.organizationName ?? "")
  const [bgMedical, setBgMedical] = useState(initialAppSettings?.backgroundMedical ?? "")
  const [bgCorporate, setBgCorporate] = useState(initialAppSettings?.backgroundCorporate ?? "")
  const [promptAnalysis, setPromptAnalysis] = useState(initialAppSettings?.promptAnalysis ?? "")
  const [promptUniversalFraming, setPromptUniversalFraming] = useState(initialAppSettings?.promptUniversalFraming ?? "")
  const [promptMedicalInstruction, setPromptMedicalInstruction] = useState(initialAppSettings?.promptMedicalInstruction ?? "")
  const [promptCorporateInstruction, setPromptCorporateInstruction] = useState(initialAppSettings?.promptCorporateInstruction ?? "")
  const [promptNegative, setPromptNegative] = useState(initialAppSettings?.promptNegative ?? "")
  const [appPending, setAppPending] = useState(false)
  const [promptsOpen, setPromptsOpen] = useState(true)

  useEffect(() => {
    if (initialAppSettings) {
      setOrgName(initialAppSettings.organizationName)
      setBgMedical(initialAppSettings.backgroundMedical)
      setBgCorporate(initialAppSettings.backgroundCorporate)
      setPromptAnalysis(initialAppSettings.promptAnalysis ?? "")
      setPromptUniversalFraming(initialAppSettings.promptUniversalFraming ?? "")
      setPromptMedicalInstruction(initialAppSettings.promptMedicalInstruction ?? "")
      setPromptCorporateInstruction(initialAppSettings.promptCorporateInstruction ?? "")
      setPromptNegative(initialAppSettings.promptNegative ?? "")
    }
  }, [initialAppSettings])

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
          body: JSON.stringify({ key: apiKey.trim() }),
        })
        const data = await res.json().catch(() => ({}))
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
        const res = await fetch("/api/settings/key", { method: "DELETE" })
        const data = await res.json().catch(() => ({}))
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
      const res = await fetch("/api/settings/app", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: orgName.trim(),
          backgroundMedical: bgMedical.trim(),
          backgroundCorporate: bgCorporate.trim(),
          promptAnalysis: promptAnalysis.trim(),
          promptUniversalFraming: promptUniversalFraming.trim(),
          promptMedicalInstruction: promptMedicalInstruction.trim(),
          promptCorporateInstruction: promptCorporateInstruction.trim(),
          promptNegative: promptNegative.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
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

  return (
    <div className="grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-none bg-primary/10">
              <Building2 className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Название организации</CardTitle>
              <CardDescription>
                Отображается в левой колонке сверху вместо подзаголовка
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-name">Название</Label>
            <Input
              id="org-name"
              placeholder="Корпоративный генератор портретов"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bg-medical">Фон 1 — для медицинского портрета</Label>
            <Textarea
              id="bg-medical"
              placeholder="Оставьте пустым, чтобы модель сама выбирала фон (светло-серый/белый)"
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
              placeholder="Оставьте пустым, чтобы модель сама выбирала фон (тёмно-серый/синий)"
              value={bgCorporate}
              onChange={(e) => setBgCorporate(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>
          <Button onClick={handleSaveAppSettings} disabled={appPending}>
            <Save className="mr-2 size-4" />
            Сохранить настройки приложения
          </Button>
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
                Текущие значения (по умолчанию или сохранённые). Английский рекомендуется для лучшего качества. Редактируйте и сохраните.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Collapsible open={promptsOpen} onOpenChange={setPromptsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between">
                {promptsOpen ? "Свернуть промпты" : "Развернуть промпты"}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 flex flex-col gap-4">
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
            </CollapsibleContent>
          </Collapsible>
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
