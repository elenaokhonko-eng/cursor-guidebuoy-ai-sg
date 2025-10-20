import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const referralTrackSchema = z.object({
  referralCode: z.string().min(1, "referralCode is required"),
  newUserId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    let parsed
    try {
      parsed = referralTrackSchema.parse(await request.json())
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json({ error: "Invalid request body", details: err.flatten() }, { status: 400 })
      }
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const { referralCode, newUserId } = parsed

    const supabase = await createClient()

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
