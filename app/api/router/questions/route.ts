import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
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

export async function POST(request: NextRequest) {
  try {
    const rl = rateLimit(keyFrom(request as any, "/api/router/questions"), 20, 60_000)
    if (!rl.ok) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    const { session_token, classification } = await request.json()

    if (!session_token || !classification) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Generate personalized questions based on classification
    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
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

    const data = JSON.parse(text)

    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Questions generation error:", error)
    return NextResponse.json({ error: "Failed to generate questions" }, { status: 500 })
  }
}
