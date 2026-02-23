
'use server'

import { registerUser, loginUser, destroySession, getSession, isApprovalRequired, hashPassword, verifyPassword, type UserGender } from '@/lib/auth'
import { sql } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

type RegistrationGender = 'male' | 'female' | 'other'

function parseGender(input: FormDataEntryValue | null): 'MALE' | 'FEMALE' | 'OTHER' {
  const value = (typeof input === 'string' ? input : '').toLowerCase() as RegistrationGender
  if (value === 'female') return 'FEMALE'
  if (value === 'other') return 'OTHER'
  return 'MALE'
}

export async function register(formData: FormData) {
  const name = formData.get('name') as string
  const lastName = formData.get('lastName') as string
  const phoneLast4 = formData.get('phoneLast4') as string
  const password = formData.get('password') as string
  const gender = parseGender(formData.get('gender'))

  if (!name || !lastName || !phoneLast4 || !password) {
    return { error: 'Todos los campos son requeridos' }
  }

  if (phoneLast4.length !== 4 || !/^\d{4}$/.test(phoneLast4)) {
    return { error: 'Ingresa los ultimos 4 digitos de tu celular' }
  }

  if (password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres' }
  }

  try {
    const result = await registerUser(name.trim(), lastName.trim(), phoneLast4, password, gender)
    
    if (result.pending) {
      return { success: true, pending: true, message: 'Solicitud enviada. Un administrador debe aprobar tu cuenta.' }
    } else {
      // User was created and auto-logged in, redirect to dashboard
      return { success: true, pending: false, redirect: '/dashboard' }
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Error al registrar' }
  }
}

export async function login(formData: FormData) {
  const name = formData.get('name') as string
  const phoneLast4 = formData.get('phoneLast4') as string
  const password = formData.get('password') as string

  if (!name || !phoneLast4 || !password) {
    return { error: 'Todos los campos son requeridos' }
  }

  try {
    await loginUser(name.trim(), phoneLast4, password)
    return { success: true, redirect: '/dashboard' }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Error al iniciar sesion' }
  }
}

export async function logout() {
  await destroySession()
  redirect('/login')
}

export async function getCurrentUser() {
  return await getSession()
}

export async function getApprovalRequired() {
  return isApprovalRequired()
}

type UpdateProfileResult = { success?: true; error?: string }

function normalizeUserName(input: string): string {
  return input.trim().toLowerCase()
}

function normalizeNamePart(input: string): string {
  return input.trim()
}

function ensureAlphanumericOnly(value: string, fieldLabel: string): void {
  if (!/^[a-z0-9]+$/i.test(value)) {
    throw new Error(`${fieldLabel} solo puede contener letras y numeros (sin espacios ni simbolos)`)
  }
}

function parseGenderStrict(input: FormDataEntryValue | null): UserGender {
  const raw = typeof input === 'string' ? input : ''
  if (raw === 'FEMALE') return 'FEMALE'
  if (raw === 'OTHER') return 'OTHER'
  return 'MALE'
}

export async function updateMyProfile(formData: FormData): Promise<UpdateProfileResult> {
  const session = await getSession()
  if (!session) return { error: 'No autenticado' }

  const name = (formData.get('name') as string | null) ?? ''
  const lastName = (formData.get('lastName') as string | null) ?? ''
  const phoneLast4 = (formData.get('phoneLast4') as string | null) ?? ''
  const gender = parseGenderStrict(formData.get('gender'))

  if (!name || !lastName || !phoneLast4) {
    return { error: 'Todos los campos son requeridos' }
  }
  if (phoneLast4.length !== 4 || !/^\d{4}$/.test(phoneLast4)) {
    return { error: 'Ingresa los ultimos 4 digitos de tu celular' }
  }

  try {
    const normalizedName = normalizeUserName(name)
    const normalizedLastName = normalizeNamePart(lastName)

    if (!normalizedLastName) {
      return { error: 'Apellido es requerido' }
    }

    ensureAlphanumericOnly(normalizedName, 'Nombre')
    ensureAlphanumericOnly(normalizedLastName, 'Apellido')

    // Enforce uniqueness rule: name + phone_last_four
    // It is case-insensitive on name.
    const existing = await sql`
      SELECT id
      FROM users
      WHERE lower(name) = ${normalizedName}
        AND phone_last_four = ${phoneLast4}
        AND id <> ${session.userId}
      LIMIT 1
    `
    if (existing.length > 0) {
      return { error: 'Ya existe un usuario con ese nombre y numero' }
    }

    await sql`
      UPDATE users
      SET name = ${normalizedName},
          last_name = ${normalizedLastName},
          phone_last_four = ${phoneLast4},
          gender = ${gender}::user_gender,
          updated_at = NOW()
      WHERE id = ${session.userId}
    `

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/configuracion')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Error al actualizar perfil' }
  }
}

type ChangePasswordResult = { success?: true; error?: string }

export async function changeMyPassword(formData: FormData): Promise<ChangePasswordResult> {
  const session = await getSession()
  if (!session) return { error: 'No autenticado' }

  const currentPassword = (formData.get('currentPassword') as string | null) ?? ''
  const newPassword = (formData.get('newPassword') as string | null) ?? ''
  const newPasswordRepeat = (formData.get('newPasswordRepeat') as string | null) ?? ''

  if (!currentPassword || !newPassword || !newPasswordRepeat) {
    return { error: 'Todos los campos son requeridos' }
  }
  if (newPassword.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres' }
  }
  if (newPassword !== newPasswordRepeat) {
    return { error: 'La nueva contraseña no coincide' }
  }
  if (currentPassword === newPassword) {
    return { error: 'La nueva contraseña no puede ser igual a la actual' }
  }

  try {
    const rows = await sql`SELECT password_hash FROM users WHERE id = ${session.userId}`
    const currentHash = rows[0]?.password_hash as string | undefined
    if (!currentHash) return { error: 'Usuario no encontrado' }

    const ok = await verifyPassword(currentPassword, currentHash)
    if (!ok) return { error: 'Contraseña actual incorrecta' }

    const newHash = await hashPassword(newPassword)
    await sql`
      UPDATE users
      SET password_hash = ${newHash}, updated_at = NOW()
      WHERE id = ${session.userId}
    `

    revalidatePath('/dashboard/configuracion')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Error al cambiar contraseña' }
  }
}
