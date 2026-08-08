'use server'

import { getSession } from '@/lib/auth'
import { buildInviteUrl, sendInviteEmail } from '@/lib/email'
import { EmailSendError } from '@/lib/email-errors'
import { cancelRegistrationInvite, createRegistrationInvite, getInviteAvailability, type InviteAvailability } from '@/lib/invitations'

type InviteStatusResult = InviteAvailability | { error: string }

export async function getMyInviteStatus(): Promise<InviteStatusResult> {
  const session = await getSession()
  if (!session) return { error: 'No autenticado' }

  return getInviteAvailability(session.userId, Boolean(session.admin))
}

type SendInviteResult =
  | { success: true; inviteUrl: string; expiresAt: string; emailSent: boolean }
  | { error: string }

export async function sendRegistrationInviteAction(formData: FormData): Promise<SendInviteResult> {
  const session = await getSession()
  if (!session) return { error: 'No autenticado' }

  const email = ((formData.get('email') as string | null) ?? '').trim()

  const inviterName = session.lastName
    ? `${session.name} ${session.lastName}`.trim()
    : session.name

  try {
    const { token, expiresAt, inviteId } = await createRegistrationInvite(
      session.userId,
      Boolean(session.admin),
      email || undefined,
    )

    const inviteUrl = buildInviteUrl(token)
    let emailSent = false

    if (email) {
      try {
        await sendInviteEmail(email, inviteUrl, inviterName)
        emailSent = true
      } catch (error) {
        await cancelRegistrationInvite(inviteId)
        if (error instanceof EmailSendError) {
          return { error: 'No pudimos enviar el email de invitacion. Intenta de nuevo mas tarde.' }
        }
        throw error
      }
    }

    return {
      success: true,
      inviteUrl,
      expiresAt: expiresAt.toISOString(),
      emailSent,
    }
  } catch (error) {
    if (error instanceof EmailSendError) {
      return { error: 'No pudimos enviar el email de invitacion. Intenta de nuevo mas tarde.' }
    }
    return { error: error instanceof Error ? error.message : 'Error al crear la invitacion' }
  }
}
