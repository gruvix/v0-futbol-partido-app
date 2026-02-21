'use client'

import { useEffect, useState } from 'react'
import { Check, Search, UserPlus } from 'lucide-react'

import { getAllUsers, getInviteCount, invitePlayer } from '@/app/actions/matches'
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

  const hasLimit = invitesPerPlayer !== null && invitesPerPlayer !== undefined
  const remainingInvites = hasLimit ? invitesPerPlayer - (myInviteCount + invitedIds.length) : Infinity
  const reachedLimit = hasLimit && remainingInvites <= 0

  useEffect(() => {
    if (!open) return

    setInvitedIds([])
    setSearch('')

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

  async function handleInvite(userId: number): Promise<void> {
    setInvitingId(userId)
    showLoader('Invitando jugador...')
    const result = await invitePlayer(matchId, userId, 'PLAYER')
    hideLoader()

    if (result?.error) {
      showError('Error al intentar invitar jugador', result.error)
      setInvitingId(null)
      return
    }

    setInvitedIds(prev => [...prev, userId])
    setInvitingId(null)
  }

  const availableUsers = users.filter(u => !currentParticipantIds.includes(u.id) && !invitedIds.includes(u.id))

  const filteredUsers = availableUsers.filter(
    u => u.name.toLowerCase().includes(search.toLowerCase()) || u.phone_last_four.includes(search)
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
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
          ) : filteredUsers.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              {search ? 'No se encontraron jugadores' : 'Todos los jugadores ya están en el partido'}
            </p>
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

        <div className="flex justify-end pt-4 border-t border-border -mx-6 px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="bg-transparent">
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
