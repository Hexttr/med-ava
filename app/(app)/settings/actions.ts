"use server"

import { revalidatePath } from "next/cache"
import { setGeminiKey, removeGeminiKey } from "@/lib/settings"

export async function saveKeyAction(key: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!key || key.length < 10) {
      return { success: false, error: "Invalid API key format" }
    }
    await setGeminiKey(key)
    revalidatePath("/", "layout")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to save API key" }
  }
}

export async function removeKeyAction(): Promise<{ success: boolean }> {
  await removeGeminiKey()
  revalidatePath("/", "layout")
  return { success: true }
}
