import { notFound } from 'next/navigation'
import { sql } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { MatchDetailClient } from '@/components/match-detail-client'

interface Match {
  id: number
  title: string | null
  date_time: string
  location_type: string
  location_custom: string | null
  field: string | null
  created_by_user_id: number
  creator_name: string
  is_public: boolean
  team_count: number
  team_size: number
  max_players: number
  invites_per_player: number | null
}

interface Participant {
  id: number
  user_id: number
  name: string
  phone_last_four: string
  role: 'PLAYER' | 'SUBSTITUTE' | 'EXTRA'
  team: 'A' | 'B' | null
  team_number: number | null
}

interface Admin {
  user_id: number
  name: string
  phone_last_four: string
}

async function getMatch(id: number): Promise<Match | null> {
  const matches = await sql`
    SELECT 
      m.id,
      m.title,
      m.date_time,
      m.location_type,
      m.location_custom,
      m.field,
      m.created_by_user_id,
      m.is_public,
      m.team_count,
      m.team_size,
      m.max_players,
      m.invites_per_player,
      u.name as creator_name
    FROM matches m
    JOIN users u ON m.created_by_user_id = u.id
    WHERE m.id = ${id}
  `
  return matches[0] as Match | null
}

async function getParticipants(matchId: number): Promise<Participant[]> {
  const participants = await sql`
    SELECT 
      mp.id,
      mp.user_id,
      u.name,
      u.phone_last_four,
      mp.role,
      mp.team,
      mp.team_number
    FROM match_participants mp
    JOIN users u ON mp.user_id = u.id
    WHERE mp.match_id = ${matchId}
    ORDER BY 
      CASE mp.role 
        WHEN 'PLAYER' THEN 1 
        WHEN 'SUBSTITUTE' THEN 2 
        WHEN 'EXTRA' THEN 3 
      END,
      mp.created_at ASC
  `
  return participants as Participant[]
}

async function getMatchAdmins(matchId: number): Promise<Admin[]> {
  const admins = await sql`
    SELECT ma.user_id, u.name, u.phone_last_four
    FROM match_admins ma
    JOIN users u ON ma.user_id = u.id
    WHERE ma.match_id = ${matchId}
  `
  return admins as Admin[]
}

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const matchId = parseInt(id, 10)
  
  if (isNaN(matchId)) {
    notFound()
  }

  const [match, participants, admins, session] = await Promise.all([
    getMatch(matchId),
    getParticipants(matchId),
    getMatchAdmins(matchId),
    getSession(),
  ])

  if (!match || !session) {
    notFound()
  }

  const isCreator = match.created_by_user_id === session.userId
  const isAdmin = isCreator || admins.some(a => a.user_id === session.userId)
  const userParticipation = participants.find(p => p.user_id === session.userId)
  const isPast = new Date(match.date_time) < new Date()

  return (
    <MatchDetailClient
      match={match}
      participants={participants}
      admins={admins}
      isCreator={isCreator}
      isAdmin={isAdmin}
      userParticipation={userParticipation}
      isPast={isPast}
      currentUserId={session.userId}
    />
  )
}
