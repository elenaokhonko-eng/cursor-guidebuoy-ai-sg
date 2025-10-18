"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"

export default function CaseCheckoutRedirect() {
  const params = useParams()
  const router = useRouter()
  const caseId = params.id as string

  useEffect(() => {
    const go = async () => {
      try {
        const res = await fetch("/api/payments/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caseId }),
        })
        const data = await res.json()
        if (res.ok && data.url) {
          window.location.href = data.url
        } else {
          alert(data.error || "Failed to start checkout")
          router.replace(`/app/case/${caseId}/dashboard`)
        }
      } catch (err) {
        console.error("checkout error", err)
        alert("Failed to start checkout")
        router.replace(`/app/case/${caseId}/dashboard`)
      }
    }
    go()
  }, [caseId, router])

  return null
}

