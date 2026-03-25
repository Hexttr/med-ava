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
    const legacyLogoFile = formData.get("overlayLogo") as File | null
    const legacyClearLogo = formData.get("clearLogo") === "true"
    const medicalLogoFile = (formData.get("overlayLogoMedical") as File | null) ?? legacyLogoFile
    const corporateLogoFile = (formData.get("overlayLogoCorporate") as File | null) ?? null
    const clearMedicalLogo = formData.get("clearMedicalLogo") === "true" || legacyClearLogo
    const clearCorporateLogo = formData.get("clearCorporateLogo") === "true"
    const updates: {
      overlayLogoPath?: string
      overlayLogoMedicalPath?: string
      overlayLogoCorporatePath?: string
    } = {}

    const uploads = [
      {
        file: medicalLogoFile,
        clear: clearMedicalLogo,
        currentPath: current.overlayLogoMedicalPath,
        updateKey: "overlayLogoMedicalPath" as const,
        prefix: "overlay_logo_medical",
      },
      {
        file: corporateLogoFile,
        clear: clearCorporateLogo,
        currentPath: current.overlayLogoCorporatePath,
        updateKey: "overlayLogoCorporatePath" as const,
        prefix: "overlay_logo_corporate",
      },
    ]

    for (const upload of uploads) {
      if (upload.clear && upload.currentPath) {
        await removeFile(upload.currentPath)
        updates[upload.updateKey] = ""
        continue
      }

      if (upload.file?.size && upload.file.size > 0) {
        if (upload.file.size > MAX_SIZE) {
          return NextResponse.json({ error: "Файл логотипа слишком большой (макс. 5 МБ)" }, { status: 400 })
        }
        if (upload.file.type !== ALLOWED_TYPE) {
          return NextResponse.json({ error: "Допустим только PNG с прозрачностью" }, { status: 400 })
        }
        if (upload.currentPath) {
          await removeFile(upload.currentPath)
        }
        const filePath = await saveBrandingImage(
          Buffer.from(await upload.file.arrayBuffer()),
          `${upload.prefix}_${Date.now()}`
        )
        updates[upload.updateKey] = filePath
      }
    }

    if (legacyClearLogo && current.overlayLogoPath) {
      await removeFile(current.overlayLogoPath)
      updates.overlayLogoPath = ""
    } else if (legacyLogoFile?.size && legacyLogoFile.size > 0 && !formData.get("overlayLogoMedical")) {
      if (legacyLogoFile.size > MAX_SIZE) {
        return NextResponse.json({ error: "Файл логотипа слишком большой (макс. 5 МБ)" }, { status: 400 })
      }
      if (legacyLogoFile.type !== ALLOWED_TYPE) {
        return NextResponse.json({ error: "Допустим только PNG с прозрачностью" }, { status: 400 })
      }
      if (current.overlayLogoPath) {
        await removeFile(current.overlayLogoPath)
      }
      const filePath = await saveBrandingImage(
        Buffer.from(await legacyLogoFile.arrayBuffer()),
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
