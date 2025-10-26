import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { render } from "@react-email/render"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { rateLimit, keyFrom } from "@/lib/rate-limit"
import { buildAppUrl } from "@/lib/url"
import { WelcomeEmail } from "@/lib/email-templates"
import { sendMail } from "@/lib/mail"
import { EMAIL_FROM } from "@/lib/email-config"

const consentSchema = z
  .object({
    purposes: z.array(z.string()).default([]),
    policyVersion: z.string().default("1.0"),
    consentedAt: z.string().optional(),
  })
  .optional()

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["victim", "helper", "lead_victim", "defendant"]).optional(),
  sessionToken: z.string().min(1, "sessionToken is required").optional(),
  firstName: z.string().max(120).optional(),
  lastName: z.string().max(120).optional(),
  consent: consentSchema,
  sendWelcomeEmail: z.boolean().optional(),
})

type RouterSessionRow = Record<string, unknown>

export async function POST(request: NextRequest) {
  try {
    const rl = rateLimit(keyFrom(request, "/api/auth/register"), 5, 60_000)
    if (!rl.ok) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    }

    const supabase = await createClient()
    let parsed
    try {
      parsed = registerSchema.parse(await request.json())
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json({ error: "Invalid request body", details: err.flatten() }, { status: 400 })
      }
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const {
      email,
      password,
      role,
      sessionToken,
      firstName,
      lastName,
      consent,
      sendWelcomeEmail = true,
    } = parsed

    const userMetadata: Record<string, unknown> = { role: role || "victim" }
    if (firstName) userMetadata.first_name = firstName
    if (lastName) userMetadata.last_name = lastName

    const emailRedirectTo = buildAppUrl("/app")

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: userMetadata,
      },
    })

    if (error) {
      console.error("[Auth Register] Signup error:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const newUserId = data.user?.id
    if (!newUserId) {
      console.error("[Auth Register] Signup returned without user data:", data)
      return NextResponse.json({ error: "Registration failed" }, { status: 500 })
    }

    console.log("[Auth Register] Supabase user created successfully. User ID:", newUserId)

    const serviceSupabase = createServiceClient()

    let routerSessionLinked = false
    let routerSessionData: RouterSessionRow | null = null
    let sessionLinkError: string | null = null
    if (sessionToken) {
      console.log(`[Auth Register] Linking session ${sessionToken} to new user ${newUserId}`)
      try {
        const {
          data: sessionUpdateData,
          error: sessionUpdateError,
        } = await serviceSupabase
          .from("router_sessions")
          .update({
            converted_to_user_id: newUserId,
            status: "CONVERTED",
            converted_at: new Date().toISOString(),
          })
          .eq("session_token", sessionToken)
          .select()
          .maybeSingle()

        if (sessionUpdateError) {
          throw sessionUpdateError
        }

        if (!sessionUpdateData) {
          console.warn(`[Auth Register] No router_session found for token ${sessionToken}`)
        } else {
          routerSessionLinked = true
          routerSessionData = sessionUpdateData as RouterSessionRow
          console.log(
            `[Auth Register] Successfully updated router_session ${sessionToken}. Result:`,
            routerSessionData,
          )
        }
      } catch (updateError) {
        sessionLinkError = updateError instanceof Error ? updateError.message : String(updateError)
        console.error(
          `[Auth Register] Failed to update router_session ${sessionToken} for user ${newUserId}:`,
          updateError,
        )
      }
    } else {
      console.warn(
        `[Auth Register] Missing sessionToken or userId, cannot link session. Token: ${sessionToken}, UserID: ${newUserId}`,
      )
    }

    let consentLogged = false
    if (consent) {
      try {
        const { error: consentError } = await serviceSupabase.from("consent_logs").insert({
          user_id: newUserId,
          email,
          consent_purposes: consent.purposes,
          policy_version: consent.policyVersion,
          consented_at: consent.consentedAt ?? new Date().toISOString(),
        })

        if (consentError) {
          throw consentError
        }

        consentLogged = true
        console.log(`[Auth Register] Consent log inserted successfully for new user ${newUserId}`)
      } catch (consentError) {
        console.error(`[Auth Register] Consent log insert failed for new user ${newUserId}:`, consentError)
      }
    }

    let welcomeEmailSent = false
    if (sendWelcomeEmail) {
      try {
        const userName =
          [firstName, lastName].filter(Boolean).join(" ").trim() || email.split("@")[0] || undefined
        const html = await render(
          WelcomeEmail({
            userName,
            userEmail: email,
            hasRouterSession: routerSessionLinked,
          }),
        )
        await sendMail({
          from: EMAIL_FROM,
          to: email,
          subject: "Welcome to GuideBuoy AI - Let's Get Started",
          html,
        })
        welcomeEmailSent = true
      } catch (mailError) {
        console.error("[Auth Register] Welcome email failed:", mailError)
      }
    }

    return NextResponse.json({
      success: true,
      user: data.user,
      sessionLinked: routerSessionLinked,
      routerSession: routerSessionData,
      sessionLinkError,
      consentLogged,
      welcomeEmailSent,
    })
  } catch (error) {
    console.error("[Auth Register] Unexpected registration error:", error)
    return NextResponse.json({ error: "Registration failed" }, { status: 500 })
  }
}
