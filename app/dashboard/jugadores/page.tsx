import { sql } from '@/lib/db'
import { PlayersList } from '@/components/players-list'

interface Player {
  id: number
  name: string
  phone_last_four: string
  gender: 'MALE' | 'FEMALE' | 'OTHER'
  matches_played: number
}

async function getPlayers(): Promise<Player[]> {
  const players = await sql`
    SELECT 
      u.id,
      u.name,
      u.phone_last_four,
      u.gender,
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

      <PlayersList players={players} />
    </div>
  )
}
