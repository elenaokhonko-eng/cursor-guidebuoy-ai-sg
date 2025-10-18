import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { nanoid } from "nanoid"

export async function POST(request: NextRequest, { params }: { params: { caseId: string } }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const { caseId } = params

    // Generate invitation token
    const invitation_token = nanoid(32)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    // Create read-only invitation (can_view true only)
    const { data: invitation, error: inviteError } = await supabase
      .from("invitations")
      .insert({
        case_id: caseId,
        invited_by: user.id,
        invited_email: email,
        invited_role: "defendant",
        invitation_token,
        expires_at: expiresAt.toISOString(),
        status: "pending",
      })
      .select()
      .single()

    if (inviteError || !invitation) {
      return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || "http://localhost:3000"
    const shareLink = `${appUrl}/invite/${invitation_token}`

    return NextResponse.json({ success: true, message: "Invitation created", shareLink })
  } catch (error) {
    console.error("[v0] Share case error:", error)
    return NextResponse.json({ error: "Failed to share case" }, { status: 500 })
  }
}
