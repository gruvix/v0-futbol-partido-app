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
  return process.env.EMAIL_FROM || 'Fulbito <soporte@barifutbol.com.ar>'
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

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const resend = getResend()

  const { error } = await resend.emails.send({
    from: getFromAddress(),
    to,
    subject: 'Recuperar tu contraseña - Fulbito',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Recuperar tu contraseña</h2>
        <p>Recibimos una solicitud para restablecer tu contraseña en Fulbito.</p>
        <p>
          <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background: #16a34a; color: white; text-decoration: none; border-radius: 6px;">
            Restablecer contraseña
          </a>
        </p>
        <p>Este enlace expira en 30 minutos. Si no pediste este cambio, podés ignorar este correo.</p>
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
    subject: `${inviterName} te invito a Fulbito`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>${inviterName} te invito a Fulbito</h2>
        <p>Fulbito es una app para organizar partidos de futbol con amigos.</p>
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
