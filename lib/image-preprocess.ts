/**
 * Предобработка изображений перед отправкой в Gemini.
 * Приводит к единому размеру и формату для стабильных результатов.
 */

import sharp from "sharp"

/** Максимальная сторона (px). Gemini хорошо работает с 1024–1536. */
const GEMINI_MAX_SIDE = 1536
const PORTRAIT_REFERENCE_WIDTH = 1152
const PORTRAIT_REFERENCE_HEIGHT = 1536
const PORTRAIT_REFERENCE_INNER_WIDTH = 1008
const PORTRAIT_REFERENCE_INNER_HEIGHT = 1344

/** Качество JPEG для баланса качества и размера. */
const JPEG_QUALITY = 94

export interface PreprocessResult {
  base64: string
  mimeType: "image/jpeg" | "image/png"
}

export interface PreprocessOptions {
  mode?: "default" | "portrait-reference" | "background-reference"
}

/**
 * Предобрабатывает буфер изображения для Gemini:
 * - Ресайз до max 1536px по большей стороне (сохраняя пропорции)
 * - Конвертация в JPEG или PNG в зависимости от режима
 */
export async function preprocessForGemini(
  buffer: Buffer,
  options: PreprocessOptions = {}
): Promise<PreprocessResult> {
  const mode = options.mode ?? "default"
  let pipeline = sharp(buffer).rotate()

  if (mode === "portrait-reference") {
    // Normalize the source portrait onto a stable 3:4 canvas with extra room
    // below the face so tightly cropped shoulder shots do not force the model
    // back into a tight bust portrait. Keep wider margins so Gemini treats this
    // image as an identity reference instead of a final composition to transplant.
    const normalizedReference = await pipeline
      .resize(PORTRAIT_REFERENCE_INNER_WIDTH, PORTRAIT_REFERENCE_INNER_HEIGHT, {
        fit: "contain",
        position: "top",
        background: { r: 245, g: 246, b: 248, alpha: 0 },
        withoutEnlargement: true,
      })
      .modulate({ brightness: 1.01, saturation: 0.97 })
      .sharpen(0.8)
      .png()
      .toBuffer()

    const pngBuffer = await sharp({
      create: {
        width: PORTRAIT_REFERENCE_WIDTH,
        height: PORTRAIT_REFERENCE_HEIGHT,
        channels: 4,
        background: { r: 245, g: 246, b: 248, alpha: 1 },
      },
    })
      .composite([{ input: normalizedReference, gravity: "north" }])
      .png({ compressionLevel: 9 })
      .toBuffer()

    return {
      base64: pngBuffer.toString("base64"),
      mimeType: "image/png",
    }
  } else if (mode === "background-reference") {
    // Turn the uploaded background into a softer portrait plate reference
    // instead of a literal hard composite target.
    pipeline = pipeline
      .resize(PORTRAIT_REFERENCE_WIDTH, PORTRAIT_REFERENCE_HEIGHT, {
        fit: "cover",
        position: "attention",
        withoutEnlargement: false,
      })
      .blur(1.2)
      .modulate({ brightness: 1.02, saturation: 0.92 })
  } else {
    const meta = await pipeline.metadata()
    const { width = 0, height = 0 } = meta
    if (width > GEMINI_MAX_SIDE || height > GEMINI_MAX_SIDE) {
      pipeline = pipeline.resize(GEMINI_MAX_SIDE, GEMINI_MAX_SIDE, {
        fit: "inside",
        withoutEnlargement: false,
      })
    }
  }

  return {
    base64: (await pipeline.jpeg({ quality: JPEG_QUALITY }).toBuffer()).toString("base64"),
    mimeType: "image/jpeg",
  }
}
