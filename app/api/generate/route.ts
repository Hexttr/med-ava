import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import { getGeminiKey } from "@/lib/settings"
import { getAppSettings } from "@/lib/app-settings"
import { applyOverlayLogo, getAbsolutePath } from "@/lib/storage"
import { fetchWithProxy } from "@/lib/fetch-proxy"
import { logger } from "@/lib/logger"
import { checkRateLimit } from "@/lib/rate-limit"
import { enforceTrustedOrigin, getClientIp } from "@/lib/request-security"
import {
  getUniversalFraming,
  getMedicalInstruction,
  getCorporateInstruction,
  getNegativePrompt,
} from "@/lib/prompts"
import { preprocessForGemini } from "@/lib/image-preprocess"

export const runtime = "nodejs"
export const maxDuration = 60

const PRIMARY_MODEL_ATTEMPTS = 3
const RETRY_DELAY_MS = 500
const HARD_FRAMING_RULES =
  "STRICT FRAMING RULES: vertical 3:4 studio portrait only. Head and upper torso only, bust-length, both shoulders visible. The head must occupy about 30-35% of the full image height. Eye line should sit around 38-42% from the top edge. Keep identical camera distance, identical crop, and identical head-to-body scale across all portraits. Do not crop tighter, do not zoom wider, do not show full body, hands, or waist."
const BACKGROUND_REFERENCE_RULES =
  "Treat the second image as a BACKGROUND REFERENCE PLATE, not as a literal pasted layer. Recreate the same scene naturally with matching palette, depth, perspective, softness, and lighting direction, but the final portrait must look like one coherent professional photograph. Avoid any cutout, pasted, or composited look."

type GenerateModelResult =
  | { ok: true; imageUrl: string }
  | { ok: false; status?: number; errorText: string }

export async function POST(request: NextRequest) {
  try {
    const originError = enforceTrustedOrigin(request)
    if (originError) return originError

    const ip = getClientIp(request)
    const { allowed, resetIn } = checkRateLimit(`generate:${ip}`)
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
    void referencePhotoMimeType

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
        const processed = await preprocessForGemini(buf, { mode: "background-reference" })
        backdropMedicalImageBase64 = processed.base64
        backdropMedicalMime = processed.mimeType
      } catch {
        logger.warn("GENERATE", "Не удалось прочитать фон медицинского портрета", { path: bgMedicalImagePath })
      }
    }
    if (hasCorporateImage) {
      try {
        const fullPath = getAbsolutePath(bgCorporateImagePath)
        const buf = await fs.readFile(fullPath)
        const processed = await preprocessForGemini(buf, { mode: "background-reference" })
        backdropCorporateImageBase64 = processed.base64
        backdropCorporateMime = processed.mimeType
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
      geminiImagePrompt = `The FIRST attached image is the REFERENCE PHOTO of the person. The SECOND attached image is the BACKGROUND REFERENCE PLATE for the final scene. Your task: generate ONE professional studio portrait photo of THIS EXACT SAME PERSON. CRITICAL IDENTITY: the face must remain identical — same person, same identity, maximum likeness. Do NOT change the face, do NOT generate a different person. Preserve every facial detail: skin tone, hair, eyes, nose, mouth, and distinctive features. Mouth closed, lips together. ${BACKGROUND_REFERENCE_RULES} ${HARD_FRAMING_RULES} ${settingInstruction}. Clothing must look premium and high-quality. Use soft, physically believable transitions between the person and the background. Output the generated portrait image.${negativeSuffix}`
    } else if (useBackgroundImage && !hasReferencePhoto) {
      geminiImagePrompt = `The attached image is the BACKGROUND REFERENCE PLATE for the final scene. Generate ONE professional studio portrait photo. ${BACKGROUND_REFERENCE_RULES} ${HARD_FRAMING_RULES} ${universalFraming} ${prompt}. Clothing must look premium and high-quality. Ultra high quality, professional photography, sharp focus, natural skin texture. Output the generated portrait image.${negativeSuffix}`
    } else if (hasReferencePhoto) {
      geminiImagePrompt = `The attached image is the REFERENCE PHOTO of the person. Your task: generate ONE professional studio portrait photo of THIS EXACT SAME PERSON. CRITICAL IDENTITY: the face must remain identical — same person, maximum likeness. Do NOT change the face, do NOT generate a different person. Preserve every facial detail: skin tone, hair, eyes, nose, mouth, and distinctive features. Mouth closed, lips together. ${HARD_FRAMING_RULES} Only change the setting and clothing as follows: ${settingInstruction}. Clothing must look premium and high-quality. Keep the person's face identical to the reference. Output the generated portrait image.${negativeSuffix}`
    } else {
      geminiImagePrompt = `Professional studio portrait photo. ${HARD_FRAMING_RULES} ${universalFraming} ${prompt}. CRITICAL IDENTITY: The face MUST match the person described above exactly — maximum likeness, same person. Ultra high quality, professional photography, sharp focus, natural skin texture. Clothing must look premium and high-quality. ${
        style === "medical"
          ? (backgroundMedical ? `${backdropMedical} Medical professional aesthetic.` : "Clean white/light gray backdrop, medical professional aesthetic.")
          : (backgroundCorporate ? `${backdropCorporate} Business professional aesthetic.` : "Medium gray corporate backdrop, business professional aesthetic.")
      }${negativeSuffix}`
    }

    const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = []
    if (hasReferencePhoto) {
      const rawBase64 = referencePhotoBase64!.replace(/^data:image\/\w+;base64,/, "")
      const buffer = Buffer.from(rawBase64, "base64")
      const { base64, mimeType } = await preprocessForGemini(buffer, { mode: "portrait-reference" })
      parts.push({
        inlineData: { mimeType, data: base64 },
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

    async function generateWithModel(model: string, attempts: number): Promise<GenerateModelResult> {
      let lastStatus: number | undefined
      let lastErrorText = ""

      for (let attempt = 1; attempt <= attempts; attempt++) {
        const response = await fetchWithProxy(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(geminiBody),
          }
        )

        if (response.ok) {
          const geminiData = await response.json()
          const responseParts = geminiData.candidates?.[0]?.content?.parts
          if (responseParts) {
            for (const part of responseParts) {
              if (part.inlineData?.data) {
                let imageUrl = `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`
                try {
                  imageUrl = await applyOverlayLogo(imageUrl, appSettings)
                } catch (error) {
                  logger.warn("GENERATE", "Не удалось наложить логотип поверх изображения", {
                    model,
                    attempt,
                    error: error instanceof Error ? error.message : String(error),
                  })
                }
                logger.info("GENERATE", "Изображение сгенерировано", { style, model, attempt })
                return { ok: true, imageUrl }
              }
            }
          }

          lastStatus = response.status
          lastErrorText = "Модель не вернула изображение"
          logger.warn("GENERATE", "Модель не вернула изображение, повторяем запрос", {
            model,
            attempt,
          })
        } else {
          lastStatus = response.status
          lastErrorText = await response.text()
          logger.warn("GENERATE", "Модель генерации вернула ошибку", {
            model,
            attempt,
            status: response.status,
            body: lastErrorText.slice(0, 400),
          })
        }

        if (attempt < attempts) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt))
        }
      }

      return { ok: false, status: lastStatus, errorText: lastErrorText }
    }

    const primaryResult = await generateWithModel(modelGeneration, PRIMARY_MODEL_ATTEMPTS)
    if (primaryResult.ok) {
      return NextResponse.json({ imageUrl: primaryResult.imageUrl })
    }

    // 2) Fallback: gemini-2.5-flash-image (тот же API generateContent)
    const fallbackModel = "gemini-2.5-flash-image"
    let finalErrorText = primaryResult.errorText
    let finalStatus = primaryResult.status

    if (modelGeneration !== fallbackModel) {
      logger.warn("GENERATE", "Переходим на fallback после неудачных попыток основной модели", {
        model: modelGeneration,
        attempts: PRIMARY_MODEL_ATTEMPTS,
      })

      const fallbackResult = await generateWithModel(fallbackModel, 1)
      if (fallbackResult.ok) {
        logger.info("GENERATE", "Изображение сгенерировано через fallback", { style, model: fallbackModel })
        return NextResponse.json({ imageUrl: fallbackResult.imageUrl })
      }

      finalErrorText = fallbackResult.errorText || finalErrorText
      finalStatus = fallbackResult.status ?? finalStatus
    }

    // Оба варианта не дали картинку — возвращаем ошибку
    const lastError = finalErrorText
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
    logger.error("GENERATE", "Ни выбранная модель, ни fallback не вернули изображение", {
      model: modelGeneration,
      geminiStatus: finalStatus,
      primaryAttempts: PRIMARY_MODEL_ATTEMPTS,
    })
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
