import { sql } from './db'

const REGISTRATION_INVITE_DURATION_HOURS = 24
const INVITES_PER_ADMIN_PER_DAY = 24

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function normalizeEmail(input: string): string {
  return input.trim().toLowerCase()
}

function generateInviteToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function validateRegistrationInvite(
  token: string,
  registrationEmail: string,
): Promise<number> {
  const tokenHash = await hashToken(token.trim())
  const normalizedEmail = normalizeEmail(registrationEmail)

  const rows = await sql`
    SELECT id, invited_email
    FROM user_registration_invites
    WHERE token_hash = ${tokenHash}
      AND used_at IS NULL
      AND expires_at > NOW()
  `

  if (rows.length === 0) {
    throw new Error('Enlace de invitacion invalido o expirado')
  }

  const invitedEmail = rows[0].invited_email as string | null
  if (invitedEmail && normalizeEmail(invitedEmail) !== normalizedEmail) {
    throw new Error('Este enlace de invitacion no es valido para ese email')
  }

  return rows[0].id as number
}

export async function consumeRegistrationInvite(inviteId: number, userId?: number): Promise<void> {
  const result = await sql`
    UPDATE user_registration_invites
    SET used_at = NOW(), used_by_user_id = ${userId ?? null}
    WHERE id = ${inviteId} AND used_at IS NULL
    RETURNING id
  `

  if (result.length === 0) {
    throw new Error('Enlace de invitacion invalido o expirado')
  }
}

export async function createRegistrationInvite(
  createdByUserId: number,
  invitedEmail?: string,
): Promise<{ token: string; expiresAt: Date }> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const recent = await sql`
    SELECT COUNT(*)::int AS count
    FROM user_registration_invites
    WHERE created_by_user_id = ${createdByUserId}
      AND created_at > ${since}
  `

  if (Number(recent[0]?.count ?? 0) >= INVITES_PER_ADMIN_PER_DAY) {
    throw new Error('Alcanzaste el limite de invitaciones por dia')
  }

  const token = generateInviteToken()
  const tokenHash = await hashToken(token)
  const expiresAt = new Date(Date.now() + REGISTRATION_INVITE_DURATION_HOURS * 60 * 60 * 1000)
  const normalizedEmail = invitedEmail?.trim() ? normalizeEmail(invitedEmail) : null

  await sql`
    INSERT INTO user_registration_invites (created_by_user_id, invited_email, token_hash, expires_at)
    VALUES (${createdByUserId}, ${normalizedEmail}, ${tokenHash}, ${expiresAt.toISOString()})
  `

  return { token, expiresAt }
}
