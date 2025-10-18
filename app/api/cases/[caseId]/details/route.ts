import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(_request: NextRequest, { params }: { params: { caseId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("cases")
    .select("id, claim_type, status, claim_amount, institution_name, incident_date, case_summary")
    .eq("id", params.caseId)
    .single()
  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(request: NextRequest, { params }: { params: { caseId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const payload = await request.json()
  const allowed = (({ claim_amount, institution_name, incident_date, case_summary }) => ({ claim_amount, institution_name, incident_date, case_summary }))(payload)

  const { data, error } = await supabase
    .from("cases")
    .update({ ...allowed, updated_at: new Date().toISOString() })
    .eq("id", params.caseId)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

