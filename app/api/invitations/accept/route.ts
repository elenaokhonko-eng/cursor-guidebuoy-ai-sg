import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { invitationToken } = await request.json()

    // Fetch invitation
    const { data: invitation, error: inviteError } = await supabase
      .from("invitations")
      .select("*")
      .eq("invitation_token", invitationToken)
      .eq("status", "pending")
      .single()

    if (inviteError || !invitation) {
      return NextResponse.json({ error: "Invalid or expired invitation" }, { status: 404 })
    }

    // Check if invitation is expired
    if (new Date(invitation.expires_at) < new Date()) {
      await supabase.from("invitations").update({ status: "expired" }).eq("id", invitation.id)
      return NextResponse.json({ error: "Invitation has expired" }, { status: 400 })
    }

    // Check if user email matches invitation
    if (user.email !== invitation.invited_email) {
      return NextResponse.json({ error: "Email mismatch" }, { status: 403 })
    }

    // Add user as collaborator
    const role = invitation.invited_role
    const permissions = {
      can_view: true,
      can_edit: role === "helper" || role === "lead_victim",
      can_invite: role === "lead_victim",
    }

    const { error: collaboratorError } = await supabase.from("case_collaborators").insert({
      case_id: invitation.case_id,
      user_id: user.id,
      role,
      invited_by: invitation.invited_by,
      accepted_at: new Date().toISOString(),
      permissions,
      status: "active",
    })

    if (collaboratorError) {
      return NextResponse.json({ error: "Failed to add collaborator" }, { status: 500 })
    }

    // Update invitation status
    await supabase
      .from("invitations")
      .update({
        status: "accepted",
        accepted_by: user.id,
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invitation.id)

    // Transfer ownership if invite makes user Victim or Lead Victim
    if (role === "victim" || role === "lead_victim") {
      const { data: caseRow } = await supabase
        .from("cases")
        .select("owner_user_id")
        .eq("id", invitation.case_id)
        .single()
      if (caseRow && caseRow.owner_user_id !== user.id) {
        await supabase
          .from("cases")
          .update({ owner_user_id: user.id, updated_at: new Date().toISOString() })
          .eq("id", invitation.case_id)
      }
    }

    // Increment referral count if this was a referral
    if (invitation.invited_by) {
      await supabase.rpc("increment_referral_count", { user_id: invitation.invited_by })
    }

    return NextResponse.json({ success: true, caseId: invitation.case_id })
  } catch (error) {
    console.error("[v0] Invitation accept error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
