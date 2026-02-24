import { NextRequest, NextResponse } from "next/server"
import { getGeminiKey } from "@/lib/settings"

export async function POST(request: NextRequest) {
  try {
    const geminiKey = await getGeminiKey()
    if (!geminiKey) {
      return NextResponse.json(
        { error: "API-ключ Gemini не настроен" },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const photo = formData.get("photo") as File | null
    const employeeName = (formData.get("employeeName") as string) || "Employee"

    if (!photo) {
      return NextResponse.json(
        { error: "Фото не загружено" },
        { status: 400 }
      )
    }

    // Convert file to base64
    const bytes = await photo.arrayBuffer()
    const base64 = Buffer.from(bytes).toString("base64")
    const mimeType = photo.type || "image/jpeg"

    // Call Gemini API for analysis
    const analysisPrompt = `You are a professional portrait photography prompt engineer for an AI image generation system called NanoBanano.

Analyze this photo of a person named "${employeeName}". Focus on:
- Face shape, skin tone, hair color and style
- Eye color and shape
- Approximate age
- Any distinguishing features
- Gender presentation

Based on your analysis, create TWO detailed prompts for generating professional portraits:

1. MEDICAL PORTRAIT: The person wearing a crisp white medical doctor's coat with a stethoscope, professional medical setting. Clean, well-lit studio backdrop in light gray or white. Professional headshot style, shoulders up. Warm, approachable expression. High-quality studio photography lighting.

2. CORPORATE PORTRAIT: The person in professional business attire (dark suit/blazer). Clean corporate background in dark navy or charcoal gray. Professional headshot style, shoulders up. Confident, professional expression. Studio photography with rim lighting.

IMPORTANT: Each prompt must describe the SAME person from the photo, maintaining their exact appearance, ethnicity, facial features, and characteristics. The prompts should be detailed enough for accurate portrait generation.

Respond in EXACTLY this JSON format:
{
  "description": "Brief description of the person in the photo",
  "medicalPrompt": "Full detailed prompt for medical portrait...",
  "corporatePrompt": "Full detailed prompt for corporate portrait..."
}`

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: analysisPrompt },
                {
                  inlineData: {
                    mimeType,
                    data: base64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        }),
      }
    )

    if (!geminiResponse.ok) {
      const err = await geminiResponse.text()
      console.error("[v0] Gemini API error:", err)
      return NextResponse.json(
        { error: "Не удалось проанализировать фото. Проверьте API-ключ." },
        { status: 500 }
      )
    }

    const geminiData = await geminiResponse.json()
    const textContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text

    if (!textContent) {
      return NextResponse.json(
        { error: "Gemini не вернул результат анализа" },
        { status: 500 }
      )
    }

    // Parse JSON from response (handle markdown code blocks)
    let parsed
    try {
      const jsonMatch = textContent.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        throw new Error("No JSON found in response")
      }
    } catch {
      console.error("[v0] Failed to parse Gemini response:", textContent)
      return NextResponse.json(
        { error: "Не удалось разобрать результат анализа" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      description: parsed.description || "Person analyzed",
      medicalPrompt: parsed.medicalPrompt || "Professional medical portrait",
      corporatePrompt: parsed.corporatePrompt || "Professional corporate portrait",
    })
  } catch (error) {
    console.error("[v0] Analysis error:", error)
    return NextResponse.json(
      { error: "Внутренняя ошибка при анализе" },
      { status: 500 }
    )
  }
}
