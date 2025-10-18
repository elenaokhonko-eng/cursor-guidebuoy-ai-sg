import { createClient } from "@/lib/supabase/client"

export interface RouterSession {
  id: string
  session_token: string
  dispute_narrative?: string
  voice_transcript?: string
  audio_file_url?: string
  classification_result?: any
  clarifying_questions?: any
  user_responses?: any
  eligibility_assessment?: any
  recommended_path?: string
  created_at: string
  expires_at: string
  converted_to_user_id?: string
  conversion_date?: string
}

export function generateSessionToken(): string {
  return `router_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("router_session_token")
}

export function setSessionToken(token: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem("router_session_token", token)
}

export function clearSessionToken(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem("router_session_token")
}

export async function createRouterSession(): Promise<RouterSession | null> {
  const supabase = createClient()
  const sessionToken = generateSessionToken()

  const { data, error } = await supabase
    .from("router_sessions")
    .insert({
      session_token: sessionToken,
      ip_address: null, // Will be set by server
      user_agent: typeof window !== "undefined" ? navigator.userAgent : null,
    })
    .select()
    .single()

  if (error) {
    console.error("[v0] Error creating router session:", error)
    return null
  }

  setSessionToken(sessionToken)
  return data
}

export async function getRouterSession(sessionToken: string): Promise<RouterSession | null> {
  const supabase = createClient()

  const { data, error } = await supabase.from("router_sessions").select("*").eq("session_token", sessionToken).single()

  if (error) {
    console.error("[v0] Error fetching router session:", error)
    return null
  }

  return data
}

export async function updateRouterSession(
  sessionToken: string,
  updates: Partial<RouterSession>,
): Promise<RouterSession | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("router_sessions")
    .update(updates)
    .eq("session_token", sessionToken)
    .select()
    .single()

  if (error) {
    console.error("[v0] Error updating router session:", error)
    return null
  }

  return data
}

export async function convertRouterSessionToUser(
  sessionToken: string,
  userId: string,
): Promise<{ success: boolean; sessionData?: RouterSession }> {
  const supabase = createClient()

  try {
    // Update router session with user conversion
    const { data, error } = await supabase
      .from("router_sessions")
      .update({
        converted_to_user_id: userId,
        conversion_date: new Date().toISOString(),
      })
      .eq("session_token", sessionToken)
      .select()
      .single()

    if (error) {
      console.error("[v0] Error converting router session:", error)
      return { success: false }
    }

    // Track conversion event
    await supabase.from("analytics_events").insert({
      event_name: "router_conversion_complete",
      user_id: userId,
      session_id: sessionToken,
      event_data: {
        session_id: data.id,
        recommended_path: data.recommended_path,
        eligibility_score: data.eligibility_assessment?.eligibility_score,
      },
      page_url: typeof window !== "undefined" ? window.location.href : null,
      user_agent: typeof window !== "undefined" ? navigator.userAgent : null,
      created_at: new Date().toISOString(),
    })

    return { success: true, sessionData: data }
  } catch (error) {
    console.error("[v0] Conversion error:", error)
    return { success: false }
  }
}
