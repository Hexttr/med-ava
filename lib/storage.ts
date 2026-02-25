import fs from "fs/promises"
import path from "path"
import { getUploadsDir } from "./db"

const UPLOADS = "uploads"

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
