import { NextRequest, NextResponse } from "next/server"
import { getGeminiKey } from "@/lib/settings"
import { fetchWithProxy } from "@/lib/fetch-proxy"
import { logger } from "@/lib/logger"

export const runtime = "nodejs"
export const maxDuration = 60

function toBase64(bytes: ArrayBuffer): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64")
  }
  const arr = new Uint8Array(bytes)
  let binary = ""
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i])
  return typeof btoa !== "undefined" ? btoa(binary) : ""
}

export async function POST(request: NextRequest) {
  try {
    const geminiKey = await getGeminiKey()
    if (!geminiKey) {
      return NextResponse.json(
        { error: "API-ключ Gemini не настроен" },
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

    const bytes = await (photo as Blob).arrayBuffer()
    const base64 = toBase64(bytes)
    const mimeType = (photo as File).type || "image/jpeg"

    // Call Gemini API for analysis
    const analysisPrompt = `You are a professional portrait photography prompt engineer for an AI image generation system called NanoBanano.

Analyze this photo of a person named "${employeeName}". Focus on:
- Face shape, skin tone, hair color and style
- Eye color and shape
- Approximate age
- Any distinguishing features
- Gender presentation

Based on your analysis, create TWO detailed prompts for generating professional portraits:

1. MEDICAL PORTRAIT: The person wearing a crisp white medical doctor's coat with a stethoscope, professional medical setting. Clean, well-lit studio backdrop in light gray or white. Professional headshot style, shoulders up. Warm, approachable expression. High-quality studio photography lighting.

2. CORPORATE PORTRAIT: The person in professional business attire (dark suit/blazer). Clean corporate background in dark navy or charcoal gray. Professional headshot style, shoulders up. Confident, professional expression. Studio photography with rim lighting.

IMPORTANT: Each prompt must describe the SAME person from the photo, maintaining their exact appearance, ethnicity, facial features, and characteristics. The prompts should be detailed enough for accurate portrait generation.

Respond in EXACTLY this JSON format:
{
  "description": "Brief description of the person in the photo",
  "medicalPrompt": "Full detailed prompt for medical portrait...",
  "corporatePrompt": "Full detailed prompt for corporate portrait..."
}`

    // Анализ фото: Gemini 2.5 Flash (запрос через fetchWithProxy для поддержки VPN/прокси)
    const geminiResponse = await fetchWithProxy(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
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

    // Parse JSON from response (handle markdown code blocks)
    let parsed
    try {
      const jsonMatch = textContent.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        throw new Error("No JSON found in response")
      }
    } catch {
      logger.error("ANALYZE", "Не удалось разобрать ответ Gemini", { excerpt: textContent.slice(0, 300) })
      return NextResponse.json(
        { error: "Не удалось разобрать результат анализа" },
        { status: 500 }
      )
    }

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
