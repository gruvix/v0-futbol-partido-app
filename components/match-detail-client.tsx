'use client'

import { useState } from 'react'
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
  UserPlus,
  UserMinus,
  Share2,
  Globe,
  Lock,
  Shield,
  ChevronLeft,
  ChevronRight,
  Pencil
} from 'lucide-react'
import {
  joinMatch,
  leaveMatch,
  deleteMatch,
  randomizeTeams,
  assignTeam,
  assignTeamNumber,
  updateMatchField,
  resetTeamsToNoTeam,
  addMatchAdmin,
  removeMatchAdmin,
  changeParticipantRole,
} from '@/app/actions/matches'
import { TeamAssignment } from '@/components/team-assignment'
import { InvitePlayersDialog } from '@/components/invite-players-dialog'
import { InlineLoader, useActionLoader } from '@/components/football-loader'
import { EditableField } from '@/components/editable-field'
import { useErrorToast } from '@/components/error-toast-provider'
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
}

interface Participant {
  id: number
  user_id: number
  name: string
  phone_last_four: string
  role: 'PLAYER' | 'SUBSTITUTE' | 'EXTRA'
  team: 'A' | 'B' | null
  team_number: number | null
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
  const [_error, setError] = useState('')
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showLastPlayerConfirm, setShowLastPlayerConfirm] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [showTeamResetWarning, setShowTeamResetWarning] = useState<{field: string, value: number} | null>(null)
  const [showAdminConfirm, setShowAdminConfirm] = useState<{userId: number, isCurrentlyAdmin: boolean} | null>(null)
  const router = useRouter()
  const { showLoader, hideLoader } = useActionLoader()
  const { showError } = useErrorToast()

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
  const extras = effectiveParticipants.filter(p => p.role === 'EXTRA')

  // Max players:
  // - when teams are enabled, it is derived (team_count * team_size)
  // - when no teams, it is chosen by creator/admin (match.max_players)
  const maxPlayers = match.team_count > 0 ? computedMaxPlayers(match.team_count, match.team_size) : match.max_players

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

  async function handleJoin(role: 'PLAYER' | 'SUBSTITUTE' | 'EXTRA') {
    setLoading(`join-${role}`)
    const roleLabels: Record<string, string> = { PLAYER: 'Jugador', SUBSTITUTE: 'Suplente', EXTRA: 'Por las dudas' }
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

  function handleToggleAdmin(userId: number, isCurrentlyAdmin: boolean) {
    setShowAdminConfirm({ userId, isCurrentlyAdmin })
  }

  async function confirmToggleAdmin() {
    if (!showAdminConfirm) return
    const { userId, isCurrentlyAdmin } = showAdminConfirm
    setShowAdminConfirm(null)
    if (isCurrentlyAdmin) {
      const result = await removeMatchAdmin(match.id, userId)
      if (result?.error) {
        showError('Error al intentar quitar administrador', result.error)
      }
    } else {
      const result = await addMatchAdmin(match.id, userId)
      if (result?.error) {
        showError('Error al intentar agregar administrador', result.error)
      }
    }
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
                    <UserPlus className="w-4 h-4" />
                  )}
                  Anotarme
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleJoin('SUBSTITUTE')}
                  disabled={isLoading}
                >
                  {loading === 'join-SUBSTITUTE' ? (
                    <InlineLoader size="sm" />
                  ) : (
                    'Como suplente'
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleJoin('EXTRA')}
                  disabled={isLoading}
                >
                  {loading === 'join-EXTRA' ? (
                    <InlineLoader size="sm" />
                  ) : (
                    'Por las dudas'
                  )}
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
              teamCount={match.team_count}
              teamSize={match.team_size}
              maxPlayers={maxPlayers}
              admins={admins}
              matchCreatorId={match.created_by_user_id}
              onToggleAdmin={handleToggleAdmin}
              loadingParticipantIds={loadingParticipantIds}
            />

            {extras.length > 0 && (
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-medium text-muted-foreground">Por las dudas ({extras.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {extras.map((p) => (
                    <Badge key={p.id} variant="outline" className="py-1.5 px-3">
                      {p.name} ({p.phone_last_four})
                    </Badge>
                  ))}
                </div>
              </div>
            )}
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
                      <UserMinus className="w-4 h-4" />
                    )}
                    Abandonar partido
                  </Button>
                )}
              </div>
            </div>
          )}
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
            <AlertDialogTitle>Cambiar configuracion de equipos</AlertDialogTitle>
            <AlertDialogDescription>
              Cambiar la configuracion de equipos va a quitar las asignaciones actuales (equipos) de todos los jugadores.
              Podras rearmarlos despues. Queres continuar?
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

      {/* Admin Toggle Confirmation Dialog */}
      <AlertDialog open={showAdminConfirm !== null} onOpenChange={() => setShowAdminConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {showAdminConfirm?.isCurrentlyAdmin ? 'Quitar administrador' : 'Hacer administrador'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {showAdminConfirm?.isCurrentlyAdmin
                ? 'Seguro que queres quitar los permisos de administrador a este jugador?'
                : 'Seguro que queres hacer administrador a este jugador? Podra modificar el partido y mover jugadores.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmToggleAdmin}>
              {showAdminConfirm?.isCurrentlyAdmin ? 'Quitar admin' : 'Hacer admin'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
