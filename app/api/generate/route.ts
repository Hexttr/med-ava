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

    const { prompt, style } = await request.json()

    if (!prompt) {
      return NextResponse.json(
        { error: "Не указан промпт" },
        { status: 400 }
      )
    }

    // Use Gemini's Imagen model for generation
    const enhancedPrompt = `Professional studio headshot portrait photo. ${prompt}. Ultra high quality, 8k resolution, professional photography, sharp focus, natural skin texture. ${
      style === "medical"
        ? "Clean white/light gray backdrop, medical professional aesthetic."
        : "Dark corporate backdrop, business professional aesthetic."
    }`

    // Try Imagen 3 via Gemini API
    const imagenResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt: enhancedPrompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: "3:4",
            personGeneration: "allow_all",
          },
        }),
      }
    )

    if (imagenResponse.ok) {
      const imagenData = await imagenResponse.json()
      const imageBytes = imagenData.predictions?.[0]?.bytesBase64Encoded

      if (imageBytes) {
        const imageUrl = `data:image/png;base64,${imageBytes}`
        return NextResponse.json({ imageUrl })
      }
    }

    // Fallback: Use Gemini 2.0 Flash with image generation
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Generate a professional portrait photo based on this description: ${enhancedPrompt}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
      }
    )

    if (!geminiResponse.ok) {
      const err = await geminiResponse.text()
      console.error("[v0] Image generation error:", err)
      return NextResponse.json(
        { error: "Ошибка генерации изображения. У ключа может не быть доступа к моделям генерации изображений." },
        { status: 500 }
      )
    }

    const geminiData = await geminiResponse.json()
    const parts = geminiData.candidates?.[0]?.content?.parts

    if (parts) {
      for (const part of parts) {
        if (part.inlineData) {
          const imageUrl = `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`
          return NextResponse.json({ imageUrl })
        }
      }
    }

    return NextResponse.json(
      { error: "Изображение не сгенерировано. Попробуйте другое фото или промпт." },
      { status: 500 }
    )
  } catch (error) {
    console.error("[v0] Generation error:", error)
    return NextResponse.json(
      { error: "Внутренняя ошибка при генерации" },
      { status: 500 }
    )
  }
}
