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

const assessSchema = z.object({
  session_token: z.string().min(1, "session_token is required"),
  classification: z.record(z.any(), z.any()),
  responses: z.record(z.any(), z.any()),
})

export async function POST(request: NextRequest) {
  try {
    const rl = rateLimit(keyFrom(request, "/api/router/assess"), 20, 60_000)
    if (!rl.ok) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })

    let parsed
    try {
      parsed = assessSchema.parse(await request.json())
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json({ error: "Invalid request body", details: err.flatten() }, { status: 400 })
      }
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const { session_token: sessionToken, classification, responses } = parsed
    void sessionToken

    const { text } = await generateText({
      model: google("models/gemini-1.5-flash-latest", {
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      }),
      prompt: `You are an expert in Singapore FIDReC (Financial Industry Disputes Resolution Centre) eligibility criteria.

FIDReC Eligibility Requirements:
1. Must be an individual consumer (not business)
2. Dispute must be with a Singapore financial institution (FIDReC member)
3. Claim amount must be <= SGD 150,000
4. Incident must have occurred within last 6 years
5. Must have first complained to the institution
6. Institution must have rejected or not resolved within 30 days

Dispute Classification:
${JSON.stringify(scrub(classification), null, 2)}

User Responses:
${JSON.stringify(scrub(responses), null, 2)}

Assess eligibility and provide:
1. is_fidrec_eligible: boolean
2. eligibility_score: 0-100 (confidence in case strength)
3. recommended_path: "fidrec_eligible" | "waitlist" | "self_service" | "not_eligible"
4. reasoning: Array of key points explaining the assessment
5. missing_info: Array of any critical missing information
6. next_steps: Array of 3-5 recommended actions
7. estimated_timeline: String describing expected timeline
8. success_probability: "high" | "medium" | "low"

Path Selection Logic:
- "fidrec_eligible": Meets all criteria, strong case (score >= 70)
- "waitlist": Meets criteria but needs professional help (score 40-69)
- "self_service": Doesn't meet FIDReC criteria but can self-resolve
- "not_eligible": Cannot proceed with dispute

Return ONLY valid JSON, no other text.`,
      maxOutputTokens: 1000,
    })

    let assessment
    try {
      assessment = JSON.parse(text)
    } catch (err) {
      console.error("[v0] Assessment JSON parse error:", err, text)
      return NextResponse.json({ error: "Unable to parse assessment result" }, { status: 502 })
    }

    return NextResponse.json(assessment)
  } catch (error) {
    console.error("[v0] Assessment error:", error)
    return NextResponse.json({ error: "Assessment failed" }, { status: 500 })
  }
}
