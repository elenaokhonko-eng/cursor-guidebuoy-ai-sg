import { type NextRequest, NextResponse } from "next/server"
import { EMAIL_FROM } from "@/lib/email-config"
import { sendMail } from "@/lib/mail"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    // Require an authenticated user to avoid exposing an open email relay
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { to, subject, html, from } = await request.json()

    if (!to || !subject || !html) {
      return NextResponse.json({ error: "Missing required fields: to, subject, html" }, { status: 400 })
    }

    const info = await sendMail({ from: from || EMAIL_FROM, to, subject, html })
    return NextResponse.json({ success: true, messageId: info.messageId })
  } catch (err) {
    console.error("[email/send] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
