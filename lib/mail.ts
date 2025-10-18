import nodemailer from 'nodemailer'

let transporter: nodemailer.Transporter | null = null

export function getMailer() {
  if (transporter) return transporter
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 465)
  const secure = String(process.env.SMTP_SECURE || 'true').toLowerCase() === 'true'
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration missing (SMTP_HOST/SMTP_USER/SMTP_PASS)')
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  })

  return transporter
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
  const defaultFromName = process.env.EMAIL_FROM_NAME || 'GuideBuoy AI'
  const defaultFrom = process.env.EMAIL_FROM || 'info@guidebuoyai.sg'
  const fromHeader = from || `${defaultFromName} <${defaultFrom}>`

  return await mailer.sendMail({ from: fromHeader, to, subject, html })
}

