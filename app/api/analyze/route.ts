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
    const analysisPrompt = `You are a professional portrait photography prompt engineer for an AI image generation system. Your goal is to produce text prompts that will generate portraits where the face is MAXIMUM LIKENESS to the source photo.

Analyze this photo of a person named "${employeeName}". You MUST describe the face in precise, unambiguous detail:
- Exact face shape (oval, round, square, heart, etc.)
- Skin tone and texture (specific shade, any visible features)
- Hair: color, exact style, length, parting, any distinctive detail
- Eyes: color, shape, spacing, eyebrows (shape and color)
- Nose and mouth: shape, lip fullness, any distinctive traits
- Approximate age and gender presentation
- Any distinguishing features (moles, freckles, scars, glasses imprint, etc.)

Based on your analysis, create TWO detailed prompts for generating professional portraits. Each prompt MUST start with a full, precise description of this person's face and head so the generated image looks like the SAME person.

1. MEDICAL PORTRAIT: First describe the person's face and appearance in full detail (so the portrait is unmistakably the same person), then: wearing a crisp white medical doctor's coat, professional medical setting. Clean, well-lit studio backdrop in light gray or white. Professional headshot style, shoulders up. Warm, approachable expression. High-quality studio photography lighting.

2. CORPORATE PORTRAIT: First describe the person's face and appearance in full detail (same as above—identical person), then: in professional business attire (dark suit/blazer). Clean corporate background in dark navy or charcoal gray. Professional headshot style, shoulders up. Confident, professional expression. Studio photography with rim lighting.

CRITICAL: Both prompts must describe the EXACT SAME person from the photo. The face in the generated image must be recognizable as this person. Lead each prompt with a detailed facial description so the AI image model preserves identity and likeness.

Respond with ONLY one valid JSON object (no markdown, no \`\`\` code fences, no extra text). Use double quotes for keys and strings; escape any " inside strings as \". Required keys: description, medicalPrompt, corporatePrompt. Example structure:
{
  "description": "Brief description of the person",
  "medicalPrompt": "Full prompt for medical portrait...",
  "corporatePrompt": "Full prompt for corporate portrait..."
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
      } catch (e2) {
        const msg = e1 instanceof Error ? e1.message : String(e1)
        logger.error("ANALYZE", "Не удалось разобрать ответ Gemini", { error: msg, excerpt: textContent.slice(0, 600) })
        return NextResponse.json(
          { error: "Не удалось разобрать результат анализа" },
          { status: 500 }
        )
      }
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
