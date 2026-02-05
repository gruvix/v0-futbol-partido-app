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
  const field = formData.get('field') as string
  const isPublic = formData.get('isPublic') !== 'false' // default to true
  const titleInput = formData.get('title') as string
  const teamCount = parseInt(formData.get('teamCount') as string) || 0
  const teamSize = parseInt(formData.get('teamSize') as string) || 5

  // Get creator's name for default title
  const user = await sql`SELECT name FROM users WHERE id = ${session.userId}`
  const creatorName = user[0]?.name || 'Usuario'
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
      INSERT INTO matches (created_by_user_id, date_time, location_type, location_custom, field, is_public, title, team_count, team_size)
      VALUES (${session.userId}, ${dateTime.toISOString()}, ${locationType}, ${locationCustom || null}, ${field || null}, ${isPublic}, ${title}, ${teamCount}, ${teamSize})
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

    revalidatePath('/dashboard', 'max')
    return { success: true, matchId, redirect: `/dashboard/partido/${matchId}` }
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

  // Check if user is admin or creator
  const match = await sql`SELECT created_by_user_id FROM matches WHERE id = ${matchId}`
  const adminCheck = await sql`SELECT 1 FROM match_admins WHERE match_id = ${matchId} AND user_id = ${session.userId}`
  
  const isCreator = match.length > 0 && match[0].created_by_user_id === session.userId
  const isAdmin = adminCheck.length > 0

  if (!isCreator && !isAdmin) {
    return { error: 'Solo los administradores pueden armar equipos' }
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

  // Check if user is admin or creator
  const match = await sql`SELECT created_by_user_id, team_count FROM matches WHERE id = ${matchId}`
  const adminCheck = await sql`SELECT 1 FROM match_admins WHERE match_id = ${matchId} AND user_id = ${session.userId}`
  
  const isCreator = match.length > 0 && match[0].created_by_user_id === session.userId
  const isAdmin = adminCheck.length > 0

  if (!isCreator && !isAdmin) {
    return { error: 'Solo los administradores pueden armar equipos' }
  }
  
  const teamCount = match[0]?.team_count || 2

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
  const allowedFields = ['title', 'date_time', 'location_type', 'location_custom', 'field', 'team_count', 'team_size', 'is_public']
  if (!allowedFields.includes(field)) {
    return { error: 'Campo no permitido' }
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
    } else if (field === 'team_size') {
      await sql`UPDATE matches SET team_size = ${value as number} WHERE id = ${matchId}`
    } else if (field === 'is_public') {
      await sql`UPDATE matches SET is_public = ${value as boolean} WHERE id = ${matchId}`
    }

    revalidatePath(`/dashboard/partido/${matchId}`, 'max')
    revalidatePath('/dashboard', 'max')
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
    revalidatePath(`/dashboard/partido/${matchId}`, 'max')
    return { success: true }
  } catch (error) {
    console.error('Error resetting teams:', error)
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
    revalidatePath(`/dashboard/partido/${matchId}`, 'max')
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
    revalidatePath(`/dashboard/partido/${matchId}`, 'max')
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
      SELECT ma.user_id, u.name, u.phone_last_four
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
    await sql`
      UPDATE match_participants 
      SET team_number = ${teamNumber}
      WHERE id = ${participantId} AND match_id = ${matchId}
    `

    revalidatePath(`/dashboard/partido/${matchId}`, 'max')
    return { success: true }
  } catch (error) {
    console.error('Error assigning team number:', error)
    return { error: 'Error al asignar equipo' }
  }
}
