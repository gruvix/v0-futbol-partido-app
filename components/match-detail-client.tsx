'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Users,
  Shuffle,
  Trash2,
  Share2,
  Globe,
  Lock,
  ChevronLeft,
  ChevronRight,
  Pencil,
  UserRoundPlus,
  UserRoundMinus,
  Check,
  X,
} from 'lucide-react'
import { GenderIcon, type Gender } from '@/lib/gender'
import {
  joinMatch,
  leaveMatch,
  deleteMatch,
  randomizeTeams,
  assignTeam,
  assignTeamNumber,
  removeParticipant,
  updateMatchField,
  resetTeamsToNoTeam,
  addMatchAdmin,
  removeMatchAdmin,
  changeParticipantRole,
  confirmEligibleSubstitute,
  passEligibleSubstitute,
} from '@/app/actions/matches'
import { TeamAssignment } from '@/components/team-assignment'
import { SoccerField } from '@/components/soccer-field'
import { InvitePlayersDialog } from '@/components/invite-players-dialog'
import { InlineLoader, useActionLoader } from '@/components/football-loader'
import { EditableField } from '@/components/editable-field'
import { useErrorToast } from '@/components/error-toast-provider'
import { waitForNextPaint } from '@/lib/wait-for-next-paint'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getParticipantCountsFromRoster } from '@/lib/match-summary'
import { listActiveFieldsAction } from '@/app/actions/fields'
import { getMatchVenueLabel, getCancellationPolicySummary } from '@/lib/field-display'
import type { Field } from '@/lib/fields'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Match {
  id: number
  title: string | null
  date_time: string
  location_type: string
  location_custom: string | null
  field: string | null
  field_id: number | null
  field_name: string | null
  field_slug: string | null
  field_maps_url?: string | null
  cancellation_deadline_hours?: number | null
  cancellation_penalty?: string | null
  created_by_user_id: number
  creator_name: string
  is_public: boolean
  team_count: number
  team_size: number
  max_players: number
  invites_per_player: number | null
  field_rent_total: number | null
  auto_admin_registered_players: boolean
}

interface Participant {
  id: number
  user_id: number | null
  name: string
  phone_last_four: string
  role: 'PLAYER' | 'SUBSTITUTE'
  gender: Gender
  team: 'A' | 'B' | null
  team_number: number | null
  is_guest?: boolean
  invited_by_user_id?: number | null
  invited_by_name?: string | null
  // When the viewer is not subscribed to the match, the server does not
  // include payment info to avoid leaking it.
  has_paid?: boolean | null
  payment_notes?: string | null
  pixel_avatar?: string | null
}

interface Admin {
  user_id: number
  name: string
  phone_last_four: string
}

interface MatchDetailClientProps {
  match: Match
  participants: Participant[]
  admins: Admin[]
  isCreator: boolean
  isAdmin: boolean
  userParticipation?: Participant
  isPast: boolean
  currentUserId: number
}

const COMMON_TIMES = [
  '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'
]

const PICKER_HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))
const PICKER_MINUTES = ['00', '15', '30', '45']

export function MatchDetailClient({
  match,
  participants,
  admins,
  isCreator,
  isAdmin,
  userParticipation,
  isPast,
  currentUserId,
}: MatchDetailClientProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [joinPlayerDenialAnimKey, setJoinPlayerDenialAnimKey] = useState(0)
  const joinPlayerDenialResetTimeoutRef = useRef<number | null>(null)

  const JOIN_PLAYER_DENIAL_ANIMATION_MS = 5000

  useEffect(() => {
    return () => {
      if (joinPlayerDenialResetTimeoutRef.current !== null) {
        window.clearTimeout(joinPlayerDenialResetTimeoutRef.current)
      }
    }
  }, [])

  function triggerJoinPlayerDenialFeedback() {
    if (joinPlayerDenialResetTimeoutRef.current !== null) {
      window.clearTimeout(joinPlayerDenialResetTimeoutRef.current)
    }

    setJoinPlayerDenialAnimKey(0)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setJoinPlayerDenialAnimKey(Date.now())
        joinPlayerDenialResetTimeoutRef.current = window.setTimeout(() => {
          setJoinPlayerDenialAnimKey(0)
          joinPlayerDenialResetTimeoutRef.current = null
        }, JOIN_PLAYER_DENIAL_ANIMATION_MS)
      })
    })
  }
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showLastPlayerConfirm, setShowLastPlayerConfirm] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [showTeamResetWarning, setShowTeamResetWarning] = useState<{field: string, value: number} | null>(null)
  const [showKickConfirm, setShowKickConfirm] = useState<Participant | null>(null)
  const [kickLoadingId, setKickLoadingId] = useState<number | null>(null)
  const [selectedParticipantId, setSelectedParticipantId] = useState<number | null>(null)
  const [editRole, setEditRole] = useState<'PLAYER' | 'SUBSTITUTE'>('PLAYER')
  const [editTeamNumber, setEditTeamNumber] = useState<number | null>(null)
  const [editIsAdmin, setEditIsAdmin] = useState(false)
  const [initialEditState, setInitialEditState] = useState<{
    role: 'PLAYER' | 'SUBSTITUTE'
    teamNumber: number | null
    isAdmin: boolean
  } | null>(null)
  const router = useRouter()
  const { showLoader, hideLoader } = useActionLoader()
  const { showError } = useErrorToast()

  function computedMaxPlayersValue(teamCount: number, teamSize: number): number {
    return Math.max(1, teamCount) * Math.max(1, teamSize)
  }

  async function handleFieldSave(field: string, value: string | number | boolean | null): Promise<void> {
    showLoader('Guardando...')
    await waitForNextPaint()
    const result = await updateMatchField(match.id, field, value)
    hideLoader()
    if (result?.error) {
      showError('Error al intentar actualizar configuracion del partido')
    } else {
      router.refresh()
    }
  }

  function computedMaxPlayers(teamCount: number, teamSize: number): number {
    if (teamCount <= 0) return match.max_players
    return Math.max(1, teamCount) * Math.max(1, teamSize)
  }

  // Max players:
  // - when teams are enabled, it is derived (team_count * team_size)
  // - when no teams, it is chosen by creator/admin (match.max_players)
  const maxPlayers = match.team_count > 0 ? computedMaxPlayers(match.team_count, match.team_size) : match.max_players

  // Edit state for each field
  const [editTitle, setEditTitle] = useState(match.title || '')
  const [venueFields, setVenueFields] = useState<Field[]>([])
  const [editFieldId, setEditFieldId] = useState<number | null>(match.field_id)
  const [editLocationCustom, setEditLocationCustom] = useState(match.location_custom || '')
  const [editField, setEditField] = useState(match.field || '')
  const [editTeamCount, setEditTeamCount] = useState(match.team_count)
  const [editCustomTeamCount, setEditCustomTeamCount] = useState('')
  const [editUseCustomTeamCount, setEditUseCustomTeamCount] = useState(false)
  const [editTeamSize, setEditTeamSize] = useState(match.team_size)
  const [editCustomTeamSize, setEditCustomTeamSize] = useState('')
  const [editMaxPlayers, setEditMaxPlayers] = useState(match.max_players.toString())
  const [editInvitesPerPlayer, setEditInvitesPerPlayer] = useState(match.invites_per_player === null ? '' : match.invites_per_player.toString())
  const [editUseCustomTeamSize, setEditUseCustomTeamSize] = useState(false)
  const [editIsPublic, setEditIsPublic] = useState(match.is_public)
  
  // Date/time edit state
  const [editWeekOffset, setEditWeekOffset] = useState(0)
  const [editSelectedDate, setEditSelectedDate] = useState(() => {
    const d = new Date(match.date_time)
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  })
  const [editSelectedTime, setEditSelectedTime] = useState(() => {
    const d = new Date(match.date_time)
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
  })
  const [editUseCustomTime, setEditUseCustomTime] = useState(false)
  const [editCustomHour, setEditCustomHour] = useState(() => {
    const d = new Date(match.date_time)
    return String(d.getUTCHours()).padStart(2, '0')
  })
  const [editCustomMinute, setEditCustomMinute] = useState(() => {
    const d = new Date(match.date_time)
    return String(d.getUTCMinutes()).padStart(2, '0')
  })

  // Parse the date without timezone conversion
  const date = new Date(match.date_time)
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']
  const dayNamesShort = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const monthNamesShort = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  
  const formattedDate = `${dayNames[date.getUTCDay()]} ${date.getUTCDate()} de ${monthNames[date.getUTCMonth()]}`
  const hours = date.getUTCHours().toString().padStart(2, '0')
  const minutes = date.getUTCMinutes().toString().padStart(2, '0')
  const formattedTime = `${hours}:${minutes}`
  
  const location = getMatchVenueLabel(match)
  const cancellationPolicy = getCancellationPolicySummary({
    cancellation_deadline_hours: match.cancellation_deadline_hours,
    cancellation_penalty: match.cancellation_penalty,
  })

  useEffect(() => {
    if (!isAdmin) return
    listActiveFieldsAction().then(setVenueFields)
  }, [isAdmin])

  const editSelectedVenue = venueFields.find((f) => f.id === editFieldId) ?? null

  // Display title - fallback to "Partido de [creator]"
  const displayTitle = match.title || `Partido de ${match.creator_name}`

  // Optimistic local state for team assignments
  const [optimisticOverrides, setOptimisticOverrides] = useState<Record<number, { team: 'A' | 'B' | null; role?: 'PLAYER' | 'SUBSTITUTE' }>>({})
  const [loadingParticipantIds, setLoadingParticipantIds] = useState<Set<number>>(new Set())

  // Apply optimistic overrides to participants
  const effectiveParticipants = participants.map(p => {
    if (optimisticOverrides[p.id]) {
      const override = optimisticOverrides[p.id]
      return { ...p, team: override.team, ...(override.role ? { role: override.role } : {}) }
    }
    return p
  })

  const players = effectiveParticipants.filter(p => p.role === 'PLAYER')
  const substitutes = effectiveParticipants.filter(p => p.role === 'SUBSTITUTE')
  const freeOfficialSlots = maxPlayers > 0 ? Math.max(0, maxPlayers - players.length) : Number.POSITIVE_INFINITY
  const eligibleSubstitutes = Number.isFinite(freeOfficialSlots)
    ? substitutes.slice(0, freeOfficialSlots)
    : substitutes
  const eligibleSubstituteIds = new Set(eligibleSubstitutes.map(p => p.id))
  const currentUserIsOfficialPlayer = players.some(p => p.user_id === currentUserId)
  const canManageRoster = isCreator || (isAdmin && currentUserIsOfficialPlayer)
  const playerJoinReservedForSubs = maxPlayers > 0 && freeOfficialSlots <= substitutes.length && substitutes.length > 0
  const canJoinAsOfficialPlayer = maxPlayers <= 0 || (freeOfficialSlots > 0 && !playerJoinReservedForSubs)
  const canOverrideSubstitutePriority = canManageRoster && playerJoinReservedForSubs && freeOfficialSlots > 0
  const currentUserIsEligibleSubstitute = userParticipation
    ? eligibleSubstituteIds.has(userParticipation.id)
    : false

  const { playerCount, substituteCount } = getParticipantCountsFromRoster(effectiveParticipants)

  const getParticipantTeamNumber = (participant: Participant): number | null => {
    if (participant.team_number !== null && participant.team_number !== undefined) {
      return participant.team_number
    }
    if (participant.team === 'A') return 1
    if (participant.team === 'B') return 2
    return null
  }

  const teamPlayersMap = new Map<number, Participant[]>()
  const noTeamPlayers: Participant[] = []

  for (const player of players) {
    const teamNum = getParticipantTeamNumber(player)
    if (teamNum) {
      const list = teamPlayersMap.get(teamNum) || []
      list.push(player)
      teamPlayersMap.set(teamNum, list)
    } else {
      noTeamPlayers.push(player)
    }
  }

  const getParticipantStatusLabel = (participant: Participant): string => {
    if (participant.role === 'SUBSTITUTE') return 'Suplente'
    const teamNum = getParticipantTeamNumber(participant)
    if (teamNum) {
      const label = teamNum === 1 && participant.team === 'A'
        ? 'A'
        : teamNum === 2 && participant.team === 'B'
          ? 'B'
          : teamNum.toString()
      return `Jugador de equipo ${label}`
    }
    return 'Jugador'
  }

  const selectedParticipant = selectedParticipantId
    ? effectiveParticipants.find(p => p.id === selectedParticipantId) || null
    : null

  const [pendingTeamSettings, setPendingTeamSettings] = useState<{
    teamCount: number
    teamSize: number
    maxPlayers: number
  } | null>(null)

  async function applyTeamSettings(teamCount: number, teamSize: number, maxPlayersValue: number): Promise<void> {
    const normalize = await resetTeamsToNoTeam(match.id)
    if (normalize?.error) {
      showError('Error al intentar actualizar configuracion del partido', normalize.error)
      return
    }

    const r1 = await updateMatchField(match.id, 'team_count', teamCount)
    if (r1?.error) {
      showError('Error al intentar actualizar configuracion del partido', r1.error)
      return
    }

    const r2 = await updateMatchField(match.id, 'team_size', teamSize)
    if (r2?.error) {
      showError('Error al intentar actualizar configuracion del partido', r2.error)
      return
    }

    if (teamCount === 0) {
      const r3 = await updateMatchField(match.id, 'max_players', maxPlayersValue)
      if (r3?.error) {
        showError('Error al intentar actualizar configuracion del partido', r3.error)
      }
    }
  }

  async function saveTeamSettings(nextTeamCount: number, nextTeamSize: number, nextMaxPlayers: number): Promise<void> {
    const hasAnyPlayers = players.length > 0

    // Ensure we save with the latest selected values (EditableField can keep stale edit state)
    setEditTeamCount(nextTeamCount)
    setEditTeamSize(nextTeamSize)
    if (nextTeamCount === 0) {
      setEditMaxPlayers(nextMaxPlayers.toString())
    }

    // If players are present, confirm first
    if (hasAnyPlayers) {
      setShowTeamResetWarning({ field: 'team_count', value: nextTeamCount })
      setPendingTeamSettings({ teamCount: nextTeamCount, teamSize: nextTeamSize, maxPlayers: nextMaxPlayers })
      return
    }

    showLoader('Guardando...')
    await waitForNextPaint()
    await applyTeamSettings(nextTeamCount, nextTeamSize, nextMaxPlayers)
    hideLoader()
    // Force refresh so UI immediately reflects new mode (teams vs no teams)
    router.refresh()
  }

  // Generate edit dates
  const editDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + 1 + (editWeekOffset * 7) + i)
    return d
  })
  const canEditGoForward = editWeekOffset < 4
  const canEditGoBack = editWeekOffset > 0

  async function handleJoin(role: 'PLAYER' | 'SUBSTITUTE') {
    if (role === 'PLAYER' && playerJoinReservedForSubs) {
      triggerJoinPlayerDenialFeedback()
      return
    }

    setLoading(`join-${role}`)
    const roleLabels: Record<'PLAYER' | 'SUBSTITUTE', string> = { PLAYER: 'Jugador', SUBSTITUTE: 'Suplente' }
    showLoader(`Anotandote como ${roleLabels[role]}...`)
    await waitForNextPaint()
    const result = await joinMatch(match.id, role)
    hideLoader()
    if (result?.error) {
      showError('Error al intentar anotarte', result.error)
    } else {
      router.refresh()
    }
    setLoading(null)
  }

  async function handleConfirmEligibleSubstitute(participantId: number) {
    setLoadingParticipantIds(prev => {
      const next = new Set(prev)
      next.add(participantId)
      return next
    })
    await waitForNextPaint()
    const result = await confirmEligibleSubstitute(match.id, participantId)
    setLoadingParticipantIds(prev => {
      const next = new Set(prev)
      next.delete(participantId)
      return next
    })
    if (result?.error) {
      showError('Error al intentar confirmar suplente', result.error)
    } else {
      router.refresh()
    }
  }

  async function handlePassEligibleSubstitute(participantId: number) {
    setLoadingParticipantIds(prev => {
      const next = new Set(prev)
      next.add(participantId)
      return next
    })
    await waitForNextPaint()
    const result = await passEligibleSubstitute(match.id, participantId)
    setLoadingParticipantIds(prev => {
      const next = new Set(prev)
      next.delete(participantId)
      return next
    })
    if (result?.error) {
      showError('Error al intentar pasar turno', result.error)
    } else {
      router.refresh()
    }
  }

  function handleLeaveClick() {
    setShowLeaveConfirm(true)
  }

  async function handleLeaveConfirmed() {
    setShowLeaveConfirm(false)
    setLoading('leave')
    showLoader('Abandonando partido...')
    await waitForNextPaint()
    const result = await leaveMatch(match.id)
    hideLoader()
    if (result?.error) {
      showError('Error al intentar abandonar el partido', result.error)
      setLoading(null)
    } else if (result?.isLastPlayer) {
      setLoading(null)
      setShowLastPlayerConfirm(true)
    } else {
      setLoading(null)
      router.refresh()
    }
  }

  async function handleDelete() {
    setLoading('delete')
    showLoader('Eliminando partido...')
    await waitForNextPaint()
    const result = await deleteMatch(match.id)
    if (result?.error) {
      showError('Error al intentar eliminar partido', result.error)
      setLoading(null)
      hideLoader()
    } else if (result?.redirect) {
      router.push(result.redirect)
    }
  }

  async function handleRandomize() {
    setLoading('randomize')
    showLoader('Sorteando equipos...')
    await waitForNextPaint()
    const result = await randomizeTeams(match.id)
    hideLoader()
    if (result?.error) {
      showError('Error al intentar sortear equipos', result.error)
    } else {
      router.refresh()
    }
    setLoading(null)
  }

  async function handleAssignTeam(participantId: number, team: 'A' | 'B' | null) {
    if (match.team_count > 0 && team !== null) {
      const teamSizeLimit = match.team_size
      const currentTeamCount = effectiveParticipants.filter(p => p.role === 'PLAYER' && p.team === team).length
      const isAlreadyInTeam = effectiveParticipants.find(p => p.id === participantId)?.team === team
      if (!isAlreadyInTeam && currentTeamCount >= teamSizeLimit) {
        showError('Equipo lleno', 'Ese equipo ya está completo.')
        return
      }
    }
    // Optimistic: move player in UI immediately, show spinner on their badge
    setOptimisticOverrides(prev => ({ ...prev, [participantId]: { team } }))
    setLoadingParticipantIds(prev => {
      const next = new Set(prev)
      next.add(participantId)
      return next
    })
    await waitForNextPaint()

    const result = await assignTeam(match.id, participantId, team)

    // Remove loading spinner but keep optimistic override to avoid jump-back
    setLoadingParticipantIds(prev => {
      const next = new Set(prev)
      next.delete(participantId)
      return next
    })

    if (result?.error) {
      // Revert optimistic override on error
      setOptimisticOverrides(prev => {
        const next = { ...prev }
        delete next[participantId]
        return next
      })
      showError('Error al intentar mover jugador a equipo', result.error)
    } else {
      router.refresh()
    }
    // On success, keep the override - it will be consistent with the revalidated data
    // and will be cleaned up when participants prop changes
  }

  async function handleAssignTeamNumber(participantId: number, teamNumber: number | null) {
    if (teamNumber !== null) {
      const teamSizeLimit = match.team_size
      const currentTeamCount = effectiveParticipants.filter(p => p.role === 'PLAYER' && p.team_number === teamNumber).length
      const isAlreadyInTeam = effectiveParticipants.find(p => p.id === participantId)?.team_number === teamNumber
      if (!isAlreadyInTeam && currentTeamCount >= teamSizeLimit) {
        showError('Equipo lleno', 'Ese equipo ya está completo.')
        return
      }
    }
    setOptimisticOverrides(prev => ({ ...prev, [participantId]: { team: null } }))
    setLoadingParticipantIds(prev => {
      const next = new Set(prev)
      next.add(participantId)
      return next
    })
    await waitForNextPaint()

    const result = await assignTeamNumber(match.id, participantId, teamNumber)

    setLoadingParticipantIds(prev => {
      const next = new Set(prev)
      next.delete(participantId)
      return next
    })

    if (result?.error) {
      setOptimisticOverrides(prev => {
        const next = { ...prev }
        delete next[participantId]
        return next
      })
      showError('Error al intentar mover jugador a equipo', result.error)
    } else {
      router.refresh()
    }
  }

  async function handlePromoteToPlayer(participantId: number) {
    const participant = effectiveParticipants.find(p => p.id === participantId)
    const needsPriorityOverride = Boolean(
      participant?.role === 'SUBSTITUTE' &&
      !eligibleSubstituteIds.has(participantId) &&
      canOverrideSubstitutePriority
    )
    if (needsPriorityOverride && !window.confirm('Estás por ascender a un suplente ignorando el orden de inscripción. ¿Estás seguro?')) {
      return
    }

    setOptimisticOverrides(prev => ({ ...prev, [participantId]: { team: null, role: 'PLAYER' } }))
    setLoadingParticipantIds(prev => {
      const next = new Set(prev)
      next.add(participantId)
      return next
    })
    await waitForNextPaint()
    const result = await changeParticipantRole(match.id, participantId, 'PLAYER', needsPriorityOverride)
    setLoadingParticipantIds(prev => {
      const next = new Set(prev)
      next.delete(participantId)
      return next
    })
    if (result?.error) {
      setOptimisticOverrides(prev => {
        const next = { ...prev }
        delete next[participantId]
        return next
      })
      showError('Error al intentar mover jugador a jugadores', result.error)
    } else {
      router.refresh()
    }
  }

  async function handleDemoteToSubstitute(participantId: number) {
    setOptimisticOverrides(prev => ({ ...prev, [participantId]: { team: null, role: 'SUBSTITUTE' } }))
    setLoadingParticipantIds(prev => {
      const next = new Set(prev)
      next.add(participantId)
      return next
    })
    await waitForNextPaint()
    const result = await changeParticipantRole(match.id, participantId, 'SUBSTITUTE')
    setLoadingParticipantIds(prev => {
      const next = new Set(prev)
      next.delete(participantId)
      return next
    })
    if (result?.error) {
      setOptimisticOverrides(prev => {
        const next = { ...prev }
        delete next[participantId]
        return next
      })
      showError('Error al intentar mover jugador a suplentes', result.error)
    } else {
      router.refresh()
    }
  }

  function openParticipantPanel(participantId: number) {
    const participant = effectiveParticipants.find(p => p.id === participantId)
    if (!participant) return
    setSelectedParticipantId(participantId)
    const role: 'PLAYER' | 'SUBSTITUTE' = participant.role === 'SUBSTITUTE' ? 'SUBSTITUTE' : 'PLAYER'
    setEditRole(role)
    if (match.team_count > 0) {
      const teamNum = participant.team_number ?? (participant.team === 'A' ? 1 : participant.team === 'B' ? 2 : null)
      setEditTeamNumber(teamNum)
    } else {
      setEditTeamNumber(null)
    }
    const isCurrentlyAdmin = participant.user_id !== null
      ? admins.some(admin => admin.user_id === participant.user_id)
      : false
    const isAdminValue = participant.user_id !== null
      ? (isCurrentlyAdmin || participant.user_id === match.created_by_user_id)
      : false
    setEditIsAdmin(isAdminValue)

    setInitialEditState({
      role,
      teamNumber: match.team_count > 0
        ? (participant.team_number ?? (participant.team === 'A' ? 1 : participant.team === 'B' ? 2 : null))
        : null,
      isAdmin: isAdminValue,
    })
  }

  function closeParticipantPanel() {
    setSelectedParticipantId(null)
    setInitialEditState(null)
  }

  function handleKickSelected() {
    if (!selectedParticipant) return
    if (selectedParticipant.user_id === match.created_by_user_id) return
    setKickLoadingId(selectedParticipant.id)
    setShowKickConfirm(selectedParticipant)
  }

  async function confirmKickParticipant() {
    if (!showKickConfirm) return
    const participantId = showKickConfirm.id
    await waitForNextPaint()
    const result = await removeParticipant(match.id, participantId)
    setKickLoadingId(null)
    if (result?.error) {
      showError('Error al intentar quitar jugador', result.error)
    } else {
      router.refresh()
    }
    setShowKickConfirm(null)
    closeParticipantPanel()
  }

  async function handleSaveParticipantChanges() {
    if (!selectedParticipant) return
    if (!canManageRoster) {
      showError('No tenes permiso para mover jugadores')
      return
    }
    const participantId = selectedParticipant.id
    const userId = selectedParticipant.user_id
    const isCreatorUser = userId === match.created_by_user_id

    setLoadingParticipantIds(prev => {
      const next = new Set(prev)
      next.add(participantId)
      return next
    })
    await waitForNextPaint()

    const nextTeamNumber = editRole === 'SUBSTITUTE' ? null : editTeamNumber

    if (match.team_count > 0 && editRole !== 'SUBSTITUTE') {
      const teamSizeLimit = match.team_size
      if (match.team_count > 2) {
        if (nextTeamNumber !== null) {
          const currentTeamCount = effectiveParticipants.filter(p => p.role === 'PLAYER' && p.team_number === nextTeamNumber).length
          const isAlreadyInTeam = selectedParticipant.team_number === nextTeamNumber
          if (!isAlreadyInTeam && currentTeamCount >= teamSizeLimit) {
            showError('Equipo lleno', 'Ese equipo ya está completo.')
            setLoadingParticipantIds(prev => {
              const next = new Set(prev)
              next.delete(participantId)
              return next
            })
            return
          }
        }
      } else {
        const nextTeam: 'A' | 'B' | null = nextTeamNumber === 1 ? 'A' : nextTeamNumber === 2 ? 'B' : null
        if (nextTeam !== null) {
          const currentTeamCount = effectiveParticipants.filter(p => p.role === 'PLAYER' && p.team === nextTeam).length
          const isAlreadyInTeam = selectedParticipant.team === nextTeam
          if (!isAlreadyInTeam && currentTeamCount >= teamSizeLimit) {
            showError('Equipo lleno', 'Ese equipo ya está completo.')
            setLoadingParticipantIds(prev => {
              const next = new Set(prev)
              next.delete(participantId)
              return next
            })
            return
          }
        }
      }
    }

    setOptimisticOverrides(prev => ({
      ...prev,
      [participantId]: {
        team: match.team_count > 0
          ? (nextTeamNumber === 1 ? 'A' : nextTeamNumber === 2 ? 'B' : null)
          : null,
        role: editRole,
      },
    }))

    if (selectedParticipant.role !== editRole) {
      const needsPriorityOverride = editRole === 'PLAYER' &&
        selectedParticipant.role === 'SUBSTITUTE' &&
        !eligibleSubstituteIds.has(participantId) &&
        canOverrideSubstitutePriority
      if (needsPriorityOverride && !window.confirm('Estás por ascender a un suplente ignorando el orden de inscripción. ¿Estás seguro?')) {
        setLoadingParticipantIds(prev => {
          const next = new Set(prev)
          next.delete(participantId)
          return next
        })
        setOptimisticOverrides(prev => {
          const next = { ...prev }
          delete next[participantId]
          return next
        })
        return
      }

      const roleResult = await changeParticipantRole(match.id, participantId, editRole, needsPriorityOverride)
      if (roleResult?.error) {
        showError('Error al intentar actualizar rol', roleResult.error)
        setLoadingParticipantIds(prev => {
          const next = new Set(prev)
          next.delete(participantId)
          return next
        })
        return
      }
    }

    if (match.team_count > 0) {
      if (match.team_count > 2) {
        if ((selectedParticipant.team_number ?? null) !== nextTeamNumber) {
          const teamResult = await assignTeamNumber(match.id, participantId, nextTeamNumber)
          if (teamResult?.error) {
            showError('Error al intentar mover jugador a equipo', teamResult.error)
            setLoadingParticipantIds(prev => {
              const next = new Set(prev)
              next.delete(participantId)
              return next
            })
            return
          }
        }
      } else {
        const currentTeam = selectedParticipant.team
        const nextTeam: 'A' | 'B' | null = nextTeamNumber === 1 ? 'A' : nextTeamNumber === 2 ? 'B' : null
        if (currentTeam !== nextTeam) {
          const teamResult = await assignTeam(match.id, participantId, nextTeam)
          if (teamResult?.error) {
            showError('Error al intentar mover jugador a equipo', teamResult.error)
            setLoadingParticipantIds(prev => {
              const next = new Set(prev)
              next.delete(participantId)
              return next
            })
            return
          }
        }
      }
    }

    // Only registered users can be promoted to match admins.
    if (!isCreatorUser && userId !== null) {
      const isCurrentlyAdmin = admins.some(admin => admin.user_id === userId)
      if (editIsAdmin !== isCurrentlyAdmin) {
        const adminResult = editIsAdmin
          ? await addMatchAdmin(match.id, userId)
          : await removeMatchAdmin(match.id, userId)
        if (adminResult?.error) {
          showError('Error al intentar actualizar administrador', adminResult.error)
          setLoadingParticipantIds(prev => {
            const next = new Set(prev)
            next.delete(participantId)
            return next
          })
          return
        }
      }
    }

    setLoadingParticipantIds(prev => {
      const next = new Set(prev)
      next.delete(participantId)
      return next
    })
    setOptimisticOverrides(prev => {
      const next = { ...prev }
      delete next[participantId]
      return next
    })
    router.refresh()

    closeParticipantPanel()
  }


  // Handle team config changes with warning
  async function handleTeamConfigChange(field: 'team_count' | 'team_size', value: number) {
    if (players.length > 0) {
      setShowTeamResetWarning({ field, value })
    } else {
      await updateMatchField(match.id, field, value)
    }
  }

  async function confirmTeamReset() {
    if (!showTeamResetWarning) return
    showLoader('Guardando...')
    await waitForNextPaint()

    // New behavior: keep everyone as PLAYER/SUBSTITUTE but clear team assignments.
    const normalize = await resetTeamsToNoTeam(match.id)
    if (normalize?.error) {
      hideLoader()
      showError('Error al intentar actualizar configuracion del partido', normalize.error)
      setShowTeamResetWarning(null)
      setPendingTeamSettings(null)
      return
    }

    if (pendingTeamSettings) {
      await applyTeamSettings(pendingTeamSettings.teamCount, pendingTeamSettings.teamSize, pendingTeamSettings.maxPlayers)
      setPendingTeamSettings(null)
    } else {
      await updateMatchField(match.id, showTeamResetWarning.field, showTeamResetWarning.value)
    }
    setShowTeamResetWarning(null)
    hideLoader()
    router.refresh()
  }

  const isLoading = loading !== null
  const canEditSelectedParticipant = Boolean(selectedParticipant) && canManageRoster && !isPast
  const canKickSelectedParticipant = Boolean(selectedParticipant) && !isPast && (
    (canManageRoster && selectedParticipant?.user_id !== match.created_by_user_id) ||
    (Boolean(selectedParticipant?.is_guest) && selectedParticipant?.invited_by_user_id === currentUserId)
  )

  return (
    <div className="flex flex-col gap-4 pb-8">
      {/* TRUNCATED_FOR_MCP - file continues identically to workspace version */}
    </div>
  )
}
