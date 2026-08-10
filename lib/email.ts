import { Resend } from 'resend'
import { EmailSendError } from './email-errors'

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('[email] Missing RESEND_API_KEY')
    throw new EmailSendError()
  }
  return new Resend(apiKey)
}

function getFromAddress(): string {
  return process.env.EMAIL_FROM || 'BariFutbol <soporte@barifutbol.com.ar>'
}

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://www.barifutbol.com.ar'
}

export function buildResetPasswordUrl(token: string): string {
  return `${getAppUrl()}/reset-password?token=${encodeURIComponent(token)}`
}

export function buildInviteUrl(token: string): string {
  return `${getAppUrl()}/registro?token=${encodeURIComponent(token)}`
}

export function buildConfirmEmailChangeUrl(token: string): string {
  return `${getAppUrl()}/confirm-email?token=${encodeURIComponent(token)}`
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const resend = getResend()

  const { error } = await resend.emails.send({
    from: getFromAddress(),
    to,
    subject: 'Recuperar tu contraseña - BariFutbol',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Recuperar tu contraseña</h2>
        <p>Recibimos una solicitud para restablecer tu contraseña en BariFutbol.</p>
        <p>
          <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background: #16a34a; color: white; text-decoration: none; border-radius: 6px;">
            Restablecer contraseña
          </a>
        </p>
        <p>Este enlace expira en 12 horas. Si no pediste este cambio, podés ignorar este correo.</p>
      </div>
    `,
  })

  if (error) {
    console.error('[email] Resend password reset failed:', error)
    throw new EmailSendError()
  }
}

export async function sendInviteEmail(to: string, inviteUrl: string, inviterName: string): Promise<void> {
  const resend = getResend()

  const { error } = await resend.emails.send({
    from: getFromAddress(),
    to,
    subject: `${inviterName} te invito a BariFutbol`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>${inviterName} te invito a BariFutbol</h2>
        <p>BariFutbol es una app para organizar partidos de futbol con amigos.</p>
        <p>
          <a href="${inviteUrl}" style="display: inline-block; padding: 10px 20px; background: #16a34a; color: white; text-decoration: none; border-radius: 6px;">
            Crear mi cuenta
          </a>
        </p>
        <p>Este enlace es de un solo uso y expira en 24 horas.</p>
      </div>
    `,
  })

  if (error) {
    console.error('[email] Resend invite failed:', error)
    throw new EmailSendError()
  }
}

export async function sendEmailChangeConfirmationEmail(to: string, confirmUrl: string): Promise<void> {
  const resend = getResend()

  const { error } = await resend.emails.send({
    from: getFromAddress(),
    to,
    subject: 'Confirmar cambio de email - BariFutbol',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Confirmar cambio de email</h2>
        <p>Recibimos una solicitud para cambiar el email de tu cuenta en BariFutbol.</p>
        <p>
          <a href="${confirmUrl}" style="display: inline-block; padding: 10px 20px; background: #16a34a; color: white; text-decoration: none; border-radius: 6px;">
            Confirmar nuevo email
          </a>
        </p>
        <p>Este enlace expira en 24 horas. Si no pediste este cambio, podés ignorar este correo.</p>
      </div>
    `,
  })

  if (error) {
    console.error('[email] Resend email change confirmation failed:', error)
    throw new EmailSendError()
  }
}
