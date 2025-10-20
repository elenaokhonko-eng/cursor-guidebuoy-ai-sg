import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { rateLimit, keyFrom } from "@/lib/rate-limit"

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["victim", "helper", "lead_victim", "defendant"]).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const rl = rateLimit(keyFrom(request, "/api/auth/register"), 5, 60_000)
    if (!rl.ok) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    }

    const supabase = await createClient()
    let parsed
    try {
      parsed = registerSchema.parse(await request.json())
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json({ error: "Invalid request body", details: err.flatten() }, { status: 400 })
      }
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const { email, password, role } = parsed

    // Register user with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: role || "victim",
        },
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      user: data.user,
      message: "Registration successful. Please check your email to verify your account.",
    })
  } catch (error) {
    console.error("[v0] Registration error:", error)
    return NextResponse.json({ error: "Registration failed" }, { status: 500 })
  }
}
