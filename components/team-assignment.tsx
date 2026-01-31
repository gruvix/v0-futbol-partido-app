'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Participant {
  id: number
  user_id: number
  name: string
  phone_last_four: string
  role: 'PLAYER' | 'SUBSTITUTE' | 'EXTRA'
  team: 'A' | 'B' | null
}

interface TeamAssignmentProps {
  participants: Participant[]
  isCreator: boolean
  isPast: boolean
  onAssignTeam: (participantId: number, team: 'A' | 'B' | null) => void
  title: string
}

export function TeamAssignment({
  participants,
  isCreator,
  isPast,
  onAssignTeam,
  title,
}: TeamAssignmentProps) {
  const teamA = participants.filter(p => p.team === 'A')
  const teamB = participants.filter(p => p.team === 'B')
  const noTeam = participants.filter(p => !p.team)

  const hasTeams = teamA.length > 0 || teamB.length > 0

  if (!hasTeams) {
    return (
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
        <div className="flex flex-wrap gap-2">
          {participants.map((p) => (
            <div key={p.id} className="flex items-center gap-1">
              <Badge variant="secondary" className="py-1.5 px-3">
                {p.name} ({p.phone_last_four})
              </Badge>
              {isCreator && !isPast && (
                <div className="flex gap-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-xs bg-primary/10 text-primary hover:bg-primary/20"
                    onClick={() => onAssignTeam(p.id, 'A')}
                  >
                    A
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-xs bg-accent/30 text-accent-foreground hover:bg-accent/50"
                    onClick={() => onAssignTeam(p.id, 'B')}
                  >
                    B
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">A</span>
            Equipo A ({teamA.length})
          </h4>
          <div className="flex flex-col gap-1.5">
            {teamA.map((p) => (
              <div key={p.id} className="flex items-center gap-1">
                <Badge 
                  variant="outline" 
                  className={cn(
                    "py-1.5 px-3 border-primary/50 bg-primary/5",
                    isCreator && !isPast && "pr-1"
                  )}
                >
                  {p.name}
                  {isCreator && !isPast && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 ml-1 text-xs hover:bg-primary/20"
                      onClick={() => onAssignTeam(p.id, null)}
                    >
                      x
                    </Button>
                  )}
                </Badge>
              </div>
            ))}
            {teamA.length === 0 && (
              <p className="text-xs text-muted-foreground">Sin jugadores</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold text-accent-foreground flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs font-bold">B</span>
            Equipo B ({teamB.length})
          </h4>
          <div className="flex flex-col gap-1.5">
            {teamB.map((p) => (
              <div key={p.id} className="flex items-center gap-1">
                <Badge 
                  variant="outline" 
                  className={cn(
                    "py-1.5 px-3 border-accent/50 bg-accent/10",
                    isCreator && !isPast && "pr-1"
                  )}
                >
                  {p.name}
                  {isCreator && !isPast && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 ml-1 text-xs hover:bg-accent/20"
                      onClick={() => onAssignTeam(p.id, null)}
                    >
                      x
                    </Button>
                  )}
                </Badge>
              </div>
            ))}
            {teamB.length === 0 && (
              <p className="text-xs text-muted-foreground">Sin jugadores</p>
            )}
          </div>
        </div>
      </div>

      {noTeam.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-medium text-muted-foreground">Sin equipo</h4>
          <div className="flex flex-wrap gap-2">
            {noTeam.map((p) => (
              <div key={p.id} className="flex items-center gap-1">
                <Badge variant="secondary" className="py-1.5 px-3">
                  {p.name}
                </Badge>
                {isCreator && !isPast && (
                  <div className="flex gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-xs bg-primary/10 text-primary hover:bg-primary/20"
                      onClick={() => onAssignTeam(p.id, 'A')}
                    >
                      A
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-xs bg-accent/30 text-accent-foreground hover:bg-accent/50"
                      onClick={() => onAssignTeam(p.id, 'B')}
                    >
                      B
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
