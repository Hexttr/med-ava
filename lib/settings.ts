"use server"

import { cookies } from "next/headers"

const GEMINI_KEY_COOKIE = "eam_gemini_key"

export async function getGeminiKey(): Promise<string | null> {
  const cookieStore = await cookies()
  const key = cookieStore.get(GEMINI_KEY_COOKIE)
  return key?.value ?? null
}

export async function setGeminiKey(key: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(GEMINI_KEY_COOKIE, key, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
  })
}

export async function removeGeminiKey(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(GEMINI_KEY_COOKIE)
}
