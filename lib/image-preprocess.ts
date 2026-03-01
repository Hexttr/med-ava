/**
 * Предобработка изображений перед отправкой в Gemini.
 * Приводит к единому размеру и формату для стабильных результатов.
 */

import sharp from "sharp"

/** Максимальная сторона (px). Gemini хорошо работает с 1024–1536. */
const GEMINI_MAX_SIDE = 1024

/** Качество JPEG для баланса качества и размера. */
const JPEG_QUALITY = 90

export interface PreprocessResult {
  base64: string
  mimeType: "image/jpeg"
}

/**
 * Предобрабатывает буфер изображения для Gemini:
 * - Ресайз до max 1024px по большей стороне (сохраняя пропорции)
 * - Конвертация в JPEG
 */
export async function preprocessForGemini(buffer: Buffer): Promise<PreprocessResult> {
  const image = sharp(buffer)
  const meta = await image.metadata()
  const { width = 0, height = 0 } = meta

  let pipeline = image
  if (width > GEMINI_MAX_SIDE || height > GEMINI_MAX_SIDE) {
    pipeline = pipeline.resize(GEMINI_MAX_SIDE, GEMINI_MAX_SIDE, {
      fit: "inside",
      withoutEnlargement: false,
    })
  }

  const jpegBuffer = await pipeline
    .rotate() // авто-поворот по EXIF
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer()

  return {
    base64: jpegBuffer.toString("base64"),
    mimeType: "image/jpeg",
  }
}
