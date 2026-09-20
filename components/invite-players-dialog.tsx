'use client'

import { useEffect, useState } from 'react'
import { Check, RotateCcw, Search, UserPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { getAllUsers, getInviteCount, inviteGuest, invitePlayer, type InviteGuestInput } from '@/app/actions/matches'
import { GenderIcon, type Gender } from '@/lib/gender'
import { useErrorToast } from '@/components/error-toast-provider'
import { InlineLoader } from '@/components/football-loader'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface User {
  id: number
  name: string
  phone_last_four: string
  gender: Gender
}

type InviteQueueStatus = 'pending' | 'success' | 'error'

type InviteQueueItem =
  | {
      id: string
      kind: 'user'
      userId: number
      displayName: string
      gender: Gender
      role: 'PLAYER' | 'SUBSTITUTE'
      overridePriority: boolean
      status: InviteQueueStatus
      error?: string
    }
  | {
      id: string
      kind: 'guest'
      displayName: string
      guestPayload: InviteGuestInput
      overridePriority: boolean
      status: InviteQueueStatus
      error?: string
    }

function queueItemKey(item: InviteQueueItem): string {
  if (item.kind === 'user') return `user:${item.userId}:${item.role}`
  return `guest:${item.guestPayload.name.trim().toLowerCase()}:${item.guestPayload.role}`
}

interface InvitePlayersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  matchId: number
  currentParticipantIds: number[]
  invitesPerPlayer?: number | null
  currentUserId: number
  canInviteAsPlayer: boolean
  canOverridePlayerInvitePriority: boolean
  playerInviteDisabledReason?: string
}

export function InvitePlayersDialog({
  open,
  onOpenChange,
  matchId,
  currentParticipantIds,
  invitesPerPlayer,
  currentUserId,
  canInviteAsPlayer,
  canOverridePlayerInvitePriority,
  playerInviteDisabledReason,
}: InvitePlayersDialogProps): React.JSX.Element {
  const router = useRouter()
  const { showError } = useErrorToast()

  const [users, setUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [inviteQueue, setInviteQueue] = useState<InviteQueueItem[]>([])
  const [search, setSearch] = useState('')
  const [myInviteCount, setMyInviteCount] = useState(0)
  const [showGuestForm, setShowGuestForm] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null)

  // Guest invite form
  const [guestName, setGuestName] = useState('')
  const [guestLastFour, setGuestLastFour] = useState('')
  const [guestGender, setGuestGender] = useState<InviteGuestInput['gender']>('MALE')
  const [guestRole, setGuestRole] = useState<InviteGuestInput['role']>('PLAYER')

  const hasLimit = invitesPerPlayer !== null && invitesPerPlayer !== undefined
  const sessionActiveInvites = inviteQueue.filter(i => i.status !== 'error').length
  const remainingInvites = hasLimit ? invitesPerPlayer - (myInviteCount + sessionActiveInvites) : Infinity
  const reachedLimit = hasLimit && remainingInvites <= 0
  const isPlayerInviteDisabled = !canInviteAsPlayer && !canOverridePlayerInvitePriority
  const needsPlayerInviteOverride = !canInviteAsPlayer && canOverridePlayerInvitePriority
  const playerInviteReason = playerInviteDisabledReason || 'Los cupos de jugador estan reservados para suplentes por orden de anotacion.'
  const overrideConfirmMessage = 'Estás por anotar a un jugador ignorando el orden de inscripción de suplentes. ¿Estás seguro?'

  useEffect(() => {
    if (!open) return

    setInviteQueue([])
    setSearch('')
    setShowGuestForm(false)
    setGuestName('')
    setGuestLastFour('')
    setGuestGender('MALE')
    setGuestRole('PLAYER')
    setFeedback(null)

    async function init(): Promise<void> {
      try {
        setLoadingUsers(true)
        const result = await getAllUsers()
        if (result?.users) setUsers(result.users as User[])

        if (hasLimit) {
          const r = await getInviteCount(matchId, currentUserId)
          setMyInviteCount(r.count)
        }
      } catch (e) {
        console.error(e)
        showError('Error al cargar jugadores')
      } finally {
        setLoadingUsers(false)
      }
    }

    void init()
  }, [open, hasLimit, matchId, currentUserId, showError])

  function onlyDigits(value: string): string {
    return value.replace(/\D+/g, '')
  }

  function getErrorMessage(error: unknown, fallback: string): string {
    if (!error) return fallback
    if (typeof error === 'string') return error
    if (typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
      return (error as { message: string }).message
    }
    return fallback
  }

  function cancelGuestForm(): void {
    setShowGuestForm(false)
    setGuestName('')
    setGuestLastFour('')
    setGuestGender('MALE')
    setGuestRole('PLAYER')
    setFeedback(null)
  }

  function isUserInviteInFlight(userId: number): boolean {
    return inviteQueue.some(i => i.kind === 'user' && i.userId === userId && i.status === 'pending')
  }

  function isUserAlreadyInvited(userId: number): boolean {
    return inviteQueue.some(i => i.kind === 'user' && i.userId === userId && i.status === 'success')
  }

  function isGuestNameQueued(name: string, role: InviteGuestInput['role']): boolean {
    const key = name.trim().toLowerCase()
    return inviteQueue.some(
      i => i.kind === 'guest'
        && i.guestPayload.name.trim().toLowerCase() === key
        && i.guestPayload.role === role
        && i.status !== 'error',
    )
  }

  function patchQueueItem(id: string, patch: Partial<InviteQueueItem>): void {
    setInviteQueue(prev => prev.map(item => (item.id === id ? { ...item, ...patch } as InviteQueueItem : item)))
  }

  async function runUserInvite(item: InviteQueueItem & { kind: 'user' }): Promise<void> {
    patchQueueItem(item.id, { status: 'pending', error: undefined })
    const result = await invitePlayer(matchId, item.userId, item.role, item.overridePriority) as { error?: unknown }

    if (result?.error) {
      patchQueueItem(item.id, {
        status: 'error',
        error: getErrorMessage(result.error, 'Error al intentar invitar jugador'),
      })
      return
    }

    patchQueueItem(item.id, { status: 'success', error: undefined })
    router.refresh()

    if (hasLimit) {
      const r = await getInviteCount(matchId, currentUserId)
      setMyInviteCount(r.count)
    }
  }

  async function runGuestInvite(item: InviteQueueItem & { kind: 'guest' }): Promise<void> {
    patchQueueItem(item.id, { status: 'pending', error: undefined })
    const result = await inviteGuest(matchId, item.guestPayload, item.overridePriority) as { error?: unknown }

    if (result?.error) {
      patchQueueItem(item.id, {
        status: 'error',
        error: getErrorMessage(result.error, 'Error al intentar invitar'),
      })
      return
    }

    patchQueueItem(item.id, { status: 'success', error: undefined })
    router.refresh()

    if (hasLimit) {
      const r = await getInviteCount(matchId, currentUserId)
      setMyInviteCount(r.count)
    }
  }

  async function handleInvite(user: User, role: 'PLAYER' | 'SUBSTITUTE'): Promise<void> {
    if (role === 'PLAYER' && isPlayerInviteDisabled) {
      setFeedback({ type: 'error', message: playerInviteReason })
      return
    }
    const overridePriority = role === 'PLAYER' && needsPlayerInviteOverride
    if (overridePriority && !window.confirm(overrideConfirmMessage)) {
      return
    }
    if (isUserInviteInFlight(user.id) || isUserAlreadyInvited(user.id)) {
      return
    }

    const existing = inviteQueue.find(i => i.kind === 'user' && i.userId === user.id && i.role === role && i.status === 'error')
    const id = existing?.id ?? crypto.randomUUID()

    setFeedback(null)
    setSearch('')

    const item: InviteQueueItem = {
      id,
      kind: 'user',
      userId: user.id,
      displayName: user.name,
      gender: user.gender,
      role,
      overridePriority,
      status: 'pending',
    }

    setInviteQueue(prev => {
      const without = prev.filter(i => i.id !== id)
      return [...without, item]
    })

    void runUserInvite(item)
  }

  function retryQueueItem(item: InviteQueueItem): void {
    if (item.kind === 'user') {
      void runUserInvite(item)
    } else {
      void runGuestInvite(item)
    }
  }

  async function handleInviteGuest(): Promise<void> {
    const name = guestName.trim()
    if (!name) {
      setFeedback({ type: 'error', message: 'Ingresá un nombre para el invitado' })
      return
    }
    if (isGuestNameQueued(name, guestRole)) {
      setFeedback({ type: 'error', message: 'Ya existe un invitado con ese nombre en esta sesión' })
      return
    }
    if (guestRole === 'PLAYER' && isPlayerInviteDisabled) {
      setFeedback({ type: 'error', message: playerInviteReason })
      return
    }
    const overridePriority = guestRole === 'PLAYER' && needsPlayerInviteOverride
    if (overridePriority && !window.confirm(overrideConfirmMessage)) {
      return
    }

    const guestPayload: InviteGuestInput = {
      name,
      phoneLastFour: guestLastFour.trim() || undefined,
      gender: guestGender,
      role: guestRole,
    }

    const existingKey = queueItemKey({
      id: '',
      kind: 'guest',
      displayName: name,
      guestPayload,
      overridePriority,
      status: 'error',
    })
    const existing = inviteQueue.find(i => queueItemKey(i) === existingKey && i.status === 'error')
    const id = existing?.id ?? crypto.randomUUID()

    setFeedback(null)
    setSearch('')

    const item: InviteQueueItem = {
      id,
      kind: 'guest',
      displayName: name,
      guestPayload,
      overridePriority,
      status: 'pending',
    }

    setInviteQueue(prev => {
      const without = prev.filter(i => i.id !== id)
      return [...without, item]
    })

    setGuestName('')
    setGuestLastFour('')
    setGuestGender('MALE')
    setGuestRole('PLAYER')
    setShowGuestForm(false)

    void runGuestInvite(item)
  }

  const queuedUserIds = new Set(
    inviteQueue.flatMap(i => (i.kind === 'user' && i.status !== 'error' ? [i.userId] : [])),
  )

  const availableUsers = users.filter(u => !currentParticipantIds.includes(u.id) && !queuedUserIds.has(u.id))

  const filteredUsers = availableUsers.filter(
    u => u.name.toLowerCase().includes(search.toLowerCase()) || u.phone_last_four.includes(search)
  )

  const handleStartGuestInvite = () => {
    setGuestName(search)
    setShowGuestForm(true)
    setFeedback(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Invitar jugadores</DialogTitle>
          <DialogDescription>
            {hasLimit
              ? `Podes invitar ${remainingInvites > 0 ? remainingInvites : 0} jugador(es) mas (limite: ${invitesPerPlayer} por persona)`
              : 'Agrega jugadores al partido'}
          </DialogDescription>
        </DialogHeader>

        {feedback ? (
          <div
            className={`rounded-lg border p-3 text-sm ${
              feedback.type === 'error'
                ? 'border-destructive/60 bg-destructive/10 text-destructive'
                : 'border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {feedback.message}
          </div>
        ) : null}

        {!canInviteAsPlayer ? (
          <div className={`rounded-lg border p-3 text-sm ${
            canOverridePlayerInvitePriority
              ? 'border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-300'
              : 'border-destructive/60 bg-destructive/10 text-destructive'
          }`}>
            {canOverridePlayerInvitePriority
              ? `${playerInviteReason} Como administrador podés ignorar el orden, pero se pedirá confirmación.`
              : playerInviteReason}
          </div>
        ) : null}

        {!showGuestForm ? (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o numero..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setFeedback(null)
              }}
              className="pl-10"
            />
          </div>
        ) : null}

        {!showGuestForm ? (
          <div className="flex-1 overflow-y-auto min-h-0 -mx-6 px-6">
            {loadingUsers ? (
              <div className="flex items-center justify-center py-8">
                <InlineLoader />
              </div>
            ) : (
              <div className="flex flex-col gap-1 py-1">
                {filteredUsers.map((user) => {
                  const playerPending = inviteQueue.some(
                    i => i.kind === 'user' && i.userId === user.id && i.role === 'PLAYER' && i.status === 'pending',
                  )
                  const subPending = inviteQueue.some(
                    i => i.kind === 'user' && i.userId === user.id && i.role === 'SUBSTITUTE' && i.status === 'pending',
                  )
                  return (
                    <div
                      key={user.id}
                      className="flex items-center justify-between gap-2 px-2 py-1 rounded-md border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground inline-flex items-center gap-1">
                          <GenderIcon gender={user.gender} className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{user.name}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">****{user.phone_last_four}</p>
                      </div>
                      <div className="flex flex-col gap-1 sm:flex-row">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => void handleInvite(user, 'PLAYER')}
                          disabled={playerPending || reachedLimit || isPlayerInviteDisabled}
                          className="gap-2"
                        >
                          {playerPending ? (
                            <InlineLoader size="sm" />
                          ) : (
                            <>
                              <UserPlus className="w-4 h-4" />
                              Jugador
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleInvite(user, 'SUBSTITUTE')}
                          disabled={subPending || reachedLimit}
                          className="gap-2"
                        >
                          {subPending ? (
                            <InlineLoader size="sm" />
                          ) : (
                            <>
                              <UserPlus className="w-4 h-4" />
                              Suplente
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 pt-4 border-t border-border -mx-6 px-6 bg-background">
          {!showGuestForm ? (
            <div
              className="flex items-center justify-between p-3 rounded-lg border border-yellow-500/50 bg-yellow-500/5 hover:bg-yellow-500/10 transition-colors cursor-pointer"
              onClick={handleStartGuestInvite}
            >
              <div>
                <p className="font-medium text-foreground inline-flex items-center gap-1">
                  <GenderIcon gender="OTHER" className="w-4 h-4 shrink-0" />
                  <span>{search || 'Jugador nuevo'}</span>
                </p>
                <p className="text-sm text-muted-foreground">********</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-2 border-yellow-500/50 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/20"
                onClick={(e) => {
                  e.stopPropagation()
                  handleStartGuestInvite()
                }}
                disabled={reachedLimit}
              >
                <UserPlus className="w-4 h-4" />
                Invitar jugador no registrado
              </Button>
            </div>
          ) : (
            <div className="mb-2 rounded-lg border border-border bg-muted/20 p-3 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2">
              <p className="text-sm font-medium text-foreground">Invitado (sin registro)</p>

              <div className="flex flex-col gap-2">
                <Input
                  placeholder="Nombre del invitado"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  maxLength={255}
                  disabled={reachedLimit}
                  autoFocus
                />

                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Últimos 4 nros de tel (opcional)"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={guestLastFour}
                    onChange={(e) => setGuestLastFour(onlyDigits(e.target.value).slice(-4))}
                    maxLength={4}
                    disabled={reachedLimit}
                  />

                  <select
                    value={guestGender}
                    onChange={(e) => setGuestGender(e.target.value as InviteGuestInput['gender'])}
                    disabled={reachedLimit}
                    className="h-9 px-2 rounded-md border border-border bg-background text-foreground text-sm focus:ring-1 focus:ring-ring"
                  >
                    <option value="MALE">Hombre</option>
                    <option value="FEMALE">Mujer</option>
                    <option value="OTHER">Otro</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={guestRole}
                    onChange={(e) => setGuestRole(e.target.value as InviteGuestInput['role'])}
                    disabled={reachedLimit}
                    className="h-9 px-2 rounded-md border border-border bg-background text-foreground text-sm focus:ring-1 focus:ring-ring"
                  >
                    <option value="PLAYER">Jugador</option>
                    <option value="SUBSTITUTE">Suplente</option>
                  </select>

                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      onClick={cancelGuestForm}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => void handleInviteGuest()}
                      disabled={reachedLimit || (guestRole === 'PLAYER' && isPlayerInviteDisabled)}
                    >
                      Invitar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {inviteQueue.length > 0 ? (
          <div className="flex flex-col gap-1 pt-2 border-t border-border -mx-6 px-6">
            <p className="text-xs font-medium text-muted-foreground">Invitaciones en curso</p>
            <ul className="flex flex-col gap-0.5 max-h-32 overflow-y-auto">
              {inviteQueue.map((item) => {
                const roleLabel = (item.kind === 'user' ? item.role : item.guestPayload.role) === 'PLAYER' ? 'jugador' : 'suplente'
                return (
                  <li
                    key={item.id}
                    className="rounded-md border border-border px-2 py-0.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2 min-h-6">
                      <p className="min-w-0 font-medium text-foreground inline-flex items-center gap-1 truncate">
                        {item.kind === 'user' ? (
                          <GenderIcon gender={item.gender} className="w-3 h-3 shrink-0" />
                        ) : (
                          <GenderIcon gender="OTHER" className="w-3 h-3 shrink-0" />
                        )}
                        <span className="truncate">{item.displayName}</span>
                        <span className="shrink-0 font-normal text-muted-foreground">
                          · Como {roleLabel}
                        </span>
                      </p>
                      <div className="shrink-0 flex items-center">
                        {item.status === 'pending' ? (
                          <InlineLoader size="sm" />
                        ) : item.status === 'success' ? (
                          <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-medium">
                            <Check className="w-3 h-3" />
                            Invitado
                          </span>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-6 px-1.5 gap-0.5 text-[11px]"
                            onClick={() => retryQueueItem(item)}
                          >
                            <RotateCcw className="w-3 h-3" />
                            Reintentar
                          </Button>
                        )}
                      </div>
                    </div>
                    {item.status === 'error' && item.error ? (
                      <p className="mt-0.5 pl-4 leading-snug text-destructive">{item.error}</p>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}

        <div className="flex justify-end pt-4 border-t border-border -mx-6 px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="bg-transparent">
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
