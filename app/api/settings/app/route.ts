import { NextRequest, NextResponse } from "next/server"
import { getAppSettings, setAppSettings } from "@/lib/app-settings"
import { logger } from "@/lib/logger"

export async function GET() {
  try {
    const settings = getAppSettings()
    return NextResponse.json(settings)
  } catch (e) {
    logger.error("SETTINGS", "GET error", { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json(
      { error: "Не удалось загрузить настройки" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const updates: {
      organizationName?: string
      backgroundMedical?: string
      backgroundCorporate?: string
      promptAnalysis?: string
      promptUniversalFraming?: string
      promptMedicalInstruction?: string
      promptCorporateInstruction?: string
      promptNegative?: string
    } = {}
    if (typeof body?.organizationName === "string") updates.organizationName = body.organizationName
    if (typeof body?.backgroundMedical === "string") updates.backgroundMedical = body.backgroundMedical
    if (typeof body?.backgroundCorporate === "string") updates.backgroundCorporate = body.backgroundCorporate
    if (typeof body?.promptAnalysis === "string") updates.promptAnalysis = body.promptAnalysis
    if (typeof body?.promptUniversalFraming === "string") updates.promptUniversalFraming = body.promptUniversalFraming
    if (typeof body?.promptMedicalInstruction === "string") updates.promptMedicalInstruction = body.promptMedicalInstruction
    if (typeof body?.promptCorporateInstruction === "string") updates.promptCorporateInstruction = body.promptCorporateInstruction
    if (typeof body?.promptNegative === "string") updates.promptNegative = body.promptNegative
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Нет данных для обновления" }, { status: 400 })
    }
    setAppSettings(updates)
    const settings = getAppSettings()
    return NextResponse.json(settings)
  } catch (e) {
    logger.error("SETTINGS", "PATCH error", { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json(
      { error: "Не удалось сохранить настройки" },
      { status: 500 }
    )
  }
}
