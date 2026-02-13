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
  field_rent_total: number | null
}

interface Participant {
  id: number
  user_id: number
  name: string
  phone_last_four: string
  role: 'PLAYER' | 'SUBSTITUTE'
  team: 'A' | 'B' | null
  team_number: number | null
  has_paid?: boolean | null
  payment_notes?: string | null
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
      m.field_rent_total,
      u.name as creator_name
    FROM matches m
    JOIN users u ON m.created_by_user_id = u.id
    WHERE m.id = ${id}
  `
  return matches[0] as Match | null
}

async function getParticipants(matchId: number, includePayments: boolean): Promise<Participant[]> {
  if (includePayments) {
    const participants = await sql`
      SELECT 
        mp.id,
        mp.user_id,
        u.name,
        u.phone_last_four,
        CASE WHEN mp.role = 'EXTRA' THEN 'SUBSTITUTE' ELSE mp.role::text END AS role,
        mp.team,
        mp.team_number,
        mp.has_paid,
        mp.payment_notes
      FROM match_participants mp
      JOIN users u ON mp.user_id = u.id
      WHERE mp.match_id = ${matchId}
      ORDER BY 
        CASE (CASE WHEN mp.role = 'EXTRA' THEN 'SUBSTITUTE' ELSE mp.role::text END)
          WHEN 'PLAYER' THEN 1
          WHEN 'SUBSTITUTE' THEN 2
        END,
        mp.created_at ASC
    `
    return participants as Participant[]
  }

  // Non-subscribed viewers can see the match and the roster, but not the payments agenda.
  const participants = await sql`
    SELECT 
      mp.id,
      mp.user_id,
      u.name,
      u.phone_last_four,
      CASE WHEN mp.role = 'EXTRA' THEN 'SUBSTITUTE' ELSE mp.role::text END AS role,
      mp.team,
      mp.team_number,
      NULL::boolean AS has_paid,
      NULL::text AS payment_notes
    FROM match_participants mp
    JOIN users u ON mp.user_id = u.id
    WHERE mp.match_id = ${matchId}
    ORDER BY 
      CASE (CASE WHEN mp.role = 'EXTRA' THEN 'SUBSTITUTE' ELSE mp.role::text END)
        WHEN 'PLAYER' THEN 1
        WHEN 'SUBSTITUTE' THEN 2
      END,
      mp.created_at ASC
  `
  return participants as Participant[]
}

async function isUserSubscribed(matchId: number, userId: number): Promise<boolean> {
  const rows = await sql`
    SELECT 1
    FROM match_participants
    WHERE match_id = ${matchId} AND user_id = ${userId}
    LIMIT 1
  `
  return rows.length > 0
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

  const session = await getSession()
  if (!session) {
    notFound()
  }

  const [match, admins, subscribed] = await Promise.all([
    getMatch(matchId),
    getMatchAdmins(matchId),
    isUserSubscribed(matchId, session.userId),
  ])

  if (!match) {
    notFound()
  }

  // Privacy: private matches are only visible to registered users (or creator/admin).
  // If a user tries to access a private match by URL without being a participant, treat it as non-existent.
  const isCreator = match.created_by_user_id === session.userId
  const isAdmin = isCreator || admins.some(a => a.user_id === session.userId)

  const canView = match.is_public || subscribed || isAdmin
  if (!canView) {
    notFound()
  }

  const participants = await getParticipants(matchId, subscribed)
  const userParticipation = subscribed ? participants.find(p => p.user_id === session.userId) : undefined
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
