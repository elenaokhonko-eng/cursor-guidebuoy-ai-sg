import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { google } from "@ai-sdk/google"
import { z } from "zod"
import { rateLimit, keyFrom } from "@/lib/rate-limit"

function scrub(obj: any): any {
  try {
    const json = JSON.stringify(obj)
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
      .replace(/\b([STFG]\d{7}[A-Z])\b/gi, "[REDACTED_NRIC]")
      .replace(/\b(\+?65[- ]?)?\d{4}[- ]?\d{4}\b/g, "[REDACTED_PHONE]")
      .replace(/\b\d{12,16}\b/g, "[REDACTED_ACCOUNT]")
    return JSON.parse(json)
  } catch {
    return obj
  }
}

const questionRequestSchema = z.object({
  session_token: z.string().min(1, "session_token is required"),
  classification: z.record(z.any(), z.any()),
})

export async function POST(request: NextRequest) {
  try {
    const rl = rateLimit(keyFrom(request, "/api/router/questions"), 20, 60_000)
    if (!rl.ok) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })

    let parsed
    try {
      parsed = questionRequestSchema.parse(await request.json())
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json({ error: "Invalid request body", details: err.flatten() }, { status: 400 })
      }
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const { session_token: sessionToken, classification } = parsed
    void sessionToken

    // Generate personalized questions based on classification
    const { text } = await generateText({
      model: google("models/gemini-1.5-flash", {
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      }),
      prompt: `You are an expert in Singapore financial disputes and FIDReC cases.

Based on this dispute classification:
${JSON.stringify(scrub(classification), null, 2)}

Generate 5-7 clarifying questions to assess FIDReC eligibility and case strength.

Questions should cover:
1. Singapore institution verification
2. Individual vs business consumer
3. Claim amount
4. Incident timing
5. Prior complaint to institution
6. Product type
7. Evidence availability

Return a JSON object with a "questions" array. Each question should have:
- key: unique identifier (snake_case)
- question: the question text
- type: "radio", "text", "number", or "date"
- options: array of options (for radio type)
- required: boolean

Return ONLY valid JSON, no other text.`,
      maxOutputTokens: 1000,
    })

    let data
    try {
      data = JSON.parse(text)
    } catch (err) {
      console.error("[v0] Questions JSON parse error:", err, text)
      return NextResponse.json({ error: "Unable to parse generated questions" }, { status: 502 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Questions generation error:", error)
    return NextResponse.json({ error: "Failed to generate questions" }, { status: 500 })
  }
}
