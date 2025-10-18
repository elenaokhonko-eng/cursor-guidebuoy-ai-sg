import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { referralCode, newUserId } = await request.json()

    if (!referralCode || !newUserId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = createClient()

    // Find referrer by code
    const { data: referrerProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("referral_code", referralCode)
      .single()

    if (!referrerProfile) {
      return NextResponse.json({ error: "Invalid referral code" }, { status: 404 })
    }

    // Create referral record
    const { error: insertError } = await supabase.from("referrals").insert({
      referrer_user_id: referrerProfile.id,
      referral_code: referralCode,
      referred_user_id: newUserId,
      status: "converted",
      converted_at: new Date().toISOString(),
    })

    if (insertError) {
      throw insertError
    }

    // Update referrer's referral count
    await supabase.rpc("increment_referral_count", { user_id: referrerProfile.id })

    // Track analytics event
    await supabase.from("analytics_events").insert({
      event_name: "referral_conversion",
      user_id: newUserId,
      event_data: {
        referrer_id: referrerProfile.id,
        referral_code: referralCode,
      },
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Referral tracking error:", error)
    return NextResponse.json({ error: "Failed to track referral" }, { status: 500 })
  }
}
