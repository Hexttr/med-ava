"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Key, Save, Trash2, CheckCircle2, ExternalLink, Stethoscope } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

interface SettingsFormProps {
  hasKey: boolean
  maskedKey: string | null
}

export function SettingsForm({ hasKey, maskedKey }: SettingsFormProps) {
  const router = useRouter()
  const [apiKey, setApiKey] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!apiKey.trim()) {
      toast.error("Введите корректный API-ключ")
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
          toast.success("API-ключ успешно сохранён")
          setApiKey("")
          router.refresh()
        } else {
          toast.error(data.error || "Не удалось сохранить ключ")
        }
      } catch {
        toast.error("Ошибка сети. Проверьте подключение.")
      }
    })
  }

  function handleRemove() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/settings/key", { method: "DELETE" })
        const data = await res.json().catch(() => ({}))
        if (res.ok && data.success) {
          toast.success("API-ключ удалён")
          router.refresh()
        } else {
          toast.error(data.error || "Не удалось удалить ключ")
        }
      } catch {
        toast.error("Ошибка сети.")
      }
    })
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <Key className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">API-ключ Gemini</CardTitle>
              <CardDescription>
                Нужен для анализа фото и генерации промптов
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {hasKey && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-success" />
                <span className="text-sm text-foreground">Текущий ключ:</span>
                <code className="font-mono text-sm text-muted-foreground">{maskedKey}</code>
              </div>
              <Badge variant="secondary" className="text-xs">Активен</Badge>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="api-key">{hasKey ? "Заменить API-ключ" : "API-ключ"}</Label>
            <div className="flex gap-2">
              <Input
                id="api-key"
                type="password"
                placeholder="AIza..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="font-mono"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave()
                }}
              />
              <Button onClick={handleSave} disabled={isPending || !apiKey.trim()}>
                <Save className="mr-2 size-4" />
                Сохранить
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Ключ хранится в зашифрованном виде в HTTP-only cookie и не передаётся клиенту.
            </p>
            <p className="text-xs text-muted-foreground">
              РФ/ограничения: включите VPN до запуска, в клиенте выберите режим «глобальный» (весь трафик через прокси). В .env.local задайте <code className="rounded bg-muted px-1">EAM_HTTPS_PROXY=socks5://127.0.0.1:10808</code> или <code className="rounded bg-muted px-1">http://127.0.0.1:10809</code> под ваш v2ray.
            </p>
            <Button variant="outline" size="sm" className="mt-2" asChild>
              <Link href="/diagnostic">
                <Stethoscope className="mr-2 size-4" />
                Диагностика сети и рекомендации
              </Link>
            </Button>
          </div>

          {hasKey && (
            <div className="flex items-center justify-between border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">Удалить API-ключ из этого браузера</p>
              <Button variant="outline" size="sm" onClick={handleRemove} disabled={isPending}>
                <Trash2 className="mr-2 size-4" />
                Удалить
              </Button>
            </div>
          )}
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
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="mb-1 text-xs font-medium text-foreground">Медицинский стиль</p>
              <p className="text-xs leading-relaxed">Белый халат, медицинская обстановка, нейтральный фон</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
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
  )
}
