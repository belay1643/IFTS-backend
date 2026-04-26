import Brevo from '@getbrevo/brevo'
import nodemailer from 'nodemailer'
import { Resend } from 'resend'

const sender = process.env.MAIL_FROM || process.env.SMTP_USER || process.env.GMAIL_USER || process.env.GMAIL_EMAIL || 'no-reply@ethiovest.local'
const rawFrontendUrl = process.env.FRONTEND_URL || ''
const frontendUrl = rawFrontendUrl.includes('localhost') || !rawFrontendUrl
  ? 'https://ifts-frontend.vercel.app'
  : rawFrontendUrl

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

export const sendUserInviteEmail = async ({ email, name, role, companyId, tempPassword }) => {
  const loginLink = `${frontendUrl}/login?email=${encodeURIComponent(email)}`
  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Manager'
  const credentialRows = tempPassword
    ? `<tr><td style="padding:6px 12px;color:#94a3b8;font-size:13px;">Email</td><td style="padding:6px 12px;color:#f1f5f9;font-size:13px;font-weight:600;">${email}</td></tr>
       <tr><td style="padding:6px 12px;color:#94a3b8;font-size:13px;">Temporary password</td><td style="padding:6px 12px;color:#34d399;font-size:13px;font-weight:700;letter-spacing:0.05em;">${tempPassword}</td></tr>`
    : `<tr><td colspan="2" style="padding:8px 12px;color:#94a3b8;font-size:13px;">Your account already exists — your role has been updated.</td></tr>`

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#1e293b;border-radius:20px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#064e3b 0%,#0f172a 60%,#1e1b4b 100%);padding:36px 32px 28px;text-align:center;">
          <div style="display:inline-block;background:rgba(52,211,153,0.12);border:1px solid rgba(52,211,153,0.3);border-radius:16px;padding:10px 20px;margin-bottom:16px;">
            <span style="font-size:22px;font-weight:900;letter-spacing:-0.5px;color:#ffffff;">Ethio<span style="color:#34d399;">Vest</span></span>
          </div>
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">You're invited!</h1>
          <p style="margin:8px 0 0;font-size:14px;color:#94a3b8;">You have been granted <strong style="color:#34d399;">${roleLabel}</strong> access.</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 20px;font-size:15px;color:#cbd5e1;line-height:1.6;">Hello <strong style="color:#f1f5f9;">${name || 'there'}</strong>,</p>
          <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.7;">
            An administrator has invited you to manage <strong style="color:#e2e8f0;">${companyId || 'a company'}</strong> on the Ethio Vest investment platform. Use the credentials below to log in and get started.
          </p>

          <!-- Credentials box -->
          <table role="presentation" width="100%" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;margin-bottom:28px;border-collapse:collapse;">
            <tr><td colspan="2" style="padding:10px 12px 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;border-bottom:1px solid rgba(255,255,255,0.06);">Your credentials</td></tr>
            ${credentialRows}
          </table>

          <!-- CTA button -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td align="center">
              <a href="${loginLink}"
                 style="display:inline-block;background:linear-gradient(135deg,#10b981,#06b6d4);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:50px;letter-spacing:0.02em;box-shadow:0 8px 24px -6px rgba(16,185,129,0.5);">
                Log In to Ethio Vest →
              </a>
            </td></tr>
          </table>

          <p style="margin:0;font-size:12px;color:#475569;text-align:center;line-height:1.6;">
            Or copy this link into your browser:<br>
            <a href="${loginLink}" style="color:#34d399;word-break:break-all;">${loginLink}</a>
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:16px 32px 24px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
          <p style="margin:0;font-size:12px;color:#475569;line-height:1.6;">
            If you did not expect this invitation, please ignore this email or contact your administrator.<br>
            © ${new Date().getFullYear()} Ethio Vest · Investment Platform
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  return sendEmail({ to: email, subject: `You are invited to Ethio Vest as ${roleLabel}`, html })
}
