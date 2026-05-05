'use client'

import { useEffect, useState } from 'react'
import { Check, Search, UserPlus } from 'lucide-react'

import { getAllUsers, getInviteCount, inviteGuest, invitePlayer, type InviteGuestInput } from '@/app/actions/matches'
import { toast } from 'sonner'
import { GenderIcon, type Gender } from '@/lib/gender'
import { useErrorToast } from '@/components/error-toast-provider'
import { InlineLoader, useActionLoader } from '@/components/football-loader'
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

interface InvitePlayersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  matchId: number
  currentParticipantIds: number[]
  invitesPerPlayer?: number | null
  currentUserId: number
}

export function InvitePlayersDialog({
  open,
  onOpenChange,
  matchId,
  currentParticipantIds,
  invitesPerPlayer,
  currentUserId,
}: InvitePlayersDialogProps): React.JSX.Element {
  const { showError } = useErrorToast()
  const { showLoader, hideLoader } = useActionLoader()

  const [users, setUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [invitingId, setInvitingId] = useState<number | null>(null)
  const [invitedIds, setInvitedIds] = useState<number[]>([])
  const [search, setSearch] = useState('')
  const [myInviteCount, setMyInviteCount] = useState(0)
  const [showGuestForm, setShowGuestForm] = useState(false)

  // Guest invite form
  const [guestName, setGuestName] = useState('')
  const [guestLastFour, setGuestLastFour] = useState('')
  const [guestGender, setGuestGender] = useState<InviteGuestInput['gender']>('MALE')
  const [guestRole, setGuestRole] = useState<InviteGuestInput['role']>('PLAYER')
  const [guestSubmitting, setGuestSubmitting] = useState(false)
  // keep track of invited guest names to prevent duplicates
  const [invitedGuestNames, setInvitedGuestNames] = useState<string[]>([])

  const hasLimit = invitesPerPlayer !== null && invitesPerPlayer !== undefined
  const remainingInvites = hasLimit ? invitesPerPlayer - (myInviteCount + invitedIds.length) : Infinity
  const reachedLimit = hasLimit && remainingInvites <= 0

  useEffect(() => {
    if (!open) return

    setInvitedIds([])
    setSearch('')
    setShowGuestForm(false)
    setGuestName('')
    setGuestLastFour('')
    setGuestGender('MALE')
    setGuestRole('PLAYER')
    // reset duplicate tracking for each dialog session
    setInvitedGuestNames([])

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

  async function handleInvite(userId: number): Promise<void> {
    setInvitingId(userId)
    showLoader('Invitando jugador...')
    const result = await invitePlayer(matchId, userId, 'PLAYER') as any
    hideLoader()

    if (result?.error) {
      showError('Error al intentar invitar jugador', result.error)
      setInvitingId(null)
      return
    }

    // successful invite: clear search and reset form state
    setSearch('')
    setInvitedIds(prev => [...prev, userId])
    setInvitingId(null)
  }

  async function handleInviteGuest(): Promise<void> {
    const name = guestName.trim()
    if (!name) {
      showError('Nombre requerido', 'Ingresá un nombre para el invitado')
      return
    }
    // Prevent duplicate non‑registered invites by name before sending request
    if (invitedGuestNames.includes(name)) {
      toast.error('Ya existe un invitado con ese nombre')
      return
    }

    setGuestSubmitting(true)
    showLoader('Agregando invitado...')
    const result = await inviteGuest(matchId, {
      name,
      phoneLastFour: guestLastFour.trim() || undefined,
      gender: guestGender,
      role: guestRole,
    }) as any
    hideLoader()
    setGuestSubmitting(false)

    if ((result as any)?.error) {
      // Show error toast; result.error may be a string or an object with message
      const description = typeof result.error === 'object' && result.error !== null && 'message' in result.error
        ? (result.error as any).message
        : String(result.error)
      toast.error('Error al intentar invitar', { description })
      return
    }

    // Prevent duplicate non‑registered invites by name
    if (invitedGuestNames.includes(name)) {
      toast.error('Ya existe un invitado con ese nombre')
      return
    }

    // Show success toast
    toast.success('Invitado agregado')

    // Reset form, hide guest form, clear search and refresh invite count (limit display)
    setGuestName('')
    setGuestLastFour('')
    setGuestGender('MALE')
    setGuestRole('PLAYER')
    setShowGuestForm(false)
    setSearch('')
    setInvitedGuestNames(prev => [...prev, name])

    if (hasLimit) {
      const r = await getInviteCount(matchId, currentUserId)
      setMyInviteCount(r.count)
    }
  }

  const availableUsers = users.filter(u => !currentParticipantIds.includes(u.id) && !invitedIds.includes(u.id))

  const filteredUsers = availableUsers.filter(
    u => u.name.toLowerCase().includes(search.toLowerCase()) || u.phone_last_four.includes(search)
  )

  const handleStartGuestInvite = () => {
    setGuestName(search)
    setShowGuestForm(true)
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

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o numero..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 -mx-6 px-6">
          {loadingUsers ? (
            <div className="flex items-center justify-center py-8">
              <InlineLoader />
            </div>
          ) : (
            <div className="flex flex-col gap-2 py-2">
              {filteredUsers.map((user) => {
                const isInviting = invitingId === user.id
                const isInvited = invitedIds.includes(user.id)
                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-foreground inline-flex items-center gap-1">
                        <GenderIcon gender={user.gender} className="w-4 h-4 shrink-0" />
                        <span>{user.name}</span>
                      </p>
                      <p className="text-sm text-muted-foreground">****{user.phone_last_four}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={isInvited ? 'secondary' : 'default'}
                      onClick={() => void handleInvite(user.id)}
                      disabled={isInviting || isInvited || reachedLimit}
                      className="gap-2"
                    >
                      {isInviting ? (
                        <InlineLoader size="sm" />
                      ) : isInvited ? (
                        <>
                          <Check className="w-4 h-4" />
                          Invitado
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          Invitar
                        </>
                      )}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

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
                  disabled={guestSubmitting || reachedLimit}
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
                    disabled={guestSubmitting || reachedLimit}
                  />

                  <select
                    value={guestGender}
                    onChange={(e) => setGuestGender(e.target.value as InviteGuestInput['gender'])}
                    disabled={guestSubmitting || reachedLimit}
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
                    disabled={guestSubmitting || reachedLimit}
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
                      onClick={() => setShowGuestForm(false)}
                      disabled={guestSubmitting}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => void handleInviteGuest()}
                      disabled={guestSubmitting || reachedLimit}
                    >
                      {guestSubmitting ? <InlineLoader size="sm" /> : 'Invitar'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t border-border -mx-6 px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="bg-transparent">
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
