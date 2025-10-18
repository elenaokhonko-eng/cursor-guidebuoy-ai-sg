import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { EMAIL_FROM } from "@/lib/email-config"
import { InvitationEmail } from "@/lib/email-templates"
import { sendMail } from "@/lib/mail"
import { render } from "@react-email/render"
import { nanoid } from "nanoid"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { caseId, email, role } = await request.json()

    // Verify user owns or has access to the case
    const { data: caseData, error: caseError } = await supabase
      .from("cases")
      .select("*")
      .eq("id", caseId)
      .single()

    if (caseError || !caseData) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 })
    }

    const isOwner = caseData.owner_user_id === user.id

    // Check collaborator permissions separately
    let isCollaboratorWhoCanInvite = false
    if (!isOwner) {
      const { data: collab } = await supabase
        .from("case_collaborators")
        .select("permissions")
        .eq("case_id", caseId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .single()
      if (collab?.permissions && typeof collab.permissions === "object") {
        isCollaboratorWhoCanInvite = Boolean((collab as any).permissions.can_invite)
      }
    }

    if (!isOwner && !isCollaboratorWhoCanInvite) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Check if invitation already exists
    const { data: existingInvite } = await supabase
      .from("invitations")
      .select("*")
      .eq("case_id", caseId)
      .eq("invited_email", email)
      .eq("status", "pending")
      .single()

    if (existingInvite) {
      return NextResponse.json({ error: "Invitation already sent" }, { status: 400 })
    }

    // Create invitation
    const invitationToken = nanoid(32)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiration

    const { data: invitation, error: inviteError } = await supabase
      .from("invitations")
      .insert({
        case_id: caseId,
        invited_by: user.id,
        invited_email: email,
        invited_role: role || "helper",
        invitation_token: invitationToken,
        expires_at: expiresAt.toISOString(),
        status: "pending",
      })
      .select()
      .single()

    if (inviteError) {
      return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 })
    }

    // Get user profile for email
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single()

const html = await render(
InvitationEmail({
inviterName: profile?.full_name || user.email || "A user",
inviterEmail: user.email || "",
caseTitle: caseData.claim_type?.replace("_", " ") || "Financial Dispute Case",
invitationToken,
role: role || "helper",
})
)

    // Send invitation email
    await sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: `${profile?.full_name || user.email} invited you to collaborate on a case`,
      html,
    })

    return NextResponse.json({ success: true, invitation })
  } catch (error) {
    console.error("[v0] Invitation send error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
