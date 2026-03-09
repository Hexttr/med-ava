import { NextRequest, NextResponse } from "next/server"
import { getAppSettings, setAppSettings } from "@/lib/app-settings"
import { removeFile, saveBrandingImage } from "@/lib/storage"
import { logger } from "@/lib/logger"
import { enforceTrustedOrigin } from "@/lib/request-security"

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPE = "image/png"

export async function POST(request: NextRequest) {
  try {
    const originError = enforceTrustedOrigin(request)
    if (originError) return originError

    const formData = await request.formData()
    const current = getAppSettings()
    const logoFile = formData.get("overlayLogo") as File | null
    const clearLogo = formData.get("clearLogo") === "true"
    const updates: { overlayLogoPath?: string } = {}

    if (clearLogo && current.overlayLogoPath) {
      await removeFile(current.overlayLogoPath)
      updates.overlayLogoPath = ""
    } else if (logoFile?.size && logoFile.size > 0) {
      if (logoFile.size > MAX_SIZE) {
        return NextResponse.json({ error: "Файл логотипа слишком большой (макс. 5 МБ)" }, { status: 400 })
      }
      if (logoFile.type !== ALLOWED_TYPE) {
        return NextResponse.json({ error: "Допустим только PNG с прозрачностью" }, { status: 400 })
      }
      if (current.overlayLogoPath) {
        await removeFile(current.overlayLogoPath)
      }
      const filePath = await saveBrandingImage(
        Buffer.from(await logoFile.arrayBuffer()),
        `overlay_logo_${Date.now()}`
      )
      updates.overlayLogoPath = filePath
    }

    if (Object.keys(updates).length > 0) {
      setAppSettings(updates)
    }

    return NextResponse.json(getAppSettings())
  } catch (e) {
    logger.error("SETTINGS", "Branding POST error", {
      error: e instanceof Error ? e.message : String(e),
    })
    return NextResponse.json({ error: "Не удалось сохранить логотип" }, { status: 500 })
  }
}
