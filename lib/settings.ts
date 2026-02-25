"use server"

import fs from "fs"
import path from "path"

const GEMINI_KEY_FILE = path.join(process.cwd(), "data", "gemini-key")

function ensureDataDir() {
  const dataDir = path.join(process.cwd(), "data")
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
}

/**
 * API-ключ Gemini: сначала из файла data/gemini-key (сохранённый в настройках),
 * затем из переменной окружения GEMINI_API_KEY.
 */
export async function getGeminiKey(): Promise<string | null> {
  try {
    if (fs.existsSync(GEMINI_KEY_FILE)) {
      const key = fs.readFileSync(GEMINI_KEY_FILE, "utf-8").trim()
      if (key) return key
    }
  } catch {
    // ignore
  }
  const key = process.env.GEMINI_API_KEY?.trim()
  return key || null
}

/** Сохраняет ключ в data/gemini-key (приоритет над .env). */
export async function saveGeminiKey(key: string): Promise<void> {
  const trimmed = key.trim()
  if (!trimmed || trimmed.length < 10) {
    throw new Error("Неверный формат ключа")
  }
  ensureDataDir()
  fs.writeFileSync(GEMINI_KEY_FILE, trimmed, "utf-8")
}

/** Удаляет сохранённый ключ (приложение будет использовать GEMINI_API_KEY из .env). */
export async function removeGeminiKey(): Promise<void> {
  try {
    if (fs.existsSync(GEMINI_KEY_FILE)) {
      fs.unlinkSync(GEMINI_KEY_FILE)
    }
  } catch {
    // ignore
  }
}
