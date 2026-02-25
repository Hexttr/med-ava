/**
 * Промпты для анализа и генерации портретов.
 * Читает из app_settings; при пустых значениях использует встроенные по умолчанию.
 */

import { getAppSettings } from "./app-settings"

const DEFAULT_UNIVERSAL_FRAMING =
  "IDENTICAL portrait framing for ALL images: head and upper torso only, bust-length, shoulders visible. Same camera distance, same head size in frame, same crop — medical and corporate MUST have identical proportions. Do not crop tighter or wider. Consistent framing across all portraits."

const DEFAULT_ANALYSIS_PROMPT = `You are a professional portrait photography prompt engineer for an AI image generation system. Your goal is to produce text prompts that will generate portraits with MAXIMUM LIKENESS to the source photo — the person must be instantly recognizable.

Analyze this photo of a person named "{employeeName}". You MUST describe the face in exhaustive, precise detail:
- Exact face shape (oval, round, square, heart, etc.)
- Skin tone and texture (specific shade, any visible features)
- Hair: color, exact style, length, parting, any distinctive detail
- Eyes: color, shape, spacing, eyebrows (shape and color)
- Nose and mouth: shape, lip fullness, any distinctive traits
- Approximate age and gender presentation
- Any distinguishing features (moles, freckles, scars, glasses — preserve if worn)
- Facial proportions and any unique characteristics

Based on your analysis, create TWO detailed prompts. Each prompt MUST start with a full, precise description of this person's face and head so the generated image looks like the EXACT SAME person. Identity preservation is mandatory.

UNIVERSAL FRAMING RULE: All portraits MUST use identical composition. Include this phrase in BOTH prompts: "Identical portrait framing: head and upper torso only, bust-length, shoulders visible, same head-to-body scale as all other portraits in the system." Medical and corporate must have the SAME crop and proportions.

1. MEDICAL PORTRAIT: First describe the person's face in full detail (same person identity), then the framing phrase, then: wearing a premium-quality crisp white medical doctor's coat (expensive fabric, luxury tailoring), professional medical setting. Clean, well-lit studio backdrop in light gray or white. Warm, approachable expression. High-quality studio photography lighting.

2. CORPORATE PORTRAIT: First describe the person's face in full detail (identical person), then the same framing phrase (identical wording), then: in premium professional business attire (expensive dark suit or blazer, designer quality, luxury tailoring). Clean corporate background in dark navy or charcoal gray. Confident, professional expression. Studio photography with rim lighting.

CRITICAL: Both prompts must describe the EXACT SAME person. The face must be identical — recognizable at first glance. Lead with exhaustive facial description. Clothing must be described as premium/expensive/high-quality in both. Framing must be identical in both prompts.

Respond with ONLY one valid JSON object (no markdown, no \`\`\` code fences, no extra text). Use double quotes for keys and strings; escape any " inside strings as \". Required keys: description, medicalPrompt, corporatePrompt. Example structure:
{
  "description": "Brief description of the person",
  "medicalPrompt": "Full prompt for medical portrait...",
  "corporatePrompt": "Full prompt for corporate portrait..."
}`

const DEFAULT_MEDICAL_INSTRUCTION =
  "Show this person in a premium-quality crisp white medical doctor's coat (expensive fabric, luxury tailoring). {backdrop} Warm, approachable expression. Preserve exact facial likeness."

const DEFAULT_CORPORATE_INSTRUCTION =
  "Show this person in premium professional business attire (expensive dark suit or blazer, designer quality, luxury tailoring). {backdrop} Confident, professional expression. Preserve exact facial likeness."

const DEFAULT_NEGATIVE_PROMPT =
  "Avoid: blurry, distorted face, different identity, different person, over-smoothing, artificial skin, wrong proportions, cheap-looking clothing, plastic skin, unnatural lighting."

/** Значения по умолчанию для отображения в настройках (когда поле пустое в БД). */
export function getPromptDefaults() {
  return {
    promptAnalysis: DEFAULT_ANALYSIS_PROMPT,
    promptUniversalFraming: DEFAULT_UNIVERSAL_FRAMING,
    promptMedicalInstruction: DEFAULT_MEDICAL_INSTRUCTION,
    promptCorporateInstruction: DEFAULT_CORPORATE_INSTRUCTION,
    promptNegative: DEFAULT_NEGATIVE_PROMPT,
  }
}

export function getAnalysisPrompt(employeeName: string): string {
  const s = getAppSettings()
  const template = s.promptAnalysis.trim() || DEFAULT_ANALYSIS_PROMPT
  return template.replace(/\{employeeName\}/g, employeeName || "Сотрудник")
}

export function getUniversalFraming(): string {
  const s = getAppSettings()
  return s.promptUniversalFraming.trim() || DEFAULT_UNIVERSAL_FRAMING
}

export function getMedicalInstruction(backdrop: string): string {
  const s = getAppSettings()
  const template = s.promptMedicalInstruction.trim() || DEFAULT_MEDICAL_INSTRUCTION
  return template.replace(/\{backdrop\}/g, backdrop)
}

export function getCorporateInstruction(backdrop: string): string {
  const s = getAppSettings()
  const template = s.promptCorporateInstruction.trim() || DEFAULT_CORPORATE_INSTRUCTION
  return template.replace(/\{backdrop\}/g, backdrop)
}

export function getNegativePrompt(): string {
  const s = getAppSettings()
  return s.promptNegative.trim() || DEFAULT_NEGATIVE_PROMPT
}
