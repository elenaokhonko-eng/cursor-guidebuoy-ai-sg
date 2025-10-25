import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServiceClient } from "@/lib/supabase/service"
import { EMAIL_FROM, ADMIN_EMAIL } from "@/lib/email-config"
import { sendMail } from "@/lib/mail"
import { render } from "@react-email/render"
import { WaitlistConfirmationEmail } from "@/lib/email-templates"
import { rateLimit, keyFrom } from "@/lib/rate-limit"

const waitlistSchema = z.object({
  email: z.string().email(),
  name: z.string().max(120).optional(),
  first_name: z.string().max(120).optional(),
  last_name: z.string().max(120).optional(),
  source: z.string().max(120).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const rl = rateLimit(keyFrom(request, "/api/waitlist/join"), 8, 60_000)
    if (!rl.ok) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    }

    let parsed
    try {
      parsed = waitlistSchema.parse(await request.json())
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json({ error: "Invalid request body", details: err.flatten() }, { status: 400 })
      }
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const { email, name, first_name, last_name } = parsed
    const source = parsed.source ?? "direct"

    const supabase = createServiceClient()

    // Add to waitlist
    const displayName = name || [first_name, last_name].filter(Boolean).join(" ") || null

    const insertPayload: Record<string, any> = {
      email,
      name: displayName,
      source,
    }

    const { data: waitlistEntry, error: insertError } = await supabase
      .from("waitlist")
      .upsert(insertPayload, { onConflict: "email" })
      .select()
      .single()

    if (insertError && !insertError.message.includes("duplicate")) {
      throw insertError
    }

    // Send confirmation email to user
    try {
      const html = await render(WaitlistConfirmationEmail({ userName: displayName || undefined, userEmail: email, source }))
      await sendMail({ to: email, subject: "You're on the GuideBuoy AI Waitlist!", html, from: EMAIL_FROM })
    } catch (emailError) {
      console.error("[v0] User confirmation email failed:", emailError)
    }

    // Send notification to admin
    try {
      await sendMail({
        from: EMAIL_FROM,
        to: ADMIN_EMAIL,
        subject: "New GuideBuoy AI Waitlist Signup",
        html: `
          <h2>New Waitlist Signup</h2>
          <p><strong>Name:</strong> ${displayName || "Not provided"}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Source:</strong> ${source}</p>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        `,
      })
    } catch (emailError) {
      console.error("[v0] Admin notification email failed:", emailError)
    }

    return NextResponse.json({
      success: true,
      message: "Successfully added to waitlist",
    })
  } catch (error) {
    console.error("[v0] Waitlist API error:", error)
    return NextResponse.json({ error: "Failed to add to waitlist" }, { status: 500 })
  }
}
