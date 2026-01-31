import { sql } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { MatchCard } from '@/components/match-card'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus, Calendar } from 'lucide-react'

interface Match {
  id: number
  date_time: string
  location_type: string
  location_custom: string | null
  created_by_user_id: number
  creator_name: string
  participant_count: number
}

async function getUpcomingMatches(): Promise<Match[]> {
  const matches = await sql`
    SELECT 
      m.id,
      m.date_time,
      m.location_type,
      m.location_custom,
      m.created_by_user_id,
      u.name as creator_name,
      COUNT(mp.id)::int as participant_count
    FROM matches m
    JOIN users u ON m.created_by_user_id = u.id
    LEFT JOIN match_participants mp ON m.id = mp.match_id
    WHERE m.date_time >= NOW()
    GROUP BY m.id, u.name
    ORDER BY m.date_time ASC
    LIMIT 10
  `
  return matches as Match[]
}

async function getPastMatches(): Promise<Match[]> {
  const matches = await sql`
    SELECT 
      m.id,
      m.date_time,
      m.location_type,
      m.location_custom,
      m.created_by_user_id,
      u.name as creator_name,
      COUNT(mp.id)::int as participant_count
    FROM matches m
    JOIN users u ON m.created_by_user_id = u.id
    LEFT JOIN match_participants mp ON m.id = mp.match_id
    WHERE m.date_time < NOW()
    GROUP BY m.id, u.name
    ORDER BY m.date_time DESC
    LIMIT 5
  `
  return matches as Match[]
}

export default async function DashboardPage() {
  const session = await getSession()
  const [upcomingMatches, pastMatches] = await Promise.all([
    getUpcomingMatches(),
    getPastMatches(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Hola, {session?.name}</h1>
          <p className="text-muted-foreground">Proximos partidos y actividad</p>
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Proximos partidos</h2>
          <Link href="/dashboard/nuevo">
            <Button size="sm" variant="outline" className="gap-2 bg-transparent">
              <Plus className="w-4 h-4" />
              Crear partido
            </Button>
          </Link>
        </div>

        {upcomingMatches.length === 0 ? (
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
          <div className="grid gap-3">
            {upcomingMatches.map((match) => (
              <MatchCard 
                key={match.id} 
                match={match} 
                currentUserId={session?.userId || 0}
              />
            ))}
          </div>
        )}
      </section>

      {pastMatches.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-foreground text-muted-foreground">Partidos pasados</h2>
          <div className="grid gap-3 opacity-70">
            {pastMatches.map((match) => (
              <MatchCard 
                key={match.id} 
                match={match} 
                currentUserId={session?.userId || 0}
                isPast
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
