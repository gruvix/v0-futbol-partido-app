import { sql } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { MatchCard } from '@/components/match-card'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus, Calendar } from 'lucide-react'

interface Match {
  id: number
  title: string | null
  date_time: string
  location_type: string
  location_custom: string | null
  created_by_user_id: number
  creator_name: string
  participant_count: number
  is_public: boolean
  is_registered: boolean
}

async function getDashboardMatches(userId: number): Promise<Match[]> {
  // Dashboard should not send past matches (before today). Past matches will live in a future section.
  // Privacy rule: private matches are only visible to registered users.
  // Old matches rule: include up to 1 week in the past (local server date, at midnight).
  const matches = await sql`
    SELECT
      m.id,
      m.title,
      m.date_time,
      m.location_type,
      m.location_custom,
      m.created_by_user_id,
      m.is_public,
      u.name as creator_name,
      COUNT(mp_all.id)::int as participant_count,
      EXISTS (
        SELECT 1
        FROM match_participants mp_me
        WHERE mp_me.match_id = m.id AND mp_me.user_id = ${userId}
      ) as is_registered
    FROM matches m
    JOIN users u ON m.created_by_user_id = u.id
    LEFT JOIN match_participants mp_all ON m.id = mp_all.match_id
    WHERE
      m.date_time >= (date_trunc('day', NOW()) - INTERVAL '7 days')
      AND (
        m.is_public = true
        OR EXISTS (
          SELECT 1
          FROM match_participants mp_me
          WHERE mp_me.match_id = m.id AND mp_me.user_id = ${userId}
        )
      )
    GROUP BY m.id, u.name
    ORDER BY m.date_time ASC
    LIMIT 20
  `

  return matches as Match[]
}

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) {
    // layout should already protect this, but keep it safe
    return null
  }

  const matches = await getDashboardMatches(session.userId)

  const todayMidnight = new Date()
  todayMidnight.setHours(0, 0, 0, 0)

  const upcomingMatches = matches.filter(m => new Date(m.date_time) >= todayMidnight)
  const pastWeekMatches = matches.filter(m => new Date(m.date_time) < todayMidnight)

  const registeredMatches = upcomingMatches.filter(m => m.is_registered)
  const otherPublicMatches = upcomingMatches.filter(m => !m.is_registered && m.is_public)

  const showNoMatchesCard =
    registeredMatches.length === 0 && otherPublicMatches.length === 0 && pastWeekMatches.length === 0

  const showJoinSuggestionCard = registeredMatches.length === 0 && otherPublicMatches.length > 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Hola, {session?.name}</h1>
          <p className="text-gray-700">Próximos partidos y actividad</p>
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Tus próximos partidos</h2>
          <Link href="/dashboard/nuevo">
            <Button size="sm" variant="outline" className="gap-2 bg-transparent">
              <Plus className="w-4 h-4" />
              Crear partido
            </Button>
          </Link>
        </div>

        {showNoMatchesCard ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
              <Calendar className="w-12 h-12 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium text-foreground">No hay partidos programados</p>
                <p className="text-sm text-muted-foreground">Crea uno para empezar</p>
              </div>
              <Link href="/dashboard/nuevo">
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Crear partido
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-6">
            {showJoinSuggestionCard && (
              <Card>
                <CardContent className="flex flex-col gap-3 py-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <p className="font-medium text-foreground">Todavía no estás anotado en ningún partido</p>
                      <p className="text-sm text-muted-foreground">
                        Abajo tenés partidos disponibles en <span className="font-medium">“Otros partidos”</span>.
                        Sumate a uno o creá el tuyo.
                      </p>
                    </div>
                    <Link href="/dashboard/nuevo" className="shrink-0">
                      <Button size="sm" className="gap-2">
                        <Plus className="w-4 h-4" />
                        Crear partido
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-3">
              {registeredMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  currentUserId={session.userId}
                  isRegistered={match.is_registered}
                />
              ))}
            </div>

            {otherPublicMatches.length > 0 && (
              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold text-muted-foreground">Otros partidos</h2>
                <div className="grid gap-3">
                  {otherPublicMatches.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      currentUserId={session.userId}
                      isRegistered={match.is_registered}
                    />
                  ))}
                </div>
              </div>
            )}

            {pastWeekMatches.length > 0 && (
              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold text-muted-foreground">Partidos anteriores (últimos 7 días)</h2>
                <div className="grid gap-3">
                  {pastWeekMatches.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      currentUserId={session.userId}
                      isPast
                      borderVariant="default"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
