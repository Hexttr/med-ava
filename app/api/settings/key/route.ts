import { NextRequest, NextResponse } from "next/server"
import { saveGeminiKey, removeGeminiKey } from "@/lib/settings"
import { logger } from "@/lib/logger"

function isValidKey(key: string): boolean {
  const trimmed = key.trim()
  if (trimmed.length < 10 || trimmed.length > 500) return false
  return /^[A-Za-z0-9_.-]+$/.test(trimmed)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const key = typeof body?.key === "string" ? body.key : ""

    if (!key.trim()) {
      return NextResponse.json({ success: false, error: "Введите API-ключ" }, { status: 400 })
    }

    if (!isValidKey(key)) {
      return NextResponse.json(
        { success: false, error: "Неверный формат. Ожидается ключ Gemini (например, AIza...)" },
        { status: 400 }
      )
    }

    await saveGeminiKey(key)
    logger.info("SETTINGS", "API-ключ сохранён в data/gemini-key")
    return NextResponse.json({ success: true })
  } catch (e) {
    logger.error("SETTINGS", "Save key error", { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Не удалось сохранить ключ" },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    await removeGeminiKey()
    logger.info("SETTINGS", "API-ключ удалён из data/gemini-key")
    return NextResponse.json({ success: true })
  } catch (e) {
    logger.error("SETTINGS", "Remove key error", { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json({ success: false, error: "Не удалось удалить ключ" }, { status: 500 })
  }
}
