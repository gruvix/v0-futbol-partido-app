'use server'

import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { sql } from '@/lib/db'
import { MIN_STAT_VALUE, MAX_STAT_VALUE } from '@/lib/stats'
import type { StatsUser } from '@/lib/stats'

export async function getUsersWithStats(): Promise<{ error?: string; users: StatsUser[] }> {
  const session = await getSession()
  if (!session?.admin) {
    return { error: 'No autorizado', users: [] }
  }

  const users = await sql`
    SELECT
      u.id,
      trim(initcap(u.name) || ' ' || initcap(u.last_name)) as name,
      u.phone_last_four,
      COALESCE(s.pac, 5)::int AS pac,
      COALESCE(s.sho, 5)::int AS sho,
      COALESCE(s.pas, 5)::int AS pas,
      COALESCE(s.dri, 5)::int AS dri,
      COALESCE(s.def, 5)::int AS def,
      COALESCE(s.phy, 5)::int AS phy
    FROM users u
    LEFT JOIN stats s ON s.user_id = u.id
    WHERE u.is_approved = true
    ORDER BY u.name ASC
  `

  return { users: users as StatsUser[] }
}

function clampStat(value: number): number {
  if (!Number.isFinite(value)) return 5
  return Math.max(MIN_STAT_VALUE, Math.min(MAX_STAT_VALUE, Math.round(value)))
}

export async function saveUserStats(formData: FormData): Promise<void> {
  const session = await getSession()
  if (!session?.admin) {
    return
  }

  const userId = Number(formData.get('userId'))
  if (!Number.isFinite(userId) || userId <= 0) {
    return
  }

  const pac = clampStat(Number(formData.get('pac')))
  const sho = clampStat(Number(formData.get('sho')))
  const pas = clampStat(Number(formData.get('pas')))
  const dri = clampStat(Number(formData.get('dri')))
  const def = clampStat(Number(formData.get('def')))
  const phy = clampStat(Number(formData.get('phy')))

  await sql`
    INSERT INTO stats (user_id, pac, sho, pas, dri, def, phy, updated_at)
    VALUES (${userId}, ${pac}, ${sho}, ${pas}, ${dri}, ${def}, ${phy}, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      pac = EXCLUDED.pac,
      sho = EXCLUDED.sho,
      pas = EXCLUDED.pas,
      dri = EXCLUDED.dri,
      def = EXCLUDED.def,
      phy = EXCLUDED.phy,
      updated_at = NOW()
  `

  revalidatePath('/dashboard/stats')
}
