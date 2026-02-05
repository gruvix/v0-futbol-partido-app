'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Users, Search } from 'lucide-react'

interface Player {
  id: number
  name: string
  phone_last_four: string
  matches_played: number
}

interface PlayersListProps {
  players: Player[]
}

export function PlayersList({ players }: PlayersListProps) {
  const [search, setSearch] = useState('')

  const filteredPlayers = players.filter(player => 
    player.name.toLowerCase().includes(search.toLowerCase()) ||
    player.phone_last_four.includes(search)
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2 text-foreground">
          <Users className="w-5 h-5" />
          {players.length} jugadores
        </CardTitle>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o telefono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>
      <CardContent>
        {players.length === 0 ? (
          <p className="text-muted-foreground text-sm">Todavia no hay jugadores registrados</p>
        ) : filteredPlayers.length === 0 ? (
          <p className="text-muted-foreground text-sm">No se encontraron jugadores con &quot;{search}&quot;</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {filteredPlayers.map(player => (
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
  )
}
