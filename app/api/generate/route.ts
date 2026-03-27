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
const NO_IMAGE_ERROR = "Модель не вернула изображение"
const SHARPNESS_RULES =
  "IMAGE QUALITY RULES: tack-sharp focus on the eyes, eyelashes, eyebrows, lips, and overall facial features. Preserve crisp hair strands, clean edge detail, natural skin texture, and realistic micro-contrast. The final portrait must look sharply resolved and professionally photographed, without soft-focus haze or smeared details."
const STUDIO_FINISH_RULES =
  "PORTRAIT FINISH RULES: preserve a premium glossy studio portrait look with polished commercial/editorial quality. Use controlled studio-grade lighting on the subject: soft directional key light, balanced fill, subtle rim separation, clean catchlights, refined tonal contrast, and elegant depth. The person must look intentionally photographed in a high-end studio setup, not casually blended into the environment."
const FACE_RELIGHT_RULES =
  "FACE RE-RENDER RULES: preserve the person's identity and natural skin tone, but re-render the face as a fresh studio portrait with new facial lighting, new tonal modeling, new shadows, new highlights, and new photographic depth. Do not keep the flat source-photo lighting, source exposure balance, raw facial tonality, or original phone-camera shading pattern."
const GLASSES_CLARITY_RULES =
  "GLASSES RULES: if the person wears glasses, preserve the frame shape, size, fit, and overall style as part of the identity. However, re-render the lenses as clean, transparent, and optically clear. Remove glare, flash hotspots, opaque reflections, muddy tint, haze, or any reflections that hide the eyes. Both eyes must remain clearly visible through the glasses unless the original eyewear is intentionally opaque."
const PRIORITY_ORDER_RULES =
  "PRIORITY ORDER: exact identity and recognizability come first; sharp eyes and facial detail second; stable waist-up framing third; believable premium clothing fourth; recognizable scene usage fifth; exact plate matching last."
const IDENTITY_USAGE_RULES =
  "IDENTITY ANCHOR RULES: use the supplied identity anchors as immutable guidance for facial structure, age impression, hair, eyes, skin tone, and distinctive traits. Preserve those anchors together with the reference photo. Do not invent or add moles, freckles, beauty marks, acne, blemishes, or any other facial skin marks unless they are clearly visible in the reference photo or explicitly present in the identity anchors."
const REPHOTOGRAPH_RULES =
  "RE-PHOTOGRAPH RULES: treat the reference photo as identity guidance only. Re-photograph the same person from scratch as a newly rendered professional portrait. Do not preserve the exact source pixels, exact source lighting, original neckline crop, original clothing folds, or raw background remnants."
const ANTI_TRANSPLANT_RULES =
  "ANTI-TRANSPLANT RULES: never perform a simple background swap, pasted cutout, source-photo transplant, or unchanged face/body insertion. The final result must be a fully re-rendered coherent photograph of the same person in the requested styling."
const MEDICAL_RESTYLE_RULES =
  "MEDICAL RESTYLE RULES: for medical portraits, fully regenerate the shoulders, torso, neckline, collar, chest area, sleeve openings, and coat structure as a new doctor's coat. Do not preserve any non-medical source clothing, original blouse/shirt, zipper, seam line, trim, or copied garment silhouette from the reference."
const SECOND_PASS_REWRITE_RULES =
  "RETRY CORRECTION: the previous attempt was too close to the source image or looked composited. Start over and synthesize a fresh portrait of the same person with newly rendered clothing, torso, facial shading, edges, and lighting integration."
const FINAL_PASS_REWRITE_RULES =
  "FINAL RETRY CORRECTION: absolutely avoid preserving the raw source composition. The result must look like a newly photographed portrait session of the same person, not an edited source image."
const MEDICAL_RETRY_RULES =
  "MEDICAL RETRY CORRECTION: the previous medical attempt preserved too much of the source outfit or torso. Regenerate the medical coat, neckline, chest, shoulders, and upper body from scratch so the wardrobe change is obvious and complete."
const FACE_RETRY_RULES =
  "FACE RETRY CORRECTION: the previous attempt preserved too much of the source facial tonality or raw lighting. Rebuild the face with fresh studio-grade lighting and new tonal modeling while keeping the same identity."
const FRAMING_EXPANSION_RULES =
  "FRAMING EXPANSION RULES: if the reference photo is cropped too tightly, expand the composition naturally to a consistent waist-up portrait instead of copying the tight shoulder crop. Maintain the same person and head scale while revealing more torso below the chest."
const BACKGROUND_REFERENCE_RULES =
  "Treat the second image as a BACKGROUND REFERENCE PLATE, not as a literal pasted layer. Recreate the same scene naturally with matching palette, depth, perspective, softness, and lighting direction, but the final portrait must look like one coherent professional photograph. Avoid any cutout, pasted, or composited look."
const BACKGROUND_PRIORITY_RULES =
  "FACIAL PRIORITY RULES: facial fidelity, eye clarity, and facial sharpness are more important than exact background matching. If needed, simplify or approximate the background to preserve a crisp, clean, sharply resolved face. Never sacrifice facial detail for scene fidelity."
const BACKGROUND_INTEGRATION_RULES =
  "SCENE INTEGRATION RULES: use the background plate only to infer environment, perspective, palette, and plausible ambient light direction. Do not let ambient scene lighting flatten the face or remove studio contrast. Keep the subject lit like a premium studio portrait while subtly harmonizing with the scene."
const BACKGROUND_REQUIRED_RULES =
  "BACKGROUND PRESENCE RULES: the final image must visibly use the supplied background scene or a faithful recreation of it. Do not replace it with a generic plain studio backdrop. Preserve recognizable scene character, palette, depth, and environment cues from the background plate."
const IMAGE_BACKGROUND_BACKDROP =
  "Use the supplied background reference plate as the actual final background environment. Do not substitute a generic studio backdrop."
const BACKGROUND_ANALYSIS_PROMPT =
  "Analyze this portrait background plate for scene integration. Describe in concise professional English: environment type, camera perspective, background depth, likely subject placement, main light direction, light softness, color temperature, brightest areas, likely shadow direction, reflective surfaces, and how a photographed person should be lit to fit naturally into this scene. Keep it compact and practical for image generation."
const SIMPLE_MEDICAL_INSTRUCTION =
  "Dress the person in a realistic premium white doctor's coat and keep the result clean, believable, and photographic."
const SIMPLE_CORPORATE_INSTRUCTION =
  "Dress the person in realistic premium business attire and keep the result clean, believable, and photographic."
const SIMPLE_BACKGROUND_RULES =
  "SIMPLE BACKGROUND RULES: if a background reference image is attached, preserve its overall environment type, palette, depth impression, and broad light direction, but simplify fine background detail whenever needed for a stable realistic portrait. Keep the result visibly related to the background reference, but prioritize facial realism, identity, clean edges, and coherent lighting over exact scene reconstruction. Avoid plain generic backdrops unless absolutely necessary."

type PromptVariant = "full" | "simple"

type GenerateModelResult =
  | { ok: true; imageUrl: string }
  | { ok: false; status?: number; errorText: string; reason: "no-image" | "error" }

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
    const defaultBackdropCorporate = "Clean professional studio backdrop with a smooth medium-gray to charcoal-gray gradient, neutral and elegant, not too bright."

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

    const backdropMedical = useMedicalImage
      ? IMAGE_BACKGROUND_BACKDROP
      : backgroundMedical
        ? `Background: ${backgroundMedical}`
        : defaultBackdropMedical
    const backdropCorporate = useCorporateImage
      ? IMAGE_BACKGROUND_BACKDROP
      : backgroundCorporate
        ? `Background: ${backgroundCorporate}`
        : defaultBackdropCorporate

    const identityAnchors = prompt.trim()
    const framingInstruction = getUniversalFraming()
    const settingInstruction =
      style === "medical"
        ? getMedicalInstruction(backdropMedical)
        : getCorporateInstruction(backdropCorporate, identityAnchors)

    const negativePrompt = getNegativePrompt()
    const styleNegativeSuffix = style === "medical"
      ? " Avoid: original source blouse, original shirt collar, original neckline, original zipper, original garment trim, copied chest folds, copied torso silhouette, or unchanged civilian clothing under the medical look."
      : ""
    const negativeSuffix = negativePrompt
      ? ` ${negativePrompt} Avoid: unchanged source photo, direct background replacement, source image transplant, copied cutout edges, copied original clothing, copied original lighting, copied raw facial tonality, copied source exposure balance, or a minimally edited source portrait.${styleNegativeSuffix}`
      : ` Avoid: unchanged source photo, direct background replacement, source image transplant, copied cutout edges, copied original clothing, copied original lighting, copied raw facial tonality, copied source exposure balance, or a minimally edited source portrait.${styleNegativeSuffix}`
    const backgroundSceneSuffix = backgroundSceneAnalysis
      ? ` BACKGROUND SCENE ANALYSIS: ${backgroundSceneAnalysis}`
      : ""
    const identityAnchorsSuffix = identityAnchors
      ? ` IDENTITY ANCHORS: ${identityAnchors}`
      : ""

    const hasReferencePhoto = Boolean(referencePhotoBase64?.trim())
    const inlineParts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = []
    if (hasReferencePhoto) {
      const rawBase64 = referencePhotoBase64!.replace(/^data:image\/\w+;base64,/, "")
      const buffer = Buffer.from(rawBase64, "base64")
      const { base64, mimeType } = await preprocessForGemini(buffer, { mode: "portrait-reference" })
      inlineParts.push({
        inlineData: { mimeType, data: base64 },
      })
    }
    if (useBackgroundImage) {
      const bgData = useMedicalImage ? backdropMedicalImageBase64! : backdropCorporateImageBase64!
      const bgMime = useMedicalImage ? backdropMedicalMime : backdropCorporateMime
      inlineParts.push({
        inlineData: { mimeType: bgMime, data: bgData },
      })
    }

    function getAttemptCorrection(attempt: number): string {
      const medicalRetry = style === "medical" ? ` ${MEDICAL_RETRY_RULES}` : ""
      const faceRetry = ` ${FACE_RETRY_RULES}`
      if (attempt <= 1) return ""
      if (attempt === 2) return ` ${SECOND_PASS_REWRITE_RULES}${medicalRetry}${faceRetry}`
      return ` ${SECOND_PASS_REWRITE_RULES} ${FINAL_PASS_REWRITE_RULES}${medicalRetry}${faceRetry}`
    }

    function buildGeminiImagePrompt(attempt: number, variant: PromptVariant): string {
      const attemptCorrection = getAttemptCorrection(attempt)
      const styleTransformationRules = style === "medical" ? ` ${MEDICAL_RESTYLE_RULES}` : ""
      const simpleStyleInstruction = style === "medical" ? SIMPLE_MEDICAL_INSTRUCTION : SIMPLE_CORPORATE_INSTRUCTION
      const simpleTextBackdropInstruction = style === "medical"
        ? backdropMedical
        : backdropCorporate

      if (variant === "simple") {
        if (useBackgroundImage && hasReferencePhoto) {
          return `The FIRST attached image is the identity reference of the exact same person. The SECOND attached image is a background reference plate for the target scene. Re-generate this person as ONE highly realistic professional portrait with maximum realism and strong likeness. Preserve the same face, age impression, skin tone, hair, and eyewear frame/style. ${IDENTITY_USAGE_RULES} ${REPHOTOGRAPH_RULES} ${ANTI_TRANSPLANT_RULES}${identityAnchorsSuffix} ${framingInstruction} ${SHARPNESS_RULES} ${STUDIO_FINISH_RULES} ${FACE_RELIGHT_RULES} ${GLASSES_CLARITY_RULES} ${SIMPLE_BACKGROUND_RULES}${backgroundSceneSuffix} ${simpleStyleInstruction} Keep the composition simple, coherent, and photographic. Maintain a stable 3:4 waist-up portrait with both shoulders visible and hands out of frame. Keep the face highly realistic and let the background be a simplified but recognizable interpretation of the supplied scene.${attemptCorrection} Output only the generated portrait image.${negativeSuffix}`
        }
        if (useBackgroundImage && !hasReferencePhoto) {
          return `The attached image is a background reference plate for the target scene. Generate ONE highly realistic professional portrait of the described person with maximum realism and natural facial detail. ${IDENTITY_USAGE_RULES} ${REPHOTOGRAPH_RULES} ${ANTI_TRANSPLANT_RULES}${identityAnchorsSuffix} ${framingInstruction} ${SHARPNESS_RULES} ${STUDIO_FINISH_RULES} ${FACE_RELIGHT_RULES} ${GLASSES_CLARITY_RULES} ${SIMPLE_BACKGROUND_RULES}${backgroundSceneSuffix} ${simpleStyleInstruction} Keep the composition simple, coherent, and photographic. Maintain a stable 3:4 waist-up portrait with both shoulders visible and hands out of frame. Keep the person realistic and let the background be a simplified but recognizable interpretation of the supplied scene.${attemptCorrection}${negativeSuffix}`
        }
        if (hasReferencePhoto) {
          return `The attached image is the identity reference of the exact same person. Re-generate this person as ONE highly realistic professional portrait with maximum realism and strong likeness. Preserve the same face, age impression, skin tone, hair, and eyewear frame/style. ${IDENTITY_USAGE_RULES} ${REPHOTOGRAPH_RULES} ${ANTI_TRANSPLANT_RULES}${identityAnchorsSuffix} ${framingInstruction} ${SHARPNESS_RULES} ${STUDIO_FINISH_RULES} ${FACE_RELIGHT_RULES} ${GLASSES_CLARITY_RULES} ${simpleStyleInstruction} ${simpleTextBackdropInstruction} Keep the composition simple, coherent, and photographic. Use a clean professional background only if no specific backdrop was supplied. Keep a stable 3:4 waist-up portrait with both shoulders visible and hands out of frame.${attemptCorrection} Output only the generated portrait image.${negativeSuffix}`
        }
        return `Generate ONE highly realistic professional portrait of the described person with maximum realism and natural facial detail. ${IDENTITY_USAGE_RULES} ${REPHOTOGRAPH_RULES} ${ANTI_TRANSPLANT_RULES}${identityAnchorsSuffix} ${framingInstruction} ${SHARPNESS_RULES} ${STUDIO_FINISH_RULES} ${FACE_RELIGHT_RULES} ${GLASSES_CLARITY_RULES} ${simpleStyleInstruction} ${simpleTextBackdropInstruction} Keep the composition simple, coherent, and photographic. Use a clean professional background only if no specific backdrop was supplied. Keep a stable 3:4 waist-up portrait with both shoulders visible and hands out of frame.${attemptCorrection}${negativeSuffix}`
      }

      if (useBackgroundImage && hasReferencePhoto) {
        return `The FIRST attached image is the IDENTITY REFERENCE PHOTO of the person, not the final composition to preserve. The SECOND attached image is the BACKGROUND REFERENCE PLATE for the final scene. Your task: generate ONE professional studio portrait photo of THIS EXACT SAME PERSON. CRITICAL IDENTITY: the face must remain identical — same person, same identity, maximum likeness. Do NOT change the face, do NOT generate a different person. Preserve every facial detail: skin tone, hair, eyes, nose, mouth, and distinctive features. ${IDENTITY_USAGE_RULES} ${REPHOTOGRAPH_RULES} ${ANTI_TRANSPLANT_RULES}${styleTransformationRules}${identityAnchorsSuffix} ${PRIORITY_ORDER_RULES} ${FRAMING_EXPANSION_RULES} ${BACKGROUND_REFERENCE_RULES} ${BACKGROUND_PRIORITY_RULES} ${BACKGROUND_INTEGRATION_RULES} ${BACKGROUND_REQUIRED_RULES} ${framingInstruction} ${SHARPNESS_RULES} ${STUDIO_FINISH_RULES} ${FACE_RELIGHT_RULES} ${GLASSES_CLARITY_RULES}${backgroundSceneSuffix} ${settingInstruction}. Keep the subject framed as a consistent waist-up portrait with visible torso to around the upper waist, both shoulders visible, and hands out of frame. Use soft, physically believable transitions between the person and the background. Harmonize with the inferred scene lighting and shadow behavior, but preserve premium studio lighting on the face, clean facial modeling, and glossy commercial portrait contrast.${attemptCorrection} Output the generated portrait image.${negativeSuffix}`
      }
      if (useBackgroundImage && !hasReferencePhoto) {
        return `The attached image is the BACKGROUND REFERENCE PLATE for the final scene. Generate ONE professional studio portrait photo of the described person. ${IDENTITY_USAGE_RULES} ${REPHOTOGRAPH_RULES} ${ANTI_TRANSPLANT_RULES}${styleTransformationRules}${identityAnchorsSuffix} ${PRIORITY_ORDER_RULES} ${FRAMING_EXPANSION_RULES} ${BACKGROUND_REFERENCE_RULES} ${BACKGROUND_PRIORITY_RULES} ${BACKGROUND_INTEGRATION_RULES} ${BACKGROUND_REQUIRED_RULES} ${framingInstruction} ${SHARPNESS_RULES} ${STUDIO_FINISH_RULES} ${FACE_RELIGHT_RULES} ${GLASSES_CLARITY_RULES}${backgroundSceneSuffix} ${settingInstruction}. Keep the subject framed as a consistent waist-up portrait with visible torso to around the upper waist, both shoulders visible, and hands out of frame. Harmonize with the inferred scene lighting and shadow behavior, but preserve premium studio lighting on the face, clean facial modeling, and glossy commercial portrait contrast.${attemptCorrection} Output the generated portrait image.${negativeSuffix}`
      }
      if (hasReferencePhoto) {
        return `The attached image is the IDENTITY REFERENCE PHOTO of the person, not the final composition to copy. Your task: generate ONE professional studio portrait photo of THIS EXACT SAME PERSON. CRITICAL IDENTITY: the face must remain identical — same person, maximum likeness. Do NOT change the face, do NOT generate a different person. Preserve every facial detail: skin tone, hair, eyes, nose, mouth, and distinctive features. ${IDENTITY_USAGE_RULES} ${REPHOTOGRAPH_RULES} ${ANTI_TRANSPLANT_RULES}${styleTransformationRules}${identityAnchorsSuffix} ${PRIORITY_ORDER_RULES} ${FRAMING_EXPANSION_RULES} ${framingInstruction} ${SHARPNESS_RULES} ${STUDIO_FINISH_RULES} ${FACE_RELIGHT_RULES} ${GLASSES_CLARITY_RULES} Only change the setting and clothing as follows: ${settingInstruction}. Keep the subject framed as a consistent waist-up portrait with visible torso to around the upper waist, both shoulders visible, and hands out of frame. Keep the person's face identical to the reference.${attemptCorrection} Output the generated portrait image.${negativeSuffix}`
      }
      return `Professional studio portrait photo. ${IDENTITY_USAGE_RULES} ${REPHOTOGRAPH_RULES} ${ANTI_TRANSPLANT_RULES}${styleTransformationRules}${identityAnchorsSuffix} ${PRIORITY_ORDER_RULES} ${FRAMING_EXPANSION_RULES} ${framingInstruction} ${SHARPNESS_RULES} ${STUDIO_FINISH_RULES} ${FACE_RELIGHT_RULES} ${GLASSES_CLARITY_RULES} CRITICAL IDENTITY: The face MUST match the person described above exactly — maximum likeness, same person. Keep the subject framed as a consistent waist-up portrait with visible torso to around the upper waist, both shoulders visible, and hands out of frame. ${
        style === "medical"
          ? (backgroundMedical ? `${backdropMedical} Medical professional aesthetic.` : "Clean white/light gray backdrop, medical professional aesthetic.")
          : (backgroundCorporate ? `${backdropCorporate} Business professional aesthetic.` : "Medium-gray gradient corporate studio backdrop, business professional aesthetic.")
      }${attemptCorrection}${negativeSuffix}`
    }

    function buildGeminiBody(attempt: number, variant: PromptVariant) {
      const selectedInlineParts =
        variant === "simple"
          ? hasReferencePhoto && useBackgroundImage
            ? inlineParts.slice(0, 2)
            : hasReferencePhoto
              ? inlineParts.slice(0, 1)
              : inlineParts
          : inlineParts

      return {
        contents: [{
          parts: [
            ...selectedInlineParts,
            { text: `Generate a professional portrait photo. ${buildGeminiImagePrompt(attempt, variant)}` },
          ],
        }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: { aspectRatio: "3:4" },
        },
      }
    }

    async function generateWithModel(model: string, attempts: number, variant: PromptVariant = "full"): Promise<GenerateModelResult> {
      let lastStatus: number | undefined
      let lastErrorText = ""

      for (let attempt = 1; attempt <= attempts; attempt++) {
        const geminiBody = buildGeminiBody(attempt, variant)
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
                  imageUrl = await applyOverlayLogo(imageUrl, appSettings, style === "medical" || style === "corporate" ? style : undefined)
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
          lastErrorText = NO_IMAGE_ERROR
          logger.warn("GENERATE", "Модель не вернула изображение, повторяем запрос", {
            model,
            attempt,
            variant,
          })
        } else {
          lastStatus = response.status
          lastErrorText = await response.text()
          logger.warn("GENERATE", "Модель генерации вернула ошибку", {
            model,
            attempt,
            variant,
            status: response.status,
            body: lastErrorText.slice(0, 400),
          })
        }

        if (attempt < attempts) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt))
        }
      }

      return {
        ok: false,
        status: lastStatus,
        errorText: lastErrorText,
        reason: lastErrorText === NO_IMAGE_ERROR ? "no-image" : "error",
      }
    }

    let primaryResult = await generateWithModel(modelGeneration, PRIMARY_MODEL_ATTEMPTS)
    if (primaryResult.ok) {
      return NextResponse.json({ imageUrl: primaryResult.imageUrl })
    }

    if (primaryResult.reason === "no-image") {
      logger.warn("GENERATE", "Повторяем генерацию с упрощённым промптом на основной модели", {
        model: modelGeneration,
      })
      const simplifiedPrimaryResult = await generateWithModel(modelGeneration, 1, "simple")
      if (simplifiedPrimaryResult.ok) {
        logger.info("GENERATE", "Изображение сгенерировано через упрощённый промпт на основной модели", {
          style,
          model: modelGeneration,
        })
        return NextResponse.json({ imageUrl: simplifiedPrimaryResult.imageUrl })
      }
      primaryResult = simplifiedPrimaryResult
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

      let fallbackResult = await generateWithModel(fallbackModel, 1)
      if (fallbackResult.ok) {
        logger.info("GENERATE", "Изображение сгенерировано через fallback", { style, model: fallbackModel })
        return NextResponse.json({ imageUrl: fallbackResult.imageUrl })
      }

      if (fallbackResult.reason === "no-image") {
        logger.warn("GENERATE", "Повторяем fallback с упрощённым промптом", {
          model: fallbackModel,
        })
        const simplifiedFallbackResult = await generateWithModel(fallbackModel, 1, "simple")
        if (simplifiedFallbackResult.ok) {
          logger.info("GENERATE", "Изображение сгенерировано через упрощённый fallback", {
            style,
            model: fallbackModel,
          })
          return NextResponse.json({ imageUrl: simplifiedFallbackResult.imageUrl })
        }
        fallbackResult = simplifiedFallbackResult
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
