/**
 * Fetch к Google API через прокси (VPN в РФ и др.).
 * Подробное логирование для диагностики.
 */

import { logger, sanitizeUrl } from "@/lib/logger"

type FetchInput = RequestInfo | URL
type FetchInit = RequestInit

function getProxyUrl(): string | undefined {
  const url =
    process.env.EAM_HTTPS_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY
  return url?.trim() || undefined
}

function isHttps(url: string): boolean {
  return url.startsWith("https://")
}

function parseProxyUrl(proxyUrl: string): { protocol: "http" | "socks5"; host: string; port: number } | null {
  try {
    const u = new URL(proxyUrl)
    const rawProtocol = u.protocol.replace(":", "")
    if (rawProtocol === "socks5" || rawProtocol === "http" || rawProtocol === "https") {
      const host = u.hostname || "127.0.0.1"
      const protocol: "http" | "socks5" = rawProtocol === "socks5" ? "socks5" : "http"
      const port = u.port ? parseInt(u.port, 10) : protocol === "socks5" ? 10808 : 10809
      return { protocol, host, port }
    }
  } catch {
    if (proxyUrl.toLowerCase().startsWith("socks5://")) {
      const rest = proxyUrl.slice(9).split(":")
      const host = rest[0] || "127.0.0.1"
      const port = rest[1] ? parseInt(rest[1], 10) : 10808
      return { protocol: "socks5", host, port }
    }
    if (proxyUrl.toLowerCase().startsWith("http://") || proxyUrl.toLowerCase().startsWith("https://")) {
      const rest = proxyUrl.replace(/^https?:\/\//, "").split(":")
      const host = rest[0] || "127.0.0.1"
      const port = rest[1] ? parseInt(rest[1], 10) : 10809
      return { protocol: "http", host, port }
    }
  }
  return null
}

export async function fetchWithProxy(input: FetchInput, init?: FetchInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
  const proxyUrl = getProxyUrl()
  const safeUrl = sanitizeUrl(url)
  const start = Date.now()

  if (!proxyUrl || !isHttps(url)) {
    logger.info("FETCH", "Прокси не задан — запрос к Google напрямую", {
      target: safeUrl,
      env_EAM_HTTPS_PROXY: !!process.env.EAM_HTTPS_PROXY,
      env_HTTPS_PROXY: !!process.env.HTTPS_PROXY,
    })
    try {
      return logResponse(await fetch(input, init), safeUrl, "direct", start)
    } catch (e) {
      return toNetworkErrorResponse(e, safeUrl, "direct")
    }
  }

  const parsed = parseProxyUrl(proxyUrl)
  if (!parsed) {
    logger.warn("FETCH", "Неверный формат прокси — запрос напрямую", { proxyUrl, target: safeUrl })
    try {
      return logResponse(await fetch(input, init), safeUrl, "direct", start)
    } catch (e) {
      return toNetworkErrorResponse(e, safeUrl, "direct")
    }
  }

  const proxyDesc = `${parsed.protocol}://${parsed.host}:${parsed.port}`
  logger.info("FETCH", "Запрос через прокси", { proxy: proxyDesc, target: safeUrl })

  try {
    let res: Response
    if (parsed.protocol === "socks5") {
      const { socksDispatcher } = await import("fetch-socks")
      const dispatcher = socksDispatcher({
        type: 5,
        host: parsed.host,
        port: parsed.port,
      })
      const { fetch: undiciFetch } = await import("undici")
      const undiciResponse = await undiciFetch(input as never, {
        ...init,
        dispatcher,
      } as never)
      res = undiciResponse as unknown as Response
    } else {
      const { fetch: undiciFetch, ProxyAgent } = await import("undici")
      const dispatcher = new ProxyAgent(`http://${parsed.host}:${parsed.port}`)
      const undiciResponse = await undiciFetch(input as never, {
        ...init,
        dispatcher,
      } as never)
      res = undiciResponse as unknown as Response
    }
    return logResponse(res, safeUrl, proxyDesc, start)
  } catch (e) {
    return toNetworkErrorResponse(e, safeUrl, proxyDesc)
  }
}

function toNetworkErrorResponse(error: unknown, safeUrl: string, via: string): Response {
  const err = error as Error
  if (via === "direct") {
    logger.error("FETCH", "Сетевой сбой при прямом запросе к Google", {
      target: safeUrl,
      error: err.message,
    })
    return new Response(
      JSON.stringify({
        error: {
          message:
            `Не удалось подключиться к Gemini API (${err.message}). ` +
            "Сервер не имеет стабильного исходящего маршрута к Google API. " +
            "Нужен рабочий VPN/proxy с выходом в поддерживаемый регион.",
        },
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    )
  }

  logger.error("FETCH", "Прокси недоступен — запрос НЕ отправлен с вашего IP", {
    proxy: via,
    target: safeUrl,
    error: err.message,
  })
  // Не делаем fallback на прямое подключение: иначе Google увидит ваш IP и вернёт "location not supported"
  return new Response(
    JSON.stringify({
      error: {
        message: `Прокси недоступен (${err.message}). Запустите VPN (HAPP), выберите PROXY, проверьте порты 10808/10809. Не используем прямое подключение, чтобы не раскрывать ваш IP.`,
      },
    }),
    { status: 503, headers: { "Content-Type": "application/json" } }
  )
}

async function logResponse(
  res: Response,
  safeUrl: string,
  via: string,
  start: number
): Promise<Response> {
  const ms = Date.now() - start
  if (res.ok) {
    logger.info("FETCH", "Ответ получен", { status: res.status, via, ms, target: safeUrl })
    return res
  }
  let bodyPreview = ""
  try {
    const clone = res.clone()
    const text = await clone.text()
    bodyPreview = text.length > 500 ? text.slice(0, 500) + "..." : text
    logger.error("FETCH", "Ошибка от API (см. body)", {
      status: res.status,
      via,
      ms,
      target: safeUrl,
      body: bodyPreview,
    })
  } catch {
    logger.error("FETCH", "Ошибка от API (тело не прочитано)", {
      status: res.status,
      via,
      ms,
      target: safeUrl,
    })
  }
  return res
}
