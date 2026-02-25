"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshCw, CheckCircle2, XCircle, AlertCircle, Play } from "lucide-react"

interface Report {
  timestamp: string
  env: {
    EAM_HTTPS_PROXY_set: boolean
    proxy_type?: string
    proxy_host_port?: string
  }
  proxy_ports: {
    socks5_10808: { open: boolean; error?: string }
    http_10809: { open: boolean; error?: string }
  }
  api_key: { configured: boolean }
  recommendations: string[]
}

type TestResult = {
  success?: boolean
  status?: number
  message?: string
  error?: string
  errorFromGoogle?: string
  recommendation?: string
} | null

export function DiagnosticClient() {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<TestResult>(null)
  const [testLoading, setTestLoading] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/diagnostic", { cache: "no-store" })
      if (!res.ok) throw new Error(res.statusText)
      const data = await res.json()
      setReport(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки")
    } finally {
      setLoading(false)
    }
  }

  async function runTest() {
    setTestLoading(true)
    setTestResult(null)
    try {
      const res = await fetch("/api/diagnostic/test", { method: "POST", cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      setTestResult(data)
    } catch (e) {
      setTestResult({ success: false, error: (e as Error).message })
    } finally {
      setTestLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading && !report) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Загрузка диагностики...
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" className="mt-4" onClick={load}>
            <RefreshCw className="mr-2 size-4" />
            Повторить
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!report) return null

  const { env, proxy_ports, api_key, recommendations } = report

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Обновлено: {new Date(report.timestamp).toLocaleString("ru")}
        </p>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} />
          Обновить
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Переменные окружения</CardTitle>
            <CardDescription>Прокси задан в .env.local или start.bat</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              {env.EAM_HTTPS_PROXY_set ? (
                <CheckCircle2 className="size-4 text-success" />
              ) : (
                <XCircle className="size-4 text-destructive" />
              )}
              <span>EAM_HTTPS_PROXY</span>
              {env.proxy_type && (
                <Badge variant="secondary" className="text-xs">
                  {env.proxy_type}
                </Badge>
              )}
            </div>
            {env.proxy_host_port && (
              <p className="text-xs text-muted-foreground font-mono">{env.proxy_host_port}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Порты прокси (127.0.0.1)</CardTitle>
            <CardDescription>Должны быть открыты при запущенном VPN</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              {proxy_ports.socks5_10808.open ? (
                <CheckCircle2 className="size-4 text-success" />
              ) : (
                <XCircle className="size-4 text-destructive" />
              )}
              <span>10808 (SOCKS5)</span>
              {!proxy_ports.socks5_10808.open && proxy_ports.socks5_10808.error && (
                <span className="text-xs text-muted-foreground">{proxy_ports.socks5_10808.error}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {proxy_ports.http_10809.open ? (
                <CheckCircle2 className="size-4 text-success" />
              ) : (
                <XCircle className="size-4 text-destructive" />
              )}
              <span>10809 (HTTP)</span>
              {!proxy_ports.http_10809.open && proxy_ports.http_10809.error && (
                <span className="text-xs text-muted-foreground">{proxy_ports.http_10809.error}</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">API-ключ Gemini</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {api_key.configured ? (
              <CheckCircle2 className="size-4 text-success" />
            ) : (
              <XCircle className="size-4 text-destructive" />
            )}
            <span>{api_key.configured ? "Настроен" : "Не настроен"}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-base">Проверка запроса к Google</CardTitle>
          <CardDescription>
            Отправляет тестовый запрос к Gemini через текущий прокси. Покажет точную ошибку от Google (в т.ч. блок по региону).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={runTest} disabled={testLoading || !api_key.configured}>
            <Play className={`mr-2 size-4 ${testLoading ? "animate-pulse" : ""}`} />
            {testLoading ? "Проверка..." : "Проверить запрос к Google"}
          </Button>
          {testResult && (
            <div className="rounded-none border border-border bg-muted/30 p-3 text-sm space-y-2">
              {testResult.success ? (
                <p className="text-success flex items-center gap-2">
                  <CheckCircle2 className="size-4 shrink-0" />
                  {testResult.message}
                </p>
              ) : (
                <>
                  {(testResult.errorFromGoogle || testResult.error) && (
                    <p className="text-destructive break-words">
                      {testResult.errorFromGoogle || testResult.error}
                    </p>
                  )}
                  {testResult.recommendation && (
                    <p className="text-foreground font-medium">{testResult.recommendation}</p>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="size-4" />
            Рекомендации
          </CardTitle>
          <CardDescription>
            Выполните по порядку. После изменений перезапустите приложение (start.bat) и обновите эту страницу.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recommendations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Всё настроено. Если генерация всё равно не работает, откройте консоль терминала (где запущен start.bat) и посмотрите логи [EAM] при нажатии «Сгенерировать портреты» — там будет ответ Google API.
            </p>
          ) : (
            <ol className="list-decimal list-inside space-y-2 text-sm">
              {recommendations.map((rec, i) => (
                <li key={i} className="leading-relaxed">
                  {rec}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Логи приложения</CardTitle>
          <CardDescription>
            В окне терминала, где запущен start.bat, при каждом запросе к Google выводятся строки [EAM] с типом запроса, прокси, статусом и телом ошибки (если есть). Запустите генерацию и посмотрите вывод.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
