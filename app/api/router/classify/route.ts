import { type NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai"
import { z } from "zod"
import { rateLimit, keyFrom } from "@/lib/rate-limit"
import { createServiceClient } from "@/lib/supabase/service"
import { getNextStepsForRuleEngine, type ClaimType } from "@/lib/rules"

type ClassificationOutput = {
  claim_type: ClaimType
  recommendation: "Financial Institution" | "Police" | "Other"
  summary: string
  key_entities?: string[]
}

const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY
if (!API_KEY) {
  throw new Error("GOOGLE_GENERATIVE_AI_API_KEY environment variable not set.")
}

const genAI = new GoogleGenerativeAI(API_KEY)
const modelName = "gemini-1.5-flash-latest"

const classifyRequestSchema = z.object({
  session_token: z.string().min(1, "session_token is required"),
  narrative: z.string().min(1, "narrative is required").max(20_000, "narrative is too long"),
})

const systemInstruction = `You are an AI assistant analyzing financial dispute descriptions from users in Singapore. Your task is to classify the issue and provide ONLY a single, valid JSON object matching the following TypeScript type. Do not include any introductory text, concluding text, explanations, or markdown formatting like \`\`\`json.

Categories for claim_type:
- Phishing Scam: User lost money due to deceptive messages, calls, or links impersonating legitimate entities.
- Mis-sold Product: User bought a financial product (insurance, investment) that was unsuitable for their needs or misrepresented.
- Denied Insurance Claim: User's claim on an insurance policy (life, health, CI, etc.) was rejected.
- Police Matter: The issue seems primarily criminal (e.g., love scam, investment fraud not involving a regulated FI directly, physical theft) and should be reported to the police first.
- Other/Unclear: The description doesn't fit the above or lacks sufficient detail.

Recommendations for recommendation:
- Financial Institution: The primary next step involves dealing with a bank or insurer (even if police report is also needed).
- Police: The primary next step is reporting to the Singapore Police Force.
- Other: Not enough information to recommend a primary channel.

TypeScript type for JSON output:
type ClassificationOutput = {
  claim_type: 'Phishing Scam' | 'Mis-sold Product' | 'Denied Insurance Claim' | 'Police Matter' | 'Other/Unclear';
  recommendation: 'Financial Institution' | 'Police' | 'Other';
  summary: string; // Brief one-sentence summary
  key_entities?: string[]; // Optional list of mentioned entities like bank names, amounts
};`

function sanitizeText(input: string): string {
  if (!input) return input
  let out = input
  out = out.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
  out = out.replace(/\b([STFG]\d{7}[A-Z])\b/gi, "[REDACTED_NRIC]")
  out = out.replace(/\b(\+?65[- ]?)?\d{4}[- ]?\d{4}\b/g, "[REDACTED_PHONE]")
  out = out.replace(/\b\d{12,16}\b/g, "[REDACTED_ACCOUNT]")
  return out
}

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

    const sanitizedNarrative = sanitizeText(narrative)

    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    })

    const userPrompt = `User Description:
"""
${sanitizedNarrative}
"""

JSON Output:`

    console.log(`Calling Gemini (${modelName}) for classification via Google SDK...`)
    const result = await model.generateContent(userPrompt)
    const response = result.response
    const rawText = response.text()

    console.log("[v0] Raw Gemini Classification Response:", rawText)

    let classificationResult: ClassificationOutput
    try {
      classificationResult = JSON.parse(rawText) as ClassificationOutput
      if (!classificationResult.claim_type || !classificationResult.recommendation || !classificationResult.summary) {
        throw new Error("Parsed JSON is missing required fields.")
      }
      console.log("Successfully parsed classification:", classificationResult)
    } catch (parseError: any) {
      console.error("[v0] Classification JSON parse error:", parseError, "Raw output:", rawText)
      classificationResult = {
        claim_type: "Other/Unclear",
        recommendation: "Other",
        summary: "Failed to classify. The AI response was not in the expected format.",
      }
    }

    const supabase = createServiceClient()
    const { error: insertError } = await supabase.from("anonymized_training_data").insert({
      original_case_id: null,
      anonymized_narrative: sanitizedNarrative,
      dispute_category: classificationResult.claim_type,
      outcome_type: null,
      anonymization_method: "regex_v2",
    })
    if (insertError) {
      console.error("[v0] Failed to persist anonymized training data:", insertError)
    }

    const nextSteps = getNextStepsForRuleEngine(classificationResult.claim_type)

    return NextResponse.json({
      claimType: classificationResult.claim_type,
      recommendation: classificationResult.recommendation,
      summary: classificationResult.summary,
      keyEntities: classificationResult.key_entities,
      nextSteps,
    })
  } catch (error: any) {
    console.error("[v0] Classification API error (Google SDK):", error)
    if (error.response?.data) {
      console.error("API Error details:", JSON.stringify(error.response.data, null, 2))
    }
    return NextResponse.json({ error: error.message || "Failed to classify case" }, { status: 500 })
  }
}
