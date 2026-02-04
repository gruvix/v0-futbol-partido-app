import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { id } = await params
  const matchId = parseInt(id, 10)
  
  if (isNaN(matchId)) {
    return NextResponse.json({ error: 'Invalid match ID' }, { status: 400 })
  }

  try {
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
        m.result_notes
      FROM matches m
      WHERE m.id = ${matchId}
    `

    if (matches.length === 0) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    const match = matches[0]
    
    // Only the creator can access match details for editing
    if (match.created_by_user_id !== session.userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    return NextResponse.json(match)
  } catch (error) {
    console.error('Error fetching match:', error)
    return NextResponse.json({ error: 'Error al obtener el partido' }, { status: 500 })
  }
}
