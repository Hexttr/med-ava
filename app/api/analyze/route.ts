import { NextRequest, NextResponse } from "next/server"
import { getGeminiKey } from "@/lib/settings"
import { getAppSettings } from "@/lib/app-settings"
import { fetchWithProxy } from "@/lib/fetch-proxy"
import { logger } from "@/lib/logger"
import { getAnalysisPrompt } from "@/lib/prompts"
import { checkRateLimit } from "@/lib/rate-limit"
import { enforceTrustedOrigin, getClientIp } from "@/lib/request-security"
import { validateImageFile } from "@/lib/upload-validation"
import { preprocessForGemini } from "@/lib/image-preprocess"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const originError = enforceTrustedOrigin(request)
    if (originError) return originError

    const ip = getClientIp(request)
    const { allowed, resetIn } = checkRateLimit(`analyze:${ip}`)
    if (!allowed) {
      return NextResponse.json(
        { error: `Превышен лимит запросов. Повторите через ${resetIn} сек.` },
        { status: 429, headers: { "Retry-After": String(resetIn) } }
      )
    }

    const geminiKey = await getGeminiKey()
    if (!geminiKey) {
      return NextResponse.json(
        { error: "API-ключ Gemini не настроен. Добавьте GEMINI_API_KEY в .env" },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const photo = formData.get("photo") as File | Blob | null
    const employeeName = (formData.get("employeeName") as string) || "Сотрудник"

    if (!photo || typeof (photo as Blob).arrayBuffer !== "function") {
      return NextResponse.json(
        { error: "Фото не загружено" },
        { status: 400 }
      )
    }

    const validation = validateImageFile(photo)
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const bytes = await (photo as Blob).arrayBuffer()
    const buffer = Buffer.from(bytes)
    const { base64, mimeType } = await preprocessForGemini(buffer)

    const analysisPrompt = getAnalysisPrompt(employeeName)
    const appSettings = getAppSettings()
    const model = appSettings.modelAnalysis || "gemini-2.5-flash"

    const geminiResponse = await fetchWithProxy(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: analysisPrompt },
                {
                  inlineData: {
                    mimeType,
                    data: base64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            topP: 0.95,
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                description: { type: "string", description: "Brief description of the person in the photo" },
                medicalPrompt: { type: "string", description: "Full detailed prompt for medical portrait" },
                corporatePrompt: { type: "string", description: "Full detailed prompt for corporate portrait" },
              },
              required: ["description", "medicalPrompt", "corporatePrompt"],
            },
          },
        }),
      }
    )

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text()
      logger.error("ANALYZE", "Gemini API вернул ошибку", {
        status: geminiResponse.status,
        body: errText.slice(0, 800),
      })
      let userMessage = "Не удалось проанализировать фото. Проверьте API-ключ."
      try {
        const errJson = JSON.parse(errText)
        const msg = errJson?.error?.message || errJson?.message
        if (msg) userMessage = msg
        if (/location is not supported|position|region|country not supported/i.test(String(msg))) {
          userMessage += " Смените сервер VPN в HAPP на США (US) или Великобританию (UK)."
        }
      } catch {
        if (errText.length < 200) userMessage = errText
      }
      return NextResponse.json(
        { error: userMessage },
        { status: geminiResponse.status >= 400 && geminiResponse.status < 500 ? geminiResponse.status : 500 }
      )
    }

    const geminiData = await geminiResponse.json()
    const textContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text

    if (!textContent) {
      return NextResponse.json(
        { error: "Gemini не вернул результат анализа" },
        { status: 500 }
      )
    }

    // Parse JSON: extract object respecting strings (braces inside "..." don't count)
    function extractJsonObject(s: string): string | null {
      const start = s.indexOf("{")
      if (start === -1) return null
      let depth = 0
      let inString = false
      let escape = false
      let quote = '"'
      for (let i = start; i < s.length; i++) {
        const c = s[i]
        if (escape) {
          escape = false
          continue
        }
        if (c === "\\" && inString) {
          escape = true
          continue
        }
        if (!inString) {
          if (c === "{") depth++
          else if (c === "}") {
            depth--
            if (depth === 0) return s.slice(start, i + 1)
          } else if (c === '"' || c === "'") {
            inString = true
            quote = c
          }
          continue
        }
        if (c === quote) inString = false
      }
      return null
    }

    let raw = textContent.trim()
    const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlock) raw = codeBlock[1].trim()
    const jsonStr = extractJsonObject(raw) ?? raw.slice(raw.indexOf("{"))
    let parsed: { description?: string; medicalPrompt?: string; corporatePrompt?: string }
    try {
      parsed = JSON.parse(jsonStr)
    } catch (e1) {
      try {
        const fixed = jsonStr.replace(/,(\s*[}\]])/g, "$1")
        parsed = JSON.parse(fixed)
      } catch {
        const msg = e1 instanceof Error ? e1.message : String(e1)
        logger.error("ANALYZE", "Не удалось разобрать ответ Gemini", { error: msg, excerpt: textContent.slice(0, 600) })
        return NextResponse.json(
          { error: "Не удалось разобрать результат анализа" },
          { status: 500 }
        )
      }
    }

    logger.info("ANALYZE", "Анализ выполнен", { employeeName })
    return NextResponse.json({
      description: parsed.description || "Person analyzed",
      medicalPrompt: parsed.medicalPrompt || "Professional medical portrait",
      corporatePrompt: parsed.corporatePrompt || "Professional corporate portrait",
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error("ANALYZE", "Исключение при анализе", { error: message, stack: (error as Error)?.stack?.slice(0, 400) })
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? message : "Внутренняя ошибка при анализе" },
      { status: 500 }
    )
  }
}
