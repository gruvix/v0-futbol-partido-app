import { sql } from './db'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { sendPasswordResetEmail, buildResetPasswordUrl, sendEmailChangeConfirmationEmail, buildConfirmEmailChangeUrl } from './email'
import { validateRegistrationInvite, consumeRegistrationInvite } from './invitations'

const SESSION_DURATION_DAYS = 30
const RESET_TOKEN_DURATION_HOURS = 12
const EMAIL_CHANGE_TOKEN_DURATION_HOURS = 24

// Set REQUIRE_APPROVAL=true to enable manual approval for new users
const REQUIRE_APPROVAL = process.env.REQUIRE_APPROVAL === 'true'

// Set INVITE_ONLY_REGISTRATION=true to require an invite token for new signups
const INVITE_ONLY_REGISTRATION = process.env.INVITE_ONLY_REGISTRATION === 'true'

export type UserGender = 'MALE' | 'FEMALE' | 'OTHER'

export type LoginCredentials =
  | { mode: 'phone'; name: string; phoneLast4: string; password: string }
  | { mode: 'email'; email: string; password: string }

function normalizeUserName(input: string): string {
  // Registration/login identifier must be case-insensitive and stored lowercase.
  return input.trim().toLowerCase()
}

function normalizeNamePart(input: string): string {
  return input.trim()
}

function normalizeEmail(input: string): string {
  return input.trim().toLowerCase()
}

function ensureAlphanumericOnly(value: string, fieldLabel: string): void {
  if (!/^[a-z0-9]+$/i.test(value)) {
    throw new Error(`${fieldLabel} solo puede contener letras y numeros (sin espacios ni simbolos)`) 
  }
}

function ensureValidEmail(value: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error('Ingresa un email valido')
  }
}

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer), byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateSessionToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function createSession(userId: number): Promise<string> {
  const token = generateSessionToken()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS)

  await sql`
    INSERT INTO sessions (user_id, token, expires_at)
    VALUES (${userId}, ${token}, ${expiresAt.toISOString()})
  `

  const cookieStore = await cookies()
  cookieStore.set('session_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })

  return token
}

export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value

  if (!token) return null

  const sessions = await sql`
    SELECT s.*, u.id as user_id, u.name, u.last_name, u.phone_last_four, u.email, u.is_approved, u.admin, u.gender
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ${token} AND s.expires_at > NOW()
  `

  if (sessions.length === 0) return null

  return {
    userId: sessions[0].user_id,
    name: sessions[0].name,
    lastName: sessions[0].last_name,
    phoneLast4: sessions[0].phone_last_four,
    email: sessions[0].email as string | null,
    isApproved: sessions[0].is_approved,
    admin: sessions[0].admin,
    gender: sessions[0].gender as UserGender,
  }
}

export async function destroySession() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value

  if (token) {
    await sql`DELETE FROM sessions WHERE token = ${token}`
    cookieStore.delete('session_token')
  }
}

export async function registerUser(
  name: string,
  lastName: string,
  phoneLast4: string,
  email: string,
  password: string,
  gender: UserGender,
  inviteToken?: string,
) {
  let registrationInviteId: number | null = null

  if (INVITE_ONLY_REGISTRATION) {
    if (!inviteToken?.trim()) {
      throw new Error('Se requiere un enlace de invitacion valido para registrarse')
    }
  }

  const normalizedName = normalizeUserName(name)
  const normalizedLastName = normalizeNamePart(lastName)
  const normalizedEmail = normalizeEmail(email)

  if (INVITE_ONLY_REGISTRATION) {
    registrationInviteId = await validateRegistrationInvite(inviteToken!.trim())
  }

  if (!normalizedLastName) {
    throw new Error('Apellido es requerido')
  }

  // Rules: no symbols, no spaces, only alphanumeric.
  ensureAlphanumericOnly(normalizedName, 'Nombre')
  ensureAlphanumericOnly(normalizedLastName, 'Apellido')
  ensureValidEmail(normalizedEmail)

  const passwordHash = await hashPassword(password)

  // Check if user already exists (by name+phone identity, or by email)
  const existingUsers = await sql`
    SELECT id
    FROM users
    WHERE (lower(name) = ${normalizedName} AND phone_last_four = ${phoneLast4})
       OR lower(email) = ${normalizedEmail}
  `
  
  if (existingUsers.length > 0) {
    throw new Error('Ya existe un usuario con ese nombre y numero, o ese email')
  }

  if (REQUIRE_APPROVAL) {
    // Check if pending request exists
    const existingPending = await sql`
      SELECT id
      FROM pending_users
      WHERE (lower(name) = ${normalizedName} AND phone_last_four = ${phoneLast4})
         OR lower(email) = ${normalizedEmail}
    `
    
    if (existingPending.length > 0) {
      throw new Error('Ya tenes una solicitud pendiente de aprobacion')
    }

    // Create pending user
    await sql`
      INSERT INTO pending_users (name, last_name, phone_last_four, email, password_hash, gender)
      VALUES (${normalizedName}, ${normalizedLastName}, ${phoneLast4}, ${normalizedEmail}, ${passwordHash}, ${gender})
    `

    if (registrationInviteId !== null) {
      await consumeRegistrationInvite(registrationInviteId)
    }

    return { pending: true }
  } else {
    // Create user directly (no approval needed)
    const result = await sql`
      INSERT INTO users (name, last_name, phone_last_four, email, password_hash, gender, is_approved)
      VALUES (${normalizedName}, ${normalizedLastName}, ${phoneLast4}, ${normalizedEmail}, ${passwordHash}, ${gender}, true)
      RETURNING id
    `
    
    // Auto-login the new user
    await createSession(result[0].id)

    if (registrationInviteId !== null) {
      await consumeRegistrationInvite(registrationInviteId, result[0].id)
    }
    
    return { pending: false, userId: result[0].id }
  }
}

export async function loginUser(credentials: LoginCredentials) {
  const users =
    credentials.mode === 'email'
      ? await sql`
          SELECT id, password_hash, is_approved FROM users
          WHERE lower(email) = ${normalizeEmail(credentials.email)}
        `
      : await sql`
          SELECT id, password_hash, is_approved FROM users 
          WHERE lower(name) = ${normalizeUserName(credentials.name)} AND phone_last_four = ${credentials.phoneLast4}
        `

  if (users.length === 0) {
    if (REQUIRE_APPROVAL) {
      const pending =
        credentials.mode === 'email'
          ? await sql`SELECT id FROM pending_users WHERE lower(email) = ${normalizeEmail(credentials.email)}`
          : await sql`
              SELECT id FROM pending_users
              WHERE lower(name) = ${normalizeUserName(credentials.name)} AND phone_last_four = ${credentials.phoneLast4}
            `
      if (pending.length > 0) {
        throw new Error('Tu cuenta esta pendiente de aprobacion')
      }
    }
    throw new Error('Usuario no encontrado')
  }

  const user = users[0]
  
  if (REQUIRE_APPROVAL && !user.is_approved) {
    throw new Error('Tu cuenta no esta aprobada')
  }

  const validPassword = await verifyPassword(credentials.password, user.password_hash)
  if (!validPassword) {
    throw new Error('Contraseña incorrecta')
  }

  await createSession(user.id)
  return { success: true, userId: user.id }
}

export function isApprovalRequired() {
  return REQUIRE_APPROVAL
}

export function isInviteOnlyRegistration() {
  return INVITE_ONLY_REGISTRATION
}

export async function assertEmailAvailable(userId: number, email: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email)

  const existingUser = await sql`
    SELECT id FROM users WHERE lower(email) = ${normalizedEmail} AND id <> ${userId}
  `
  if (existingUser.length > 0) {
    throw new Error('Ese email ya esta en uso')
  }

  const existingPending = await sql`
    SELECT id FROM pending_users WHERE lower(email) = ${normalizedEmail}
  `
  if (existingPending.length > 0) {
    throw new Error('Ese email ya esta en uso')
  }
}

export async function setUserEmail(userId: number, email: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email)
  ensureValidEmail(normalizedEmail)
  await assertEmailAvailable(userId, normalizedEmail)

  await sql`
    UPDATE users SET email = ${normalizedEmail}, updated_at = NOW() WHERE id = ${userId}
  `
}

export async function requestEmailChange(userId: number, newEmail: string): Promise<void> {
  const normalizedEmail = normalizeEmail(newEmail)
  ensureValidEmail(normalizedEmail)

  const users = await sql`SELECT email FROM users WHERE id = ${userId}`
  if (users.length === 0) {
    throw new Error('Usuario no encontrado')
  }

  const currentEmail = users[0].email as string | null
  if (!currentEmail) {
    throw new Error('Primero tenes que cargar un email')
  }
  if (normalizeEmail(currentEmail) === normalizedEmail) {
    throw new Error('El nuevo email debe ser distinto al actual')
  }

  await assertEmailAvailable(userId, normalizedEmail)

  const token = generateSessionToken()
  const tokenHash = await hashToken(token)
  const expiresAt = new Date(Date.now() + EMAIL_CHANGE_TOKEN_DURATION_HOURS * 60 * 60 * 1000)

  await sql`
    UPDATE email_change_tokens
    SET used_at = NOW()
    WHERE user_id = ${userId} AND used_at IS NULL
  `

  const inserted = await sql`
    INSERT INTO email_change_tokens (user_id, new_email, token_hash, expires_at)
    VALUES (${userId}, ${normalizedEmail}, ${tokenHash}, ${expiresAt.toISOString()})
    RETURNING id
  `
  const tokenRowId = inserted[0].id as number

  try {
    await sendEmailChangeConfirmationEmail(normalizedEmail, buildConfirmEmailChangeUrl(token))
  } catch (error) {
    await sql`UPDATE email_change_tokens SET used_at = NOW() WHERE id = ${tokenRowId}`
    throw error
  }
}

export async function confirmEmailChange(token: string): Promise<void> {
  const tokenHash = await hashToken(token)

  const rows = await sql`
    SELECT id, user_id, new_email, used_at, expires_at
    FROM email_change_tokens
    WHERE token_hash = ${tokenHash}
  `
  if (rows.length === 0) {
    throw new Error('El enlace de confirmacion es invalido o expiro')
  }

  const row = rows[0]
  const userId = row.user_id as number
  const normalizedEmail = normalizeEmail(row.new_email as string)

  if (row.used_at) {
    const users = await sql`SELECT email FROM users WHERE id = ${userId}`
    const currentEmail = users[0]?.email as string | null
    if (currentEmail && normalizeEmail(currentEmail) === normalizedEmail) {
      return
    }
    throw new Error('El enlace de confirmacion es invalido o expiro')
  }

  if (new Date(row.expires_at as string) <= new Date()) {
    throw new Error('El enlace de confirmacion es invalido o expiro')
  }

  ensureValidEmail(normalizedEmail)
  await assertEmailAvailable(userId, normalizedEmail)

  await sql`
    UPDATE users SET email = ${normalizedEmail}, updated_at = NOW() WHERE id = ${userId}
  `
  await sql`UPDATE email_change_tokens SET used_at = NOW() WHERE id = ${row.id}`
  await sql`
    UPDATE email_change_tokens
    SET used_at = NOW()
    WHERE user_id = ${userId} AND used_at IS NULL
  `
  await sql`DELETE FROM sessions WHERE user_id = ${userId}`
}

export async function requestPasswordReset(email: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email)

  const users = await sql`SELECT id FROM users WHERE lower(email) = ${normalizedEmail}`
  if (users.length === 0) {
    // Do not reveal whether the email exists.
    return
  }

  const userId = users[0].id
  const token = generateSessionToken()
  const tokenHash = await hashToken(token)
  const expiresAt = new Date(Date.now() + RESET_TOKEN_DURATION_HOURS * 60 * 60 * 1000)

  await sql`
    UPDATE password_reset_tokens
    SET used_at = NOW()
    WHERE user_id = ${userId} AND used_at IS NULL
  `

  const inserted = await sql`
    INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
    VALUES (${userId}, ${tokenHash}, ${expiresAt.toISOString()})
    RETURNING id
  `
  const tokenRowId = inserted[0].id as number

  try {
    await sendPasswordResetEmail(normalizedEmail, buildResetPasswordUrl(token))
  } catch (error) {
    await sql`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ${tokenRowId}`
    throw error
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = await hashToken(token)

  const rows = await sql`
    SELECT id, user_id FROM password_reset_tokens
    WHERE token_hash = ${tokenHash} AND used_at IS NULL AND expires_at > NOW()
  `
  if (rows.length === 0) {
    throw new Error('El enlace de recuperacion es invalido o expiro')
  }

  const { id, user_id: userId } = rows[0]
  const passwordHash = await hashPassword(newPassword)

  await sql`UPDATE users SET password_hash = ${passwordHash}, updated_at = NOW() WHERE id = ${userId}`
  await sql`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ${id}`
  // Invalidate all existing sessions for this user as a security measure.
  await sql`DELETE FROM sessions WHERE user_id = ${userId}`
}
