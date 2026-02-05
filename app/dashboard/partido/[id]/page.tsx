import { notFound } from 'next/navigation'
import { sql } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { MatchDetailClient } from '@/components/match-detail-client'

interface Match {
  id: number
  date_time: string
  location_type: string
  location_custom: string | null
  created_by_user_id: number
  creator_name: string
  title: string | null
}

interface Participant {
  id: number
  user_id: number
  name: string
  phone_last_four: string
  role: 'PLAYER' | 'SUBSTITUTE' | 'EXTRA'
  team: 'A' | 'B' | null
}

async function getMatch(id: number): Promise<Match | null> {
  const matches = await sql`
    SELECT 
      m.id,
      m.date_time,
      m.location_type,
      m.location_custom,
      m.created_by_user_id,
      m.title,
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
      mp.team
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

  const [match, participants, session] = await Promise.all([
    getMatch(matchId),
    getParticipants(matchId),
    getSession(),
  ])

  if (!match || !session) {
    notFound()
  }

  const isCreator = match.created_by_user_id === session.userId
  const userParticipation = participants.find(p => p.user_id === session.userId)
  const isPast = new Date(match.date_time) < new Date()

  return (
    <MatchDetailClient
      match={match}
      participants={participants}
      isCreator={isCreator}
      userParticipation={userParticipation}
      isPast={isPast}
      currentUserId={session.userId}
    />
  )
}
