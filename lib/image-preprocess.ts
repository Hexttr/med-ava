/**
 * Предобработка изображений перед отправкой в Gemini.
 * Приводит к единому размеру и формату для стабильных результатов.
 */

import sharp from "sharp"

/** Максимальная сторона (px). Gemini хорошо работает с 1024–1536. */
const GEMINI_MAX_SIDE = 1536
const PORTRAIT_REFERENCE_WIDTH = 1152
const PORTRAIT_REFERENCE_HEIGHT = 1536

/** Качество JPEG для баланса качества и размера. */
const JPEG_QUALITY = 94

export interface PreprocessResult {
  base64: string
  mimeType: "image/jpeg"
}

export interface PreprocessOptions {
  mode?: "default" | "portrait-reference" | "background-reference"
}

/**
 * Предобрабатывает буфер изображения для Gemini:
 * - Ресайз до max 1536px по большей стороне (сохраняя пропорции)
 * - Конвертация в JPEG
 */
export async function preprocessForGemini(
  buffer: Buffer,
  options: PreprocessOptions = {}
): Promise<PreprocessResult> {
  const mode = options.mode ?? "default"
  let pipeline = sharp(buffer).rotate()

  if (mode === "portrait-reference") {
    // Normalize the source portrait closer to the target 3:4 framing so the
    // generation model receives a more consistent head-to-body scale.
    pipeline = pipeline
      .resize(PORTRAIT_REFERENCE_WIDTH, PORTRAIT_REFERENCE_HEIGHT, {
        fit: "cover",
        position: "attention",
        withoutEnlargement: false,
      })
      .sharpen(0.8)
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

  const jpegBuffer = await pipeline.jpeg({ quality: JPEG_QUALITY }).toBuffer()

  return {
    base64: jpegBuffer.toString("base64"),
    mimeType: "image/jpeg",
  }
}
