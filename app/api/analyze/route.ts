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

type ParsedAnalysis = {
  description?: string
  identityAnchors?: string
}

function buildAnalysisRequestBody(
  analysisPrompt: string,
  mimeType: string,
  base64: string,
  maxOutputTokens: number
) {
  return {
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
      temperature: 0.25,
      topP: 0.95,
      maxOutputTokens,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          description: { type: "string", description: "Brief description of the person in the photo" },
          identityAnchors: { type: "string", description: "Compact but information-dense identity anchors to preserve in generation" },
        },
        required: ["description", "identityAnchors"],
      },
    },
  }
}

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

function parseAnalysisText(textContent: string): ParsedAnalysis {
  let raw = textContent.trim()
  const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlock) raw = codeBlock[1].trim()

  const start = raw.indexOf("{")
  const jsonStr = extractJsonObject(raw) ?? (start >= 0 ? raw.slice(start) : raw)

  try {
    return JSON.parse(jsonStr) as ParsedAnalysis
  } catch (e1) {
    try {
      const fixed = jsonStr
        .replace(/,(\s*[}\]])/g, "$1")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
      return JSON.parse(fixed) as ParsedAnalysis
    } catch {
      const msg = e1 instanceof Error ? e1.message : String(e1)
      throw new Error(msg)
    }
  }
}

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

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`

    async function requestAnalysis(prompt: string, maxOutputTokens: number) {
      const response = await fetchWithProxy(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildAnalysisRequestBody(prompt, mimeType, base64, maxOutputTokens)),
      })

      if (!response.ok) {
        const errText = await response.text()
        logger.error("ANALYZE", "Gemini API вернул ошибку", {
          status: response.status,
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

        return {
          ok: false as const,
          responseStatus: response.status,
          userMessage,
        }
      }

      const geminiData = await response.json()
      const textContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
      const finishReason = geminiData.candidates?.[0]?.finishReason

      if (!textContent) {
        return {
          ok: false as const,
          responseStatus: 500,
          userMessage: "Gemini не вернул результат анализа",
        }
      }

      return {
        ok: true as const,
        textContent,
        finishReason,
      }
    }

    const firstAttempt = await requestAnalysis(analysisPrompt, 2048)
    if (!firstAttempt.ok) {
      return NextResponse.json(
        { error: firstAttempt.userMessage },
        {
          status:
            firstAttempt.responseStatus >= 400 && firstAttempt.responseStatus < 500
              ? firstAttempt.responseStatus
              : 500,
        }
      )
    }

    let parsed: ParsedAnalysis
    try {
      parsed = parseAnalysisText(firstAttempt.textContent)
    } catch (e1) {
      const retryPrompt =
        `${analysisPrompt}\n\n` +
        "IMPORTANT RETRY INSTRUCTIONS: Return a compact JSON object only. " +
        "Keep each field concise but sufficient for generation. " +
        "Limit description to 220 characters and identityAnchors to 1200 characters. " +
        "Do not use markdown, code fences, comments, or trailing commas."

      logger.warn("ANALYZE", "Повторяем анализ после битого JSON от Gemini", {
        error: e1 instanceof Error ? e1.message : String(e1),
        finishReason: firstAttempt.finishReason,
        excerpt: firstAttempt.textContent.slice(0, 600),
      })

      const secondAttempt = await requestAnalysis(retryPrompt, 4096)
      if (!secondAttempt.ok) {
        return NextResponse.json(
          { error: secondAttempt.userMessage },
          {
            status:
              secondAttempt.responseStatus >= 400 && secondAttempt.responseStatus < 500
                ? secondAttempt.responseStatus
                : 500,
          }
        )
      }

      try {
        parsed = parseAnalysisText(secondAttempt.textContent)
      } catch (e2) {
        const msg = e2 instanceof Error ? e2.message : String(e2)
        logger.error("ANALYZE", "Не удалось разобрать ответ Gemini после повтора", {
          error: msg,
          finishReason: secondAttempt.finishReason,
          excerpt: secondAttempt.textContent.slice(0, 600),
        })
        return NextResponse.json(
          { error: "Не удалось разобрать результат анализа" },
          { status: 500 }
        )
      }
    }

    logger.info("ANALYZE", "Анализ выполнен", { employeeName })
    return NextResponse.json({
      description: parsed.description || "Person analyzed",
      identityAnchors:
        parsed.identityAnchors ||
        parsed.description ||
        "Preserve exact facial identity, hair, eyes, skin tone, age impression, and distinctive facial features from the source photo.",
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
