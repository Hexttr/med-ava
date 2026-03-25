import { getDb } from "./db"
import { MODEL_ANALYSIS_OPTIONS, MODEL_GENERATION_OPTIONS } from "./model-options"

export type OverlayLogoPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right"

const KEYS = {
  organizationName: "organization_name",
  backgroundMedical: "background_medical",
  backgroundCorporate: "background_corporate",
  backgroundMedicalImage: "background_medical_image",
  backgroundCorporateImage: "background_corporate_image",
  overlayLogoEnabled: "overlay_logo_enabled",
  overlayLogoPath: "overlay_logo_path",
  overlayLogoMedicalPath: "overlay_logo_medical_path",
  overlayLogoCorporatePath: "overlay_logo_corporate_path",
  overlayLogoPosition: "overlay_logo_position",
  overlayLogoSizePercent: "overlay_logo_size_percent",
  overlayLogoPadding: "overlay_logo_padding",
  backgroundMode: "background_mode",
  modelAnalysis: "model_analysis",
  modelGeneration: "model_generation",
  promptAnalysis: "prompt_analysis",
  promptUniversalFraming: "prompt_universal_framing",
  promptMedicalInstruction: "prompt_medical_instruction",
  promptCorporateInstruction: "prompt_corporate_instruction",
  promptNegative: "prompt_negative",
} as const

export interface AppSettings {
  organizationName: string
  backgroundMedical: string
  backgroundCorporate: string
  backgroundMedicalImage: string
  backgroundCorporateImage: string
  overlayLogoEnabled: boolean
  overlayLogoPath: string
  overlayLogoMedicalPath: string
  overlayLogoCorporatePath: string
  overlayLogoPosition: OverlayLogoPosition
  overlayLogoSizePercent: number
  overlayLogoPadding: number
  backgroundMode: "description" | "image"
  modelAnalysis: string
  modelGeneration: string
  promptAnalysis: string
  promptUniversalFraming: string
  promptMedicalInstruction: string
  promptCorporateInstruction: string
  promptNegative: string
}

const ALL_KEYS = [
  KEYS.organizationName,
  KEYS.backgroundMedical,
  KEYS.backgroundCorporate,
  KEYS.backgroundMedicalImage,
  KEYS.backgroundCorporateImage,
  KEYS.overlayLogoEnabled,
  KEYS.overlayLogoPath,
  KEYS.overlayLogoMedicalPath,
  KEYS.overlayLogoCorporatePath,
  KEYS.overlayLogoPosition,
  KEYS.overlayLogoSizePercent,
  KEYS.overlayLogoPadding,
  KEYS.backgroundMode,
  KEYS.modelAnalysis,
  KEYS.modelGeneration,
  KEYS.promptAnalysis,
  KEYS.promptUniversalFraming,
  KEYS.promptMedicalInstruction,
  KEYS.promptCorporateInstruction,
  KEYS.promptNegative,
] as const

export function getAppSettings(): AppSettings {
  const db = getDb()
  const placeholders = ALL_KEYS.map(() => "?").join(", ")
  const rows = db.prepare(`SELECT key, value FROM app_settings WHERE key IN (${placeholders})`).all(...ALL_KEYS) as Array<{ key: string; value: string | null }>
  const map = new Map(rows.map((r) => [r.key, r.value ?? ""]))
  const overlayLogoPosition = map.get(KEYS.overlayLogoPosition)
  const overlayLogoSizePercent = Number(map.get(KEYS.overlayLogoSizePercent) || 16)
  const overlayLogoPadding = Number(map.get(KEYS.overlayLogoPadding) || 24)
  return {
    organizationName: map.get(KEYS.organizationName) ?? "",
    backgroundMedical: map.get(KEYS.backgroundMedical) ?? "",
    backgroundCorporate: map.get(KEYS.backgroundCorporate) ?? "",
    backgroundMedicalImage: map.get(KEYS.backgroundMedicalImage) ?? "",
    backgroundCorporateImage: map.get(KEYS.backgroundCorporateImage) ?? "",
    overlayLogoEnabled: map.get(KEYS.overlayLogoEnabled) === "true",
    overlayLogoPath: map.get(KEYS.overlayLogoPath) ?? "",
    overlayLogoMedicalPath: map.get(KEYS.overlayLogoMedicalPath) ?? "",
    overlayLogoCorporatePath: map.get(KEYS.overlayLogoCorporatePath) ?? "",
    overlayLogoPosition:
      overlayLogoPosition === "top-left" ||
      overlayLogoPosition === "bottom-left" ||
      overlayLogoPosition === "bottom-right"
        ? overlayLogoPosition
        : "top-right",
    overlayLogoSizePercent: Number.isFinite(overlayLogoSizePercent) ? overlayLogoSizePercent : 16,
    overlayLogoPadding: Number.isFinite(overlayLogoPadding) ? overlayLogoPadding : 24,
    backgroundMode: (map.get(KEYS.backgroundMode) === "image" ? "image" : "description") as "description" | "image",
    modelAnalysis: map.get(KEYS.modelAnalysis) || MODEL_ANALYSIS_OPTIONS[0].value,
    modelGeneration: map.get(KEYS.modelGeneration) || MODEL_GENERATION_OPTIONS[0].value,
    promptAnalysis: map.get(KEYS.promptAnalysis) ?? "",
    promptUniversalFraming: map.get(KEYS.promptUniversalFraming) ?? "",
    promptMedicalInstruction: map.get(KEYS.promptMedicalInstruction) ?? "",
    promptCorporateInstruction: map.get(KEYS.promptCorporateInstruction) ?? "",
    promptNegative: map.get(KEYS.promptNegative) ?? "",
  }
}

export function setAppSettings(updates: Partial<AppSettings>): void {
  const db = getDb()
  const stmt = db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)")
  const mapping: [string, keyof AppSettings][] = [
    [KEYS.organizationName, "organizationName"],
    [KEYS.backgroundMedical, "backgroundMedical"],
    [KEYS.backgroundCorporate, "backgroundCorporate"],
    [KEYS.backgroundMedicalImage, "backgroundMedicalImage"],
    [KEYS.backgroundCorporateImage, "backgroundCorporateImage"],
    [KEYS.overlayLogoEnabled, "overlayLogoEnabled"],
    [KEYS.overlayLogoPath, "overlayLogoPath"],
    [KEYS.overlayLogoMedicalPath, "overlayLogoMedicalPath"],
    [KEYS.overlayLogoCorporatePath, "overlayLogoCorporatePath"],
    [KEYS.overlayLogoPosition, "overlayLogoPosition"],
    [KEYS.overlayLogoSizePercent, "overlayLogoSizePercent"],
    [KEYS.overlayLogoPadding, "overlayLogoPadding"],
    [KEYS.backgroundMode, "backgroundMode"],
    [KEYS.modelAnalysis, "modelAnalysis"],
    [KEYS.modelGeneration, "modelGeneration"],
    [KEYS.promptAnalysis, "promptAnalysis"],
    [KEYS.promptUniversalFraming, "promptUniversalFraming"],
    [KEYS.promptMedicalInstruction, "promptMedicalInstruction"],
    [KEYS.promptCorporateInstruction, "promptCorporateInstruction"],
    [KEYS.promptNegative, "promptNegative"],
  ]
  for (const [key, prop] of mapping) {
    const val = updates[prop]
    if (val !== undefined) {
      stmt.run(key, String(val).trim())
    }
  }
}
