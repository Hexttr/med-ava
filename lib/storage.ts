import fs from "fs/promises"
import path from "path"
import sharp from "sharp"
import { getUploadsDir } from "./db"
import type { AppSettings } from "./app-settings"
import { logger } from "./logger"

const THUMB_MAX_SIZE = 400
const THUMB_QUALITY = 0.75

/**
 * Сохраняет base64 (data URL) в файл. Возвращает путь относительно data/uploads для хранения в БД.
 */
export async function saveBase64Image(
  dataUrl: string,
  dir: string,
  filename: string
): Promise<string> {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) throw new Error("Invalid data URL")
  const ext = match[1].includes("png") ? "png" : match[1].includes("webp") ? "webp" : "jpg"
  const baseDir = getUploadsDir()
  const fullDir = path.join(baseDir, dir)
  await fs.mkdir(fullDir, { recursive: true })
  const base64 = match[2]
  const buf = Buffer.from(base64, "base64")
  const finalName = `${filename}.${ext}`
  const filePath = path.join(fullDir, finalName)
  await fs.writeFile(filePath, buf)
  return path.join(dir, finalName)
}

/**
 * Сохраняет фото сотрудника: оригинал (для генерации) + сжатый превью (для отображения).
 * Возвращает { path, thumbnailPath }.
 */
export async function saveEmployeePhoto(
  dataUrl: string,
  filename: string
): Promise<{ path: string; thumbnailPath: string }> {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) throw new Error("Invalid data URL")
  const ext = match[1].includes("png") ? "png" : match[1].includes("webp") ? "webp" : "jpg"
  const dir = "employees"
  const baseDir = getUploadsDir()
  const fullDir = path.join(baseDir, dir)
  await fs.mkdir(fullDir, { recursive: true })
  const base64 = match[2]
  const buf = Buffer.from(base64, "base64")

  const finalName = `${filename}.${ext}`
  const filePath = path.join(fullDir, finalName)
  await fs.writeFile(filePath, buf)

  const thumbName = `${filename}_thumb.jpg`
  const thumbPath = path.join(dir, thumbName)
  try {
    await sharp(buf)
      .resize(THUMB_MAX_SIZE, THUMB_MAX_SIZE, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: Math.round(THUMB_QUALITY * 100) })
      .toFile(path.join(fullDir, thumbName))
  } catch {
    return { path: path.join(dir, finalName), thumbnailPath: path.join(dir, finalName) }
  }
  return { path: path.join(dir, finalName), thumbnailPath: thumbPath }
}

/**
 * Сохраняет фото сотрудника из буфера (для batch). Оригинал + превью.
 */
export async function saveEmployeePhotoFromBuffer(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<{ path: string; thumbnailPath: string }> {
  const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg"
  const dir = "employees"
  const baseDir = getUploadsDir()
  const fullDir = path.join(baseDir, dir)
  await fs.mkdir(fullDir, { recursive: true })

  const finalName = `${filename}.${ext}`
  const filePath = path.join(fullDir, finalName)
  await fs.writeFile(filePath, buffer)

  const thumbName = `${filename}_thumb.jpg`
  const thumbPath = path.join(dir, thumbName)
  try {
    await sharp(buffer)
      .resize(THUMB_MAX_SIZE, THUMB_MAX_SIZE, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: Math.round(THUMB_QUALITY * 100) })
      .toFile(path.join(fullDir, thumbName))
  } catch {
    return { path: path.join(dir, finalName), thumbnailPath: path.join(dir, finalName) }
  }
  return { path: path.join(dir, finalName), thumbnailPath: thumbPath }
}

/**
 * Возвращает абсолютный путь к файлу по относительному (от data/uploads).
 */
export function getAbsolutePath(relativePath: string): string {
  const base = getUploadsDir()
  return path.join(base, relativePath)
}

/**
 * Сохраняет буфер изображения в backgrounds/. Возвращает путь относительно data/uploads.
 */
export async function saveBackgroundImage(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg"
  const dir = "backgrounds"
  const baseDir = getUploadsDir()
  const fullDir = path.join(baseDir, dir)
  await fs.mkdir(fullDir, { recursive: true })
  const finalName = `${filename}.${ext}`
  const filePath = path.join(fullDir, finalName)
  await fs.writeFile(filePath, buffer)
  return path.join(dir, finalName)
}

export async function saveBrandingImage(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const dir = "branding"
  const baseDir = getUploadsDir()
  const fullDir = path.join(baseDir, dir)
  await fs.mkdir(fullDir, { recursive: true })
  const finalName = `${filename}.png`
  const filePath = path.join(fullDir, finalName)
  await fs.writeFile(filePath, buffer)
  return path.join(dir, finalName)
}

export async function enhanceGeneratedPortrait(dataUrl: string): Promise<string> {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return dataUrl

  const mimeType = match[1]
  const inputBuffer = Buffer.from(match[2], "base64")
  const image = sharp(inputBuffer, { failOn: "none" })
  const metadata = await image.metadata()
  const width = metadata.width ?? 0
  const height = metadata.height ?? 0

  if (!width || !height) return dataUrl

  const targetHeight = height < 1536 ? Math.min(1536, Math.round(height * 1.35)) : height
  const targetWidth = width < 1152 ? Math.min(1152, Math.round(width * 1.35)) : width

  const output = image
    .resize(targetWidth, targetHeight, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: false,
    })
    .sharpen({ sigma: 1.1, m1: 1.2, m2: 2.2, x1: 2, y2: 10, y3: 20 })
    .modulate({ brightness: 1.01, saturation: 1.02 })

  if (mimeType.includes("png")) {
    return `data:image/png;base64,${(await output.png({ compressionLevel: 9 }).toBuffer()).toString("base64")}`
  }
  if (mimeType.includes("webp")) {
    return `data:image/webp;base64,${(await output.webp({ quality: 96 }).toBuffer()).toString("base64")}`
  }
  return `data:image/jpeg;base64,${(await output.jpeg({ quality: 96 }).toBuffer()).toString("base64")}`
}

export async function applyOverlayLogo(
  dataUrl: string,
  settings: Pick<
    AppSettings,
    "overlayLogoEnabled" | "overlayLogoPath" | "overlayLogoPosition" | "overlayLogoSizePercent" | "overlayLogoPadding"
  >
): Promise<string> {
  if (!settings.overlayLogoEnabled || !settings.overlayLogoPath?.trim()) {
    return dataUrl
  }

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return dataUrl

  const mimeType = match[1]
  const inputBuffer = Buffer.from(match[2], "base64")

  let overlayBuffer: Buffer
  try {
    overlayBuffer = await fs.readFile(getAbsolutePath(settings.overlayLogoPath))
  } catch {
    logger.warn("STORAGE", "Не удалось прочитать PNG-логотип для overlay", {
      path: settings.overlayLogoPath,
    })
    return dataUrl
  }

  const image = sharp(inputBuffer, { failOn: "none" })
  const metadata = await image.metadata()
  const width = metadata.width ?? 0
  const height = metadata.height ?? 0
  if (!width || !height) return dataUrl

  const logoWidth = Math.max(32, Math.round(width * (settings.overlayLogoSizePercent / 100)))
  const padding = Math.max(0, Math.round(settings.overlayLogoPadding))

  const overlay = await sharp(overlayBuffer)
    .resize({ width: logoWidth, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer()

  const overlayMeta = await sharp(overlay).metadata()
  const overlayWidth = overlayMeta.width ?? logoWidth
  const overlayHeight = overlayMeta.height ?? logoWidth

  const left =
    settings.overlayLogoPosition === "top-right" || settings.overlayLogoPosition === "bottom-right"
      ? Math.max(0, width - overlayWidth - padding)
      : padding
  const top =
    settings.overlayLogoPosition === "bottom-left" || settings.overlayLogoPosition === "bottom-right"
      ? Math.max(0, height - overlayHeight - padding)
      : padding

  const output = image.composite([{ input: overlay, left, top }])
  if (mimeType.includes("png")) {
    return `data:image/png;base64,${(await output.png().toBuffer()).toString("base64")}`
  }
  if (mimeType.includes("webp")) {
    return `data:image/webp;base64,${(await output.webp({ quality: 95 }).toBuffer()).toString("base64")}`
  }
  return `data:image/jpeg;base64,${(await output.jpeg({ quality: 95 }).toBuffer()).toString("base64")}`
}

/**
 * Удаляет файл по относительному пути. Игнорирует ошибки если файла нет.
 */
export async function removeFile(relativePath: string): Promise<void> {
  const base = getUploadsDir()
  const full = path.join(base, relativePath)
  await fs.unlink(full).catch(() => {})
}
