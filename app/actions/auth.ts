'use server'

import { registerUser, loginUser, destroySession, getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export async function register(formData: FormData) {
  const name = formData.get('name') as string
  const phoneLast4 = formData.get('phoneLast4') as string
  const password = formData.get('password') as string

  if (!name || !phoneLast4 || !password) {
    return { error: 'Todos los campos son requeridos' }
  }

  if (phoneLast4.length !== 4 || !/^\d{4}$/.test(phoneLast4)) {
    return { error: 'Ingresa los ultimos 4 digitos de tu celular' }
  }

  if (password.length < 4) {
    return { error: 'La contraseña debe tener al menos 4 caracteres' }
  }

  try {
    await registerUser(name.trim(), phoneLast4, password)
    return { success: true, message: 'Solicitud enviada. Un administrador debe aprobar tu cuenta.' }
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
    redirect('/dashboard')
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
