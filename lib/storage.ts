import fs from "fs/promises"
import path from "path"
import sharp from "sharp"
import { getUploadsDir } from "./db"

const UPLOADS = "uploads"
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

/**
 * Удаляет файл по относительному пути. Игнорирует ошибки если файла нет.
 */
export async function removeFile(relativePath: string): Promise<void> {
  const base = getUploadsDir()
  const full = path.join(base, relativePath)
  await fs.unlink(full).catch(() => {})
}
