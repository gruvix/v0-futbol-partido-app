'use server'

import { sql, type MatchVisibility, type ResultTeam } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export interface MatchWithDetails {
  id: number
  date_time: string
  location_type: string
  location_custom: string | null
  created_by_user_id: number
  creator_name: string
  participant_count: number
  visibility: MatchVisibility
  result_winner: ResultTeam | null
  result_score_a: number | null
  result_score_b: number | null
  result_notes: string | null
  is_participant?: boolean
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
  const visibility = (formData.get('visibility') as MatchVisibility) || 'PUBLIC'

  if (!dateStr || !time || !locationType) {
    return { error: 'Todos los campos son requeridos' }
  }

  const dateTime = new Date(`${dateStr}T${time}`)
  
  if (dateTime < new Date()) {
    return { error: 'La fecha debe ser en el futuro' }
  }

  try {
    const result = await sql`
      INSERT INTO matches (created_by_user_id, date_time, location_type, location_custom, visibility)
      VALUES (${session.userId}, ${dateTime.toISOString()}, ${locationType}, ${locationCustom || null}, ${visibility})
      RETURNING id
    `
    
    // Auto-join creator as player
    await sql`
      INSERT INTO match_participants (match_id, user_id, role)
      VALUES (${result[0].id}, ${session.userId}, 'PLAYER')
    `

    revalidatePath('/dashboard', 'max')
    return { success: true, matchId: result[0].id, redirect: `/dashboard/partido/${result[0].id}` }
  } catch (error) {
    console.error('Error creating match:', error)
    return { error: 'Error al crear el partido' }
  }
}

export async function joinMatch(matchId: number, role: 'PLAYER' | 'SUBSTITUTE' | 'EXTRA' = 'PLAYER') {
  const session = await getSession()
  if (!session) {
    return { error: 'No autenticado' }
  }

  try {
    // Check if already joined
    const existing = await sql`
      SELECT id FROM match_participants 
      WHERE match_id = ${matchId} AND user_id = ${session.userId}
    `

    if (existing.length > 0) {
      // Update role
      await sql`
        UPDATE match_participants 
        SET role = ${role}
        WHERE match_id = ${matchId} AND user_id = ${session.userId}
      `
    } else {
      await sql`
        INSERT INTO match_participants (match_id, user_id, role)
        VALUES (${matchId}, ${session.userId}, ${role})
      `
    }

    revalidatePath(`/dashboard/partido/${matchId}`, 'max')
    revalidatePath('/dashboard', 'max')
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

    revalidatePath(`/dashboard/partido/${matchId}`, 'max')
    revalidatePath('/dashboard', 'max')
    
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
    revalidatePath('/dashboard', 'max')
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

  // Check if user is the creator
  const match = await sql`
    SELECT created_by_user_id FROM matches WHERE id = ${matchId}
  `

  if (match.length === 0 || match[0].created_by_user_id !== session.userId) {
    return { error: 'Solo el organizador puede armar equipos' }
  }

  try {
    await sql`
      UPDATE match_participants 
      SET team = ${team}
      WHERE id = ${participantId} AND match_id = ${matchId}
    `

    revalidatePath(`/dashboard/partido/${matchId}`, 'max')
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

  // Check if user is the creator
  const match = await sql`
    SELECT created_by_user_id FROM matches WHERE id = ${matchId}
  `

  if (match.length === 0 || match[0].created_by_user_id !== session.userId) {
    return { error: 'Solo el organizador puede armar equipos' }
  }

  try {
    // Get all players (not substitutes)
    const players = await sql`
      SELECT id FROM match_participants 
      WHERE match_id = ${matchId} AND role = 'PLAYER'
      ORDER BY RANDOM()
    `

    // Assign half to A, half to B
    const half = Math.ceil(players.length / 2)
    
    for (let i = 0; i < players.length; i++) {
      const team = i < half ? 'A' : 'B'
      await sql`
        UPDATE match_participants 
        SET team = ${team}
        WHERE id = ${players[i].id}
      `
    }

    revalidatePath(`/dashboard/partido/${matchId}`, 'max')
    return { success: true }
  } catch (error) {
    console.error('Error randomizing teams:', error)
    return { error: 'Error al sortear equipos' }
  }
}

export async function invitePlayer(matchId: number, userId: number, role: 'PLAYER' | 'SUBSTITUTE' | 'EXTRA' = 'PLAYER') {
  const session = await getSession()
  if (!session) {
    return { error: 'No autenticado' }
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

    await sql`
      INSERT INTO match_participants (match_id, user_id, role)
      VALUES (${matchId}, ${userId}, ${role})
    `

    revalidatePath(`/dashboard/partido/${matchId}`, 'max')
    revalidatePath('/dashboard', 'max')
    return { success: true }
  } catch (error) {
    console.error('Error inviting player:', error)
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
      SELECT id, name, phone_last_four 
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

// Get matches where user is participant or creator (Tus Partidos)
export async function getUserMatches(): Promise<MatchWithDetails[]> {
  const session = await getSession()
  if (!session) {
    return []
  }

  const matches = await sql`
    SELECT DISTINCT
      m.id,
      m.date_time,
      m.location_type,
      m.location_custom,
      m.created_by_user_id,
      m.visibility,
      m.result_winner,
      m.result_score_a,
      m.result_score_b,
      m.result_notes,
      u.name as creator_name,
      COUNT(mp.id)::int as participant_count
    FROM matches m
    JOIN users u ON m.created_by_user_id = u.id
    LEFT JOIN match_participants mp ON m.id = mp.match_id
    WHERE m.date_time >= NOW()
      AND (m.created_by_user_id = ${session.userId} 
           OR EXISTS (SELECT 1 FROM match_participants mp2 WHERE mp2.match_id = m.id AND mp2.user_id = ${session.userId}))
    GROUP BY m.id, u.name
    ORDER BY m.date_time ASC
  `
  return matches as MatchWithDetails[]
}

// Get public upcoming matches where user is NOT participant (Proximos Partidos)
export async function getPublicUpcomingMatches(): Promise<MatchWithDetails[]> {
  const session = await getSession()
  if (!session) {
    return []
  }

  const matches = await sql`
    SELECT 
      m.id,
      m.date_time,
      m.location_type,
      m.location_custom,
      m.created_by_user_id,
      m.visibility,
      m.result_winner,
      m.result_score_a,
      m.result_score_b,
      m.result_notes,
      u.name as creator_name,
      COUNT(mp.id)::int as participant_count
    FROM matches m
    JOIN users u ON m.created_by_user_id = u.id
    LEFT JOIN match_participants mp ON m.id = mp.match_id
    WHERE m.date_time >= NOW()
      AND m.visibility = 'PUBLIC'
      AND m.created_by_user_id != ${session.userId}
      AND NOT EXISTS (SELECT 1 FROM match_participants mp2 WHERE mp2.match_id = m.id AND mp2.user_id = ${session.userId})
    GROUP BY m.id, u.name
    ORDER BY m.date_time ASC
    LIMIT 10
  `
  return matches as MatchWithDetails[]
}

// Get past matches for history (matches user participated in)
export async function getUserPastMatches(): Promise<MatchWithDetails[]> {
  const session = await getSession()
  if (!session) {
    return []
  }

  const matches = await sql`
    SELECT DISTINCT
      m.id,
      m.date_time,
      m.location_type,
      m.location_custom,
      m.created_by_user_id,
      m.visibility,
      m.result_winner,
      m.result_score_a,
      m.result_score_b,
      m.result_notes,
      u.name as creator_name,
      COUNT(mp.id)::int as participant_count
    FROM matches m
    JOIN users u ON m.created_by_user_id = u.id
    LEFT JOIN match_participants mp ON m.id = mp.match_id
    WHERE m.date_time < NOW()
      AND (m.created_by_user_id = ${session.userId} 
           OR EXISTS (SELECT 1 FROM match_participants mp2 WHERE mp2.match_id = m.id AND mp2.user_id = ${session.userId}))
    GROUP BY m.id, u.name
    ORDER BY m.date_time DESC
    LIMIT 10
  `
  return matches as MatchWithDetails[]
}

// Update match visibility
export async function updateMatchVisibility(matchId: number, visibility: MatchVisibility) {
  const session = await getSession()
  if (!session) {
    return { error: 'No autenticado' }
  }

  // Check if user is the creator
  const match = await sql`
    SELECT created_by_user_id, date_time FROM matches WHERE id = ${matchId}
  `

  if (match.length === 0 || match[0].created_by_user_id !== session.userId) {
    return { error: 'Solo el organizador puede cambiar la visibilidad' }
  }

  // Check if match is in the past
  if (new Date(match[0].date_time) < new Date()) {
    return { error: 'No se puede modificar un partido pasado' }
  }

  try {
    await sql`
      UPDATE matches SET visibility = ${visibility} WHERE id = ${matchId}
    `
    revalidatePath(`/dashboard/partido/${matchId}`, 'max')
    revalidatePath('/dashboard', 'max')
    return { success: true }
  } catch (error) {
    console.error('Error updating visibility:', error)
    return { error: 'Error al actualizar visibilidad' }
  }
}

// Update match details (for organizers)
export async function updateMatch(matchId: number, formData: FormData) {
  const session = await getSession()
  if (!session) {
    return { error: 'No autenticado' }
  }

  // Check if user is the creator
  const match = await sql`
    SELECT created_by_user_id, date_time FROM matches WHERE id = ${matchId}
  `

  if (match.length === 0 || match[0].created_by_user_id !== session.userId) {
    return { error: 'Solo el organizador puede editar el partido' }
  }

  // Check if match is in the past
  if (new Date(match[0].date_time) < new Date()) {
    return { error: 'No se puede modificar un partido pasado' }
  }

  const dateStr = formData.get('date') as string
  const time = formData.get('time') as string
  const locationType = formData.get('locationType') as string
  const locationCustom = formData.get('locationCustom') as string
  const visibility = (formData.get('visibility') as MatchVisibility) || 'PUBLIC'

  if (!dateStr || !time || !locationType) {
    return { error: 'Todos los campos son requeridos' }
  }

  const dateTime = new Date(`${dateStr}T${time}`)
  
  if (dateTime < new Date()) {
    return { error: 'La fecha debe ser en el futuro' }
  }

  try {
    await sql`
      UPDATE matches 
      SET date_time = ${dateTime.toISOString()}, 
          location_type = ${locationType}, 
          location_custom = ${locationCustom || null},
          visibility = ${visibility}
      WHERE id = ${matchId}
    `
    revalidatePath(`/dashboard/partido/${matchId}`, 'max')
    revalidatePath('/dashboard', 'max')
    return { success: true }
  } catch (error) {
    console.error('Error updating match:', error)
    return { error: 'Error al actualizar el partido' }
  }
}

// Save match result (for organizers, only for past matches)
export async function saveMatchResult(
  matchId: number, 
  winner: ResultTeam | null, 
  scoreA: number | null, 
  scoreB: number | null, 
  notes: string | null
) {
  const session = await getSession()
  if (!session) {
    return { error: 'No autenticado' }
  }

  // Check if user is the creator
  const match = await sql`
    SELECT created_by_user_id, date_time FROM matches WHERE id = ${matchId}
  `

  if (match.length === 0 || match[0].created_by_user_id !== session.userId) {
    return { error: 'Solo el organizador puede guardar el resultado' }
  }

  // Check if match is in the past (only allow results for past matches)
  if (new Date(match[0].date_time) > new Date()) {
    return { error: 'Solo se pueden guardar resultados de partidos finalizados' }
  }

  try {
    await sql`
      UPDATE matches 
      SET result_winner = ${winner}, 
          result_score_a = ${scoreA}, 
          result_score_b = ${scoreB},
          result_notes = ${notes}
      WHERE id = ${matchId}
    `
    revalidatePath(`/dashboard/partido/${matchId}`, 'max')
    revalidatePath('/dashboard', 'max')
    return { success: true }
  } catch (error) {
    console.error('Error saving result:', error)
    return { error: 'Error al guardar el resultado' }
  }
}
