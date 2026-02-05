'use client'

import { useState, useRef, useCallback, type DragEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { GripVertical } from 'lucide-react'

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
  onAssignTeam: (participantId: number, team: 'A' | 'B' | null) => Promise<void>
  title: string
  showTeamColumns?: boolean // Whether to show team A/B columns
  showPhoneNumbers?: boolean // Always show phone numbers
}

export function TeamAssignment({
  participants,
  isCreator,
  isPast,
  onAssignTeam,
  title,
  showTeamColumns = true,
  showPhoneNumbers = true,
}: TeamAssignmentProps) {
  const [draggedParticipantId, setDraggedParticipantId] = useState<number | null>(null)
  const [dragOverTeam, setDragOverTeam] = useState<'A' | 'B' | 'none' | null>(null)
  const [isAssigning, setIsAssigning] = useState(false)
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const teamA = participants.filter(p => p.team === 'A')
  const teamB = participants.filter(p => p.team === 'B')
  const noTeam = participants.filter(p => !p.team)

  const hasTeams = teamA.length > 0 || teamB.length > 0
  const canDrag = isCreator && !isPast && !isAssigning

  // Reset drag state with timeout to prevent stuck state
  const resetDragState = useCallback(() => {
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current)
    }
    dragTimeoutRef.current = setTimeout(() => {
      setDraggedParticipantId(null)
      setDragOverTeam(null)
    }, 50)
  }, [])

  // Drag handlers
  function handleDragStart(e: DragEvent<HTMLDivElement>, participantId: number) {
    if (!canDrag) {
      e.preventDefault()
      return
    }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', participantId.toString())
    // Small delay to allow the drag image to be set
    requestAnimationFrame(() => {
      setDraggedParticipantId(participantId)
    })
  }

  function handleDragEnd() {
    resetDragState()
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>, team: 'A' | 'B' | 'none') {
    if (!canDrag || draggedParticipantId === null) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverTeam !== team) {
      setDragOverTeam(team)
    }
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    // Only reset if leaving the drop zone entirely
    const relatedTarget = e.relatedTarget as HTMLElement
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDragOverTeam(null)
    }
  }

  async function handleDrop(e: DragEvent<HTMLDivElement>, team: 'A' | 'B' | null) {
    if (!canDrag) return
    e.preventDefault()
    
    const participantIdStr = e.dataTransfer.getData('text/plain')
    const participantId = parseInt(participantIdStr, 10)
    
    resetDragState()
    
    if (!isNaN(participantId)) {
      setIsAssigning(true)
      try {
        await onAssignTeam(participantId, team)
      } finally {
        setIsAssigning(false)
      }
    }
  }

  async function handleButtonAssign(participantId: number, team: 'A' | 'B' | null) {
    if (isAssigning) return
    setIsAssigning(true)
    try {
      await onAssignTeam(participantId, team)
    } finally {
      setIsAssigning(false)
    }
  }

  // Draggable player badge component
  function PlayerBadge({ 
    participant, 
    variant,
    showButtons = false 
  }: { 
    participant: Participant
    variant: 'teamA' | 'teamB' | 'noTeam'
    showButtons?: boolean
  }) {
    const isDragging = draggedParticipantId === participant.id
    
    const badgeStyles = {
      teamA: "border-primary/50 bg-primary/5",
      teamB: "border-accent/50 bg-accent/10", 
      noTeam: ""
    }

    return (
      <div 
        className={cn(
          "flex items-center gap-1 transition-opacity select-none",
          isDragging && "opacity-50"
        )}
        draggable={canDrag}
        onDragStart={(e) => handleDragStart(e, participant.id)}
        onDragEnd={handleDragEnd}
      >
        <Badge 
          variant={variant === 'noTeam' ? 'secondary' : 'outline'}
          className={cn(
            "py-1.5 px-3 transition-all",
            badgeStyles[variant],
            canDrag && "cursor-grab active:cursor-grabbing pl-1.5",
            canDrag && variant !== 'noTeam' && "pr-1"
          )}
        >
          {canDrag && (
            <GripVertical className="w-3 h-3 mr-1 text-muted-foreground" />
          )}
          {participant.name}
          {showPhoneNumbers && ` (${participant.phone_last_four})`}
          {canDrag && variant !== 'noTeam' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 ml-1 text-xs hover:bg-destructive/20 hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                handleButtonAssign(participant.id, null)
              }}
              disabled={isAssigning}
            >
              x
            </Button>
          )}
        </Badge>
        {showButtons && canDrag && (
          <div className="flex gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-xs bg-primary/10 text-primary hover:bg-primary/20"
              onClick={() => handleButtonAssign(participant.id, 'A')}
              disabled={isAssigning}
            >
              A
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-xs bg-accent/30 text-accent-foreground hover:bg-accent/50"
              onClick={() => handleButtonAssign(participant.id, 'B')}
              disabled={isAssigning}
            >
              B
            </Button>
          </div>
        )}
      </div>
    )
  }

  // Drop zone component
  function DropZone({ 
    team, 
    children, 
    className 
  }: { 
    team: 'A' | 'B' | 'none'
    children: React.ReactNode
    className?: string 
  }) {
    const isOver = dragOverTeam === team && draggedParticipantId !== null
    
    return (
      <div
        className={cn(
          "min-h-[60px] rounded-lg transition-all",
          canDrag && "border-2 border-dashed",
          canDrag && !isOver && "border-transparent",
          isOver && team === 'A' && "border-primary bg-primary/10",
          isOver && team === 'B' && "border-accent bg-accent/10",
          isOver && team === 'none' && "border-muted-foreground bg-muted/50",
          className
        )}
        onDragOver={(e) => handleDragOver(e, team)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, team === 'none' ? null : team)}
      >
        {children}
      </div>
    )
  }

  // Simple list without teams (for substitutes/extras or when teams disabled)
  if (!showTeamColumns || !hasTeams) {
    return (
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium text-muted-foreground">{title} ({participants.length})</h4>
        <DropZone team="none">
          <div className="flex flex-wrap gap-2 p-1">
            {participants.map((p) => (
              <PlayerBadge 
                key={p.id} 
                participant={p} 
                variant="noTeam" 
                showButtons={showTeamColumns}
              />
            ))}
            {participants.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">Sin jugadores</p>
            )}
          </div>
        </DropZone>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h4 className="text-sm font-medium text-muted-foreground">{title} ({participants.length})</h4>
      <div className="grid grid-cols-2 gap-4">
        {/* Team A */}
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">A</span>
            Equipo A ({teamA.length})
          </h4>
          <DropZone team="A">
            <div className="flex flex-col gap-1.5 p-1">
              {teamA.map((p) => (
                <PlayerBadge key={p.id} participant={p} variant="teamA" />
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
          <h4 className="text-sm font-semibold text-accent-foreground flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs font-bold">B</span>
            Equipo B ({teamB.length})
          </h4>
          <DropZone team="B">
            <div className="flex flex-col gap-1.5 p-1">
              {teamB.map((p) => (
                <PlayerBadge key={p.id} participant={p} variant="teamB" />
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
          <h4 className="text-sm font-medium text-muted-foreground">Sin equipo ({noTeam.length})</h4>
          <DropZone team="none">
            <div className="flex flex-wrap gap-2 p-1">
              {noTeam.map((p) => (
                <PlayerBadge 
                  key={p.id} 
                  participant={p} 
                  variant="noTeam" 
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
