import { NextResponse, type NextRequest } from "next/server"

// Compatibility endpoint that orchestrates classify -> questions -> assess
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { session_token, narrative, classification, responses } = body

    if (!session_token) {
      return NextResponse.json({ error: "Missing session_token" }, { status: 400 })
    }

    // If no classification and we have narrative, classify first
    if (!classification && narrative) {
      const res = await fetch(new URL("/api/router/classify", request.url), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_token, narrative }),
      })
      if (!res.ok) return NextResponse.json({ error: "Classification failed" }, { status: res.status })
      const data = await res.json()
      return NextResponse.json({ step: "classified", classification: data })
    }

    // If we have classification but no responses, generate questions
    if (classification && !responses) {
      const res = await fetch(new URL("/api/router/questions", request.url), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_token, classification }),
      })
      if (!res.ok) return NextResponse.json({ error: "Question generation failed" }, { status: res.status })
      const data = await res.json()
      return NextResponse.json({ step: "questions", ...data })
    }

    // If we have classification and responses, assess eligibility
    if (classification && responses) {
      const res = await fetch(new URL("/api/router/assess", request.url), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_token, classification, responses }),
      })
      if (!res.ok) return NextResponse.json({ error: "Assessment failed" }, { status: res.status })
      const data = await res.json()
      return NextResponse.json({ step: "assessment", assessment: data })
    }

    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  } catch (err) {
    console.error("/api/triage/analyze error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

