import Brevo from '@getbrevo/brevo'
import nodemailer from 'nodemailer'
import { Resend } from 'resend'

const sender = process.env.MAIL_FROM || process.env.SMTP_USER || process.env.GMAIL_USER || process.env.GMAIL_EMAIL || 'no-reply@ethiovest.local'
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

const resendApiKey = process.env.RESEND_API_KEY
const hasResend = Boolean(resendApiKey)
const resend = hasResend ? new Resend(resendApiKey) : null

const brevoApi = new Brevo.TransactionalEmailsApi()
const hasBrevo = Boolean(process.env.BREVO_API_KEY)
if (hasBrevo) {
  brevoApi.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY)
}

const gmailUser = process.env.GMAIL_USER || process.env.GMAIL_EMAIL
const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASSWORD
const smtpHost = process.env.SMTP_HOST
const smtpPort = Number(process.env.SMTP_PORT || 587)
const smtpUser = process.env.SMTP_USER
const smtpPass = process.env.SMTP_PASS

const hasGmailSmtp = Boolean(gmailUser && gmailPass)
const hasGenericSmtp = Boolean(smtpHost && smtpUser && smtpPass)
const hasSmtp = hasGmailSmtp || hasGenericSmtp

const smtpTransporter = hasSmtp
  ? nodemailer.createTransport(
      hasGmailSmtp
        ? {
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: { user: gmailUser, pass: gmailPass }
          }
        : {
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: { user: smtpUser, pass: smtpPass }
          }
    )
  : null

export const isEmailProviderConfigured = hasResend || hasSmtp || hasBrevo

export const getEmailProviderStatus = () => ({
  configured: isEmailProviderConfigured,
  resend: hasResend,
  smtp: hasSmtp,
  gmail: hasGmailSmtp,
  brevo: hasBrevo,
  sender
})

const sendEmail = async ({ to, subject, html }) => {
  if (!isEmailProviderConfigured) {
    console.warn('No email provider configured. Configure Resend, Gmail SMTP, or Brevo API key.')
    return { status: 'skipped', reason: 'no_provider' }
  }

  if (resend) {
    try {
      const resp = await resend.emails.send({
        from: sender,
        to,
        subject,
        html
      })
      const messageId = resp?.data?.id || resp?.id
      console.log('Resend accepted email', { to, messageId })
      return { status: 'sent', provider: 'resend', messageId }
    } catch (err) {
      console.error('Resend send error', { to, message: err?.message })
      if (!hasSmtp && !hasBrevo) throw err
    }
  }

  if (smtpTransporter) {
    try {
      const smtpResult = await smtpTransporter.sendMail({
        from: sender,
        to,
        subject,
        html
      })
      const messageId = smtpResult?.messageId
      console.log('SMTP accepted email', { to, messageId })
      return { status: 'sent', provider: 'smtp', messageId }
    } catch (err) {
      console.error('SMTP send error', { to, message: err?.message })
      if (!hasBrevo) throw err
    }
  }

  if (!hasBrevo) {
    return { status: 'skipped', reason: 'smtp_failed_no_brevo' }
  }

  const email = new Brevo.SendSmtpEmail()
  email.sender = { email: sender, name: 'Ethio Vest' }
  email.to = [{ email: to }]
  email.subject = subject
  email.htmlContent = html

  try {
    const resp = await brevoApi.sendTransacEmail(email)
    const messageId = resp?.messageId || resp?.messageIds?.[0]
    console.log('Brevo accepted email', { to, messageId })
    return { status: 'sent', provider: 'brevo', resp, messageId }
  } catch (err) {
    console.error('Brevo send error', {
      to,
      code: err?.code,
      message: err?.message,
      response: err?.response?.body
    })
    throw err
  }
}

export const sendVerificationEmail = async ({ email, token }) => {
  const link = `${frontendUrl}/verify?token=${encodeURIComponent(token)}`
  const html = `<p>Verify your Ethio Vest account.</p><p><a href="${link}">Verify Account</a></p><p>This link expires in 24 hours.</p>`
  return sendEmail({ to: email, subject: 'Verify your Ethio Vest account', html })
}

export const sendResetEmail = async ({ email, token }) => {
  const link = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`
  const html = `<p>Reset your Ethio Vest password.</p><p><a href="${link}">Reset Password</a></p><p>This link expires in 30 minutes.</p>`
  return sendEmail({ to: email, subject: 'Reset your Ethio Vest password', html })
}
