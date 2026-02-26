"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshCw, CheckCircle2, XCircle, AlertCircle, Play, Copy, Terminal } from "lucide-react"

interface Report {
  timestamp: string
  env: {
    EAM_HTTPS_PROXY_set: boolean
    GEMINI_API_KEY_set: boolean
    EAM_PASSWORD_set: boolean
    NODE_ENV: string
    proxy_type?: string
    proxy_host_port?: string
  }
  proxy_ports: {
    socks5_10808: { open: boolean; error?: string }
    http_10809: { open: boolean; error?: string }
  }
  api_key: { configured: boolean }
  health: { database: string; uptimeSeconds?: number }
  storage: { dataDirExists: boolean; dbExists: boolean; uploadsExists: boolean }
  rateLimit: { totalTracked: number }
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

interface LogEntry {
  id: string
  ts: string
  level: string
  tag: string
  message: string
  data?: Record<string, unknown>
  raw: string
}

export function DiagnosticClient() {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<TestResult>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

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

  const loadLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const res = await fetch("/api/diagnostic/logs?limit=100", { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs ?? [])
      }
    } catch {
      setLogs([])
    } finally {
      setLogsLoading(false)
    }
  }, [])

  const copyLogs = useCallback(() => {
    const text = logs.map((l) => l.raw).join("\n")
    void navigator.clipboard.writeText(text)
  }, [logs])

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    loadLogs()
    const interval = setInterval(loadLogs, 5000)
    return () => clearInterval(interval)
  }, [loadLogs])

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

  const { env, proxy_ports, api_key, health, storage, rateLimit, recommendations } = report

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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Переменные окружения</CardTitle>
            <CardDescription>.env.local</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              {env.GEMINI_API_KEY_set ? (
                <CheckCircle2 className="size-4 text-success" />
              ) : (
                <XCircle className="size-4 text-destructive" />
              )}
              <span>GEMINI_API_KEY</span>
            </div>
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
            <div className="flex items-center gap-2">
              {env.EAM_PASSWORD_set ? (
                <CheckCircle2 className="size-4 text-success" />
              ) : (
                <span className="size-4 text-muted-foreground">—</span>
              )}
              <span className="text-xs">EAM_PASSWORD (Basic Auth)</span>
            </div>
            <p className="text-xs text-muted-foreground">NODE_ENV: {env.NODE_ENV}</p>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Проверки</CardTitle>
            <CardDescription>БД, хранилище, rate limit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              {health.database === "ok" ? (
                <CheckCircle2 className="size-4 text-success" />
              ) : (
                <XCircle className="size-4 text-destructive" />
              )}
              <span>БД: {health.database}</span>
            </div>
            <div className="flex items-center gap-2">
              {storage.dataDirExists ? (
                <CheckCircle2 className="size-4 text-success" />
              ) : (
                <XCircle className="size-4 text-destructive" />
              )}
              <span>data/</span>
            </div>
            <div className="flex items-center gap-2">
              {storage.dbExists ? (
                <CheckCircle2 className="size-4 text-success" />
              ) : (
                <XCircle className="size-4 text-muted-foreground" />
              )}
              <span>eam.db</span>
            </div>
            <div className="flex items-center gap-2">
              {storage.uploadsExists ? (
                <CheckCircle2 className="size-4 text-success" />
              ) : (
                <XCircle className="size-4 text-muted-foreground" />
              )}
              <span>uploads/</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Rate limit: {rateLimit.totalTracked} IP в окне
            </p>
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

      <Card className="border-primary/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Terminal className="size-4" />
                Логи и мониторинг
              </CardTitle>
              <CardDescription>
                Последние записи логов приложения. Обновляются каждые 5 сек. Запустите генерацию — здесь появятся запросы к API, статусы и ошибки.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadLogs} disabled={logsLoading}>
                <RefreshCw className={`mr-2 size-4 ${logsLoading ? "animate-spin" : ""}`} />
                Обновить
              </Button>
              <Button variant="outline" size="sm" onClick={copyLogs} disabled={logs.length === 0}>
                <Copy className="mr-2 size-4" />
                Копировать
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[320px] overflow-y-auto rounded-none border border-border bg-muted/20 font-mono text-xs">
            {logs.length === 0 && !logsLoading ? (
              <p className="p-4 text-muted-foreground">Логов пока нет. Выполните генерацию или проверку API.</p>
            ) : (
              <div className="divide-y divide-border">
                {logs.map((entry, i) => (
                  <div
                    key={`${entry.ts}-${i}`}
                    className={`px-3 py-1.5 hover:bg-muted/40 ${
                      entry.level === "error" ? "text-destructive" : entry.level === "warn" ? "text-amber-600 dark:text-amber-400" : ""
                    }`}
                  >
                    <span className="text-muted-foreground">{entry.ts}</span>{" "}
                    <span className="font-medium">[{entry.tag}]</span> {entry.message}
                    {entry.data && Object.keys(entry.data).length > 0 && (
                      <span className="text-muted-foreground"> {JSON.stringify(entry.data)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
