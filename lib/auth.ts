import { sql } from './db'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'

const SESSION_DURATION_DAYS = 30

// Set REQUIRE_APPROVAL=true to enable manual approval for new users
const REQUIRE_APPROVAL = process.env.REQUIRE_APPROVAL === 'true'

export type UserGender = 'MALE' | 'FEMALE' | 'OTHER'

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
    SELECT s.*, u.id as user_id, u.name, u.phone_last_four, u.is_approved, u.admin, u.gender
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ${token} AND s.expires_at > NOW()
  `

  if (sessions.length === 0) return null

  return {
    userId: sessions[0].user_id,
    name: sessions[0].name,
    phoneLast4: sessions[0].phone_last_four,
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
  phoneLast4: string,
  password: string,
  gender: UserGender,
) {
  const passwordHash = await hashPassword(password)

  // Check if user already exists
  const existingUsers = await sql`
    SELECT id FROM users WHERE name = ${name} AND phone_last_four = ${phoneLast4}
  `
  
  if (existingUsers.length > 0) {
    throw new Error('Ya existe un usuario con ese nombre y numero')
  }

  if (REQUIRE_APPROVAL) {
    // Check if pending request exists
    const existingPending = await sql`
      SELECT id FROM pending_users WHERE name = ${name} AND phone_last_four = ${phoneLast4}
    `
    
    if (existingPending.length > 0) {
      throw new Error('Ya tenes una solicitud pendiente de aprobacion')
    }

    // Create pending user
    await sql`
      INSERT INTO pending_users (name, phone_last_four, password_hash, gender)
      VALUES (${name}, ${phoneLast4}, ${passwordHash}, ${gender})
    `

    return { pending: true }
  } else {
    // Create user directly (no approval needed)
    const result = await sql`
      INSERT INTO users (name, phone_last_four, password_hash, gender, is_approved)
      VALUES (${name}, ${phoneLast4}, ${passwordHash}, ${gender}, true)
      RETURNING id
    `
    
    // Auto-login the new user
    await createSession(result[0].id)
    
    return { pending: false, userId: result[0].id }
  }
}

export async function loginUser(name: string, phoneLast4: string, password: string) {
  const users = await sql`
    SELECT id, password_hash, is_approved FROM users 
    WHERE name = ${name} AND phone_last_four = ${phoneLast4}
  `

  if (users.length === 0) {
    if (REQUIRE_APPROVAL) {
      // Check if pending
      const pending = await sql`
        SELECT id FROM pending_users WHERE name = ${name} AND phone_last_four = ${phoneLast4}
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

  const validPassword = await verifyPassword(password, user.password_hash)
  if (!validPassword) {
    throw new Error('Contraseña incorrecta')
  }

  await createSession(user.id)
  return { success: true, userId: user.id }
}

export function isApprovalRequired() {
  return REQUIRE_APPROVAL
}
