import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Pull primary user data
    const [{ data: profile }, { data: cases }, { data: responses }, { data: payments }, { data: outcomes } ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("cases").select("*").or(`user_id.eq.${user.id},owner_user_id.eq.${user.id},creator_user_id.eq.${user.id}`),
      supabase.from("case_responses").select("*").in(
        "case_id",
        (await supabase.from("cases").select("id").eq("user_id", user.id)).data?.map((c: any) => c.id) || [],
      ),
      supabase.from("payments").select("*").eq("user_id", user.id),
      supabase.from("case_outcomes").select("*").in(
        "case_id",
        (await supabase.from("cases").select("id").eq("user_id", user.id)).data?.map((c: any) => c.id) || [],
      ),
    ])

    const exportPayload = {
      generated_at: new Date().toISOString(),
      user: { id: user.id, email: user.email },
      profile: profile || null,
      cases: cases || [],
      case_responses: responses || [],
      payments: payments || [],
      case_outcomes: outcomes || [],
    }

    return NextResponse.json(exportPayload)
  } catch (err) {
    console.error("[privacy] export error:", err)
    return NextResponse.json({ error: "Failed to export data" }, { status: 500 })
  }
}

