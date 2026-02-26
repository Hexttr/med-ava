import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { getGeminiKey } from "@/lib/settings"
import { getAppSettings } from "@/lib/app-settings"
import { getAbsolutePath } from "@/lib/storage"
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
    const modelGeneration = appSettings.modelGeneration || "gemini-3-pro-image-preview"
    const defaultBackdropMedical = "Clean, well-lit studio backdrop in light gray or white."
    const defaultBackdropCorporate = "Clean corporate background in medium gray or soft slate, well-lit."

    // Приоритет: изображение > текст > базовые настройки
    const bgMedicalImagePath = appSettings.backgroundMedicalImage?.trim()
    const bgCorporateImagePath = appSettings.backgroundCorporateImage?.trim()
    const backgroundMedical = appSettings.backgroundMedical.trim()
    const backgroundCorporate = appSettings.backgroundCorporate.trim()

    const hasMedicalImage = Boolean(bgMedicalImagePath)
    const hasCorporateImage = Boolean(bgCorporateImagePath)
    let backdropMedicalImageBase64: string | null = null
    let backdropCorporateImageBase64: string | null = null
    let backdropMedicalMime = "image/jpeg"
    let backdropCorporateMime = "image/jpeg"

    if (hasMedicalImage) {
      try {
        const fullPath = getAbsolutePath(bgMedicalImagePath)
        const buf = await fs.readFile(fullPath)
        backdropMedicalImageBase64 = buf.toString("base64")
        const ext = path.extname(fullPath).toLowerCase()
        backdropMedicalMime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg"
      } catch {
        logger.warn("GENERATE", "Не удалось прочитать фон медицинского портрета", { path: bgMedicalImagePath })
      }
    }
    if (hasCorporateImage) {
      try {
        const fullPath = getAbsolutePath(bgCorporateImagePath)
        const buf = await fs.readFile(fullPath)
        backdropCorporateImageBase64 = buf.toString("base64")
        const ext = path.extname(fullPath).toLowerCase()
        backdropCorporateMime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg"
      } catch {
        logger.warn("GENERATE", "Не удалось прочитать фон корпоративного портрета", { path: bgCorporateImagePath })
      }
    }

    const useMedicalImage = style === "medical" && backdropMedicalImageBase64
    const useCorporateImage = style === "corporate" && backdropCorporateImageBase64
    const useBackgroundImage = useMedicalImage || useCorporateImage

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

    let geminiImagePrompt: string
    if (useBackgroundImage && hasReferencePhoto) {
      geminiImagePrompt = `The FIRST attached image is the REFERENCE PHOTO of the person. The SECOND attached image is the BACKGROUND to use. Your task: generate ONE professional studio portrait photo of THIS EXACT SAME PERSON placed onto this exact background. CRITICAL IDENTITY: The face must be identical — same person, same identity, maximum likeness. Do NOT change the face, do NOT generate a different person. Preserve every facial detail: skin tone, hair, eyes, nose, mouth, any distinctive features. Place the person naturally and seamlessly onto the provided background — match lighting direction and color temperature, cast appropriate soft shadows, ensure correct scale and perspective, blend edges naturally (no cutout/pasted look). ${settingInstruction}. Use identical portrait framing: head and upper torso only, bust-length, shoulders visible — same crop for both medical and corporate styles. Clothing must look premium and high-quality.${negativeSuffix} Output the generated portrait image.`
    } else if (useBackgroundImage && !hasReferencePhoto) {
      geminiImagePrompt = `The attached image is the BACKGROUND to use. Generate ONE professional studio portrait photo. ${universalFraming} ${prompt}. Place the person described in the prompt onto this exact background — match lighting, cast natural shadows, correct scale. Clothing must look premium and high-quality. Ultra high quality, 8k resolution, professional photography, sharp focus, natural skin texture.${negativeSuffix} Output the generated portrait image.`
    } else if (hasReferencePhoto) {
      geminiImagePrompt = `The attached image is the REFERENCE PHOTO of the person. Your task: generate ONE professional studio portrait photo of THIS EXACT SAME PERSON. CRITICAL IDENTITY: The face must be identical — same person, maximum likeness. Do NOT change the face, do NOT generate a different person. Preserve every facial detail: skin tone, hair, eyes, nose, mouth, any distinctive features. Only change the setting and clothing as follows: ${settingInstruction}. Clothing must look premium and high-quality. Keep the person's face identical to the reference.${negativeSuffix} Output the generated portrait image.`
    } else {
      geminiImagePrompt = `Professional studio portrait photo. ${universalFraming} ${prompt}. CRITICAL IDENTITY: The face MUST match the person described above exactly — maximum likeness, same person. Ultra high quality, 8k resolution, professional photography, sharp focus, natural skin texture. Clothing must look premium and high-quality. ${
        style === "medical"
          ? (backgroundMedical ? `${backdropMedical} Medical professional aesthetic.` : "Clean white/light gray backdrop, medical professional aesthetic.")
          : (backgroundCorporate ? `${backdropCorporate} Business professional aesthetic.` : "Medium gray corporate backdrop, business professional aesthetic.")
      }${negativeSuffix}`
    }

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
    if (useBackgroundImage) {
      const bgData = useMedicalImage ? backdropMedicalImageBase64! : backdropCorporateImageBase64!
      const bgMime = useMedicalImage ? backdropMedicalMime : backdropCorporateMime
      parts.push({
        inlineData: { mimeType: bgMime, data: bgData },
      })
    }
    parts.push({ text: `Generate a professional portrait photo. ${geminiImagePrompt}` })

    const geminiBody = {
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: { aspectRatio: "3:4" },
      },
    }
    const geminiResponse = await fetchWithProxy(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelGeneration}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiBody),
      }
    )

    if (geminiResponse.ok) {
      const geminiData = await geminiResponse.json()
      const parts = geminiData.candidates?.[0]?.content?.parts
      if (parts) {
        for (const part of parts) {
          if (part.inlineData?.data) {
            const imageUrl = `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`
            logger.info("GENERATE", "Изображение сгенерировано", { style, model: modelGeneration })
            return NextResponse.json({ imageUrl })
          }
        }
      }
    } else {
      gemini3ErrorText = await geminiResponse.text()
      logger.warn("GENERATE", "Модель генерации не вернула изображение", { model: modelGeneration, status: geminiResponse.status, body: gemini3ErrorText.slice(0, 400) })
    }

    // 2) Fallback: gemini-2.5-flash-image (тот же API generateContent)
    const fallbackModel = "gemini-2.5-flash-image"
    if (modelGeneration !== fallbackModel) {
      const fallbackResponse = await fetchWithProxy(
        `https://generativelanguage.googleapis.com/v1beta/models/${fallbackModel}:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geminiBody),
        }
      )

      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json()
        const fallbackParts = fallbackData.candidates?.[0]?.content?.parts
        if (fallbackParts) {
          for (const part of fallbackParts) {
            if (part.inlineData?.data) {
              const imageUrl = `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`
              logger.info("GENERATE", "Изображение сгенерировано (fallback)", { style, model: fallbackModel })
              return NextResponse.json({ imageUrl })
            }
          }
        }
      }
    }

    // Оба варианта не дали картинку — возвращаем ошибку
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
    logger.error("GENERATE", "Ни выбранная модель, ни fallback не вернули изображение", { model: modelGeneration, geminiStatus: geminiResponse.status })
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
