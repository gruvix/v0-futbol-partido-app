'use client'

import { useState, useRef, type DragEvent, type TouchEvent as ReactTouchEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { GripVertical, Shield, Loader2 } from 'lucide-react'

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
  substitutes: Participant[]
  isAdmin: boolean
  isPast: boolean
  onAssignTeam: (participantId: number, team: 'A' | 'B' | null) => void
  onPromoteToPlayer?: (participantId: number) => void
  onDemoteToSubstitute?: (participantId: number) => void
  teamCount: number
  teamSize: number
  maxPlayers: number
  admins?: Admin[]
  matchCreatorId?: number
  onToggleAdmin?: (userId: number, isCurrentlyAdmin: boolean) => void
  loadingParticipantIds?: Set<number>
}

const TEAM_COLORS = [
  { bg: 'bg-primary/10', border: 'border-primary/50', text: 'text-primary', badge: 'bg-primary text-primary-foreground' },
  { bg: 'bg-accent/10', border: 'border-accent/50', text: 'text-accent-foreground', badge: 'bg-accent text-accent-foreground' },
  { bg: 'bg-emerald-500/10', border: 'border-emerald-500/50', text: 'text-emerald-600', badge: 'bg-emerald-500 text-white' },
  { bg: 'bg-orange-500/10', border: 'border-orange-500/50', text: 'text-orange-600', badge: 'bg-orange-500 text-white' },
  { bg: 'bg-purple-500/10', border: 'border-purple-500/50', text: 'text-purple-600', badge: 'bg-purple-500 text-white' },
  { bg: 'bg-rose-500/10', border: 'border-rose-500/50', text: 'text-rose-600', badge: 'bg-rose-500 text-white' },
  { bg: 'bg-cyan-500/10', border: 'border-cyan-500/50', text: 'text-cyan-600', badge: 'bg-cyan-500 text-white' },
  { bg: 'bg-amber-500/10', border: 'border-amber-500/50', text: 'text-amber-600', badge: 'bg-amber-500 text-white' },
]

export function TeamAssignment({
  participants,
  substitutes,
  isAdmin,
  isPast,
  onAssignTeam,
  onPromoteToPlayer,
  onDemoteToSubstitute,
  teamCount,
  teamSize,
  maxPlayers,
  admins = [],
  matchCreatorId,
  onToggleAdmin,
  loadingParticipantIds = new Set(),
}: TeamAssignmentProps) {
  const [draggedParticipantId, setDraggedParticipantId] = useState<number | null>(null)
  const [draggedFromSubs, setDraggedFromSubs] = useState(false)
  const [dragOverZone, setDragOverZone] = useState<string | null>(null)
  const dragNodeRef = useRef<HTMLDivElement | null>(null)

  const canDrag = isAdmin && !isPast

  const getTeamNumber = (p: Participant): number | null => {
    if (p.team_number !== undefined && p.team_number !== null) return p.team_number
    if (p.team === 'A') return 1
    if (p.team === 'B') return 2
    return null
  }

  // Group players by team
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

  function isParticipantAdmin(userId: number): boolean {
    return admins.some(a => a.user_id === userId)
  }

  // --- Drag handlers ---
  function handleDragStart(e: DragEvent<HTMLDivElement>, participantId: number, fromSubs: boolean) {
    if (!canDrag) return
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', participantId.toString())
    e.dataTransfer.setData('application/from-subs', fromSubs ? '1' : '0')
    setDraggedParticipantId(participantId)
    setDraggedFromSubs(fromSubs)
  }

  function handleDragEnd() {
    setDraggedParticipantId(null)
    setDraggedFromSubs(false)
    setDragOverZone(null)
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>, zone: string) {
    if (!canDrag) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverZone(zone)
  }

  function handleDragLeave() {
    setDragOverZone(null)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>, zone: string) {
    if (!canDrag) return
    e.preventDefault()
    const participantId = parseInt(e.dataTransfer.getData('text/plain'), 10)
    const fromSubs = e.dataTransfer.getData('application/from-subs') === '1'
    if (!isNaN(participantId)) {
      processDropAction(participantId, zone, fromSubs)
    }
    setDraggedParticipantId(null)
    setDraggedFromSubs(false)
    setDragOverZone(null)
  }

  function processDropAction(participantId: number, zone: string, fromSubs: boolean) {
    if (zone === 'substitutes') {
      // Drop into substitutes list
      if (!fromSubs && onDemoteToSubstitute) {
        onDemoteToSubstitute(participantId)
      }
    } else if (zone === 'none') {
      // Drop into no-team list (players without team)
      if (fromSubs && onPromoteToPlayer) {
        onPromoteToPlayer(participantId)
      } else if (!fromSubs) {
        onAssignTeam(participantId, null)
      }
    } else if (zone.startsWith('team-')) {
      // Drop into a team
      if (fromSubs && onPromoteToPlayer) {
        // First promote, then assign team - handled by parent
        onPromoteToPlayer(participantId)
        // After promotion, also assign team
        const teamLetter = zone === 'team-1' ? 'A' as const : 'B' as const
        setTimeout(() => onAssignTeam(participantId, teamLetter), 100)
      } else {
        const teamLetter = zone === 'team-1' ? 'A' as const : 'B' as const
        onAssignTeam(participantId, teamLetter)
      }
    }
  }

  // --- Player badge ---
  function PlayerBadge({ 
    participant, 
    teamIndex,
    isSub = false,
    playerNumber
  }: { 
    participant: Participant
    teamIndex: number | null
    isSub?: boolean
    playerNumber?: number
  }) {
    const isDragging = draggedParticipantId === participant.id
    const isPlayerAdmin = isParticipantAdmin(participant.user_id)
    const isLoading = loadingParticipantIds.has(participant.id)
    const colors = teamIndex !== null ? TEAM_COLORS[teamIndex % TEAM_COLORS.length] : null

    return (
      <div 
        className={cn(
          "transition-all select-none",
          isDragging && "opacity-40"
        )}
        draggable={canDrag && !isLoading}
        onDragStart={(e) => handleDragStart(e, participant.id, isSub)}
        onDragEnd={handleDragEnd}
      >
        <Badge 
          variant={isSub ? 'secondary' : teamIndex === null ? 'default' : 'outline'}
          className={cn(
            "py-1.5 px-3 transition-all inline-flex items-center gap-1",
            colors && `${colors.border} ${colors.bg}`,
            canDrag && !isLoading && "cursor-grab active:cursor-grabbing",
          )}
        >
          {isLoading ? (
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground shrink-0" />
          ) : canDrag ? (
            <GripVertical className="w-3 h-3 text-muted-foreground shrink-0" />
          ) : null}
          {playerNumber !== undefined && (
            <span className="text-[10px] font-bold text-muted-foreground mr-0.5">{playerNumber}.</span>
          )}
          <span>{participant.name}</span>
          <span className="text-muted-foreground text-[10px]">({participant.phone_last_four})</span>
          {/* Admin shield inside badge */}
          {isAdmin && !isPast && onToggleAdmin && participant.user_id !== matchCreatorId ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleAdmin(participant.user_id, isPlayerAdmin) }}
              className="ml-0.5 shrink-0"
              title={isPlayerAdmin ? 'Quitar admin' : 'Hacer admin'}
            >
              <Shield className={cn(
                "w-3 h-3 transition-colors",
                isPlayerAdmin ? 'text-sky-400 opacity-100' : 'text-muted-foreground opacity-50 hover:opacity-80'
              )} />
            </button>
          ) : isPlayerAdmin ? (
            <Shield className="w-3 h-3 text-sky-400 shrink-0 ml-0.5" />
          ) : null}
        </Badge>
      </div>
    )
  }

  // --- Drop zone ---
  function DropZone({ 
    zone, 
    children, 
    className: extraClass,
    teamIndex
  }: { 
    zone: string
    children: React.ReactNode
    className?: string
    teamIndex?: number
  }) {
    const isOver = dragOverZone === zone && draggedParticipantId !== null
    const colors = teamIndex !== undefined ? TEAM_COLORS[teamIndex % TEAM_COLORS.length] : null
    
    return (
      <div
        className={cn(
          "min-h-[48px] rounded-lg transition-all",
          canDrag && "border-2 border-dashed",
          canDrag && !isOver && "border-transparent",
          isOver && colors && `${colors.border} ${colors.bg}`,
          isOver && !colors && "border-muted-foreground bg-muted/50",
          extraClass
        )}
        onDragOver={(e) => handleDragOver(e, zone)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, zone)}
      >
        {children}
      </div>
    )
  }

  // --- Render helpers ---
  function renderPlayerList(list: Participant[], teamIndex: number | null, isSub: boolean = false) {
    return (
      <div className="flex flex-wrap gap-1.5 p-1">
        {list.map((p, i) => (
          <PlayerBadge 
            key={p.id} 
            participant={p} 
            teamIndex={teamIndex} 
            isSub={isSub}
            playerNumber={!isSub ? i + 1 : undefined}
          />
        ))}
        {list.length === 0 && (
          <p className="text-xs text-muted-foreground p-2">
            {canDrag ? 'Arrastra jugadores aqui' : 'Sin jugadores'}
          </p>
        )}
      </div>
    )
  }

  // ==== No teams (team_count === 0) - just players + subs ====
  if (teamCount === 0) {
    return (
      <div className="flex flex-col gap-4">
        {/* Players list */}
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            Jugadores ({participants.length}/{maxPlayers})
          </h4>
          <DropZone zone="none">
            {renderPlayerList(participants, null)}
          </DropZone>
        </div>

        {/* Substitutes */}
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            Suplentes ({substitutes.length})
          </h4>
          <DropZone zone="substitutes">
            {renderPlayerList(substitutes, null, true)}
          </DropZone>
        </div>
      </div>
    )
  }

  // ==== 2 teams ====
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
            <DropZone zone="team-1" teamIndex={0}>
              {renderPlayerList(teamA, 0)}
            </DropZone>
          </div>

          {/* Team B */}
          <div className="flex flex-col gap-2">
            <h4 className={cn("text-sm font-semibold flex items-center gap-2", TEAM_COLORS[1].text)}>
              <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold", TEAM_COLORS[1].badge)}>B</span>
              Equipo B ({teamB.length}/{teamSize})
            </h4>
            <DropZone zone="team-2" teamIndex={1}>
              {renderPlayerList(teamB, 1)}
            </DropZone>
          </div>
        </div>

        {/* Always visible no-team list */}
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-medium text-muted-foreground">Sin equipo ({noTeam.length})</h4>
          <DropZone zone="none">
            {renderPlayerList(noTeam, null)}
          </DropZone>
        </div>

        {/* Substitutes */}
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-medium text-muted-foreground">Suplentes ({substitutes.length})</h4>
          <DropZone zone="substitutes">
            {renderPlayerList(substitutes, null, true)}
          </DropZone>
        </div>
      </div>
    )
  }

  // ==== More than 2 teams ====
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
              <DropZone zone={`team-${teamNum}`} teamIndex={i}>
                {renderPlayerList(teamPlayers, i)}
              </DropZone>
            </div>
          )
        })}
      </div>

      {/* Always visible no-team list */}
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium text-muted-foreground">Sin equipo ({noTeam.length})</h4>
        <DropZone zone="none">
          {renderPlayerList(noTeam, null)}
        </DropZone>
      </div>

      {/* Substitutes */}
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium text-muted-foreground">Suplentes ({substitutes.length})</h4>
        <DropZone zone="substitutes">
          {renderPlayerList(substitutes, null, true)}
        </DropZone>
      </div>
    </div>
  )
}
