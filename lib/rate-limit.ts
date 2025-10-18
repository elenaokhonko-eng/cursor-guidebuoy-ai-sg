type Hit = { count: number; expiresAt: number }

const buckets = new Map<string, Hit>()

export function rateLimit(key: string, limit = 20, windowMs = 60_000): { ok: boolean; remaining: number; reset: number } {
  const now = Date.now()
  const hit = buckets.get(key)
  if (!hit || hit.expiresAt <= now) {
    buckets.set(key, { count: 1, expiresAt: now + windowMs })
    return { ok: true, remaining: limit - 1, reset: now + windowMs }
  }
  if (hit.count >= limit) {
    return { ok: false, remaining: 0, reset: hit.expiresAt }
  }
  hit.count += 1
  return { ok: true, remaining: Math.max(0, limit - hit.count), reset: hit.expiresAt }
}

export function keyFrom(request: Request, route: string) {
  const ip = request.headers.get("x-forwarded-for") || (request as any).ip || "unknown"
  return `${route}:${ip}`
}

