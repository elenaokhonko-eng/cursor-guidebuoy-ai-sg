import { type NextRequest, NextResponse } from "next/server"
import { EMAIL_FROM } from "@/lib/email-config"
import { WelcomeEmail } from "@/lib/email-templates"
import { sendMail } from "@/lib/mail"
import { render } from "@react-email/render"

export async function POST(request: NextRequest) {
  try {
    const { userEmail, userName, hasRouterSession } = await request.json()

    if (!userEmail) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const html = render(WelcomeEmail({ userName, userEmail, hasRouterSession }))
    const info = await sendMail({ from: EMAIL_FROM, to: userEmail, subject: "Welcome to GuideBuoy AI - Let's Get Started", html })
    return NextResponse.json({ success: true, messageId: info.messageId })
  } catch (error) {
    console.error("[v0] Welcome email error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
