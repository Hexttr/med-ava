import { NextResponse } from "next/server"
import { getGeminiKey } from "@/lib/settings"
import { logger } from "@/lib/logger"
import { getRateLimitStats } from "@/lib/rate-limit"
import { getDb } from "@/lib/db"
import fs from "fs"
import path from "path"
import net from "net"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function checkTcpPort(host: string, port: number, timeoutMs = 2000): Promise<{ open: boolean; error?: string }> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    const timer = setTimeout(() => {
      socket.destroy()
      resolve({ open: false, error: "timeout" })
    }, timeoutMs)
    socket.once("connect", () => {
      clearTimeout(timer)
      socket.destroy()
      resolve({ open: true })
    })
    socket.once("error", (err) => {
      clearTimeout(timer)
      resolve({ open: false, error: err.message })
    })
    socket.connect(port, host)
  })
}

export async function GET() {
  const report: {
    timestamp: string
    env: {
      EAM_HTTPS_PROXY_set: boolean
      GEMINI_API_KEY_set: boolean
      EAM_PASSWORD_set: boolean
      NODE_ENV: string
      proxy_type?: string
      proxy_host_port?: string
    }
    proxy_ports: { socks5_10808: { open: boolean; error?: string }; http_10809: { open: boolean; error?: string } }
    api_key: { configured: boolean }
    health: { database: string; uptimeSeconds?: number }
    storage: { dataDirExists: boolean; dbExists: boolean; uploadsExists: boolean }
    rateLimit: { totalTracked: number }
    recommendations: string[]
  } = {
    timestamp: new Date().toISOString(),
    env: {
      EAM_HTTPS_PROXY_set: !!process.env.EAM_HTTPS_PROXY,
      GEMINI_API_KEY_set: !!process.env.GEMINI_API_KEY?.trim(),
      EAM_PASSWORD_set: !!process.env.EAM_PASSWORD?.trim(),
      NODE_ENV: process.env.NODE_ENV || "development",
      proxy_type: undefined,
      proxy_host_port: undefined,
    },
    proxy_ports: {
      socks5_10808: { open: false },
      http_10809: { open: false },
    },
    api_key: { configured: false },
    health: { database: "unknown" },
    storage: { dataDirExists: false, dbExists: false, uploadsExists: false },
    rateLimit: { totalTracked: 0 },
    recommendations: [],
  }

  const proxyUrl = process.env.EAM_HTTPS_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY
  if (proxyUrl) {
    const u = proxyUrl.trim().toLowerCase()
    if (u.startsWith("socks5://")) report.env.proxy_type = "socks5"
    else if (u.startsWith("http://") || u.startsWith("https://")) report.env.proxy_type = "http"
    try {
      const url = new URL(proxyUrl.trim())
      report.env.proxy_host_port = `${url.hostname}:${url.port || (report.env.proxy_type === "socks5" ? "10808" : "10809")}`
    } catch {
      report.env.proxy_host_port = "parse_error"
    }
  }

  report.proxy_ports.socks5_10808 = await checkTcpPort("127.0.0.1", 10808)
  report.proxy_ports.http_10809 = await checkTcpPort("127.0.0.1", 10809)
  const key = await getGeminiKey()
  report.api_key.configured = !!key
  report.env.GEMINI_API_KEY_set = !!key

  try {
    const db = getDb()
    db.prepare("SELECT 1").get()
    report.health.database = "ok"
  } catch {
    report.health.database = "error"
    report.recommendations.push("Ошибка подключения к БД. Проверьте папку data/.")
  }

  try {
    const dataDir = path.join(process.cwd(), "data")
    report.storage.dataDirExists = fs.existsSync(dataDir)
    report.storage.dbExists = fs.existsSync(path.join(dataDir, "eam.db"))
    report.storage.uploadsExists = fs.existsSync(path.join(dataDir, "uploads"))
  } catch {
    report.storage.dataDirExists = false
  }

  report.rateLimit = getRateLimitStats()

  if (!report.api_key.configured) {
    report.recommendations.push("Добавьте GEMINI_API_KEY в .env.local")
  }

  if (!report.env.EAM_HTTPS_PROXY_set) {
    report.recommendations.push("Задайте прокси: в .env.local добавьте EAM_HTTPS_PROXY=socks5://127.0.0.1:10808 или http://127.0.0.1:10809 (под ваш v2ray). Либо запускайте приложение через start.bat — он задаёт прокси сам.")
  } else {
    const wantSocks = report.env.proxy_type === "socks5"
    const wantHttp = report.env.proxy_type === "http"
    const socksOpen = report.proxy_ports.socks5_10808.open
    const httpOpen = report.proxy_ports.http_10809.open

    if (wantSocks && !socksOpen) {
      report.recommendations.push("В .env.local указан SOCKS5 (10808), но порт 10808 закрыт. Включите VPN-клиент (v2ray) и убедитесь, что слушается 127.0.0.1:10808. Либо переключитесь на HTTP-прокси: EAM_HTTPS_PROXY=http://127.0.0.1:10809")
    }
    if (wantHttp && !httpOpen) {
      report.recommendations.push("В .env.local указан HTTP-прокси (10809), но порт 10809 закрыт. Включите VPN и проверьте, что слушается 127.0.0.1:10809. Либо используйте SOCKS5: EAM_HTTPS_PROXY=socks5://127.0.0.1:10808")
    }
    if (wantSocks && socksOpen) {
      report.recommendations.push("Прокси SOCKS5 (10808) доступен. Убедитесь, что в VPN включён режим «глобальный» / «весь трафик через прокси», иначе запросы к Google могут идти напрямую с вашего IP.")
    }
    if (wantHttp && httpOpen) {
      report.recommendations.push("Прокси HTTP (10809) доступен. В VPN выберите режим «глобальный», чтобы трафик к Google шёл через сервер VPN.")
    }
    if (!socksOpen && !httpOpen) {
      report.recommendations.push("Оба порта 10808 и 10809 закрыты. Запустите VPN-клиент (v2ray) и дождитесь появления локальных прокси, затем перезапустите приложение.")
    }
  }

  if (report.api_key.configured && report.env.EAM_HTTPS_PROXY_set) {
    const socksOpen = report.proxy_ports.socks5_10808.open
    const httpOpen = report.proxy_ports.http_10809.open
    if (!socksOpen && !httpOpen) {
      report.recommendations.push("После запуска VPN перезапустите приложение (start.bat), затем снова попробуйте генерацию. В консоли (терминал) смотрите логи [EAM] — там будет видно, через какой прокси пошёл запрос и какой ответ вернул Google.")
    }
  }

  logger.info("DIAGNOSTIC", "Отчёт сформирован", { recommendations_count: report.recommendations.length })
  return NextResponse.json(report, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  })
}
