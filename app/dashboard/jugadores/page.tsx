import { sql } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users } from 'lucide-react'

interface Player {
  id: number
  name: string
  phone_last_four: string
  matches_played: number
}

async function getPlayers(): Promise<Player[]> {
  const players = await sql`
    SELECT 
      u.id,
      u.name,
      u.phone_last_four,
      COUNT(mp.id)::int as matches_played
    FROM users u
    LEFT JOIN match_participants mp ON u.id = mp.user_id
    WHERE u.is_approved = true
    GROUP BY u.id
    ORDER BY matches_played DESC, u.name ASC
  `
  return players as Player[]
}

export default async function JugadoresPage() {
  const players = await getPlayers()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Jugadores</h1>
        <p className="text-muted-foreground">Todos los pibes del grupo</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-foreground">
            <Users className="w-5 h-5" />
            {players.length} jugadores
          </CardTitle>
        </CardHeader>
        <CardContent>
          {players.length === 0 ? (
            <p className="text-muted-foreground text-sm">Todavia no hay jugadores registrados</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {players.map(player => (
                <Badge
                  key={player.id}
                  variant="secondary"
                  className="py-2 px-3 flex items-center gap-2"
                >
                  <span className="font-medium">{player.name}</span>
                  <span className="text-muted-foreground">({player.phone_last_four})</span>
                  {player.matches_played > 0 && (
                    <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                      {player.matches_played} partidos
                    </span>
                  )}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
