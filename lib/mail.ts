import nodemailer from "nodemailer"
import { logger } from "@/lib/logger"

let transporter: nodemailer.Transporter | null = null
const log = logger.withContext({ module: "mail" })
const RETRYABLE_SMTP_CODES = new Set([421, 450, 451, 452, 454])
const RETRYABLE_ERROR_CODES = new Set(["ECONNECTION", "ETIMEDOUT", "EAUTH", "EREFUSED"])
const MAX_RETRIES = Number(process.env.SMTP_MAX_RETRIES ?? 3)

export function getMailer() {
  if (transporter) return transporter

  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT ?? 587)
  const secure = process.env.SMTP_SECURE === "true"
  const requireTLS = process.env.SMTP_REQUIRE_TLS === "true"
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host) {
    throw new Error("SMTP configuration missing (SMTP_HOST)")
  }

  const auth = user && pass ? { user, pass } : undefined

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS,
    auth,
    pool: true,
    maxConnections: Number(process.env.SMTP_MAX_CONNECTIONS ?? 2),
    maxMessages: Number(process.env.SMTP_MAX_MESSAGES ?? 50),
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS ?? 15_000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS ?? 15_000),
  })

  return transporter
}

function isRetryable(error: any) {
  if (!error) return false
  if (error.code && RETRYABLE_ERROR_CODES.has(error.code)) return true
  if (typeof error.responseCode === "number" && RETRYABLE_SMTP_CODES.has(error.responseCode)) return true
  return false
}

async function sendWithRetry(
  mailer: nodemailer.Transporter,
  options: nodemailer.SendMailOptions,
  attempt = 1,
): Promise<nodemailer.SentMessageInfo> {
  try {
    const result = await mailer.sendMail(options)
    log.info("Email dispatched", {
      to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
      subject: options.subject,
      attempt,
      messageId: result.messageId,
      envelopeTo: result.envelope?.to,
    })
    return result
  } catch (error: any) {
    const metadata = {
      to: options.to,
      subject: options.subject,
      attempt,
      code: error?.code,
      responseCode: error?.responseCode,
    }

    if (attempt < MAX_RETRIES && isRetryable(error)) {
      const delay = Math.min(5000, 500 * 2 ** (attempt - 1))
      log.warn("Retryable email delivery failure", { ...metadata, retryInMs: delay })
      await new Promise((resolve) => setTimeout(resolve, delay))
      return sendWithRetry(mailer, options, attempt + 1)
    }

    log.error("Email delivery failed", {
      ...metadata,
      error: error?.message ?? String(error),
      stack: error?.stack,
    })
    throw error
  }
}

export async function sendMail({
  to,
  subject,
  html,
  from,
}: {
  to: string | string[]
  subject: string
  html: string
  from?: string
}) {
  const mailer = getMailer()
  const defaultFromName = process.env.EMAIL_FROM_NAME || "GuideBuoy AI"
  const defaultFrom = process.env.EMAIL_FROM || "info@guidebuoyai.sg"
  const fromHeader = from || `${defaultFromName} <${defaultFrom}>`

  return sendWithRetry(mailer, { from: fromHeader, to, subject, html })
}
