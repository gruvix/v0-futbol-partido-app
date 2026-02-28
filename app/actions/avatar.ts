'use server'

import { getSession } from '@/lib/auth'
import { sql } from '@/lib/db'
import { revalidatePath } from 'next/cache'

const GRID_SIZE = 16
const TOTAL_PIXELS = GRID_SIZE * GRID_SIZE
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i

type SaveAvatarResult = { success?: true; error?: string }

export async function savePixelAvatar(data: string): Promise<SaveAvatarResult> {
  const session = await getSession()
  if (!session) return { error: 'No autenticado' }

  // Validate the payload
  let pixels: unknown[]
  try {
    const parsed: unknown = JSON.parse(data)
    if (!Array.isArray(parsed) || parsed.length !== TOTAL_PIXELS) {
      return { error: 'Formato de avatar inválido' }
    }
    pixels = parsed
  } catch {
    return { error: 'JSON inválido' }
  }

  // Validate each pixel is either null or a hex color string
  for (const pixel of pixels) {
    if (pixel !== null && (typeof pixel !== 'string' || !HEX_COLOR_RE.test(pixel))) {
      return { error: 'Formato de avatar inválido' }
    }
  }

  try {
    await sql`
      UPDATE users
      SET pixel_avatar = ${data}, updated_at = NOW()
      WHERE id = ${session.userId}
    `

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/configuracion')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Error al guardar avatar' }
  }
}

export async function getMyPixelAvatar(): Promise<string | null> {
  const session = await getSession()
  if (!session) return null

  const rows = await sql`SELECT pixel_avatar FROM users WHERE id = ${session.userId}`
  return (rows[0]?.pixel_avatar as string | null) ?? null
}
