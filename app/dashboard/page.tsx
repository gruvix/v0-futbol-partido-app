import { getSession } from '@/lib/auth'
import { MatchCard } from '@/components/match-card'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus, Calendar, Users, Globe } from 'lucide-react'
import { getUserMatches, getPublicUpcomingMatches, getUserPastMatches } from '@/app/actions/matches'

export default async function DashboardPage() {
  const session = await getSession()
  const [userMatches, publicMatches, pastMatches] = await Promise.all([
    getUserMatches(),
    getPublicUpcomingMatches(),
    getUserPastMatches(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Hola, {session?.name}</h1>
          <p className="text-muted-foreground">Tus partidos y actividad</p>
        </div>
        <Link href="/dashboard/nuevo">
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Crear partido
          </Button>
        </Link>
      </div>

      {/* Tus Partidos - User's matches (participant or creator) */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Tus partidos</h2>
        </div>

        {userMatches.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
              <Calendar className="w-12 h-12 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium text-foreground">No estas anotado en ningun partido</p>
                <p className="text-sm text-muted-foreground">Crea uno o anotate en uno existente</p>
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
            {userMatches.map((match) => (
              <MatchCard 
                key={match.id} 
                match={match} 
                currentUserId={session?.userId || 0}
                isUserMatch
              />
            ))}
          </div>
        )}
      </section>

      {/* Proximos Partidos - Public matches user is not part of */}
      {publicMatches.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Proximos partidos</h2>
          </div>
          <div className="grid gap-3">
            {publicMatches.map((match) => (
              <MatchCard 
                key={match.id} 
                match={match} 
                currentUserId={session?.userId || 0}
              />
            ))}
          </div>
        </section>
      )}

      {/* Historial - Past matches */}
      {pastMatches.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-muted-foreground">Historial</h2>
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
