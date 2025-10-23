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

    const apiKey = process.env.API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Missing API_KEY" }, { status: 500 })
    }

    const openAiForm = new FormData()
    // OpenAI expects field name 'file' and 'model'
    openAiForm.append("file", audioFile, (audioFile as any).name || "audio.webm")
    openAiForm.append("model", "whisper-1")
    // You can optionally set 'language' or 'prompt' to bias transcription

    const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: openAiForm,
    })

    if (!resp.ok) {
      const errText = await resp.text()
      console.error("[v0] Whisper API error:", resp.status, errText)
      return NextResponse.json({ error: "Transcription provider error" }, { status: 502 })
    }

    const data = await resp.json() as { text?: string }
    const transcription = data.text || ""

    return NextResponse.json({ transcription, success: true })
  } catch (error) {
    console.error("[v0] Transcription error:", error)
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 })
  }
}
