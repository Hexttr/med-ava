import { NextRequest, NextResponse } from "next/server"
import { getGeminiKey } from "@/lib/settings"
import { getAppSettings } from "@/lib/app-settings"
import { fetchWithProxy } from "@/lib/fetch-proxy"
import { logger } from "@/lib/logger"
import { checkRateLimit } from "@/lib/rate-limit"
import {
  getUniversalFraming,
  getMedicalInstruction,
  getCorporateInstruction,
  getNegativePrompt,
} from "@/lib/prompts"

export const runtime = "nodejs"
export const maxDuration = 60

function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request)
    const { allowed, remaining, resetIn } = checkRateLimit(`generate:${ip}`)
    if (!allowed) {
      return NextResponse.json(
        { error: `Превышен лимит запросов. Повторите через ${resetIn} сек.` },
        { status: 429, headers: { "Retry-After": String(resetIn) } }
      )
    }

    const geminiKey = await getGeminiKey()
    if (!geminiKey) {
      return NextResponse.json(
        { error: "API-ключ Gemini не настроен" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { prompt, style, referencePhotoBase64, referencePhotoMimeType } = body as {
      prompt?: string
      style?: string
      referencePhotoBase64?: string
      referencePhotoMimeType?: string
    }

    if (!prompt) {
      return NextResponse.json(
        { error: "Не указан промпт" },
        { status: 400 }
      )
    }

    const appSettings = getAppSettings()
    const backgroundMedical = appSettings.backgroundMedical.trim()
    const backgroundCorporate = appSettings.backgroundCorporate.trim()
    const defaultBackdropMedical = "Clean, well-lit studio backdrop in light gray or white."
    const defaultBackdropCorporate = "Clean corporate background in dark navy or charcoal gray."
    const backdropMedical = backgroundMedical ? `Background: ${backgroundMedical}` : defaultBackdropMedical
    const backdropCorporate = backgroundCorporate ? `Background: ${backgroundCorporate}` : defaultBackdropCorporate

    const universalFraming = getUniversalFraming()
    const medicalInstruction = getMedicalInstruction(backdropMedical)
    const corporateInstruction = getCorporateInstruction(backdropCorporate)
    const settingInstruction =
      style === "medical"
        ? `${universalFraming} ${medicalInstruction}`
        : `${universalFraming} ${corporateInstruction}`

    const negativePrompt = getNegativePrompt()
    const negativeSuffix = negativePrompt ? ` ${negativePrompt}` : ""

    const hasReferencePhoto = Boolean(referencePhotoBase64?.trim())

    const geminiImagePrompt = hasReferencePhoto
      ? `The attached image is the REFERENCE PHOTO of the person. Your task: generate ONE professional studio portrait photo of THIS EXACT SAME PERSON — the face must be the same person, same identity, same likeness. Do NOT change the face, do NOT generate a different person. Only change the setting and clothing as follows: ${settingInstruction}. Keep the person's face, skin tone, hair, and all facial features identical to the reference.${negativeSuffix} Output the generated portrait image.`
      : `Professional studio portrait photo. ${universalFraming} ${prompt}. CRITICAL: The face in the image MUST match the person described above exactly. Ultra high quality, 8k resolution, professional photography, sharp focus, natural skin texture. ${
          style === "medical"
            ? (backgroundMedical ? `${backdropMedical} Medical professional aesthetic.` : "Clean white/light gray backdrop, medical professional aesthetic.")
            : (backgroundCorporate ? `${backdropCorporate} Business professional aesthetic.` : "Dark corporate backdrop, business professional aesthetic.")
        }${negativeSuffix}`

    let gemini3ErrorText = ""

    const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = []
    if (hasReferencePhoto) {
      parts.push({
        inlineData: {
          mimeType: referencePhotoMimeType || "image/jpeg",
          data: referencePhotoBase64!.replace(/^data:image\/\w+;base64,/, ""),
        },
      })
    }
    parts.push({ text: `Generate a professional portrait photo. ${geminiImagePrompt}` })

    // 1) Gemini 3 Pro Image (Nano Banana Pro) — основная модель
    const gemini3Body = {
      contents: [{ parts }],
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

    // 2) Imagen 3 (запасной вариант; не поддерживает эталонное фото — только текст)
    const imagenPrompt = `Professional studio portrait photo. ${universalFraming} ${prompt}. Ultra high quality, 8k resolution, professional photography, sharp focus, natural skin texture. ${
      style === "medical"
        ? (backgroundMedical ? `${backdropMedical} Medical professional aesthetic.` : "Clean white/light gray backdrop, medical professional aesthetic.")
        : (backgroundCorporate ? `${backdropCorporate} Business professional aesthetic.` : "Dark corporate backdrop, business professional aesthetic.")
    }${negativeSuffix}`
    const imagenResponse = await fetchWithProxy(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt: imagenPrompt }],
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
