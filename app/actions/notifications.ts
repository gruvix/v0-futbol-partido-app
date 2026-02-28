'use server'

import { getSession } from '@/lib/auth'
import { sql } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export type PushNotificationsSettings = {
  newMatch: boolean
  matchCancelled: boolean
  matchFilled: boolean
  cancellation: boolean
  reminder: boolean
  reminderTime: number
}

const DEFAULTS: PushNotificationsSettings = {
  newMatch: false,
  matchCancelled: false,
  matchFilled: false,
  cancellation: false,
  reminder: false,
  reminderTime: 60,
}

export async function getPushNotificationsSettings(): Promise<PushNotificationsSettings | null> {
  const session = await getSession()
  if (!session) return null

  const rows = await sql`
    SELECT new_match, match_cancelled, match_filled, cancellation, reminder, reminder_time
    FROM push_notifications_settings
    WHERE user_id = ${session.userId}
  `

  if (rows.length === 0) return { ...DEFAULTS }

  const row = rows[0]
  return {
    newMatch: row.new_match as boolean,
    matchCancelled: row.match_cancelled as boolean,
    matchFilled: row.match_filled as boolean,
    cancellation: row.cancellation as boolean,
    reminder: row.reminder as boolean,
    reminderTime: row.reminder_time as number,
  }
}

type UpdateResult = { success?: true; error?: string }

export async function updatePushNotificationsSettings(formData: FormData): Promise<UpdateResult> {
  const session = await getSession()
  if (!session) return { error: 'No autenticado' }

  const newMatch = formData.get('newMatch') === 'true'
  const matchCancelled = formData.get('matchCancelled') === 'true'
  const matchFilled = formData.get('matchFilled') === 'true'
  const cancellation = formData.get('cancellation') === 'true'
  const reminder = formData.get('reminder') === 'true'
  const reminderTime = Math.max(5, Math.min(1440, Number(formData.get('reminderTime')) || 60))

  try {
    await sql`
      INSERT INTO push_notifications_settings (user_id, new_match, match_cancelled, match_filled, cancellation, reminder, reminder_time)
      VALUES (${session.userId}, ${newMatch}, ${matchCancelled}, ${matchFilled}, ${cancellation}, ${reminder}, ${reminderTime})
      ON CONFLICT (user_id)
      DO UPDATE SET
        new_match = ${newMatch},
        match_cancelled = ${matchCancelled},
        match_filled = ${matchFilled},
        cancellation = ${cancellation},
        reminder = ${reminder},
        reminder_time = ${reminderTime}
    `

    revalidatePath('/dashboard/configuracion')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Error al guardar notificaciones' }
  }
}
