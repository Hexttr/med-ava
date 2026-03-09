import { NextRequest, NextResponse } from "next/server"
import { getGeminiKey } from "@/lib/settings"
import { fetchWithProxy } from "@/lib/fetch-proxy"
import { logger } from "@/lib/logger"
import { enforceTrustedOrigin } from "@/lib/request-security"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

/**
 * Тестовый запрос к Google API через текущий прокси.
 * Показывает точный ответ Google (в т.ч. ошибку «position» / геоблок).
 */
export async function POST(request: NextRequest) {
  const originError = enforceTrustedOrigin(request)
  if (originError) return originError

  const key = await getGeminiKey()
  if (!key) {
    return NextResponse.json({
      success: false,
      error: "API-ключ не настроен",
      recommendation: "Добавьте ключ Gemini в Настройках.",
    })
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`
  const body = JSON.stringify({
    contents: [{ parts: [{ text: "Say OK in one word." }] }],
    generationConfig: { maxOutputTokens: 10 },
  })

  try {
    const res = await fetchWithProxy(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    })

    const text = await res.text()
    let parsed: unknown = null
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text.slice(0, 500)
    }

    if (res.ok) {
      logger.info("DIAGNOSTIC_TEST", "Успех", { status: res.status })
      return NextResponse.json({
        success: true,
        status: res.status,
        message: "Запрос к Google прошёл. Прокси работает.",
      })
    }

    const errorMessage =
      typeof parsed === "object" && parsed !== null && "error" in parsed
        ? String((parsed as { error?: { message?: string } }).error?.message ?? JSON.stringify((parsed as { error: unknown }).error))
        : String(parsed)

    logger.error("DIAGNOSTIC_TEST", "Ошибка Google", { status: res.status, body: errorMessage })

    let recommendation = ""
    if (/location is not supported|position|region|country|not available|restricted|403|geograph/i.test(errorMessage)) {
      recommendation =
        "Google не поддерживает регион того IP, с которого пришёл запрос. Запрос уже идёт через прокси — значит, блокируют страну вашего VPN-сервера. В HAPP смените сервер на страну, где Gemini API доступен: США (US), Великобритания (UK), Германия (DE). Затем перезапустите start.bat и проверьте снова."
    } else if (/401|invalid|key/i.test(errorMessage)) {
      recommendation = "Проверьте API-ключ в Настройках и доступ к Gemini API."
    }

    return NextResponse.json({
      success: false,
      status: res.status,
      errorFromGoogle: errorMessage,
      recommendation: recommendation || "См. текст ошибки выше и логи [EAM] в терминале.",
    })
  } catch (e) {
    const err = e as Error
    logger.error("DIAGNOSTIC_TEST", "Исключение", { error: err.message })
    return NextResponse.json({
      success: false,
      error: err.message,
      recommendation: "Проверьте, что VPN (HAPP) запущен и порты 10808/10809 открыты. Попробуйте EAM_HTTPS_PROXY=http://127.0.0.1:10809 в .env.local",
    })
  }
}
