'use client'

import { useState, type DragEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { GripVertical, Shield } from 'lucide-react'

interface Participant {
  id: number
  user_id: number
  name: string
  phone_last_four: string
  role: 'PLAYER' | 'SUBSTITUTE' | 'EXTRA'
  team: 'A' | 'B' | null
  team_number?: number | null
}

interface Admin {
  user_id: number
  name: string
  phone_last_four: string
}

interface TeamAssignmentProps {
  participants: Participant[]
  isAdmin: boolean
  isPast: boolean
  onAssignTeam: (participantId: number, team: 'A' | 'B' | null) => void
  teamCount: number
  teamSize: number
  title: string
  admins?: Admin[]
  matchCreatorId?: number
  onToggleAdmin?: (userId: number, isCurrentlyAdmin: boolean) => void
}

// Team colors for multiple teams
const TEAM_COLORS = [
  { bg: 'bg-primary/10', border: 'border-primary/50', text: 'text-primary', badge: 'bg-primary text-primary-foreground' },
  { bg: 'bg-accent/10', border: 'border-accent/50', text: 'text-accent-foreground', badge: 'bg-accent text-accent-foreground' },
  { bg: 'bg-emerald-500/10', border: 'border-emerald-500/50', text: 'text-emerald-600', badge: 'bg-emerald-500 text-white' },
  { bg: 'bg-orange-500/10', border: 'border-orange-500/50', text: 'text-orange-600', badge: 'bg-orange-500 text-white' },
  { bg: 'bg-purple-500/10', border: 'border-purple-500/50', text: 'text-purple-600', badge: 'bg-purple-500 text-white' },
  { bg: 'bg-rose-500/10', border: 'border-rose-500/50', text: 'text-rose-600', badge: 'bg-rose-500 text-white' },
  { bg: 'bg-cyan-500/10', border: 'border-cyan-500/50', text: 'text-cyan-600', badge: 'bg-cyan-500 text-white' },
  { bg: 'bg-amber-500/10', border: 'border-amber-500/50', text: 'text-amber-600', badge: 'bg-amber-500 text-white' },
  { bg: 'bg-indigo-500/10', border: 'border-indigo-500/50', text: 'text-indigo-600', badge: 'bg-indigo-500 text-white' },
  { bg: 'bg-pink-500/10', border: 'border-pink-500/50', text: 'text-pink-600', badge: 'bg-pink-500 text-white' },
]

export function TeamAssignment({
  participants,
  isAdmin,
  isPast,
  onAssignTeam,
  teamCount,
  teamSize,
  title,
  admins = [],
  matchCreatorId,
  onToggleAdmin,
}: TeamAssignmentProps) {
  const [draggedParticipantId, setDraggedParticipantId] = useState<number | null>(null)
  const [dragOverTeam, setDragOverTeam] = useState<string | null>(null)

  const canDrag = isAdmin && !isPast

  // For backwards compatibility with old team: 'A' | 'B' system
  const getTeamNumber = (p: Participant): number | null => {
    if (p.team_number !== undefined && p.team_number !== null) return p.team_number
    if (p.team === 'A') return 1
    if (p.team === 'B') return 2
    return null
  }

  // Group participants by team number
  const teamGroups: Record<number, Participant[]> = {}
  const noTeam: Participant[] = []

  for (const p of participants) {
    const teamNum = getTeamNumber(p)
    if (teamNum !== null && teamNum >= 1 && teamNum <= teamCount) {
      if (!teamGroups[teamNum]) teamGroups[teamNum] = []
      teamGroups[teamNum].push(p)
    } else {
      noTeam.push(p)
    }
  }

  const hasTeams = Object.keys(teamGroups).length > 0

  // Drag handlers
  function handleDragStart(e: DragEvent<HTMLDivElement>, participantId: number) {
    if (!canDrag) return
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', participantId.toString())
    setDraggedParticipantId(participantId)
  }

  function handleDragEnd() {
    setDraggedParticipantId(null)
    setDragOverTeam(null)
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>, team: string) {
    if (!canDrag) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverTeam(team)
  }

  function handleDragLeave() {
    setDragOverTeam(null)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>, team: 'A' | 'B' | null) {
    if (!canDrag) return
    e.preventDefault()
    const participantId = parseInt(e.dataTransfer.getData('text/plain'), 10)
    if (!isNaN(participantId)) {
      onAssignTeam(participantId, team)
    }
    setDraggedParticipantId(null)
    setDragOverTeam(null)
  }

  // Check if participant is admin
  function isParticipantAdmin(userId: number): boolean {
    return admins.some(a => a.user_id === userId)
  }

  // Player badge component
  function PlayerBadge({ 
    participant, 
    teamIndex,
    showButtons = false 
  }: { 
    participant: Participant
    teamIndex: number | null
    showButtons?: boolean
  }) {
    const isDragging = draggedParticipantId === participant.id
    const isPlayerAdmin = isParticipantAdmin(participant.user_id)
    
    const colors = teamIndex !== null ? TEAM_COLORS[teamIndex % TEAM_COLORS.length] : null

    return (
      <div 
        className={cn(
          "flex items-center gap-1 transition-opacity",
          isDragging && "opacity-50"
        )}
        draggable={canDrag}
        onDragStart={(e) => handleDragStart(e, participant.id)}
        onDragEnd={handleDragEnd}
      >
        <Badge 
          variant={teamIndex === null ? 'secondary' : 'outline'}
          className={cn(
            "py-1.5 px-3 transition-all",
            colors && `${colors.border} ${colors.bg}`,
            canDrag && "cursor-grab active:cursor-grabbing pl-1.5",
            canDrag && !isPast && teamIndex !== null && "pr-1"
          )}
        >
          {canDrag && (
            <GripVertical className="w-3 h-3 mr-1 text-muted-foreground" />
          )}
          {participant.name}
          {teamIndex === null && !hasTeams && ` (${participant.phone_last_four})`}
          {isPlayerAdmin && <Shield className="w-3 h-3 ml-1" />}
          {canDrag && teamIndex !== null && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 ml-1 text-xs hover:bg-destructive/20 hover:text-destructive"
              onClick={() => onAssignTeam(participant.id, null)}
            >
              x
            </Button>
          )}
        </Badge>
        {showButtons && canDrag && teamCount >= 2 && (
          <div className="flex gap-0.5">
            {Array.from({ length: Math.min(teamCount, 4) }, (_, i) => {
              const colors = TEAM_COLORS[i % TEAM_COLORS.length]
              const teamLabel = teamCount === 2 ? (i === 0 ? 'A' : 'B') : (i + 1).toString()
              return (
                <Button
                  key={i}
                  variant="ghost"
                  size="sm"
                  className={cn("h-6 w-6 p-0 text-xs", colors.bg, colors.text, `hover:${colors.bg}`)}
                  onClick={() => onAssignTeam(participant.id, i === 0 ? 'A' : 'B')}
                >
                  {teamLabel}
                </Button>
              )
            })}
          </div>
        )}
        {isAdmin && !isPast && onToggleAdmin && participant.user_id !== matchCreatorId && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onToggleAdmin(participant.user_id, isPlayerAdmin)}
            title={isPlayerAdmin ? 'Quitar admin' : 'Hacer admin'}
          >
            <Shield className={`w-3 h-3 ${isPlayerAdmin ? 'text-primary' : 'text-muted-foreground'}`} />
          </Button>
        )}
      </div>
    )
  }

  // Drop zone component
  function DropZone({ 
    team, 
    children, 
    className,
    teamIndex
  }: { 
    team: string
    children: React.ReactNode
    className?: string
    teamIndex?: number
  }) {
    const isOver = dragOverTeam === team && draggedParticipantId !== null
    const colors = teamIndex !== undefined ? TEAM_COLORS[teamIndex % TEAM_COLORS.length] : null
    
    return (
      <div
        className={cn(
          "min-h-[60px] rounded-lg transition-all",
          canDrag && "border-2 border-dashed",
          canDrag && !isOver && "border-transparent",
          isOver && colors && `${colors.border} ${colors.bg}`,
          isOver && !colors && "border-muted-foreground bg-muted/50",
          className
        )}
        onDragOver={(e) => handleDragOver(e, team)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, team === 'none' ? null : (team === 'team-1' ? 'A' : 'B'))}
      >
        {children}
      </div>
    )
  }

  // No teams configured - show simple list
  if (teamCount === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
        <div className="flex flex-wrap gap-2">
          {participants.map((p) => (
            <PlayerBadge 
              key={p.id} 
              participant={p} 
              teamIndex={null} 
              showButtons={false}
            />
          ))}
        </div>
      </div>
    )
  }

  // 2 teams - classic A/B layout
  if (teamCount === 2) {
    const teamA = teamGroups[1] || []
    const teamB = teamGroups[2] || []
    
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Team A */}
          <div className="flex flex-col gap-2">
            <h4 className={cn("text-sm font-semibold flex items-center gap-2", TEAM_COLORS[0].text)}>
              <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold", TEAM_COLORS[0].badge)}>A</span>
              Equipo A ({teamA.length}/{teamSize})
            </h4>
            <DropZone team="team-1" teamIndex={0}>
              <div className="flex flex-col gap-1.5 p-1">
                {teamA.map((p) => (
                  <PlayerBadge key={p.id} participant={p} teamIndex={0} />
                ))}
                {teamA.length === 0 && (
                  <p className="text-xs text-muted-foreground p-2">
                    {canDrag ? 'Arrastra jugadores aqui' : 'Sin jugadores'}
                  </p>
                )}
              </div>
            </DropZone>
          </div>

          {/* Team B */}
          <div className="flex flex-col gap-2">
            <h4 className={cn("text-sm font-semibold flex items-center gap-2", TEAM_COLORS[1].text)}>
              <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold", TEAM_COLORS[1].badge)}>B</span>
              Equipo B ({teamB.length}/{teamSize})
            </h4>
            <DropZone team="team-2" teamIndex={1}>
              <div className="flex flex-col gap-1.5 p-1">
                {teamB.map((p) => (
                  <PlayerBadge key={p.id} participant={p} teamIndex={1} />
                ))}
                {teamB.length === 0 && (
                  <p className="text-xs text-muted-foreground p-2">
                    {canDrag ? 'Arrastra jugadores aqui' : 'Sin jugadores'}
                  </p>
                )}
              </div>
            </DropZone>
          </div>
        </div>

        {/* Unassigned players */}
        {noTeam.length > 0 && (
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-medium text-muted-foreground">Sin equipo</h4>
            <DropZone team="none">
              <div className="flex flex-wrap gap-2 p-1">
                {noTeam.map((p) => (
                  <PlayerBadge 
                    key={p.id} 
                    participant={p} 
                    teamIndex={null} 
                    showButtons={true}
                  />
                ))}
              </div>
            </DropZone>
          </div>
        )}
      </div>
    )
  }

  // More than 2 teams - grid layout
  return (
    <div className="flex flex-col gap-4">
      <div className={cn(
        "grid gap-4",
        teamCount <= 3 ? "grid-cols-3" : teamCount === 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3"
      )}>
        {Array.from({ length: teamCount }, (_, i) => {
          const teamNum = i + 1
          const teamPlayers = teamGroups[teamNum] || []
          const colors = TEAM_COLORS[i % TEAM_COLORS.length]
          
          return (
            <div key={teamNum} className="flex flex-col gap-2">
              <h4 className={cn("text-sm font-semibold flex items-center gap-2", colors.text)}>
                <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold", colors.badge)}>
                  {teamNum}
                </span>
                Equipo {teamNum} ({teamPlayers.length}/{teamSize})
              </h4>
              <DropZone team={`team-${teamNum}`} teamIndex={i}>
                <div className="flex flex-col gap-1.5 p-1">
                  {teamPlayers.map((p) => (
                    <PlayerBadge key={p.id} participant={p} teamIndex={i} />
                  ))}
                  {teamPlayers.length === 0 && (
                    <p className="text-xs text-muted-foreground p-2">
                      {canDrag ? 'Arrastra jugadores' : 'Sin jugadores'}
                    </p>
                  )}
                </div>
              </DropZone>
            </div>
          )
        })}
      </div>

      {/* Unassigned players */}
      {noTeam.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-medium text-muted-foreground">Sin equipo</h4>
          <DropZone team="none">
            <div className="flex flex-wrap gap-2 p-1">
              {noTeam.map((p) => (
                <PlayerBadge 
                  key={p.id} 
                  participant={p} 
                  teamIndex={null} 
                  showButtons={true}
                />
              ))}
            </div>
          </DropZone>
        </div>
      )}
    </div>
  )
}
