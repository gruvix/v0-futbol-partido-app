'use server'

import { sql } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

function computedMaxPlayers(teamCount: number, teamSize: number): number {
  if (teamCount <= 0) return 0
  return Math.max(1, teamCount) * Math.max(1, teamSize)
}

type PushSubscriptionRow = { endpoint: string; p256dh: string; auth: string }
const MAX_PARTICIPANTS_IN_PUSH_BODY = 6
const FIELDS_TRIGGERING_CHANGE_NOTIFICATION = ['title', 'date_time', 'location_type', 'location_custom', 'field'] as const

function getPushErrorStatusCode(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('statusCode' in error)) return null
  const statusCode = (error as { statusCode?: unknown }).statusCode
  return typeof statusCode === 'number' ? statusCode : null
}

async function sendPushToSubscriptions(subscriptions: PushSubscriptionRow[], payload: { title: string; body: string; url?: string }) {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  if (!vapidPublicKey || !vapidPrivateKey || subscriptions.length === 0) return

  const webpush = (await import('web-push')).default
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:noreply@example.com', vapidPublicKey, vapidPrivateKey)

  const serialized = JSON.stringify(payload)
  await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          serialized
        )
      } catch (error: unknown) {
        const statusCode = getPushErrorStatusCode(error)
        if (statusCode === 404 || statusCode === 410) {
          await sql`DELETE FROM push_subscriptions WHERE endpoint = ${subscription.endpoint}`
        }
      }
    })
  )
}

function buildParticipantNamesSummary(names: string[]): string {
  if (names.length <= MAX_PARTICIPANTS_IN_PUSH_BODY) return names.join(', ')
  return `${names.slice(0, MAX_PARTICIPANTS_IN_PUSH_BODY).join(', ')} +${names.length - MAX_PARTICIPANTS_IN_PUSH_BODY} más`
}

async function sendMatchFilledPushIfNeeded(matchId: number): Promise<void> {
  const matchRows = await sql`
    SELECT
      title,
      CASE WHEN team_count > 0 THEN GREATEST(1, team_count) * GREATEST(1, team_size) ELSE max_players END AS max_players
    FROM matches
    WHERE id = ${matchId}
  `
  const match = matchRows[0]
  if (!match) return

  const maxPlayers = Number(match.max_players || 0)
  if (maxPlayers <= 0) return

  const players = await sql`
    SELECT COALESCE(trim(initcap(u.name) || ' ' || initcap(u.last_name)), mp.guest_name, 'Invitado') AS name
    FROM match_participants mp
    LEFT JOIN users u ON u.id = mp.user_id
    WHERE mp.match_id = ${matchId} AND mp.role = 'PLAYER'
    ORDER BY mp.id ASC
  `
  if (players.length !== maxPlayers) return

  const subscriptions = await sql`
    SELECT DISTINCT ps.endpoint, ps.p256dh, ps.auth
    FROM match_participants mp
    JOIN push_notifications_settings pns ON pns.user_id = mp.user_id
    JOIN push_subscriptions ps ON ps.user_id = mp.user_id
    WHERE mp.match_id = ${matchId}
      AND mp.user_id IS NOT NULL
      AND pns.match_filled = true
  `

  await sendPushToSubscriptions(subscriptions as PushSubscriptionRow[], {
    title: 'Partido lleno',
    body: `${String(match.title || 'El partido')} ya está completo. Jugadores: ${buildParticipantNamesSummary(players.map((p) => String(p.name)))}`,
    url: `/dashboard/partido/${matchId}`,
  })
}

async function sendMatchChangesPush(matchId: number): Promise<void> {
  const matchRows = await sql`SELECT title FROM matches WHERE id = ${matchId}`
  const title = String(matchRows[0]?.title || 'Partido')
  const subscriptions = await sql`
    SELECT DISTINCT ps.endpoint, ps.p256dh, ps.auth
    FROM match_participants mp
    JOIN push_notifications_settings pns ON pns.user_id = mp.user_id
    JOIN push_subscriptions ps ON ps.user_id = mp.user_id
    WHERE mp.match_id = ${matchId}
      AND mp.user_id IS NOT NULL
      AND pns.match_changes = true
  `
  await sendPushToSubscriptions(subscriptions as PushSubscriptionRow[], {
    title: 'Cambios en el partido',
    body: `${title} tuvo cambios de horario, lugar o datos del partido`,
    url: `/dashboard/partido/${matchId}`,
  })
}

async function autoBalanceTeamsIfFull(matchId: number) {
  const matchRows = await sql`
    SELECT team_count, team_size, max_players
    FROM matches
    WHERE id = ${matchId}
  `
  const match = matchRows[0]
  if (!match) return

  const teamCount = Number(match.team_count || 0)
  const teamSize = Number(match.team_size || 0)
  const maxPlayers = Number(match.max_players || 0)
  if (teamCount < 2 || teamSize <= 0 || maxPlayers <= 0) return

  const players = await sql`
    SELECT
      mp.id,
      mp.user_id,
      mp.team,
      mp.team_number,
      (
        COALESCE(s.pac, 5) +
        COALESCE(s.sho, 5) +
        COALESCE(s.pas, 5) +
        COALESCE(s.dri, 5) +
        COALESCE(s.def, 5) +
        COALESCE(s.phy, 5)
      )::float / 6.0 AS overall
    FROM match_participants mp
    LEFT JOIN stats s ON s.user_id = mp.user_id
    WHERE mp.match_id = ${matchId} AND mp.role = 'PLAYER'
  `

  if (players.length !== maxPlayers) return

  const sorted = [...players].sort((a, b) => Number(b.overall) - Number(a.overall))
  const teams: Array<{ total: number; members: number[] }> = Array.from(
    { length: teamCount },
    () => ({ total: 0, members: [] })
  )

  for (const player of sorted) {
    let targetTeam = -1
    for (let i = 0; i < teamCount; i++) {
      if (teams[i].members.length >= teamSize) continue
      if (targetTeam === -1 || teams[i].total < teams[targetTeam].total) {
        targetTeam = i
      }
    }
    if (targetTeam === -1) break
    teams[targetTeam].members.push(player.id)
    teams[targetTeam].total += Number(player.overall)
  }

  const desiredByParticipantId = new Map<number, { team: 'A' | 'B' | null; teamNumber: number | null }>()
  for (let i = 0; i < teams.length; i++) {
    for (const participantId of teams[i].members) {
      const teamNumber = i + 1
      desiredByParticipantId.set(participantId, {
        team: teamCount === 2 ? (teamNumber === 1 ? 'A' : 'B') : null,
        teamNumber: teamCount === 2 ? null : teamNumber,
      })
    }
  }

  const alreadyBalanced = players.every((player) => {
    const desired = desiredByParticipantId.get(player.id)
    if (!desired) return false
    return player.team === desired.team && player.team_number === desired.teamNumber
  })
  if (alreadyBalanced) return

  await sql`
    UPDATE match_participants
    SET team = NULL, team_number = NULL
    WHERE match_id = ${matchId} AND role = 'PLAYER'
  `

  for (let i = 0; i < teams.length; i++) {
    for (const participantId of teams[i].members) {
      const teamNumber = i + 1
      if (teamCount === 2) {
        const team = teamNumber === 1 ? 'A' : 'B'
        await sql`
          UPDATE match_participants
          SET team = ${team}, team_number = NULL
          WHERE id = ${participantId} AND match_id = ${matchId}
        `
      } else {
        await sql`
          UPDATE match_participants
          SET team = NULL, team_number = ${teamNumber}
          WHERE id = ${participantId} AND match_id = ${matchId}
        `
      }
    }
  }
}

export async function createMatch(formData: FormData) {
  const session = await getSession()
  if (!session) {
    return { error: 'No autenticado' }
  }

  const dateStr = formData.get('date') as string
  const time = formData.get('time') as string
  const locationType = formData.get('locationType') as string
  const locationCustom = formData.get('locationCustom') as string
  const field = formData.get('field') as string
  const isPublic = formData.get('isPublic') !== 'false' // default to true
  const titleInput = formData.get('title') as string
  const teamCount = parseInt(formData.get('teamCount') as string) || 0
  const teamSize = parseInt(formData.get('teamSize') as string) || 5
  // max_players rules:
  // - if teamCount > 0 (teams mode), it is derived as teamCount * teamSize
  // - if teamCount === 0 (no teams), creator can choose it
  const requestedMaxPlayers = parseInt(formData.get('maxPlayers') as string) || 10
  const maxPlayers = teamCount > 0 ? computedMaxPlayers(teamCount, teamSize) : requestedMaxPlayers
  const invitesPerPlayerStr = formData.get('invitesPerPlayer') as string
  const invitesPerPlayer = invitesPerPlayerStr ? parseInt(invitesPerPlayerStr) : null

  // Get creator's name for default title
  const user = await sql`SELECT trim(initcap(name) || ' ' || initcap(last_name)) as full_name FROM users WHERE id = ${session.userId}`
  const creatorName = (user[0]?.full_name as string | undefined) || 'Usuario'
  const title = titleInput?.trim() ? titleInput : `Partido de ${creatorName}`

  if (!dateStr || !time || !locationType) {
    return { error: 'Todos los campos son requeridos' }
  }

  const dateTime = new Date(`${dateStr}T${time}`)
  
  if (dateTime < new Date()) {
    return { error: 'La fecha debe ser en el futuro' }
  }

  try {
    const result = await sql`
      INSERT INTO matches (created_by_user_id, date_time, location_type, location_custom, field, is_public, title, team_count, team_size, max_players, invites_per_player)
      VALUES (${session.userId}, ${dateTime.toISOString()}, ${locationType}, ${locationCustom || null}, ${field || null}, ${isPublic}, ${title}, ${teamCount}, ${teamSize}, ${maxPlayers}, ${invitesPerPlayer})
      RETURNING id
    `
    
    const matchId = result[0].id
    
    // Auto-join creator as player
    await sql`
      INSERT INTO match_participants (match_id, user_id, role)
      VALUES (${matchId}, ${session.userId}, 'PLAYER')
    `
    
    // Creator is automatically an admin
    await sql`
      INSERT INTO match_admins (match_id, user_id)
      VALUES (${matchId}, ${session.userId})
    `

    revalidatePath('/dashboard')
    return { success: true, matchId, redirect: `/dashboard/partido/${matchId}` }
  } catch (error) {
    console.error('Error creating match:', error)
    return { error: 'Error al crear el partido' }
  }
}

export async function joinMatch(matchId: number, role: 'PLAYER' | 'SUBSTITUTE' = 'PLAYER') {
  const session = await getSession()
  if (!session) {
    return { error: 'No autenticado' }
  }

  // Safety: in case some old client still sends EXTRA
  if (role !== 'PLAYER' && role !== 'SUBSTITUTE') {
    return { error: 'Rol invalido' }
  }

  try {
    // Enforce capacity when trying to join as PLAYER.
    // Fullness is based on total amount of non-substitute players registered in the match,
    // i.e. role === 'PLAYER' across all teams + no-team list.
    // (SUBSTITUTE does not consume a player slot.)

    const upsert = await sql`
      WITH match_data AS (
        SELECT
          CASE
            WHEN team_count > 0 THEN GREATEST(1, team_count) * GREATEST(1, team_size)
            ELSE max_players
          END AS max_players
        FROM matches
        WHERE id = ${matchId}
      ),
      player_count AS (
        SELECT COUNT(*)::int AS count
        FROM match_participants
        WHERE match_id = ${matchId}
          AND role = 'PLAYER'
          AND user_id <> ${session.userId}
      ),
      existing AS (
        SELECT id, role
        FROM match_participants
        WHERE match_id = ${matchId} AND user_id = ${session.userId}
      ),
      do_update AS (
        UPDATE match_participants mp
        SET role = ${role}::participant_role
        FROM match_data md, player_count pc, existing e
        WHERE mp.id = e.id
          AND (
            ${role}::text <> 'PLAYER'
            OR e.role = 'PLAYER'
            OR md.max_players <= 0
            OR pc.count < md.max_players
          )
        RETURNING mp.id
      ),
      do_insert AS (
        INSERT INTO match_participants (match_id, user_id, role)
        SELECT ${matchId}, ${session.userId}, ${role}::participant_role
        FROM match_data md, player_count pc
        WHERE NOT EXISTS (SELECT 1 FROM existing)
          AND (
            ${role}::text <> 'PLAYER'
            OR md.max_players <= 0
            OR pc.count < md.max_players
          )
        RETURNING id
      )
      SELECT id FROM do_update
      UNION ALL
      SELECT id FROM do_insert
    `

    if (upsert.length === 0) {
      // Either the match doesn't exist, or capacity was reached.
      // Disambiguate for a better message.
      const matchExists = await sql`SELECT 1 FROM matches WHERE id = ${matchId}`
      if (matchExists.length === 0) {
        return { error: 'Partido no encontrado' }
      }
      return { error: 'El partido ya está lleno' }
    }

    if (role === 'PLAYER') {
      await autoBalanceTeamsIfFull(matchId)
      await sendMatchFilledPushIfNeeded(matchId)
    }

    revalidatePath(`/dashboard/partido/${matchId}`)
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Error joining match:', error)
    return { error: 'Error al anotarse' }
  }
}

export async function leaveMatch(matchId: number) {
  const session = await getSession()
  if (!session) {
    return { error: 'No autenticado' }
  }

  try {
    await sql`
      DELETE FROM match_participants 
      WHERE match_id = ${matchId} AND user_id = ${session.userId}
    `

    // Check remaining participants
    const remaining = await sql`
      SELECT COUNT(*) as count FROM match_participants WHERE match_id = ${matchId}
    `

    revalidatePath(`/dashboard/partido/${matchId}`)
    revalidatePath('/dashboard')
    
    return { 
      success: true, 
      remainingPlayers: Number(remaining[0].count),
      isLastPlayer: Number(remaining[0].count) === 0
    }
  } catch (error) {
    console.error('Error leaving match:', error)
    return { error: 'Error al borrarse' }
  }
}

export async function removeParticipant(matchId: number, participantId: number) {
  const session = await getSession()
  if (!session) {
    return { error: 'No autenticado' }
  }

  // Admins can remove anyone.
  // Additionally: the inviter (even if not admin) can remove only their guest participants.
  const isAdmin = await isMatchAdmin(matchId)

  try {
    const participant = await sql`
      SELECT user_id, invited_by_user_id
      FROM match_participants
      WHERE match_id = ${matchId} AND id = ${participantId}
    `
    if (participant.length === 0) {
      return { error: 'Jugador no encontrado' }
    }

    const userId = participant[0]?.user_id as number | null | undefined
    const invitedByUserId = participant[0]?.invited_by_user_id as number | null | undefined

    const canRemoveAsInviter = !isAdmin && userId === null && invitedByUserId === session.userId
    if (!isAdmin && !canRemoveAsInviter) {
      return { error: 'Solo los administradores pueden quitar jugadores' }
    }

    // Only registered users can be match admins
    if (userId !== null && userId !== undefined) {
      await sql`
        DELETE FROM match_admins
        WHERE match_id = ${matchId} AND user_id = ${userId}
      `
    }
    await sql`
      DELETE FROM match_participants
      WHERE match_id = ${matchId} AND id = ${participantId}
    `
    revalidatePath(`/dashboard/partido/${matchId}`)
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Error removing participant:', error)
    return { error: 'Error al quitar jugador' }
  }
}

export async function deleteMatch(matchId: number) {
  const session = await getSession()
  if (!session) {
    return { error: 'No autenticado' }
  }

  // Check if user is the creator
  const match = await sql`
    SELECT created_by_user_id FROM matches WHERE id = ${matchId}
  `

  if (match.length === 0 || match[0].created_by_user_id !== session.userId) {
    return { error: 'No tenes permiso para eliminar este partido' }
  }

  try {
    await sql`DELETE FROM matches WHERE id = ${matchId}`
    revalidatePath('/dashboard')
    return { success: true, redirect: '/dashboard' }
  } catch (error) {
    console.error('Error deleting match:', error)
    return { error: 'Error al eliminar el partido' }
  }
}

export async function assignTeam(matchId: number, participantId: number, team: 'A' | 'B' | null) {
  const session = await getSession()
  if (!session) {
    return { error: 'No autenticado' }
  }

  // Check if user is admin or creator
  const match = await sql`SELECT created_by_user_id FROM matches WHERE id = ${matchId}`
  const adminCheck = await sql`SELECT 1 FROM match_admins WHERE match_id = ${matchId} AND user_id = ${session.userId}`
  
  const isCreator = match.length > 0 && match[0].created_by_user_id === session.userId
  const isAdmin = adminCheck.length > 0

  if (!isCreator && !isAdmin) {
    return { error: 'Solo los administradores pueden armar equipos' }
  }

  try {
    // Only non-substitute players should be assigned to teams.
    const updated = await sql`
      UPDATE match_participants 
      SET team = ${team}
      WHERE id = ${participantId} AND match_id = ${matchId} AND role = 'PLAYER'
      RETURNING id
    `

    if (updated.length === 0) {
      return { error: 'Solo los jugadores pueden estar asignados a un equipo' }
    }

    revalidatePath(`/dashboard/partido/${matchId}`)
    return { success: true }
  } catch (error) {
    console.error('Error assigning team:', error)
    return { error: 'Error al asignar equipo' }
  }
}

export async function randomizeTeams(matchId: number) {
  const session = await getSession()
  if (!session) {
    return { error: 'No autenticado' }
  }

  // Check if user is admin or creator
  const match = await sql`SELECT created_by_user_id, team_count FROM matches WHERE id = ${matchId}`
  const adminCheck = await sql`SELECT 1 FROM match_admins WHERE match_id = ${matchId} AND user_id = ${session.userId}`
  
  const isCreator = match.length > 0 && match[0].created_by_user_id === session.userId
  const isAdmin = adminCheck.length > 0

  if (!isCreator && !isAdmin) {
    return { error: 'Solo los administradores pueden armar equipos' }
  }
  
  const teamCount = match[0]?.team_count || 2

  type UserGender = 'MALE' | 'FEMALE' | 'OTHER'
  type PlayerRow = { id: number; gender: UserGender }

  function shuffle<T>(input: T[]): T[] {
    const arr = [...input]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = arr[i]
      arr[i] = arr[j]
      arr[j] = tmp
    }
    return arr
  }

  function pickRandomIndex(indices: number[]): number {
    return indices[Math.floor(Math.random() * indices.length)]
  }

  try {
    // Get all players (not substitutes) + their gender (guests fallback to guest_gender)
    const playersRaw = await sql`
      SELECT mp.id, COALESCE(u.gender, mp.guest_gender, 'MALE') as gender
      FROM match_participants mp
      LEFT JOIN users u ON mp.user_id = u.id
      WHERE mp.match_id = ${matchId} AND mp.role = 'PLAYER'
    `

    const players = playersRaw as PlayerRow[]

    // Clear previous assignments
    await sql`
      UPDATE match_participants
      SET team = NULL, team_number = NULL
      WHERE match_id = ${matchId} AND role = 'PLAYER'
    `

    const tc = Math.max(2, Number(teamCount) || 2)
    const teamIndices = Array.from({ length: tc }, (_, i) => i)

    const females = shuffle(players.filter(p => p.gender === 'FEMALE'))
    const others = shuffle(players.filter(p => p.gender === 'OTHER'))
    const males = shuffle(players.filter(p => p.gender !== 'FEMALE' && p.gender !== 'OTHER'))

    const teamTotalCounts = Array.from({ length: tc }, () => 0)
    const teamFemaleCounts = Array.from({ length: tc }, () => 0)
    const teamOtherCounts = Array.from({ length: tc }, () => 0)

    const assignments = new Map<number, number>()

    const selectTeamForGroup = (groupCounts: number[]): number => {
      const minGroup = Math.min(...groupCounts)
      const groupCandidates = teamIndices.filter(t => groupCounts[t] === minGroup)
      const minTotal = Math.min(...groupCandidates.map(t => teamTotalCounts[t]))
      const totalCandidates = groupCandidates.filter(t => teamTotalCounts[t] === minTotal)
      return pickRandomIndex(totalCandidates)
    }

    const assignGroup = (group: PlayerRow[], groupCounts: number[]) => {
      for (const p of group) {
        const teamIndex = selectTeamForGroup(groupCounts)
        assignments.set(p.id, teamIndex)
        teamTotalCounts[teamIndex] += 1
        groupCounts[teamIndex] += 1
      }
    }

    // Balance females first (requirement), then others, then fill remaining randomly while keeping team sizes balanced.
    assignGroup(females, teamFemaleCounts)
    assignGroup(others, teamOtherCounts)

    for (const p of males) {
      const minTotal = Math.min(...teamTotalCounts)
      const candidates = teamIndices.filter(t => teamTotalCounts[t] === minTotal)
      const teamIndex = pickRandomIndex(candidates)
      assignments.set(p.id, teamIndex)
      teamTotalCounts[teamIndex] += 1
    }

    // Persist assignments
    for (const [participantId, teamIndex] of assignments.entries()) {
      if (tc === 2) {
        const team = teamIndex === 0 ? 'A' as const : 'B' as const
        await sql`
          UPDATE match_participants
          SET team = ${team}, team_number = NULL
          WHERE id = ${participantId}
        `
      } else {
        const teamNumber = teamIndex + 1
        await sql`
          UPDATE match_participants
          SET team = NULL, team_number = ${teamNumber}
          WHERE id = ${participantId}
        `
      }
    }

    revalidatePath(`/dashboard/partido/${matchId}`)
    return { success: true }
  } catch (error) {
    console.error('Error randomizing teams:', error)
    return { error: 'Error al sortear equipos' }
  }
}

export async function invitePlayer(matchId: number, userId: number, role: 'PLAYER' | 'SUBSTITUTE' = 'PLAYER') {
  const session = await getSession()
  if (!session) {
    return { error: 'No autenticado' }
  }

  // Safety: in case some old client still sends EXTRA
  if (role !== 'PLAYER' && role !== 'SUBSTITUTE') {
    return { error: 'Rol invalido' }
  }

  try {
    // Check if already invited/joined
    const existing = await sql`
      SELECT id FROM match_participants 
      WHERE match_id = ${matchId} AND user_id = ${userId}
    `

    if (existing.length > 0) {
      return { error: 'Este jugador ya esta anotado' }
    }

    // Check invite limit per player (ACTIVE invites only).
    // The user requested that if an invited participant leaves/is kicked,
    // the inviter recovers the slot.
    const matchData = await sql`SELECT invites_per_player FROM matches WHERE id = ${matchId}`
    const invitesPerPlayer = matchData[0]?.invites_per_player
    if (invitesPerPlayer !== null && invitesPerPlayer !== undefined) {
      const inviteCount = await sql`
        SELECT COUNT(*)::int as count
        FROM match_participants
        WHERE match_id = ${matchId} AND invited_by_user_id = ${session.userId}
      `
      if (Number(inviteCount[0]?.count ?? 0) >= invitesPerPlayer) {
        return { error: `Ya invitaste el maximo de ${invitesPerPlayer} jugador(es)` }
      }
    }

    // Enforce capacity for PLAYER invites (same rule as joining).
    const inserted = await sql`
      WITH match_data AS (
        SELECT
          CASE
            WHEN team_count > 0 THEN GREATEST(1, team_count) * GREATEST(1, team_size)
            ELSE max_players
          END AS max_players
        FROM matches
        WHERE id = ${matchId}
      ),
      player_count AS (
        SELECT COUNT(*)::int AS count
        FROM match_participants
        WHERE match_id = ${matchId}
          AND role = 'PLAYER'
      )
      INSERT INTO match_participants (match_id, user_id, role, invited_by_user_id)
      SELECT ${matchId}, ${userId}, ${role}::participant_role, ${session.userId}
      FROM match_data md, player_count pc
      WHERE (
        ${role}::text <> 'PLAYER'
        OR md.max_players <= 0
        OR pc.count < md.max_players
      )
      RETURNING id
    `

    if (inserted.length === 0) {
      return { error: 'El partido ya está lleno' }
    }
    if (role === 'PLAYER') {
      await autoBalanceTeamsIfFull(matchId)
      await sendMatchFilledPushIfNeeded(matchId)
    }

    // Note: match_invites is kept for backward compatibility / potential auditing,
    // but the limit logic uses active participants.

    revalidatePath(`/dashboard/partido/${matchId}`)
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Error inviting player:', error)
    return { error: 'Error al invitar jugador' }
  }
}

export type InviteGuestInput = {
  name: string
  phoneLastFour?: string
  gender: 'MALE' | 'FEMALE' | 'OTHER'
  role: 'PLAYER' | 'SUBSTITUTE'
}

export async function inviteGuest(matchId: number, input: InviteGuestInput) {
  const session = await getSession()
  if (!session) {
    return { error: 'No autenticado' }
  }

  const guestName = input.name.trim()
  const rawLastFour = (input.phoneLastFour ?? '').trim()
  const phoneLastFour = rawLastFour.replace(/\D+/g, '').slice(-4)
  const role = input.role
  const gender = input.gender

  if (!guestName) {
    return { error: 'Nombre requerido' }
  }

  if (role !== 'PLAYER' && role !== 'SUBSTITUTE') {
    return { error: 'Rol invalido' }
  }

  if (gender !== 'MALE' && gender !== 'FEMALE' && gender !== 'OTHER') {
    return { error: 'Genero invalido' }
  }

  try {
    // Check invite limit per player (ACTIVE invites only)
    const matchData = await sql`SELECT invites_per_player FROM matches WHERE id = ${matchId}`
    const invitesPerPlayer = matchData[0]?.invites_per_player
    if (invitesPerPlayer !== null && invitesPerPlayer !== undefined) {
      const inviteCount = await sql`
        SELECT COUNT(*)::int as count
        FROM match_participants
        WHERE match_id = ${matchId} AND invited_by_user_id = ${session.userId}
      `
      if (Number(inviteCount[0]?.count ?? 0) >= invitesPerPlayer) {
        return { error: `Ya invitaste el maximo de ${invitesPerPlayer} jugador(es)` }
      }
    }

    // Enforce capacity for PLAYER guests
    const inserted = await sql`
      WITH match_data AS (
        SELECT
          CASE
            WHEN team_count > 0 THEN GREATEST(1, team_count) * GREATEST(1, team_size)
            ELSE max_players
          END AS max_players
        FROM matches
        WHERE id = ${matchId}
      ),
      player_count AS (
        SELECT COUNT(*)::int AS count
        FROM match_participants
        WHERE match_id = ${matchId}
          AND role = 'PLAYER'
      )
      INSERT INTO match_participants (
        match_id,
        user_id,
        invited_by_user_id,
        guest_name,
        guest_phone_last_four,
        guest_gender,
        role
      )
      SELECT
        ${matchId},
        NULL,
        ${session.userId},
        ${guestName},
        ${phoneLastFour || null},
        ${gender}::user_gender,
        ${role}::participant_role
      FROM match_data md, player_count pc
      WHERE (
        ${role}::text <> 'PLAYER'
        OR md.max_players <= 0
        OR pc.count < md.max_players
      )
      RETURNING id
    `

    if (inserted.length === 0) {
      return { error: 'El partido ya está lleno' }
    }
    if (role === 'PLAYER') {
      await autoBalanceTeamsIfFull(matchId)
      await sendMatchFilledPushIfNeeded(matchId)
    }

    revalidatePath(`/dashboard/partido/${matchId}`)
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Error inviting guest:', error)
    return { error: 'Error al invitar jugador' }
  }
}

export async function getAllUsers() {
  const session = await getSession()
  if (!session) {
    return { error: 'No autenticado', users: [] }
  }

  try {
    const users = await sql`
      SELECT id, trim(initcap(name) || ' ' || initcap(last_name)) as name, phone_last_four, gender
      FROM users 
      WHERE is_approved = true
      ORDER BY name ASC
    `
    return { users }
  } catch (error) {
    console.error('Error getting users:', error)
    return { error: 'Error al obtener usuarios', users: [] }
  }
}

export async function getMatchParticipantIds(matchId: number) {
  const session = await getSession()
  if (!session) {
    return { error: 'No autenticado', participantIds: [] }
  }

  try {
    const participants = await sql`
      SELECT user_id FROM match_participants WHERE match_id = ${matchId}
    `
    return { participantIds: participants.map(p => p.user_id) }
  } catch (error) {
    console.error('Error getting participant ids:', error)
    return { error: 'Error', participantIds: [] }
  }
}

// Check if current user is an admin of the match
export async function isMatchAdmin(matchId: number): Promise<boolean> {
  const session = await getSession()
  if (!session) return false

  const result = await sql`
    SELECT 1 FROM match_admins WHERE match_id = ${matchId} AND user_id = ${session.userId}
    UNION
    SELECT 1 FROM matches WHERE id = ${matchId} AND created_by_user_id = ${session.userId}
  `
  return result.length > 0
}

export async function updateMatchFieldRentTotal(matchId: number, fieldRentTotal: number | null) {
  const session = await getSession()
  if (!session) {
    return { error: 'No autenticado' }
  }

  const isAdmin = await isMatchAdmin(matchId)
  if (!isAdmin) {
    return { error: 'Solo los administradores pueden modificar los pagos' }
  }

  try {
    await sql`
      UPDATE matches
      SET field_rent_total = ${fieldRentTotal}
      WHERE id = ${matchId}
    `
    revalidatePath(`/dashboard/partido/${matchId}`)
    return { success: true }
  } catch (error) {
    console.error('Error updating match field rent total:', error)
    return { error: 'Error al actualizar el alquiler de la cancha' }
  }
}

export async function setParticipantPaymentStatus(matchId: number, participantId: number, hasPaid: boolean) {
  const session = await getSession()
  if (!session) {
    return { error: 'No autenticado' }
  }

  const isAdmin = await isMatchAdmin(matchId)
  if (!isAdmin) {
    return { error: 'Solo los administradores pueden confirmar pagos' }
  }

  try {
    await sql`
      UPDATE match_participants
      SET has_paid = ${hasPaid}
      WHERE id = ${participantId} AND match_id = ${matchId}
    `
    revalidatePath(`/dashboard/partido/${matchId}`)
    return { success: true }
  } catch (error) {
    console.error('Error updating participant payment status:', error)
    return { error: 'Error al actualizar estado de pago' }
  }
}

export async function updateParticipantPaymentNotes(matchId: number, participantId: number, paymentNotes: string) {
  const session = await getSession()
  if (!session) {
    return { error: 'No autenticado' }
  }

  const isAdmin = await isMatchAdmin(matchId)

  try {
    if (!isAdmin) {
      // Users can only update their own notes
      const ownership = await sql`
        SELECT 1
        FROM match_participants
        WHERE id = ${participantId} AND match_id = ${matchId} AND user_id = ${session.userId}
      `
      if (ownership.length === 0) {
        return { error: 'Solo podes modificar tus notas' }
      }
    }

    await sql`
      UPDATE match_participants
      SET payment_notes = ${paymentNotes}
      WHERE id = ${participantId} AND match_id = ${matchId}
    `
    revalidatePath(`/dashboard/partido/${matchId}`)
    return { success: true }
  } catch (error) {
    console.error('Error updating participant payment notes:', error)
    return { error: 'Error al actualizar notas' }
  }
}

// Update match field with admin check
export async function updateMatchField(
  matchId: number, 
  field: string, 
  value: string | number | boolean | null
) {
  const session = await getSession()
  if (!session) {
    return { error: 'No autenticado' }
  }

  const isAdmin = await isMatchAdmin(matchId)
  if (!isAdmin) {
    return { error: 'Solo los administradores pueden modificar el partido' }
  }

  // Whitelist of allowed fields
  const allowedFields = ['title', 'date_time', 'location_type', 'location_custom', 'field', 'team_count', 'team_size', 'is_public', 'max_players', 'invites_per_player']
  if (!allowedFields.includes(field)) {
    return { error: 'Campo no permitido' }
  }

  // Enforce max_players derivation when teams are enabled
  // - If team_count > 0, max_players is always team_count * team_size
  // - Disallow directly setting max_players in that mode
  if (field === 'max_players') {
    const match = await sql`SELECT team_count FROM matches WHERE id = ${matchId}`
    const teamCount = Number(match[0]?.team_count ?? 0)
    if (teamCount > 0) {
      return { error: 'max_players se calcula automaticamente cuando hay equipos' }
    }
  }

  try {
    // Build the query dynamically based on field
    if (field === 'title') {
      await sql`UPDATE matches SET title = ${value as string} WHERE id = ${matchId}`
    } else if (field === 'date_time') {
      await sql`UPDATE matches SET date_time = ${value as string} WHERE id = ${matchId}`
    } else if (field === 'location_type') {
      await sql`UPDATE matches SET location_type = ${value as string} WHERE id = ${matchId}`
    } else if (field === 'location_custom') {
      await sql`UPDATE matches SET location_custom = ${value as string} WHERE id = ${matchId}`
    } else if (field === 'field') {
      await sql`UPDATE matches SET field = ${value as string} WHERE id = ${matchId}`
    } else if (field === 'team_count') {
      await sql`UPDATE matches SET team_count = ${value as number} WHERE id = ${matchId}`
      const match = await sql`SELECT team_count, team_size FROM matches WHERE id = ${matchId}`
      const teamCount = Number(match[0]?.team_count ?? 0)
      const teamSize = Number(match[0]?.team_size ?? 0)
      if (teamCount > 0) {
        await sql`UPDATE matches SET max_players = ${computedMaxPlayers(teamCount, teamSize)} WHERE id = ${matchId}`
      }
    } else if (field === 'team_size') {
      await sql`UPDATE matches SET team_size = ${value as number} WHERE id = ${matchId}`
      const match = await sql`SELECT team_count, team_size FROM matches WHERE id = ${matchId}`
      const teamCount = Number(match[0]?.team_count ?? 0)
      const teamSize = Number(match[0]?.team_size ?? 0)
      if (teamCount > 0) {
        await sql`UPDATE matches SET max_players = ${computedMaxPlayers(teamCount, teamSize)} WHERE id = ${matchId}`
      }
    } else if (field === 'is_public') {
      await sql`UPDATE matches SET is_public = ${value as boolean} WHERE id = ${matchId}`
    } else if (field === 'max_players') {
      await sql`UPDATE matches SET max_players = ${value as number} WHERE id = ${matchId}`
    } else if (field === 'invites_per_player') {
      await sql`UPDATE matches SET invites_per_player = ${value as number | null} WHERE id = ${matchId}`
    }

    revalidatePath(`/dashboard/partido/${matchId}`)
    revalidatePath('/dashboard')
    if (FIELDS_TRIGGERING_CHANGE_NOTIFICATION.includes(field as (typeof FIELDS_TRIGGERING_CHANGE_NOTIFICATION)[number])) {
      await sendMatchChangesPush(matchId)
    }
    return { success: true }
  } catch (error) {
    console.error('Error updating match:', error)
    return { error: 'Error al actualizar el partido' }
  }
}

// Reset teams when team config changes (move all to substitutes)
export async function resetTeamsToSubstitutes(matchId: number) {
  const session = await getSession()
  if (!session) {
    return { error: 'No autenticado' }
  }

  const isAdmin = await isMatchAdmin(matchId)
  if (!isAdmin) {
    return { error: 'Solo los administradores pueden modificar el partido' }
  }

  try {
    await sql`
      UPDATE match_participants 
      SET role = 'SUBSTITUTE', team = NULL, team_number = NULL
      WHERE match_id = ${matchId}
    `
    revalidatePath(`/dashboard/partido/${matchId}`)
    revalidatePath('/dashboard')
  } catch (error) {
    console.error('Error resetting teams:', error)
    return { error: 'Error al resetear equipos' }
  }
}

// Normalize participants when switching between team modes.
// - If switching to NO TEAMS (team_count === 0): keep role as-is, clear team/team_number for everyone.
// - If switching to TEAMS (team_count > 0): keep role as-is, clear team/team_number for everyone (so they appear in the "Sin equipo" list).
export async function resetTeamsToNoTeam(matchId: number) {
  const session = await getSession()
  if (!session) {
    return { error: 'No autenticado' }
  }

  const isAdmin = await isMatchAdmin(matchId)
  if (!isAdmin) {
    return { error: 'Solo los administradores pueden modificar el partido' }
  }

  try {
    await sql`
      UPDATE match_participants
      SET team = NULL, team_number = NULL
      WHERE match_id = ${matchId}
    `
    revalidatePath(`/dashboard/partido/${matchId}`)
    return { success: true }
  } catch (error) {
    console.error('Error resetting teams to no-team:', error)
    return { error: 'Error al resetear equipos' }
  }
}

// Add match admin
export async function addMatchAdmin(matchId: number, userId: number) {
  const session = await getSession()
  if (!session) {
    return { error: 'No autenticado' }
  }

  const isAdmin = await isMatchAdmin(matchId)
  if (!isAdmin) {
    return { error: 'Solo los administradores pueden agregar otros administradores' }
  }

  // Check if user is a participant
  const participant = await sql`
    SELECT id FROM match_participants WHERE match_id = ${matchId} AND user_id = ${userId}
  `
  if (participant.length === 0) {
    return { error: 'El usuario debe estar anotado en el partido' }
  }

  try {
    await sql`
      INSERT INTO match_admins (match_id, user_id)
      VALUES (${matchId}, ${userId})
      ON CONFLICT (match_id, user_id) DO NOTHING
    `
    revalidatePath(`/dashboard/partido/${matchId}`)
    return { success: true }
  } catch (error) {
    console.error('Error adding admin:', error)
    return { error: 'Error al agregar administrador' }
  }
}

// Remove match admin
export async function removeMatchAdmin(matchId: number, userId: number) {
  const session = await getSession()
  if (!session) {
    return { error: 'No autenticado' }
  }

  const isAdmin = await isMatchAdmin(matchId)
  if (!isAdmin) {
    return { error: 'Solo los administradores pueden quitar administradores' }
  }

  // Cannot remove the creator
  const match = await sql`SELECT created_by_user_id FROM matches WHERE id = ${matchId}`
  if (match.length > 0 && match[0].created_by_user_id === userId) {
    return { error: 'No se puede quitar al creador del partido como administrador' }
  }

  try {
    await sql`
      DELETE FROM match_admins WHERE match_id = ${matchId} AND user_id = ${userId}
    `
    revalidatePath(`/dashboard/partido/${matchId}`)
    return { success: true }
  } catch (error) {
    console.error('Error removing admin:', error)
    return { error: 'Error al quitar administrador' }
  }
}

// Get match admins
export async function getMatchAdmins(matchId: number) {
  try {
    const admins = await sql`
      SELECT ma.user_id, trim(initcap(u.name) || ' ' || initcap(u.last_name)) as name, u.phone_last_four
      FROM match_admins ma
      JOIN users u ON ma.user_id = u.id
      WHERE ma.match_id = ${matchId}
    `
    return { admins }
  } catch (error) {
    console.error('Error getting admins:', error)
    return { admins: [] }
  }
}

// Change participant role (promote sub to player, demote player to sub)
export async function changeParticipantRole(matchId: number, participantId: number, newRole: 'PLAYER' | 'SUBSTITUTE') {
  const session = await getSession()
  if (!session) {
    return { error: 'No autenticado' }
  }

  const admin = await isMatchAdmin(matchId)
  if (!admin) {
    return { error: 'Solo los administradores pueden mover jugadores' }
  }

  try {
    // Enforce capacity when promoting to PLAYER.
    const updated = await sql`
      WITH target AS (
        SELECT user_id, role
        FROM match_participants
        WHERE id = ${participantId} AND match_id = ${matchId}
      ),
      match_data AS (
        SELECT
          CASE
            WHEN team_count > 0 THEN GREATEST(1, team_count) * GREATEST(1, team_size)
            ELSE max_players
          END AS max_players
        FROM matches
        WHERE id = ${matchId}
      ),
      player_count AS (
        SELECT COUNT(*)::int AS count
        FROM match_participants mp
        JOIN target t ON true
        WHERE mp.match_id = ${matchId}
          AND mp.role = 'PLAYER'
          AND mp.id <> ${participantId}
      )
      UPDATE match_participants mp
      SET role = ${newRole}::participant_role,
          team = NULL,
          team_number = NULL
      FROM target t, match_data md, player_count pc
      WHERE mp.id = ${participantId} AND mp.match_id = ${matchId}
        AND (
          ${newRole}::text <> 'PLAYER'
          OR t.role = 'PLAYER'
          OR md.max_players <= 0
          OR pc.count < md.max_players
        )
      RETURNING mp.id
    `
    if (updated.length === 0 && newRole === 'PLAYER') {
      return { error: 'El partido ya está lleno' }
    }
    if (newRole === 'PLAYER') {
      await autoBalanceTeamsIfFull(matchId)
      await sendMatchFilledPushIfNeeded(matchId)
    }
    revalidatePath(`/dashboard/partido/${matchId}`)
    return { success: true }
  } catch (error) {
    console.error('Error changing role:', error)
    return { error: 'Error al cambiar rol' }
  }
}

// Get invite count for a user in a match
export async function getInviteCount(matchId: number, userId: number) {
  try {
    const result = await sql`
      SELECT COUNT(*)::int as count
      FROM match_participants
      WHERE match_id = ${matchId} AND invited_by_user_id = ${userId}
    `
    return { count: Number(result[0].count) }
  } catch {
    return { count: 0 }
  }
}

// Assign team number (for multiple teams)
export async function assignTeamNumber(matchId: number, participantId: number, teamNumber: number | null) {
  const session = await getSession()
  if (!session) {
    return { error: 'No autenticado' }
  }

  const isAdmin = await isMatchAdmin(matchId)
  if (!isAdmin) {
    return { error: 'Solo los administradores pueden armar equipos' }
  }

  try {
    // Only non-substitute players should be assigned to teams.
    const updated = await sql`
      UPDATE match_participants
      SET team_number = ${teamNumber}
      WHERE id = ${participantId} AND match_id = ${matchId} AND role = 'PLAYER'
      RETURNING id
    `

    if (updated.length === 0) {
      return { error: 'Solo los jugadores pueden estar asignados a un equipo' }
    }

    revalidatePath(`/dashboard/partido/${matchId}`)
    return { success: true }
  } catch (error) {
    console.error('Error assigning team number:', error)
    return { error: 'Error al asignar equipo' }
  }
}
