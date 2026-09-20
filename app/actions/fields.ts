'use server'

import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import {
  createField,
  deactivateField,
  listFields,
  normalizeFieldSlug,
  updateField,
  type Field,
  type FieldInput,
} from '@/lib/fields'

async function requireAdmin(): Promise<{ userId: number } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'No autenticado' }
  if (!session.admin) return { error: 'Solo administradores pueden gestionar canchas' }
  return { userId: session.userId }
}

export async function listActiveFieldsAction(): Promise<Field[]> {
  return listFields(false)
}

export async function listAllFieldsAction(): Promise<{ fields?: Field[]; error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  const fields = await listFields(true)
  return { fields }
}

export async function createFieldAction(
  input: FieldInput,
): Promise<{ field?: Field; error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }

  if (!input.name?.trim()) return { error: 'El nombre es requerido' }
  if (!normalizeFieldSlug(input.slug || input.name)) return { error: 'Slug invalido' }
  if (input.cancellation_deadline_hours < 0) return { error: 'Plazo de cancelación invalido' }
  if (input.cancellation_reminder_offset_hours < 0) return { error: 'Recordatorio invalido' }

  try {
    const field = await createField(input)
    revalidatePath('/dashboard/canchas')
    return { field }
  } catch (error) {
    console.error('[createFieldAction]', error)
    const message = error instanceof Error && error.message.includes('unique')
      ? 'Ya existe una cancha con ese slug'
      : 'Error al crear la cancha'
    return { error: message }
  }
}

export async function updateFieldAction(
  id: number,
  input: Partial<FieldInput>,
): Promise<{ field?: Field; error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }

  if (input.name !== undefined && !input.name.trim()) return { error: 'El nombre es requerido' }
  if (input.cancellation_deadline_hours != null && input.cancellation_deadline_hours < 0) {
    return { error: 'Plazo de cancelación invalido' }
  }
  if (input.cancellation_reminder_offset_hours != null && input.cancellation_reminder_offset_hours < 0) {
    return { error: 'Recordatorio invalido' }
  }

  try {
    const field = await updateField(id, input)
    revalidatePath('/dashboard/canchas')
    revalidatePath('/dashboard')
    return { field }
  } catch (error) {
    console.error('[updateFieldAction]', error)
    return { error: 'Error al actualizar la cancha' }
  }
}

export async function deactivateFieldAction(id: number): Promise<{ success?: boolean; error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }

  try {
    await deactivateField(id)
    revalidatePath('/dashboard/canchas')
    return { success: true }
  } catch (error) {
    console.error('[deactivateFieldAction]', error)
    return { error: 'Error al desactivar la cancha' }
  }
}
