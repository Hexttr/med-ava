import { NextRequest, NextResponse } from "next/server"
import { getGeminiKey } from "@/lib/settings"
import { fetchWithProxy } from "@/lib/fetch-proxy"
import { logger } from "@/lib/logger"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const geminiKey = await getGeminiKey()
    if (!geminiKey) {
      return NextResponse.json(
        { error: "API-ключ Gemini не настроен" },
        { status: 401 }
      )
    }

    const { prompt, style } = await request.json()

    if (!prompt) {
      return NextResponse.json(
        { error: "Не указан промпт" },
        { status: 400 }
      )
    }

    const enhancedPrompt = `Professional studio headshot portrait photo. ${prompt}. Ultra high quality, 8k resolution, professional photography, sharp focus, natural skin texture. ${
      style === "medical"
        ? "Clean white/light gray backdrop, medical professional aesthetic."
        : "Dark corporate backdrop, business professional aesthetic."
    }`

    let gemini3ErrorText = ""

    // 1) Gemini 3 Pro Image (Nano Banana Pro) — основная модель
    const gemini3Body = {
      contents: [
        {
          parts: [{ text: `Generate a professional portrait photo based on this description: ${enhancedPrompt}` }],
        },
      ],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: { aspectRatio: "3:4" },
      },
    }
    const gemini3Response = await fetchWithProxy(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gemini3Body),
      }
    )

    if (gemini3Response.ok) {
      const gemini3Data = await gemini3Response.json()
      const parts = gemini3Data.candidates?.[0]?.content?.parts
      if (parts) {
        for (const part of parts) {
          if (part.inlineData?.data) {
            const imageUrl = `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`
            return NextResponse.json({ imageUrl })
          }
        }
      }
    } else {
      gemini3ErrorText = await gemini3Response.text()
      logger.warn("GENERATE", "Gemini 3 Pro Image не вернул изображение", { status: gemini3Response.status, body: gemini3ErrorText.slice(0, 400) })
    }

    // 2) Imagen 3 (запасной вариант)
    const imagenResponse = await fetchWithProxy(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt: enhancedPrompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: "3:4",
            personGeneration: "allow_all",
          },
        }),
      }
    )

    if (imagenResponse.ok) {
      const imagenData = await imagenResponse.json()
      const imageBytes = imagenData.predictions?.[0]?.bytesBase64Encoded
      if (imageBytes) {
        return NextResponse.json({ imageUrl: `data:image/png;base64,${imageBytes}` })
      }
    }

    // Оба варианта не дали картинку — возвращаем ошибку от Gemini 3 или общую
    const lastError = gemini3ErrorText
    let userMessage = "Изображение не сгенерировано. Попробуйте другое фото или промпт."
    try {
      if (lastError) {
        const errJson = JSON.parse(lastError)
        const msg = errJson?.error?.message || errJson?.message
        if (msg) userMessage = msg
        if (/location is not supported|position|region|country not supported/i.test(String(msg))) {
          userMessage += " Смените сервер VPN на US/UK/DE."
        }
      }
    } catch {
      if (lastError.length < 300) userMessage = lastError
    }
    logger.error("GENERATE", "Ни Gemini 3 Pro Image, ни Imagen 3 не вернули изображение", { gemini3Status: gemini3Response.status })
    return NextResponse.json(
      { error: userMessage },
      { status: 500 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error("GENERATE", "Исключение при генерации", { error: message, stack: (error as Error)?.stack?.slice(0, 400) })
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? message : "Внутренняя ошибка при генерации" },
      { status: 500 }
    )
  }
}
