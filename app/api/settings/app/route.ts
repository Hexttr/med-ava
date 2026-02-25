import { NextRequest, NextResponse } from "next/server"
import { getAppSettings, setAppSettings } from "@/lib/app-settings"

export async function GET() {
  try {
    const settings = getAppSettings()
    return NextResponse.json(settings)
  } catch (e) {
    console.error("[API] settings/app GET", e)
    return NextResponse.json(
      { error: "Не удалось загрузить настройки" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const updates: { organizationName?: string; backgroundMedical?: string; backgroundCorporate?: string } = {}
    if (typeof body?.organizationName === "string") updates.organizationName = body.organizationName
    if (typeof body?.backgroundMedical === "string") updates.backgroundMedical = body.backgroundMedical
    if (typeof body?.backgroundCorporate === "string") updates.backgroundCorporate = body.backgroundCorporate
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Нет данных для обновления" }, { status: 400 })
    }
    setAppSettings(updates)
    const settings = getAppSettings()
    return NextResponse.json(settings)
  } catch (e) {
    console.error("[API] settings/app PATCH", e)
    return NextResponse.json(
      { error: "Не удалось сохранить настройки" },
      { status: 500 }
    )
  }
}
