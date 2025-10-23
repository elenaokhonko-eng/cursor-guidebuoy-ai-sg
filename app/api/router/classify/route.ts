import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { google } from "@ai-sdk/google"
import { z } from "zod"
import { rateLimit, keyFrom } from "@/lib/rate-limit"
import { createServiceClient } from "@/lib/supabase/service"

function sanitizeText(input: string): string {
  if (!input) return input
  let out = input
  out = out.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
  out = out.replace(/\b([STFG]\d{7}[A-Z])\b/gi, "[REDACTED_NRIC]")
  out = out.replace(/\b(\+?65[- ]?)?\d{4}[- ]?\d{4}\b/g, "[REDACTED_PHONE]")
  out = out.replace(/\b\d{12,16}\b/g, "[REDACTED_ACCOUNT]")
  return out
}

const classifyRequestSchema = z.object({
  session_token: z.string().min(1, "session_token is required"),
  narrative: z.string().min(1, "narrative is required").max(20_000, "narrative is too long"),
})

export async function POST(request: NextRequest) {
  try {
    const rl = rateLimit(keyFrom(request, "/api/router/classify"), 20, 60_000)
    if (!rl.ok) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })

    let parsedBody
    try {
      parsedBody = classifyRequestSchema.parse(await request.json())
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json({ error: "Invalid request body", details: err.flatten() }, { status: 400 })
      }
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const { session_token: sessionToken, narrative } = parsedBody
    void sessionToken

    // Use AI to classify the dispute
    const { text } = await generateText({
      model: google("models/gemini-1.5-flash-001", {
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        apiVersion: "v1beta",
      }),
      prompt: `You are an expert in Singapore financial disputes and FIDReC (Financial Industry Disputes Resolution Centre) cases.

Analyze this dispute narrative and classify it:

"${sanitizeText(narrative)}"

Provide a JSON response with:
1. category: One of ["banking_scam", "insurance_claim", "investment_loss", "unauthorized_transaction", "service_failure", "other"]
2. institution_type: One of ["bank", "insurer", "investment_firm", "other"]
3. estimated_amount: Estimated monetary value involved (number or null)
4. urgency: One of ["high", "medium", "low"]
5. key_facts: Array of 3-5 key facts extracted from the narrative
6. initial_assessment: Brief assessment of case strength (1-2 sentences)

Return ONLY valid JSON, no other text.`,
      maxOutputTokens: 500,
    })

    let classification
    try {
      classification = JSON.parse(text)
    } catch (err) {
      console.error("[v0] Classification JSON parse error:", err, text)
      return NextResponse.json({ error: "Unable to parse classification result" }, { status: 502 })
    }

    // Anonymization pass (basic): remove obvious emails/phones/account numbers before any persistence
    const anonymizedNarrative = (narrative as string)
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted_email]")
      .replace(/\b\+?\d[\d\s-]{6,}\b/g, "[redacted_phone]")
      .replace(/\b\d{12,19}\b/g, "[redacted_number]")

    // Store anonymized record only; do not store raw narrative
    const supabase = createServiceClient()
    const { error: insertError } = await supabase.from("anonymized_training_data").insert({
      original_case_id: null,
      anonymized_narrative: anonymizedNarrative,
      dispute_category: classification.category ?? null,
      outcome_type: null,
      anonymization_method: "regex_v1",
    })
    if (insertError) {
      console.error("[v0] Failed to persist anonymized training data:", insertError)
    }

    return NextResponse.json(classification)
  } catch (error) {
    console.error("[v0] Classification error:", error)
    return NextResponse.json({ error: "Classification failed" }, { status: 500 })
  }
}
