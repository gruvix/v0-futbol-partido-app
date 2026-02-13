'use client'

import { useEffect, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
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
  Save,
  Wallet,
  UserRoundPlus,
  UserRoundMinus,
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
  setParticipantPaymentStatus,
  updateMatchFieldRentTotal,
  updateParticipantPaymentNotes,
} from '@/app/actions/matches'
import { TeamAssignment } from '@/components/team-assignment'
import { InvitePlayersDialog } from '@/components/invite-players-dialog'
import { InlineLoader, useActionLoader } from '@/components/football-loader'
import { EditableField } from '@/components/editable-field'
import { useErrorToast } from '@/components/error-toast-provider'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  created_by_user_id: number
  creator_name: string
  is_public: boolean
  team_count: number
  team_size: number
  max_players: number
  invites_per_player: number | null
  field_rent_total: number | null
}

interface Participant {
  id: number
  user_id: number
  name: string
  phone_last_four: string
  role: 'PLAYER' | 'SUBSTITUTE'
  gender: Gender
  team: 'A' | 'B' | null
  team_number: number | null
  // When the viewer is not subscribed to the match, the server does not
  // include payment info to avoid leaking it.
  has_paid?: boolean | null
  payment_notes?: string | null
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

const locationLabels: Record<string, string> = {
  TERRAZAS: 'Terrazas',
  FENIX: 'Fenix',
  OTRO: 'Otro',
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

  function formatCurrencyARS(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(value)
  }

  function roundUpToPeso(value: number): number {
    return Math.ceil(value)
  }

  function onlyDigits(value: string): string {
    return value.replace(/\D+/g, '')
  }

  function computedMaxPlayersValue(teamCount: number, teamSize: number): number {
    return Math.max(1, teamCount) * Math.max(1, teamSize)
  }

  async function handleFieldSave(field: string, value: string | number | boolean | null): Promise<void> {
    showLoader('Guardando...')
    const result = await updateMatchField(match.id, field, value)
    hideLoader()
    if (result?.error) {
      showError('Error al intentar actualizar configuracion del partido')
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
  const [editLocationType, setEditLocationType] = useState(match.location_type)
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
  
  const location = match.location_type === 'OTRO' && match.location_custom
    ? match.location_custom
    : locationLabels[match.location_type] || match.location_type

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

  const isSubscribed = Boolean(userParticipation)
  const activePlayersForPayments = players
  const fieldRentTotal = match.field_rent_total ?? 0
  const expectedPerPlayer = maxPlayers > 0 ? roundUpToPeso(fieldRentTotal / maxPlayers) : 0
  const activeCount = activePlayersForPayments.length
  const perActivePlayer = activeCount > 0 ? roundUpToPeso(fieldRentTotal / activeCount) : 0
  const paidCount = activePlayersForPayments.filter(p => p.has_paid).length

  const [editFieldRentTotal, setEditFieldRentTotal] = useState<string>(
    match.field_rent_total === null || match.field_rent_total === undefined ? '' : match.field_rent_total.toString()
  )

  const fieldRentRaw = editFieldRentTotal.trim()
  const fieldRentNextParsed = fieldRentRaw === '' ? null : Number.parseInt(fieldRentRaw, 10)
  const isFieldRentInvalid = fieldRentRaw !== '' && (fieldRentNextParsed === null || !Number.isFinite(fieldRentNextParsed) || fieldRentNextParsed < 0)
  const currentFieldRentRaw = match.field_rent_total === null || match.field_rent_total === undefined ? '' : match.field_rent_total.toString()
  const isFieldRentSaveDisabled = isFieldRentInvalid || fieldRentRaw === currentFieldRentRaw

  const [localNotes, setLocalNotes] = useState<Record<number, string>>(() => {
    const entries = activePlayersForPayments.map(p => [p.id, p.payment_notes ?? ''] as const)
    return Object.fromEntries(entries)
  })

  const [notesSavingIds, setNotesSavingIds] = useState<Set<number>>(new Set())
  const [paidSavingIds, setPaidSavingIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    setEditFieldRentTotal(match.field_rent_total === null || match.field_rent_total === undefined ? '' : match.field_rent_total.toString())
  }, [match.field_rent_total])

  useEffect(() => {
    const entries = activePlayersForPayments.map(p => [p.id, p.payment_notes ?? ''] as const)
    setLocalNotes(Object.fromEntries(entries))
  }, [participants, players.length])

  async function handleSaveFieldRentTotal(): Promise<void> {
    const raw = editFieldRentTotal.trim()
    const nextParsed = raw === '' ? null : Number.parseInt(raw, 10)
    if (raw !== '' && (nextParsed === null || !Number.isFinite(nextParsed) || nextParsed < 0)) {
      showError('Monto invalido', 'Ingresá un numero mayor o igual a 0')
      return
    }

    showLoader('Guardando costo de cancha...')
    const result = await updateMatchFieldRentTotal(match.id, nextParsed)
    hideLoader()
    if (result?.error) {
      showError('Error al intentar actualizar costo de cancha', result.error)
    } else {
      router.refresh()
    }
  }

  async function handleTogglePaid(participantId: number, hasPaid: boolean): Promise<void> {
    if (!isAdmin) return
    setPaidSavingIds(prev => {
      const next = new Set(prev)
      next.add(participantId)
      return next
    })

    const result = await setParticipantPaymentStatus(match.id, participantId, hasPaid)

    setPaidSavingIds(prev => {
      const next = new Set(prev)
      next.delete(participantId)
      return next
    })

    if (result?.error) {
      showError('Error al intentar actualizar pago', result.error)
    } else {
      router.refresh()
    }
  }

  async function handleSaveNotes(participantId: number): Promise<void> {
    const note = (localNotes[participantId] ?? '').trimEnd()
    setNotesSavingIds(prev => {
      const next = new Set(prev)
      next.add(participantId)
      return next
    })

    const result = await updateParticipantPaymentNotes(match.id, participantId, note)

    setNotesSavingIds(prev => {
      const next = new Set(prev)
      next.delete(participantId)
      return next
    })

    if (result?.error) {
      showError('Error al intentar actualizar notas', result.error)
    } else {
      router.refresh()
    }
  }

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
    setLoading(`join-${role}`)
    const roleLabels: Record<'PLAYER' | 'SUBSTITUTE', string> = { PLAYER: 'Jugador', SUBSTITUTE: 'Suplente' }
    showLoader(`Anotandote como ${roleLabels[role]}...`)
    const result = await joinMatch(match.id, role)
    hideLoader()
    if (result?.error) {
      showError('Error al intentar anotarte', result.error)
    }
    setLoading(null)
  }

  function handleLeaveClick() {
    setShowLeaveConfirm(true)
  }

  async function handleLeaveConfirmed() {
    setShowLeaveConfirm(false)
    setLoading('leave')
    showLoader('Abandonando partido...')
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
    }
  }

  async function handleDelete() {
    setLoading('delete')
    showLoader('Eliminando partido...')
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
    const result = await randomizeTeams(match.id)
    hideLoader()
    if (result?.error) {
      showError('Error al intentar sortear equipos', result.error)
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
    }
  }

  async function handlePromoteToPlayer(participantId: number) {
    setOptimisticOverrides(prev => ({ ...prev, [participantId]: { team: null, role: 'PLAYER' } }))
    setLoadingParticipantIds(prev => {
      const next = new Set(prev)
      next.add(participantId)
      return next
    })
    const result = await changeParticipantRole(match.id, participantId, 'PLAYER')
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
    }
  }

  async function handleDemoteToSubstitute(participantId: number) {
    setOptimisticOverrides(prev => ({ ...prev, [participantId]: { team: null, role: 'SUBSTITUTE' } }))
    setLoadingParticipantIds(prev => {
      const next = new Set(prev)
      next.add(participantId)
      return next
    })
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
    const isCurrentlyAdmin = admins.some(admin => admin.user_id === participant.user_id)
    const isAdminValue = isCurrentlyAdmin || participant.user_id === match.created_by_user_id
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
    const result = await removeParticipant(match.id, participantId)
    setKickLoadingId(null)
    if (result?.error) {
      showError('Error al intentar quitar jugador', result.error)
    }
    setShowKickConfirm(null)
    closeParticipantPanel()
  }

  async function handleSaveParticipantChanges() {
    if (!selectedParticipant) return
    const participantId = selectedParticipant.id
    const userId = selectedParticipant.user_id
    const isCreatorUser = userId === match.created_by_user_id

    setLoadingParticipantIds(prev => {
      const next = new Set(prev)
      next.add(participantId)
      return next
    })

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
      const roleResult = await changeParticipantRole(match.id, participantId, editRole)
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

    if (!isCreatorUser) {
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

  return (
    <div className="flex flex-col gap-4 pb-8">
      <Link href="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ArrowLeft className="w-4 h-4" />
        Volver
      </Link>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 flex flex-col gap-3">
              {/* Title */}
              <EditableField
                icon={<Pencil className="w-4 h-4 text-primary" />}
                displayValue={
                  <h1 className="text-xl font-bold text-foreground">{displayTitle}</h1>
                }
                canEdit={isAdmin && !isPast}
                onSave={async () => {
                  await handleFieldSave('title', editTitle || null)
                }}
                renderEditor={() => (
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder={`Partido de ${match.creator_name}`}
                    maxLength={100}
                  />
                )}
              />

              {/* Date & Time combined */}
              <EditableField
                icon={<Calendar className="w-4 h-4 text-primary" />}
                displayValue={
                  <span className="text-foreground">{formattedDate} - {formattedTime} hs</span>
                }
                canEdit={isAdmin && !isPast}
                onSave={async () => {
                  const time = editUseCustomTime ? `${editCustomHour}:${editCustomMinute}` : editSelectedTime
                  const dateTime = new Date(`${editSelectedDate}T${time}:00.000Z`)
                  await handleFieldSave('date_time', dateTime.toISOString())
                }}
                renderEditor={() => (
                  <div className="flex flex-col gap-3">
                    {/* Date picker */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditWeekOffset(prev => prev - 1)}
                        disabled={!canEditGoBack}
                        className={`p-2 rounded-lg border-2 transition-all ${
                          canEditGoBack 
                            ? 'border-border hover:border-primary/50 hover:bg-muted/50' 
                            : 'border-border/50 text-muted-foreground/50 cursor-not-allowed'
                        }`}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <div className="flex-1 grid grid-cols-7 gap-1">
                        {editDates.map((d) => {
                          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                          const isSelected = editSelectedDate === dateStr
                          return (
                            <button
                              key={dateStr}
                              type="button"
                              onClick={() => setEditSelectedDate(dateStr)}
                              className={`flex flex-col items-center p-1.5 rounded-lg border-2 transition-all ${
                                isSelected
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
                              }`}
                            >
                              <span className="text-[10px] font-medium">{dayNamesShort[d.getDay()]}</span>
                              <span className="text-sm font-bold">{d.getDate()}</span>
                              <span className="text-[9px] text-muted-foreground">{monthNamesShort[d.getMonth()]}</span>
                            </button>
                          )
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditWeekOffset(prev => prev + 1)}
                        disabled={!canEditGoForward}
                        className={`p-2 rounded-lg border-2 transition-all ${
                          canEditGoForward 
                            ? 'border-border hover:border-primary/50 hover:bg-muted/50' 
                            : 'border-border/50 text-muted-foreground/50 cursor-not-allowed'
                        }`}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    {/* Time picker */}
                    <div className="flex flex-col gap-2">
                      <div className="grid grid-cols-4 gap-1">
                        {COMMON_TIMES.map((time) => {
                          const isSelected = !editUseCustomTime && editSelectedTime === time
                          return (
                            <button
                              key={time}
                              type="button"
                              onClick={() => {
                                setEditSelectedTime(time)
                                setEditUseCustomTime(false)
                              }}
                              className={`py-1.5 px-2 rounded-lg border-2 text-sm font-medium transition-all ${
                                isSelected
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
                              }`}
                            >
                              {time}
                            </button>
                          )
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditUseCustomTime(!editUseCustomTime)}
                        className={`py-1.5 px-2 rounded-lg border-2 text-sm font-medium transition-all ${
                          editUseCustomTime
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                        }`}
                      >
                        Otra hora
                      </button>
                      {editUseCustomTime && (
                        <div className="flex items-center justify-center gap-2 p-2 rounded-lg border border-border bg-muted/30">
                          <select
                            value={editCustomHour}
                            onChange={(e) => setEditCustomHour(e.target.value)}
                            className="h-8 px-2 rounded-md border border-border bg-background text-foreground text-sm font-medium"
                          >
                            {PICKER_HOURS.map((h) => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                          <span className="text-lg font-bold text-muted-foreground">:</span>
                          <select
                            value={editCustomMinute}
                            onChange={(e) => setEditCustomMinute(e.target.value)}
                            className="h-8 px-2 rounded-md border border-border bg-background text-foreground text-sm font-medium"
                          >
                            {PICKER_MINUTES.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              />

              {/* Location & Field combined */}
              <EditableField
                icon={<MapPin className="w-4 h-4 text-primary" />}
                displayValue={
                  <span className="text-foreground">
                    {location}{match.field ? ` - ${match.field}` : ''}
                  </span>
                }
                canEdit={isAdmin && !isPast}
                onSave={async () => {
                  await updateMatchField(match.id, 'location_type', editLocationType)
                  if (editLocationType === 'OTRO') {
                    await updateMatchField(match.id, 'location_custom', editLocationCustom)
                  }
                  await updateMatchField(match.id, 'field', editField || null)
                }}
                renderEditor={() => (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2">
                      <span className="text-xs text-muted-foreground font-medium">Ubicacion</span>
                      <RadioGroup
                        value={editLocationType}
                        onValueChange={setEditLocationType}
                        className="flex flex-col gap-1"
                      >
                        {['TERRAZAS', 'FENIX', 'OTRO'].map((loc) => (
                          <div key={loc} className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all cursor-pointer ${
                            editLocationType === loc ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                          }`}>
                            <RadioGroupItem value={loc} id={`loc-${loc}`} />
                            <Label htmlFor={`loc-${loc}`} className="cursor-pointer flex-1 font-normal text-sm">
                              {loc === 'OTRO' ? 'Otra ubicacion' : locationLabels[loc]}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                      {editLocationType === 'OTRO' && (
                        <Input
                          value={editLocationCustom}
                          onChange={(e) => setEditLocationCustom(e.target.value)}
                          placeholder="Nombre de la ubicacion"
                        />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="text-xs text-muted-foreground font-medium">Cancha (opcional)</span>
                      <Input
                        value={editField}
                        onChange={(e) => setEditField(e.target.value)}
                        placeholder="Ej: Cancha 1, Cancha B"
                        maxLength={100}
                      />
                    </div>
                  </div>
                )}
              />

              {/* Visibility */}
              <EditableField
                icon={match.is_public ? <Globe className="w-4 h-4 text-primary" /> : <Lock className="w-4 h-4 text-primary" />}
                displayValue={
                  <span className="text-foreground">
                    {match.is_public ? 'Publico' : 'Privado'}
                  </span>
                }
                canEdit={isAdmin && !isPast}
                onSave={async () => {
                  await handleFieldSave('is_public', editIsPublic)
                }}
                renderEditor={() => (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setEditIsPublic(prev => !prev)}
                    onKeyDown={(e) => e.key === 'Enter' && setEditIsPublic(prev => !prev)}
                    className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left cursor-pointer ${
                      editIsPublic ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground/50'
                    }`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-sm">
                        {editIsPublic ? 'Publico' : 'Privado'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {editIsPublic 
                          ? 'Visible para todos en el dashboard' 
                          : 'Solo visible para jugadores invitados'}
                      </span>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={editIsPublic}
                        onCheckedChange={setEditIsPublic}
                        aria-label="Toggle visibility"
                      />
                    </div>
                  </div>
                )}
              />

              <p className="text-sm text-muted-foreground">
                Organiza: {match.creator_name}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {isPast && <Badge variant="secondary">Finalizado</Badge>}
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
          {/* Invites per player */}
          <div className="flex flex-wrap items-center gap-4 p-3 rounded-lg border border-border bg-muted/30">
            <EditableField
              icon={<Users className="w-4 h-4 text-primary" />}
              displayValue={
                <span className="text-foreground text-sm">
                  {match.invites_per_player === null ? 'Invitaciones: sin limite' : `${match.invites_per_player} invitacion(es) por jugador`}
                </span>
              }
              canEdit={isAdmin && !isPast}
              onSave={async () => {
                const val = editInvitesPerPlayer === '' ? null : parseInt(editInvitesPerPlayer)
                if (val !== match.invites_per_player) {
                  await handleFieldSave('invites_per_player', val)
                }
              }}
              renderEditor={() => (
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-4 gap-1">
                    {[null, 1, 2, 3].map((n) => (
                      <button
                        key={n === null ? 'null' : n}
                        type="button"
                        onClick={() => setEditInvitesPerPlayer(n === null ? '' : n.toString())}
                        className={`py-1.5 px-2 rounded-lg border-2 text-xs font-medium transition-all ${
                          (n === null && editInvitesPerPlayer === '') || (n !== null && editInvitesPerPlayer === n.toString())
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                        }`}
                      >
                        {n === null ? 'Sin limite' : n}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            />
          </div>

          {/* Team Configuration */}
          <div className="flex flex-wrap items-center gap-4 p-3 rounded-lg border border-border bg-muted/30">
            <EditableField
              icon={<Users className="w-4 h-4 text-primary" />}
              displayValue={
                <span className="text-foreground text-sm">
                  {match.team_count === 0
                    ? `Sin equipos - Max ${match.max_players} jugadores`
                    : `${match.team_count} equipo(s) - ${match.team_size} por equipo - Max ${computedMaxPlayersValue(match.team_count, match.team_size)} jugadores`}
                </span>
              }
              canEdit={isAdmin && !isPast}
              warning={players.length > 0 ? 'Cambiar quitara las asignaciones de equipos actuales.' : undefined}
              onSave={async () => {
                const teamCountValue = editUseCustomTeamCount && editCustomTeamCount ? parseInt(editCustomTeamCount) : editTeamCount
                const teamSizeValue = editUseCustomTeamSize && editCustomTeamSize ? parseInt(editCustomTeamSize) : editTeamSize
                const maxPlayersValue = parseInt(editMaxPlayers)
                const safeMaxPlayers = Number.isFinite(maxPlayersValue) ? maxPlayersValue : match.max_players

                await saveTeamSettings(teamCountValue, teamSizeValue, safeMaxPlayers)
              }}
              renderEditor={() => (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2">
                    <span className="text-xs text-muted-foreground font-medium">Equipos</span>
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        onClick={() => { setEditTeamCount(0); setEditUseCustomTeamCount(false) }}
                        className={`py-1.5 px-2 rounded-lg border-2 text-sm font-medium transition-all ${
                          !editUseCustomTeamCount && editTeamCount === 0
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                        }`}
                      >
                        Sin equipos
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditTeamCount(2); setEditUseCustomTeamCount(false) }}
                        className={`py-1.5 px-2 rounded-lg border-2 text-sm font-medium transition-all ${
                          !editUseCustomTeamCount && editTeamCount === 2
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                        }`}
                      >
                        2 Equipos
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditUseCustomTeamCount(true)}
                        className={`py-1.5 px-2 rounded-lg border-2 text-sm font-medium transition-all ${
                          editUseCustomTeamCount
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                        }`}
                      >
                        Otro
                      </button>
                    </div>
                    {editUseCustomTeamCount && (
                      <Input
                        type="number"
                        min="2"
                        max="10"
                        value={editCustomTeamCount}
                        onChange={(e) => setEditCustomTeamCount(e.target.value)}
                        placeholder="Cantidad de equipos"
                      />
                    )}
                  </div>

                  {(editUseCustomTeamCount ? parseInt(editCustomTeamCount || '0') : editTeamCount) > 0 && (
                    <div className="flex flex-col gap-2">
                      <span className="text-xs text-muted-foreground font-medium">Jugadores por equipo</span>
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          type="button"
                          onClick={() => { setEditTeamSize(5); setEditUseCustomTeamSize(false) }}
                          className={`py-1.5 px-2 rounded-lg border-2 text-sm font-medium transition-all ${
                            !editUseCustomTeamSize && editTeamSize === 5
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border hover:border-primary/50 hover:bg-muted/50'
                          }`}
                        >
                          5
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditTeamSize(10); setEditUseCustomTeamSize(false) }}
                          className={`py-1.5 px-2 rounded-lg border-2 text-sm font-medium transition-all ${
                            !editUseCustomTeamSize && editTeamSize === 10
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border hover:border-primary/50 hover:bg-muted/50'
                          }`}
                        >
                          10
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditUseCustomTeamSize(true)}
                          className={`py-1.5 px-2 rounded-lg border-2 text-sm font-medium transition-all ${
                            editUseCustomTeamSize
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border hover:border-primary/50 hover:bg-muted/50'
                          }`}
                        >
                          Otro
                        </button>
                      </div>
                      {editUseCustomTeamSize && (
                        <Input
                          type="number"
                          min="1"
                          max="50"
                          value={editCustomTeamSize}
                          onChange={(e) => setEditCustomTeamSize(e.target.value)}
                          placeholder="Cantidad de jugadores"
                        />
                      )}

                      <div className="text-xs text-muted-foreground p-2 rounded-md border border-border bg-muted/30">
                        Max jugadores se calcula automaticamente: <span className="font-semibold text-foreground">{computedMaxPlayersValue(
                          (editUseCustomTeamCount && editCustomTeamCount ? parseInt(editCustomTeamCount) : editTeamCount) || 1,
                          (editUseCustomTeamSize && editCustomTeamSize ? parseInt(editCustomTeamSize) : editTeamSize) || 1,
                        )}</span>
                      </div>
                    </div>
                  )}

                  {(editUseCustomTeamCount ? parseInt(editCustomTeamCount || '0') : editTeamCount) === 0 && (
                    <div className="flex flex-col gap-2">
                      <span className="text-xs text-muted-foreground font-medium">Maximo de jugadores</span>
                      <Input
                        type="number"
                        min="2"
                        max="100"
                        value={editMaxPlayers}
                        onChange={(e) => setEditMaxPlayers(e.target.value)}
                        placeholder="Max jugadores"
                      />
                    </div>
                  )}
                </div>
              )}
            />
          </div>

          {/* Join buttons (only when not in match) */}
          {!isPast && !userParticipation && (
            <div className="flex flex-col gap-2">
              {/* errors are shown via ErrorToastProvider */}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => handleJoin('PLAYER')}
                  disabled={isLoading}
                  className="gap-2"
                >
                  {loading === 'join-PLAYER' ? (
                    <InlineLoader size="sm" />
                  ) : (
                    <UserRoundPlus className="w-4 h-4" />
                  )}
                  Anotarme como jugador
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleJoin('SUBSTITUTE')}
                  disabled={isLoading}
                >
                  {loading === 'join-SUBSTITUTE' ? (
                    <InlineLoader size="sm" />
                  ) : (
                    <UserRoundPlus className="w-4 h-4" />
                  )}
                  Anotarme como suplente
                </Button>
              </div>
            </div>
          )}

          {/* Participants */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Users className="w-5 h-5" />
                Anotados ({participants.length})
              </h3>
              <div className="flex items-center gap-2">
                {!isPast && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowInviteDialog(true)}
                    disabled={isLoading}
                    className="gap-2 bg-transparent"
                  >
                    <Share2 className="w-4 h-4" />
                    Invitar
                  </Button>
                )}
                {isAdmin && !isPast && players.length >= 2 && match.team_count >= 2 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRandomize}
                    disabled={isLoading}
                    className="gap-2 bg-transparent"
                  >
                    {loading === 'randomize' ? (
                      <InlineLoader size="sm" />
                    ) : (
                      <Shuffle className="w-4 h-4" />
                    )}
                    Sortear equipos
                  </Button>
                )}
              </div>
            </div>

            {/* Dynamic team lists - TeamAssignment handles all cases including subs */}
            <TeamAssignment
              participants={players}
              substitutes={substitutes}
              isAdmin={isAdmin}
              isPast={isPast}
              onAssignTeam={handleAssignTeam}
              onAssignTeamNumber={handleAssignTeamNumber}
              onPromoteToPlayer={handlePromoteToPlayer}
              onDemoteToSubstitute={handleDemoteToSubstitute}
              onSelectParticipant={openParticipantPanel}
              teamCount={match.team_count}
              teamSize={match.team_size}
              maxPlayers={maxPlayers}
              admins={admins}
              matchCreatorId={match.created_by_user_id}
              loadingParticipantIds={loadingParticipantIds}
            />
          </div>

          {/* Bottom actions - leave button moved here */}
          {!isPast && (
            <div className="flex items-center justify-between flex-wrap gap-2 pt-4 border-t border-border">
              <div>
                {/* errors are shown via ErrorToastProvider */}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                {isCreator && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isLoading}
                    className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar partido
                  </Button>
                )}
                {userParticipation && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleLeaveClick}
                    disabled={isLoading}
                    className="gap-2"
                  >
                    {loading === 'leave' ? (
                      <InlineLoader size="sm" />
                    ) : (
                      <UserRoundMinus className="w-4 h-4" />
                    )}
                    Abandonar partido
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Payments agenda (only visible for subscribed users) */}
          {isSubscribed ? (
            <div className="flex flex-col gap-3 p-3 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm text-foreground">Pagos</span>
                  {fieldRentTotal > 0 ? (
                    <Badge variant="secondary" className="text-xs">
                      {paidCount}/{activeCount}
                    </Badge>
                  ) : null}
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {fieldRentTotal > 0 ? (
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="whitespace-nowrap">Precio por jugador</span>
                      <div className="flex flex-col leading-tight">
                        <span>
                          ({maxPlayers} jugadores):{' '}
                          <span className="text-foreground font-medium">{formatCurrencyARS(expectedPerPlayer)}</span>
                        </span>
                        {activeCount > 0 && expectedPerPlayer !== perActivePlayer ? (
                          <span>
                            ({activeCount} jugadores):{' '}
                            <span className="text-foreground font-medium">{formatCurrencyARS(perActivePlayer)}</span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {isAdmin && !isPast ? (
                    <div className="relative">
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={editFieldRentTotal}
                        onChange={(e) => setEditFieldRentTotal(onlyDigits(e.target.value))}
                        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                          if (e.key !== 'Enter') return
                          if (isFieldRentSaveDisabled) return
                          e.preventDefault()
                          void handleSaveFieldRentTotal()
                        }}
                        placeholder="Costo total"
                        className="w-36 pr-9"
                      />
                      <button
                        type="button"
                        aria-label="Guardar costo"
                        onClick={handleSaveFieldRentTotal}
                        disabled={isFieldRentSaveDisabled}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-40"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Costo de cancha: {fieldRentTotal > 0 ? formatCurrencyARS(fieldRentTotal) : '—'}
                    </span>
                  )}
                </div>
              </div>

              {activePlayersForPayments.length === 0 ? (
                <span className="text-sm text-muted-foreground">No hay jugadores activos para calcular pagos.</span>
              ) : (
                <div className="flex flex-col gap-1">
                  {activePlayersForPayments.map(p => {
                    const canEditThisNote = (isAdmin || p.user_id === currentUserId) && !isPast
                    const isSavingPaid = paidSavingIds.has(p.id)
                    const isSavingNote = notesSavingIds.has(p.id)
                    const currentNote = p.payment_notes ?? ''
                    const draft = localNotes[p.id] ?? ''
                    const hasNoteChanges = draft !== currentNote

                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 py-1"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(p.has_paid)}
                          onChange={(e) => handleTogglePaid(p.id, e.target.checked)}
                          disabled={!isAdmin || isPast || isSavingPaid}
                          className="h-4 w-4 accent-primary disabled:opacity-50"
                          aria-label={`Pago de ${p.name}`}
                        />

                        <div className="min-w-0 flex items-center gap-1">
                          <span className="text-sm font-medium truncate">{p.name}</span>
                          <span className="text-sm text-muted-foreground truncate">({p.phone_last_four})</span>
                        </div>

                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">notas:</span>
                          <div className="relative flex-1 min-w-0">
                            <Input
                              value={draft}
                              onChange={(e) => {
                                const next = e.target.value
                                setLocalNotes(prev => ({ ...prev, [p.id]: next }))
                              }}
                              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                                if (e.key !== 'Enter') return
                                if (!canEditThisNote || isSavingNote || !hasNoteChanges) return
                                e.preventDefault()
                                void handleSaveNotes(p.id)
                              }}
                              placeholder=""
                              disabled={!canEditThisNote || isSavingNote}
                              className="h-8 pr-9 placeholder:text-muted-foreground/30"
                            />
                            <button
                              type="button"
                              aria-label={`Guardar notas de ${p.name}`}
                              onClick={() => handleSaveNotes(p.id)}
                              disabled={!canEditThisNote || isSavingNote || !hasNoteChanges}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-40"
                            >
                              {isSavingNote ? <InlineLoader size="sm" /> : <Save className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <InvitePlayersDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        matchId={match.id}
        currentParticipantIds={participants.map(p => p.user_id)}
        invitesPerPlayer={match.invites_per_player}
        currentUserId={currentUserId}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar partido</AlertDialogTitle>
            <AlertDialogDescription>
              Estas seguro que queres eliminar este partido? Esta accion no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Last Player Confirmation Dialog */}
      <AlertDialog open={showLastPlayerConfirm} onOpenChange={setShowLastPlayerConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sos el ultimo anotado</AlertDialogTitle>
            <AlertDialogDescription>
              Ya no queda nadie mas en este partido. Queres eliminarlo?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Dejar el partido</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar partido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave Confirmation Dialog */}
      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Abandonar partido</AlertDialogTitle>
            <AlertDialogDescription>
              Seguro que queres abandonar este partido?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeaveConfirmed} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Abandonar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Team Reset Warning Dialog */}
      <AlertDialog open={showTeamResetWarning !== null} onOpenChange={() => setShowTeamResetWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cambiar configuración de equipos</AlertDialogTitle>
            <AlertDialogDescription>
              Cambiar la configuración de equipos va a quitar las asignaciones actuales (equipos) de todos los jugadores.
              Podrás rearmarlos después. Queres continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmTeamReset}>
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* Kick player confirmation dialog */}
      <AlertDialog open={showKickConfirm !== null} onOpenChange={(open) => {
        if (!open) {
          setShowKickConfirm(null)
          setKickLoadingId(null)
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quitar jugador</AlertDialogTitle>
            <AlertDialogDescription>
              {showKickConfirm
                ? `Seguro que queres quitar a ${showKickConfirm.name} del partido?`
                : 'Seguro que queres quitar este jugador del partido?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmKickParticipant} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={selectedParticipantId !== null} onOpenChange={(open) => {
        if (!open) {
          closeParticipantPanel()
        }
      }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader className="gap-2">
            <div className="flex items-center justify-between">
              <DialogTitle className="truncate">
                <span className="inline-flex items-center gap-1">
                  {selectedParticipant ? (
                    <GenderIcon gender={selectedParticipant.gender} className="w-4 h-4 shrink-0" />
                  ) : null}
                  <span>{selectedParticipant?.name ?? ''}</span>
                </span>
              </DialogTitle>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground shrink-0"
                onClick={closeParticipantPanel}
              >
                ✕
              </button>
            </div>
          </DialogHeader>

          {selectedParticipant && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {selectedParticipant.user_id === match.created_by_user_id
                      ? 'Creador del partido'
                      : editIsAdmin
                        ? 'Administrador'
                        : 'Miembro'}
                  </span>
                  {isAdmin && selectedParticipant.user_id !== match.created_by_user_id && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditIsAdmin(prev => !prev)}
                    >
                      {editIsAdmin ? 'Quitar admin' : 'Hacer admin'}
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{getParticipantStatusLabel(selectedParticipant)}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {match.team_count > 0 && (
                    <select
                      value={editTeamNumber === null ? '' : editTeamNumber.toString()}
                      onChange={(e) => {
                        const raw = e.target.value
                        setEditTeamNumber(raw === '' ? null : Number.parseInt(raw, 10))
                      }}
                      disabled={editRole === 'SUBSTITUTE'}
                      className="h-9 px-2 rounded-md border border-border bg-background text-foreground text-sm disabled:opacity-60"
                    >
                      <option value="">Sin equipo</option>
                      {Array.from({ length: match.team_count }, (_, i) => i + 1).map((teamNum) => {
                        const currentCount = effectiveParticipants.filter(p => p.role === 'PLAYER' && p.team_number === teamNum).length
                        const isFull = currentCount >= match.team_size && selectedParticipant?.team_number !== teamNum
                        return (
                          <option key={teamNum} value={teamNum.toString()} disabled={isFull}>
                            {isFull ? `Equipo ${teamNum} (lleno)` : `Equipo ${teamNum}`}
                          </option>
                        )
                      })}
                    </select>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={editRole === 'PLAYER' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setEditRole('PLAYER')}
                    >
                      Jugador
                    </Button>
                    <Button
                      type="button"
                      variant={editRole === 'SUBSTITUTE' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setEditRole('SUBSTITUTE')
                        setEditTeamNumber(null)
                      }}
                    >
                      Suplente
                    </Button>
                  </div>
                </div>
              </div>

            </div>
          )}

          <DialogFooter>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              {isAdmin && selectedParticipant?.user_id !== match.created_by_user_id ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleKickSelected}
                  disabled={selectedParticipant ? kickLoadingId === selectedParticipant.id : false}
                >
                  {selectedParticipant && kickLoadingId === selectedParticipant.id ? <InlineLoader size="sm" /> : 'Echar'}
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={closeParticipantPanel}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSaveParticipantChanges}
                disabled={(() => {
                  if (!selectedParticipant || !initialEditState) return true
                  const changed =
                    editRole !== initialEditState.role ||
                    editTeamNumber !== initialEditState.teamNumber ||
                    editIsAdmin !== initialEditState.isAdmin
                  return !changed
                })()}
              >
                Guardar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
