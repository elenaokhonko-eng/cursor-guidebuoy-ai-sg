"use client"

import type React from "react"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle, Mail, User } from "lucide-react"
import Link from "next/link"

export default function WaitlistPage() {
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const source = searchParams.get("source")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/waitlist/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          source: source || "direct",
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to join waitlist")
      }

      setIsSuccess(true)
    } catch (error) {
      console.error("[v0] Error joining waitlist:", error)
      alert("Something went wrong. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-600" />
            </div>
            <CardTitle className="text-center text-2xl">You're on the list!</CardTitle>
            <CardDescription className="text-center">
              We'll notify you as soon as our full service launches.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg text-center">
              <p className="text-sm font-medium mb-2">What happens next?</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✓ You'll receive a confirmation email</li>
                <li>✓ We'll keep you updated on our progress</li>
                <li>✓ You'll get early access when we launch</li>
              </ul>
            </div>
            <Button onClick={() => router.push("/")} variant="outline" className="w-full">
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">GB</span>
              </div>
              <span className="font-semibold text-lg">GuideBuoy AI</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto">
          <Card className="shadow-lg">
            <CardHeader>
              <Badge variant="secondary" className="w-fit mb-4">
                Early Access
              </Badge>
              <CardTitle className="text-2xl">Join the Waitlist</CardTitle>
              <CardDescription>
                Be the first to know when GuideBuoy AI launches with full case management and expert support.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                  <p className="text-sm font-medium mb-2">What you'll get:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>✓ Early access to full platform</li>
                    <li>✓ Priority case review</li>
                    <li>✓ Exclusive launch pricing</li>
                    <li>✓ Direct support from our team</li>
                  </ul>
                </div>

                <Button type="submit" disabled={isSubmitting} size="lg" className="w-full">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    "Join Waitlist"
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  We respect your privacy. Unsubscribe anytime.
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
