export type AnalyticsEventPayload = {
  eventName: string
  eventData?: Record<string, any>
  sessionId?: string | null
  userId?: string | null
  pageUrl?: string | null
  userAgent?: string | null
  createdAt?: string
}
