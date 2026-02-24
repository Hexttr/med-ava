import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

const GEMINI_KEY_COOKIE = "eam_gemini_key"

function isValidGeminiKey(key: string): boolean {
  const trimmed = key.trim()
  // Gemini keys: обычно AIza... (≈39 символов), допускаем разные форматы
  if (trimmed.length < 10 || trimmed.length > 500) return false
  // Безопасные символы для cookie (без ; , пробелов)
  return /^[A-Za-z0-9_.-]+$/.test(trimmed)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const key = typeof body?.key === "string" ? body.key.trim() : ""

    if (!key) {
      return NextResponse.json(
        { success: false, error: "Введите API-ключ" },
        { status: 400 }
      )
    }

    if (!isValidGeminiKey(key)) {
      return NextResponse.json(
        { success: false, error: "Неверный формат ключа. Ожидается ключ Gemini (например, AIza...)" },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    cookieStore.set(GEMINI_KEY_COOKIE, key, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    })
    await cookies()

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[EAM] Save API key error:", err)
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Не удалось сохранить ключ",
      },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies()
    cookieStore.delete(GEMINI_KEY_COOKIE)
    await cookies()

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[EAM] Remove API key error:", err)
    return NextResponse.json(
      { success: false, error: "Не удалось удалить ключ" },
      { status: 500 }
    )
  }
}
