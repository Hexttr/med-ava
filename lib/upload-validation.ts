/**
 * Валидация загружаемых изображений.
 */

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
const MAX_BASE64_IMAGE_SIZE_BYTES = 15 * 1024 * 1024 // 15 MB (base64 ~33% больше)
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"] as const

export function validateImageFile(file: File | Blob): { ok: boolean; error?: string } {
  const size = file.size
  if (size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: `Файл слишком большой (макс. ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB)` }
  }
  if (size === 0) {
    return { ok: false, error: "Файл пустой" }
  }
  const mime = (file as File).type || ""
  if (mime && !ALLOWED_MIMES.includes(mime as (typeof ALLOWED_MIMES)[number])) {
    return { ok: false, error: `Недопустимый формат. Разрешены: JPEG, PNG, WebP` }
  }
  return { ok: true }
}

export function validateBase64Image(dataUrl: string): { ok: boolean; error?: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return { ok: false, error: "Неверный формат data URL" }
  const mime = match[1]
  if (!mime.startsWith("image/")) return { ok: false, error: "Ожидается изображение" }
  const base64 = match[2]
  const sizeBytes = Math.ceil((base64.length * 3) / 4)
  if (sizeBytes > MAX_BASE64_IMAGE_SIZE_BYTES) {
    return { ok: false, error: `Изображение слишком большое (макс. ~${MAX_BASE64_IMAGE_SIZE_BYTES / 1024 / 1024} MB)` }
  }
  return { ok: true }
}
