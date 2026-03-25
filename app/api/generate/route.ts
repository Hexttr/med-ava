import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import { getGeminiKey } from "@/lib/settings"
import { getAppSettings } from "@/lib/app-settings"
import { applyOverlayLogo, enhanceGeneratedPortrait, getAbsolutePath } from "@/lib/storage"
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
const SHARPNESS_RULES =
  "IMAGE QUALITY RULES: tack-sharp focus on the eyes, eyelashes, eyebrows, lips, and overall facial features. Preserve crisp hair strands, clean edge detail, natural skin texture, and realistic micro-contrast. The final portrait must look sharply resolved and professionally photographed, without soft-focus haze or smeared details."
const STUDIO_FINISH_RULES =
  "PORTRAIT FINISH RULES: preserve a premium glossy studio portrait look with polished commercial/editorial quality. Use controlled studio-grade lighting on the subject: soft directional key light, balanced fill, subtle rim separation, clean catchlights, refined tonal contrast, and elegant depth. The person must look intentionally photographed in a high-end studio setup, not casually blended into the environment."
const BACKGROUND_REFERENCE_RULES =
  "Treat the second image as a BACKGROUND REFERENCE PLATE, not as a literal pasted layer. Recreate the same scene naturally with matching palette, depth, perspective, softness, and lighting direction, but the final portrait must look like one coherent professional photograph. Avoid any cutout, pasted, or composited look."
const BACKGROUND_PRIORITY_RULES =
  "FACIAL PRIORITY RULES: facial fidelity, eye clarity, and facial sharpness are more important than exact background matching. If needed, simplify or approximate the background to preserve a crisp, clean, sharply resolved face. Never sacrifice facial detail for scene fidelity."
const BACKGROUND_INTEGRATION_RULES =
  "SCENE INTEGRATION RULES: use the background plate only to infer environment, perspective, palette, and plausible ambient light direction. Do not let ambient scene lighting flatten the face or remove studio contrast. Keep the subject lit like a premium studio portrait while subtly harmonizing with the scene."
const BACKGROUND_REQUIRED_RULES =
  "BACKGROUND PRESENCE RULES: the final image must visibly use the supplied background scene or a faithful recreation of it. Do not replace it with a generic plain studio backdrop. Preserve recognizable scene character, palette, depth, and environment cues from the background plate."
const BACKGROUND_ANALYSIS_PROMPT =
  "Analyze this portrait background plate for scene integration. Describe in concise professional English: environment type, camera perspective, background depth, likely subject placement, main light direction, light softness, color temperature, brightest areas, likely shadow direction, reflective surfaces, and how a photographed person should be lit to fit naturally into this scene. Keep it compact and practical for image generation."

type GenerateModelResult =
  | { ok: true; imageUrl: string }
  | { ok: false; status?: number; errorText: string }

async function analyzeBackgroundScene(
  geminiKey: string,
  model: string,
  mimeType: string,
  base64: string
): Promise<string> {
  try {
    const response = await fetchWithProxy(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: BACKGROUND_ANALYSIS_PROMPT },
              { inlineData: { mimeType, data: base64 } },
            ],
          }],
          generationConfig: {
            temperature: 0.2,
            topP: 0.8,
            maxOutputTokens: 256,
          },
        }),
      }
    )

    if (!response.ok) {
      logger.warn("GENERATE", "Не удалось проанализировать background plate", {
        model,
        status: response.status,
      })
      return ""
    }

    const payload = await response.json()
    const text = payload.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join(" ")
      .trim()

    return text || ""
  } catch (error) {
    logger.warn("GENERATE", "Ошибка анализа background plate", {
      model,
      error: error instanceof Error ? error.message : String(error),
    })
    return ""
  }
}

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
    const modelAnalysis = appSettings.modelAnalysis || "gemini-2.5-flash"
    const backgroundMode = appSettings.backgroundMode === "image" ? "image" : "description"
    const defaultBackdropMedical = "Clean, well-lit studio backdrop in light gray or white."
    const defaultBackdropCorporate = "Clean corporate background in medium gray or soft slate, well-lit."

    // Приоритет: изображение > текст > базовые настройки
    const bgMedicalImagePath = appSettings.backgroundMedicalImage?.trim()
    const bgCorporateImagePath = appSettings.backgroundCorporateImage?.trim()
    const backgroundMedical = appSettings.backgroundMedical.trim()
    const backgroundCorporate = appSettings.backgroundCorporate.trim()

    const hasMedicalImage = backgroundMode === "image" && Boolean(bgMedicalImagePath)
    const hasCorporateImage = backgroundMode === "image" && Boolean(bgCorporateImagePath)
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
    let backgroundSceneAnalysis = ""

    if (useBackgroundImage) {
      try {
        const selectedBackgroundPath = style === "medical" ? bgMedicalImagePath : bgCorporateImagePath
        if (selectedBackgroundPath) {
          const backgroundBuffer = await fs.readFile(getAbsolutePath(selectedBackgroundPath))
          const processedSceneBackground = await preprocessForGemini(backgroundBuffer)
          backgroundSceneAnalysis = await analyzeBackgroundScene(
            geminiKey,
            modelAnalysis,
            processedSceneBackground.mimeType,
            processedSceneBackground.base64
          )
        }
      } catch (error) {
        logger.warn("GENERATE", "Не удалось подготовить scene analysis для background plate", {
          style,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

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
    const backgroundSceneSuffix = backgroundSceneAnalysis
      ? ` BACKGROUND SCENE ANALYSIS: ${backgroundSceneAnalysis}`
      : ""

    const hasReferencePhoto = Boolean(referencePhotoBase64?.trim())

    let geminiImagePrompt: string
    if (useBackgroundImage && hasReferencePhoto) {
      geminiImagePrompt = `The FIRST attached image is the REFERENCE PHOTO of the person. The SECOND attached image is the BACKGROUND REFERENCE PLATE for the final scene. Your task: generate ONE professional studio portrait photo of THIS EXACT SAME PERSON. CRITICAL IDENTITY: the face must remain identical — same person, same identity, maximum likeness. Do NOT change the face, do NOT generate a different person. Preserve every facial detail: skin tone, hair, eyes, nose, mouth, and distinctive features. Mouth closed, lips together. ${BACKGROUND_REFERENCE_RULES} ${BACKGROUND_PRIORITY_RULES} ${BACKGROUND_INTEGRATION_RULES} ${BACKGROUND_REQUIRED_RULES} ${HARD_FRAMING_RULES} ${SHARPNESS_RULES} ${STUDIO_FINISH_RULES}${backgroundSceneSuffix} ${settingInstruction}. Clothing must look premium and high-quality. Use soft, physically believable transitions between the person and the background. Harmonize with the inferred scene lighting and shadow behavior, but preserve premium studio lighting on the face, clean facial modeling, and glossy commercial portrait contrast. Output the generated portrait image.${negativeSuffix}`
    } else if (useBackgroundImage && !hasReferencePhoto) {
      geminiImagePrompt = `The attached image is the BACKGROUND REFERENCE PLATE for the final scene. Generate ONE professional studio portrait photo. ${BACKGROUND_REFERENCE_RULES} ${BACKGROUND_PRIORITY_RULES} ${BACKGROUND_INTEGRATION_RULES} ${BACKGROUND_REQUIRED_RULES} ${HARD_FRAMING_RULES} ${SHARPNESS_RULES} ${STUDIO_FINISH_RULES}${backgroundSceneSuffix} ${universalFraming} ${prompt}. Clothing must look premium and high-quality. Ultra high quality, professional photography, sharp focus, natural skin texture. Harmonize with the inferred scene lighting and shadow behavior, but preserve premium studio lighting on the face, clean facial modeling, and glossy commercial portrait contrast. Output the generated portrait image.${negativeSuffix}`
    } else if (hasReferencePhoto) {
      geminiImagePrompt = `The attached image is the REFERENCE PHOTO of the person. Your task: generate ONE professional studio portrait photo of THIS EXACT SAME PERSON. CRITICAL IDENTITY: the face must remain identical — same person, maximum likeness. Do NOT change the face, do NOT generate a different person. Preserve every facial detail: skin tone, hair, eyes, nose, mouth, and distinctive features. Mouth closed, lips together. ${HARD_FRAMING_RULES} ${SHARPNESS_RULES} ${STUDIO_FINISH_RULES} Only change the setting and clothing as follows: ${settingInstruction}. Clothing must look premium and high-quality. Keep the person's face identical to the reference. Output the generated portrait image.${negativeSuffix}`
    } else {
      geminiImagePrompt = `Professional studio portrait photo. ${HARD_FRAMING_RULES} ${SHARPNESS_RULES} ${STUDIO_FINISH_RULES} ${universalFraming} ${prompt}. CRITICAL IDENTITY: The face MUST match the person described above exactly — maximum likeness, same person. Ultra high quality, professional photography, sharp focus, natural skin texture. Clothing must look premium and high-quality. ${
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
                  imageUrl = await enhanceGeneratedPortrait(imageUrl)
                } catch (error) {
                  logger.warn("GENERATE", "Не удалось усилить финальное изображение после генерации", {
                    model,
                    attempt,
                    error: error instanceof Error ? error.message : String(error),
                  })
                }
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
