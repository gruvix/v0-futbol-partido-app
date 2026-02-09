'use client'

import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { GripVertical, Shield } from 'lucide-react'
import { InlineLoader } from '@/components/football-loader'

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
  onAssignTeamNumber?: (participantId: number, teamNumber: number | null) => void
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
  onAssignTeamNumber,
}: TeamAssignmentProps) {
  const [activeDrag, setActiveDrag] = useState<Participant | null>(null)

  const canDrag = isAdmin && !isPast

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } })
  )

  const participantById = useMemo(() => {
    const map = new Map<number, Participant>()
    for (const participant of [...participants, ...substitutes]) {
      map.set(participant.id, participant)
    }
    return map
  }, [participants, substitutes])

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

  type DragPayload = { participantId: number; fromSubs: boolean }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as DragPayload | undefined
    if (!data) return
    const dragged = participantById.get(data.participantId) || null
    setActiveDrag(dragged)
  }

  function handleDragEnd(event: DragEndEvent) {
    const data = event.active.data.current as DragPayload | undefined
    const overId = event.over?.id
    if (data && typeof overId === 'string') {
      processDropAction(data.participantId, overId, data.fromSubs)
    }
    setActiveDrag(null)
  }

  function handleDragCancel() {
    setActiveDrag(null)
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
        if (teamCount > 2 && onAssignTeamNumber) {
          onAssignTeamNumber(participantId, null)
        } else {
          onAssignTeam(participantId, null)
        }
      }
    } else if (zone.startsWith('team-')) {
      // Drop into a team
      const teamNumber = Number.parseInt(zone.replace('team-', ''), 10)
      if (!Number.isFinite(teamNumber)) return
      const assignToTeam = () => {
        if (teamCount > 2) {
          if (onAssignTeamNumber) {
            onAssignTeamNumber(participantId, teamNumber)
          }
          return
        }
        const teamLetter = teamNumber === 1 ? 'A' as const : 'B' as const
        onAssignTeam(participantId, teamLetter)
      }

      if (fromSubs && onPromoteToPlayer) {
        onPromoteToPlayer(participantId)
        setTimeout(assignToTeam, 100)
      } else {
        assignToTeam()
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
    const isPlayerAdmin = isParticipantAdmin(participant.user_id)
    const isLoading = loadingParticipantIds.has(participant.id)
    const colors = teamIndex !== null ? TEAM_COLORS[teamIndex % TEAM_COLORS.length] : null
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
      id: participant.id,
      data: { participantId: participant.id, fromSubs: isSub },
      disabled: !canDrag || isLoading,
    })

    return (
      <div
        ref={setNodeRef}
        className={cn(
          "transition-all select-none",
          isDragging && "opacity-40"
        )}
      >
        <Badge 
          variant={isSub ? 'secondary' : teamIndex === null ? 'default' : 'outline'}
          className={cn(
            "py-1.5 px-3 transition-all inline-flex items-center gap-1",
            colors && `${colors.border} ${colors.bg}`,
            canDrag && !isLoading && "touch-none",
          )}
        >
          {isLoading ? (
            <InlineLoader size="sm" className="shrink-0" />
          ) : canDrag ? (
            <span
              ref={setActivatorNodeRef}
              {...listeners}
              {...attributes}
              className="cursor-grab active:cursor-grabbing shrink-0"
            >
              <GripVertical className="w-3 h-3 text-muted-foreground" />
            </span>
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
    const { isOver, setNodeRef } = useDroppable({ id: zone, disabled: !canDrag })
    const colors = teamIndex !== undefined ? TEAM_COLORS[teamIndex % TEAM_COLORS.length] : null
    
    return (
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[48px] rounded-lg transition-all",
          canDrag && "border-2 border-dashed",
          canDrag && !isOver && "border-transparent",
          isOver && colors && `${colors.border} ${colors.bg}`,
          isOver && !colors && "border-muted-foreground bg-muted/50",
          extraClass
        )}
      >
        {children}
      </div>
    )
  }

  function DragOverlayBadge({ participant }: { participant: Participant }) {
    const teamNumber = getTeamNumber(participant)
    const teamIndex = teamNumber !== null ? teamNumber - 1 : null
    const colors = teamIndex !== null ? TEAM_COLORS[teamIndex % TEAM_COLORS.length] : null
    const isSub = participant.role === 'SUBSTITUTE'

    return (
      <Badge
        variant={isSub ? 'secondary' : teamIndex === null ? 'default' : 'outline'}
        className={cn(
          "py-1.5 px-3 inline-flex items-center gap-1",
          colors && `${colors.border} ${colors.bg}`
        )}
      >
        <GripVertical className="w-3 h-3 text-muted-foreground" />
        <span>{participant.name}</span>
        <span className="text-muted-foreground text-[10px]">({participant.phone_last_four})</span>
      </Badge>
    )
  }

  // --- Render helpers ---
  function renderPlayerList(list: Participant[], teamIndex: number | null, isSub: boolean = false) {
    return (
      <div className="flex flex-col gap-1.5 p-1">
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
  const content = (() => {
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
  })()

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {content}
      <DragOverlay>
        {activeDrag ? <DragOverlayBadge participant={activeDrag} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
