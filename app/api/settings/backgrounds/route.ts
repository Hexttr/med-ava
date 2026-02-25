import { NextRequest, NextResponse } from "next/server"
import { getAppSettings, setAppSettings } from "@/lib/app-settings"
import { saveBackgroundImage, removeFile } from "@/lib/storage"
import { logger } from "@/lib/logger"

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const current = getAppSettings()
    const updates: { backgroundMedicalImage?: string; backgroundCorporateImage?: string } = {}

    const medicalFile = formData.get("backgroundMedical") as File | null
    const corporateFile = formData.get("backgroundCorporate") as File | null
    const clearMedical = formData.get("clearMedical") === "true"
    const clearCorporate = formData.get("clearCorporate") === "true"

    if (clearMedical) {
      if (current.backgroundMedicalImage) {
        await removeFile(current.backgroundMedicalImage)
        updates.backgroundMedicalImage = ""
      }
    } else if (medicalFile?.size && medicalFile.size > 0) {
      if (medicalFile.size > MAX_SIZE) {
        return NextResponse.json({ error: "Файл медицинского фона слишком большой (макс. 10 МБ)" }, { status: 400 })
      }
      if (!ALLOWED_TYPES.includes(medicalFile.type)) {
        return NextResponse.json({ error: "Недопустимый формат (jpeg, png, webp)" }, { status: 400 })
      }
      if (current.backgroundMedicalImage) await removeFile(current.backgroundMedicalImage)
      const path = await saveBackgroundImage(Buffer.from(await medicalFile.arrayBuffer()), "medical", medicalFile.type)
      updates.backgroundMedicalImage = path
    }

    if (clearCorporate) {
      if (current.backgroundCorporateImage) {
        await removeFile(current.backgroundCorporateImage)
        updates.backgroundCorporateImage = ""
      }
    } else if (corporateFile?.size && corporateFile.size > 0) {
      if (corporateFile.size > MAX_SIZE) {
        return NextResponse.json({ error: "Файл корпоративного фона слишком большой (макс. 10 МБ)" }, { status: 400 })
      }
      if (!ALLOWED_TYPES.includes(corporateFile.type)) {
        return NextResponse.json({ error: "Недопустимый формат (jpeg, png, webp)" }, { status: 400 })
      }
      if (current.backgroundCorporateImage) await removeFile(current.backgroundCorporateImage)
      const path = await saveBackgroundImage(Buffer.from(await corporateFile.arrayBuffer()), "corporate", corporateFile.type)
      updates.backgroundCorporateImage = path
    }

    if (Object.keys(updates).length > 0) {
      setAppSettings(updates)
    }
    const settings = getAppSettings()
    return NextResponse.json(settings)
  } catch (e) {
    logger.error("SETTINGS", "Backgrounds POST error", { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json(
      { error: "Не удалось сохранить фоны" },
      { status: 500 }
    )
  }
}
