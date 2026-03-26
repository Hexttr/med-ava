/**
 * Промпты для анализа и генерации портретов.
 * Читает из app_settings; при пустых значениях использует встроенные по умолчанию.
 */

import { getAppSettings } from "./app-settings"

const DEFAULT_UNIVERSAL_FRAMING =
  "IDENTICAL portrait framing for ALL images: vertical 3:4 waist-up portrait. Show the subject from the top of the head to around the upper waist / mid-torso, with both shoulders and chest clearly visible. Head should occupy about 22-26% of total image height, with the eye line around 30-34% from the top edge. Same camera distance, same head size in frame, same crop, and same torso coverage across all portraits. Do not crop tighter to a bust shot, do not zoom out to full body, and keep hands out of frame. Consistent framing across all portraits."

const DEFAULT_ANALYSIS_PROMPT = `You are extracting IDENTITY ANCHORS for portrait generation. Your goal is MAXIMUM LIKENESS to the source photo so the person is instantly recognizable.

Analyze this photo of a person named "{employeeName}". Describe only the person's identity features in precise, compact English:
- Exact face shape (oval, round, square, heart, etc.)
- Skin tone and texture (specific shade, any visible features)
- Hair: color, exact style, length, parting, any distinctive detail
- Eyes: color, shape, spacing, eyebrows (shape and color)
- Nose and mouth: shape, lip fullness, any distinctive traits
- Approximate age and gender presentation
- Any distinguishing features only if they are clearly visible in the source (moles, freckles, scars, glasses — preserve if worn)
- Facial proportions and any unique characteristics

Do NOT infer or invent facial marks, freckles, moles, scars, acne, skin spots, or blemishes that are not clearly visible in the source photo.
Do NOT describe clothing, background, lighting, pose direction, framing, or style. Do NOT write separate medical/corporate prompts.

Return ONLY one valid JSON object with exactly these keys:
- description: a short plain-English summary of the person in 1 sentence
- identityAnchors: one compact but information-dense paragraph listing the facial and identity traits that MUST stay unchanged in generation

identityAnchors must prioritize immutable identity details and should read like instructions for preserving the same person. Mention what must remain unchanged: facial structure, hair, eyes, skin tone, age impression, clearly visible distinctive marks only, glasses, and proportions.

Respond with ONLY one valid JSON object (no markdown, no \`\`\` code fences, no extra text). Use double quotes for keys and strings; escape any " inside strings as \". Required keys: description, identityAnchors. Example structure:
{
  "description": "Brief description of the person",
  "identityAnchors": "Identity anchors for preserving the same person..."
}`

const DEFAULT_MEDICAL_INSTRUCTION =
  "Show this person in a premium-quality crisp white medical doctor's coat (expensive fabric, luxury tailoring). No stethoscope, no medical accessories — only the white coat. Fully replace the original clothing and upper torso styling with a newly rendered medical uniform: new collar, new neckline, new shoulders, new chest area, and new coat structure. Do not preserve the source garment, blouse, shirt, zipper, trim, neckline, or copied torso folds. {backdrop} Warm, approachable expression. Mouth closed, lips together."

const DEFAULT_CORPORATE_INSTRUCTION =
  "Show this person in premium professional business attire (expensive dark suit or blazer, designer quality, luxury tailoring). {backdrop} Confident, professional expression. Mouth closed, lips together."

const DEFAULT_NEGATIVE_PROMPT =
  "Avoid: different identity, blurry face, soft-focus haze, distorted facial features, over-smoothed skin, pasted cutout edges, floating subject, invented moles, invented freckles, invented beauty marks, acne, blemishes, skin spots not visible in the source, cheap-looking clothing, stethoscope, medical accessories, open mouth, full-body framing, hands in frame."
const MEDICAL_CLOTHING_OVERRIDE_SUFFIX =
  "Medical clothing override: even if the reference already shows white clothing, scrubs, or a medical-looking uniform, you must replace it with a newly rendered premium doctor's coat. Do not preserve the source coat, scrub top, zipper, piping, trim, pocket shape, seam layout, neckline, or chest silhouette."
const CORPORATE_DIVERSITY_SUFFIX =
  "Corporate wardrobe diversity: choose a premium executive outfit that suits the person's presentation, but vary the wardrobe across different people. Do not default to the same navy suit and blue tie. Vary jacket cut, lapels, shirt or blouse, neckline, fabric texture, and restrained luxury color palette while keeping the result formal and expensive."
const CORPORATE_VARIATION_OPTIONS = [
  "Wardrobe direction: charcoal or graphite tailored suit with a refined white or soft ecru shirt, and either no tie or a very subtle dark tie.",
  "Wardrobe direction: deep navy or midnight blazer with a premium light shirt or blouse, clean structured silhouette, and understated executive styling.",
  "Wardrobe direction: dark textured suit or blazer in graphite, ink, or deep brown with a premium blouse/shirt and a distinctive but restrained neckline treatment.",
  "Wardrobe direction: elegant premium business look with a dark blazer and luxurious blouse/top, avoiding the standard blue-tie formula.",
]

function hashString(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0
  }
  return hash
}

function normalizePromptTemplate(template: string): string {
  return template.replace(/\s+/g, " ").trim().toLowerCase()
}

function isLegacyAnalysisTemplate(template: string): boolean {
  const normalized = normalizePromptTemplate(template)
  if (!normalized) return false

  // Older deployments asked Gemini for verbose style prompts and incompatible keys.
  if (normalized.includes("medicalprompt") || normalized.includes("corporateprompt")) {
    return true
  }

  // The current parser expects identityAnchors; if the saved custom prompt does not
  // mention that field at all, it is very likely an outdated template from before
  // the analysis pipeline refactor.
  return !normalized.includes("identityanchors")
}

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
  const customTemplate = s.promptAnalysis.trim()
  const template = customTemplate && !isLegacyAnalysisTemplate(customTemplate)
    ? customTemplate
    : DEFAULT_ANALYSIS_PROMPT
  return template.replace(/\{employeeName\}/g, employeeName || "Сотрудник")
}

export function getUniversalFraming(): string {
  const s = getAppSettings()
  return s.promptUniversalFraming.trim() || DEFAULT_UNIVERSAL_FRAMING
}

export function getMedicalInstruction(backdrop: string): string {
  const s = getAppSettings()
  const template = s.promptMedicalInstruction.trim() || DEFAULT_MEDICAL_INSTRUCTION
  return `${template.replace(/\{backdrop\}/g, backdrop)} ${MEDICAL_CLOTHING_OVERRIDE_SUFFIX}`.trim()
}

export function getCorporateInstruction(backdrop: string, seedSource = ""): string {
  const s = getAppSettings()
  const template = s.promptCorporateInstruction.trim() || DEFAULT_CORPORATE_INSTRUCTION
  const variant =
    CORPORATE_VARIATION_OPTIONS[
      hashString(seedSource || backdrop || "corporate") % CORPORATE_VARIATION_OPTIONS.length
    ]!
  return `${template.replace(/\{backdrop\}/g, backdrop)} ${CORPORATE_DIVERSITY_SUFFIX} ${variant}`.trim()
}

export function getNegativePrompt(): string {
  const s = getAppSettings()
  return s.promptNegative.trim() || DEFAULT_NEGATIVE_PROMPT
}
