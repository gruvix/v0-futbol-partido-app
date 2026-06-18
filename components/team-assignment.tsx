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
import { Check, Shield, X } from 'lucide-react'
import { InlineLoader } from '@/components/football-loader'
import { GenderIcon, type Gender } from '@/lib/gender'

interface Participant {
  id: number
  user_id: number | null
  name: string
  phone_last_four: string
  gender: Gender
  role: 'PLAYER' | 'SUBSTITUTE'
  team: 'A' | 'B' | null
  team_number?: number | null
  is_guest?: boolean
  invited_by_user_id?: number | null
  invited_by_name?: string | null
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
  canManageRoster?: boolean
  isPast: boolean
  onAssignTeam: (participantId: number, team: 'A' | 'B' | null) => void
  onPromoteToPlayer?: (participantId: number) => void
  onDemoteToSubstitute?: (participantId: number) => void
  teamCount: number
  teamSize: number
  maxPlayers: number
  admins?: Admin[]
  matchCreatorId?: number
  loadingParticipantIds?: Set<number>
  eligibleSubstituteIds?: Set<number>
  currentUserId?: number
  onAssignTeamNumber?: (participantId: number, teamNumber: number | null) => void
  onSelectParticipant?: (participantId: number) => void
  onConfirmEligibleSubstitute?: (participantId: number) => void
  onPassEligibleSubstitute?: (participantId: number) => void
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
  canManageRoster = isAdmin,
  isPast,
  onAssignTeam,
  onPromoteToPlayer,
  onDemoteToSubstitute,
  teamCount,
  teamSize,
  maxPlayers,
  admins = [],
  matchCreatorId,
  loadingParticipantIds = new Set(),
  eligibleSubstituteIds = new Set(),
  currentUserId,
  onAssignTeamNumber,
  onSelectParticipant,
  onConfirmEligibleSubstitute,
  onPassEligibleSubstitute,
}: TeamAssignmentProps) {
  const [activeDrag, setActiveDrag] = useState<Participant | null>(null)

  const canDrag = canManageRoster && !isPast
  const eligibleSubstitutes = substitutes.filter(p => eligibleSubstituteIds.has(p.id))
  const waitingSubstitutes = substitutes.filter(p => !eligibleSubstituteIds.has(p.id))

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
      if (teamCount > 0 && teamSize > 0) {
        const dragged = participantById.get(participantId)
        if (dragged) {
          const targetTeamCount = teamGroups[teamNumber]?.length ?? 0
          const isAlreadyInTeam = getTeamNumber(dragged) === teamNumber
          if (!isAlreadyInTeam && targetTeamCount >= teamSize) {
            return
          }
        }
      }
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
  }: { 
    participant: Participant
    teamIndex: number | null
    isSub?: boolean
  }) {
    const isPlayerAdmin = participant.user_id !== null ? isParticipantAdmin(participant.user_id) : false
    const isLoading = loadingParticipantIds.has(participant.id)
    const isCreator = participant.user_id !== null && participant.user_id === matchCreatorId
    const colors = teamIndex !== null ? TEAM_COLORS[teamIndex % TEAM_COLORS.length] : null
    const isEligibleSubstitute = isSub && eligibleSubstituteIds.has(participant.id)
    const canActOnEligibleSubstitute = isEligibleSubstitute && !isPast && (
      canManageRoster ||
      participant.user_id === currentUserId ||
      (participant.user_id === null && participant.invited_by_user_id === currentUserId)
    )
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
      id: participant.id,
      data: { participantId: participant.id, fromSubs: isSub },
      disabled: !canDrag || isLoading,
    })

    return (
      <div
        ref={setNodeRef}
        className={cn(
          "transition-all select-none w-full min-w-0",
          isDragging && "opacity-40"
        )}
      >
        <Badge 
          variant={isSub ? 'secondary' : teamIndex === null ? 'default' : 'outline'}
          className={cn(
            "py-1 px-2 md:py-1.5 md:px-3 transition-all inline-flex w-full overflow-hidden max-w-full flex-col items-start gap-0.5 md:flex-row md:items-center md:gap-1",
            colors && `${colors.border} ${colors.bg}`,
            // Ensure all participants show the hand cursor (clickable) on hover.
            // When drag is enabled, keep grab cursor to communicate drag affordance.
            canDrag && !isLoading
              ? "touch-none cursor-grab active:cursor-grabbing"
              : "cursor-pointer",
          )}
          {...attributes}
          {...listeners}
          onClick={() => onSelectParticipant?.(participant.id)}
        >
          {isLoading ? (
            <InlineLoader size="sm" className="shrink-0" />
          ) : null}
          <span className="min-w-0 w-full truncate text-sm md:text-[13px] md:w-auto md:flex-1">
            <span className="inline-flex items-center gap-1">
              <GenderIcon gender={participant.gender} className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{participant.name}</span>
              {participant.is_guest ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                  Invitado
                </span>
              ) : null}
            </span>
            {participant.is_guest && participant.invited_by_name ? (
              <span className="block text-[10px] text-muted-foreground truncate">
                por {participant.invited_by_name}
              </span>
            ) : null}
          </span>
          <div className="flex items-center gap-1 self-stretch md:self-auto">
            <span className="text-muted-foreground text-[10px] md:text-[10px] flex items-center gap-1">
              ({participant.phone_last_four ? participant.phone_last_four : '—'})
              {isCreator ? (
                <Shield className="w-3 h-3 text-amber-400 shrink-0" />
              ) : isPlayerAdmin ? (
                <Shield className="w-3 h-3 text-sky-400 shrink-0" />
              ) : null}
            </span>
            {canActOnEligibleSubstitute ? (
              <span className="ml-auto inline-flex items-center gap-1">
                <button
                  type="button"
                  aria-label={`Confirmar a ${participant.name} como jugador`}
                  disabled={isLoading}
                  onClick={(event) => {
                    event.stopPropagation()
                    onConfirmEligibleSubstitute?.(participant.id)
                  }}
                  className="rounded-full border border-emerald-500/60 bg-emerald-500/10 p-1 text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  aria-label={`Pasar turno de ${participant.name}`}
                  disabled={isLoading}
                  onClick={(event) => {
                    event.stopPropagation()
                    onPassEligibleSubstitute?.(participant.id)
                  }}
                  className="rounded-full border border-destructive/60 bg-destructive/10 p-1 text-destructive hover:bg-destructive/20 disabled:opacity-50"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ) : null}
          </div>
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
          "min-h-[40px] md:min-h-[48px] rounded-lg transition-all w-full min-w-0",
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
          "py-1.5 px-3 inline-flex items-center gap-1 max-w-[240px]",
          colors && `${colors.border} ${colors.bg}`
        )}
      >
        <GenderIcon gender={participant.gender} className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate max-w-[150px]">{participant.name}</span>
        <span className="text-muted-foreground text-[10px] shrink-0">({participant.phone_last_four})</span>
      </Badge>
    )
  }


  // --- Render helpers ---
  function renderPlayerList(list: Participant[], teamIndex: number | null, isSub: boolean = false) {
    return (
      <div className="flex flex-col gap-0.5 p-0 md:gap-1.5 md:p-1">
        {list.map((p) => (
          <PlayerBadge 
            key={p.id} 
            participant={p} 
            teamIndex={teamIndex} 
            isSub={isSub}
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

  function renderSubstitutesList() {
    return (
      <DropZone zone="substitutes">
        <div className="flex flex-col gap-1 p-0 md:p-1">
          {eligibleSubstitutes.length > 0 ? (
            <div className="rounded-lg border-2 border-amber-500/70 bg-amber-500/10 p-1.5">
              <p className="px-1 pb-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                Suplentes habilitados para confirmar
              </p>
              {renderPlayerList(eligibleSubstitutes, null, true)}
            </div>
          ) : null}
          {waitingSubstitutes.length > 0 ? renderPlayerList(waitingSubstitutes, null, true) : null}
          {substitutes.length === 0 ? (
            <p className="text-xs text-muted-foreground p-2">
              {canDrag ? 'Arrastra jugadores aqui' : 'Sin jugadores'}
            </p>
          ) : null}
        </div>
      </DropZone>
    )
  }

  function renderNumberedList(list: Participant[], totalSlots: number, teamIndex: number | null) {
    return (
      <div className="flex flex-col gap-0.5 p-0 md:gap-1.5 md:p-1">
        {Array.from({ length: totalSlots }, (_, i) => {
          const participant = list[i]

          return (
            <div key={i} className="flex items-start gap-1 md:gap-2 w-full min-w-0">
              <span className="text-[10px] font-bold text-muted-foreground w-4 md:w-5 text-right pt-1">{i + 1}.</span>
              {participant ? (
                <div className="flex-1 min-w-0">
                  <PlayerBadge participant={participant} teamIndex={teamIndex} />
                </div>
              ) : (
                <div className="h-8 flex-1 min-w-0" />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // ==== No teams (team_count === 0) - just players + subs ====
  const content = (() => {
    if (teamCount === 0) {
      return (
        <div className="flex flex-col gap-0 md:gap-4">
          {/* Players list */}
          <div className="flex flex-col gap-0 md:gap-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              Jugadores ({participants.length}/{maxPlayers})
            </h4>
          <DropZone zone="none">
            {renderNumberedList(participants, maxPlayers, null)}
          </DropZone>
          </div>

          {/* Substitutes */}
          <div className="flex flex-col gap-0 md:gap-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              Suplentes ({substitutes.length})
            </h4>
            {renderSubstitutesList()}
          </div>
        </div>
      )
    }

    if (teamCount === 2) {
      const teamA = teamGroups[1] || []
      const teamB = teamGroups[2] || []

      return (
        <div className="flex flex-col gap-0 md:gap-4">
          <div className="grid grid-cols-2 gap-0 md:gap-4 auto-rows-fr items-stretch">
            {/* Team A */}
            <div className="flex flex-col gap-0 md:gap-2 h-full">
              <h4 className={cn("text-sm font-semibold flex items-center gap-2", TEAM_COLORS[0].text)}>
                <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold", TEAM_COLORS[0].badge)}>A</span>
                Equipo A ({teamA.length}/{teamSize})
              </h4>
              <DropZone zone="team-1" teamIndex={0}>
                {renderNumberedList(teamA, teamSize, 0)}
              </DropZone>
            </div>

            {/* Team B */}
            <div className="flex flex-col gap-0 md:gap-2 h-full">
              <h4 className={cn("text-sm font-semibold flex items-center gap-2", TEAM_COLORS[1].text)}>
                <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold", TEAM_COLORS[1].badge)}>B</span>
                Equipo B ({teamB.length}/{teamSize})
              </h4>
              <DropZone zone="team-2" teamIndex={1}>
                {renderNumberedList(teamB, teamSize, 1)}
              </DropZone>
            </div>
          </div>

          {/* Always visible no-team list */}
          <div className="flex flex-col gap-0 md:gap-2">
            <h4 className="text-sm font-medium text-muted-foreground">Sin equipo ({noTeam.length})</h4>
            <DropZone zone="none">
              {renderPlayerList(noTeam, null)}
            </DropZone>
          </div>

          {/* Substitutes */}
          <div className="flex flex-col gap-0 md:gap-2">
            <h4 className="text-sm font-medium text-muted-foreground">Suplentes ({substitutes.length})</h4>
            {renderSubstitutesList()}
          </div>

        </div>
      )
    }

    return (
      <div className="flex flex-col gap-0 md:gap-4">
        <div className={cn(
          "grid gap-0 md:gap-4 auto-rows-fr items-stretch",
          "grid-cols-2"
        )}>
          {Array.from({ length: teamCount }, (_, i) => {
            const teamNum = i + 1
            const teamPlayers = teamGroups[teamNum] || []
            const colors = TEAM_COLORS[i % TEAM_COLORS.length]

            return (
              <div key={teamNum} className="flex flex-col gap-0 md:gap-2 h-full">
                <h4 className={cn("text-sm font-semibold flex items-center gap-2", colors.text)}>
                  <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold", colors.badge)}>
                    {teamNum}
                  </span>
                  Equipo {teamNum} ({teamPlayers.length}/{teamSize})
                </h4>
                <DropZone zone={`team-${teamNum}`} teamIndex={i}>
                  {renderNumberedList(teamPlayers, teamSize, i)}
                </DropZone>
              </div>
            )
          })}
        </div>

        {/* Always visible no-team list */}
        <div className="flex flex-col gap-0 md:gap-2">
          <h4 className="text-sm font-medium text-muted-foreground">Sin equipo ({noTeam.length})</h4>
          <DropZone zone="none">
            {renderPlayerList(noTeam, null)}
          </DropZone>
        </div>

        {/* Substitutes */}
        <div className="flex flex-col gap-0 md:gap-2">
          <h4 className="text-sm font-medium text-muted-foreground">Suplentes ({substitutes.length})</h4>
          {renderSubstitutesList()}
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
