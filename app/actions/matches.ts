'use server'

import { sql } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function createMatch(formData: FormData) {
  const session = await getSession()
  if (!session) {
    return { error: 'No autenticado' }
  }

  const dateStr = formData.get('date') as string
  const time = formData.get('time') as string
  const locationType = formData.get('locationType') as string
  const locationCustom = formData.get('locationCustom') as string
  const isPublic = formData.get('isPublic') !== 'false' // default to true

  if (!dateStr || !time || !locationType) {
    return { error: 'Todos los campos son requeridos' }
  }

  const dateTime = new Date(`${dateStr}T${time}`)
  
  if (dateTime < new Date()) {
    return { error: 'La fecha debe ser en el futuro' }
  }

  try {
    const result = await sql`
      INSERT INTO matches (created_by_user_id, date_time, location_type, location_custom, is_public)
      VALUES (${session.userId}, ${dateTime.toISOString()}, ${locationType}, ${locationCustom || null}, ${isPublic})
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
