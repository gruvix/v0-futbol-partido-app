import { sql } from './db'

const REGISTRATION_INVITE_DURATION_HOURS = 24
const INVITE_COOLDOWN_MS = 24 * 60 * 60 * 1000
const NEW_USER_INVITE_WAIT_MS = 7 * 24 * 60 * 60 * 1000

export type InviteAvailability = {
  canInvite: boolean
  nextAvailableAt: string | null
  blockedByCooldown: boolean
  blockedByNewUserWait: boolean
  cooldownEndsAt: string | null
  newUserWaitEndsAt: string | null
}

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

export async function getInviteAvailability(userId: number, isAdmin: boolean): Promise<InviteAvailability> {
  const users = await sql`SELECT created_at, admin FROM users WHERE id = ${userId}`
  if (users.length === 0) {
    return {
      canInvite: false,
      nextAvailableAt: null,
      blockedByCooldown: false,
      blockedByNewUserWait: false,
      cooldownEndsAt: null,
      newUserWaitEndsAt: null,
    }
  }

  const userIsAdmin = isAdmin || Boolean(users[0].admin)
  if (userIsAdmin) {
    return {
      canInvite: true,
      nextAvailableAt: null,
      blockedByCooldown: false,
      blockedByNewUserWait: false,
      cooldownEndsAt: null,
      newUserWaitEndsAt: null,
    }
  }

  const createdAt = new Date(users[0].created_at as string)
  const now = Date.now()

  const lastInvite = await sql`
    SELECT created_at
    FROM user_registration_invites
    WHERE created_by_user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 1
  `

  let cooldownEndsAt: Date | null = null
  if (lastInvite.length > 0) {
    cooldownEndsAt = new Date(new Date(lastInvite[0].created_at as string).getTime() + INVITE_COOLDOWN_MS)
  }

  const newUserWaitEndsAt = isAdmin ? null : new Date(createdAt.getTime() + NEW_USER_INVITE_WAIT_MS)

  const waitUntilMs = Math.max(
    cooldownEndsAt && cooldownEndsAt.getTime() > now ? cooldownEndsAt.getTime() : 0,
    newUserWaitEndsAt && newUserWaitEndsAt.getTime() > now ? newUserWaitEndsAt.getTime() : 0,
  )

  const blockedByCooldown = Boolean(cooldownEndsAt && cooldownEndsAt.getTime() > now)
  const blockedByNewUserWait = Boolean(newUserWaitEndsAt && newUserWaitEndsAt.getTime() > now)

  return {
    canInvite: waitUntilMs <= now,
    nextAvailableAt: waitUntilMs > now ? new Date(waitUntilMs).toISOString() : null,
    blockedByCooldown,
    blockedByNewUserWait,
    cooldownEndsAt: cooldownEndsAt && cooldownEndsAt.getTime() > now ? cooldownEndsAt.toISOString() : null,
    newUserWaitEndsAt:
      newUserWaitEndsAt && newUserWaitEndsAt.getTime() > now ? newUserWaitEndsAt.toISOString() : null,
  }
}

export async function validateRegistrationInvite(token: string): Promise<number> {
  const tokenHash = await hashToken(token.trim())

  const rows = await sql`
    SELECT id
    FROM user_registration_invites
    WHERE token_hash = ${tokenHash}
      AND used_at IS NULL
      AND expires_at > NOW()
  `

  if (rows.length === 0) {
    throw new Error('Enlace de invitacion invalido o expirado')
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
  isAdmin: boolean,
  sentToEmail?: string,
): Promise<{ token: string; expiresAt: Date; inviteId: number }> {
  const availability = await getInviteAvailability(createdByUserId, isAdmin)
  if (!availability.canInvite) {
    if (availability.blockedByNewUserWait) {
      throw new Error('Todavia no podes invitar usuarios. Las cuentas nuevas deben esperar 1 semana.')
    }
    throw new Error('Ya enviaste una invitacion en las ultimas 24 horas.')
  }

  const token = generateInviteToken()
  const tokenHash = await hashToken(token)
  const expiresAt = new Date(Date.now() + REGISTRATION_INVITE_DURATION_HOURS * 60 * 60 * 1000)
  const normalizedEmail = sentToEmail?.trim() ? normalizeEmail(sentToEmail) : null

  const inserted = await sql`
    INSERT INTO user_registration_invites (created_by_user_id, invited_email, token_hash, expires_at)
    VALUES (${createdByUserId}, ${normalizedEmail}, ${tokenHash}, ${expiresAt.toISOString()})
    RETURNING id
  `

  return { token, expiresAt, inviteId: inserted[0].id as number }
}

export async function cancelRegistrationInvite(inviteId: number): Promise<void> {
  await sql`
    DELETE FROM user_registration_invites
    WHERE id = ${inviteId} AND used_at IS NULL
  `
}
