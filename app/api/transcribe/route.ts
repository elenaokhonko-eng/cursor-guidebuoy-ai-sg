import { type NextRequest, NextResponse } from "next/server"
import { rateLimit, keyFrom } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  try {
    const key = keyFrom(request as any, "/api/transcribe")
    const rl = rateLimit(key, 10, 60_000)
    if (!rl.ok) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })

    const formData = await request.formData()
    const audioFile = formData.get("audio") as File | null

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Missing GOOGLE_GENERATIVE_AI_API_KEY" }, { status: 500 })
    }

    const arrayBuffer = await audioFile.arrayBuffer()
    const base64Audio = Buffer.from(arrayBuffer).toString("base64")
    const mimeType = audioFile.type || "audio/webm"

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: "Transcribe the following audio." },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Audio,
                  },
                },
              ],
            },
          ],
        }),
      },
    )

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text()
      console.error("[v0] Gemini transcription error:", geminiResponse.status, errText)
      return NextResponse.json({ error: "Transcription provider error" }, { status: 502 })
    }

    const result = (await geminiResponse.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }

    const transcription =
      result.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text?.trim() ?? ""

    if (!transcription) {
      return NextResponse.json({ error: "Transcription unavailable" }, { status: 502 })
    }

    return NextResponse.json({ transcription, success: true })
  } catch (error) {
    console.error("[v0] Transcription error:", error)
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 })
  }
}
