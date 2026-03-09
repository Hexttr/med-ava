import { NextRequest, NextResponse } from "next/server"
import { getAppSettings, setAppSettings, type OverlayLogoPosition } from "@/lib/app-settings"
import { logger } from "@/lib/logger"
import { enforceTrustedOrigin } from "@/lib/request-security"

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
    const originError = enforceTrustedOrigin(request)
    if (originError) return originError

    const body = await request.json()
    const updates: {
      organizationName?: string
      backgroundMedical?: string
      backgroundCorporate?: string
      overlayLogoEnabled?: boolean
      overlayLogoPath?: string
      overlayLogoPosition?: OverlayLogoPosition
      overlayLogoSizePercent?: number
      overlayLogoPadding?: number
      backgroundMode?: "description" | "image"
      modelAnalysis?: string
      modelGeneration?: string
      promptAnalysis?: string
      promptUniversalFraming?: string
      promptMedicalInstruction?: string
      promptCorporateInstruction?: string
      promptNegative?: string
    } = {}
    if (typeof body?.organizationName === "string") updates.organizationName = body.organizationName
    if (typeof body?.backgroundMedical === "string") updates.backgroundMedical = body.backgroundMedical
    if (typeof body?.backgroundCorporate === "string") updates.backgroundCorporate = body.backgroundCorporate
    if (typeof body?.overlayLogoEnabled === "boolean") updates.overlayLogoEnabled = body.overlayLogoEnabled
    if (typeof body?.overlayLogoPath === "string") updates.overlayLogoPath = body.overlayLogoPath
    if (
      body?.overlayLogoPosition === "top-left" ||
      body?.overlayLogoPosition === "top-right" ||
      body?.overlayLogoPosition === "bottom-left" ||
      body?.overlayLogoPosition === "bottom-right"
    ) {
      updates.overlayLogoPosition = body.overlayLogoPosition
    }
    if (typeof body?.overlayLogoSizePercent === "number" && Number.isFinite(body.overlayLogoSizePercent)) {
      updates.overlayLogoSizePercent = Math.min(35, Math.max(5, Math.round(body.overlayLogoSizePercent)))
    }
    if (typeof body?.overlayLogoPadding === "number" && Number.isFinite(body.overlayLogoPadding)) {
      updates.overlayLogoPadding = Math.min(96, Math.max(0, Math.round(body.overlayLogoPadding)))
    }
    if (body?.backgroundMode === "description" || body?.backgroundMode === "image") updates.backgroundMode = body.backgroundMode
    if (typeof body?.modelAnalysis === "string") updates.modelAnalysis = body.modelAnalysis
    if (typeof body?.modelGeneration === "string") updates.modelGeneration = body.modelGeneration
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
