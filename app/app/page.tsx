import HomeClient from "./_components/home-client"
import { createClient } from "@/lib/supabase/server"
import type { User } from "@supabase/supabase-js"

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return <HomeClient initialUser={(user as User) ?? null} />
}
