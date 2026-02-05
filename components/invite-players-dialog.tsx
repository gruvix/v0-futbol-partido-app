'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getAllUsers, invitePlayer } from '@/app/actions/matches'
import { FootballLoader, InlineLoader } from '@/components/football-loader'
import { Check, UserPlus, Search } from 'lucide-react'

interface User {
  id: number
  name: string
  phone_last_four: string
}

interface InvitePlayersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  matchId: number
  currentParticipantIds: number[]
}

export function InvitePlayersDialog({
  open,
  onOpenChange,
  matchId,
  currentParticipantIds,
}: InvitePlayersDialogProps) {
  const [users, setUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [invitingId, setInvitingId] = useState<number | null>(null)
  const [invitedIds, setInvitedIds] = useState<number[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      loadUsers()
      setInvitedIds([])
      setSearch('')
    }
  }, [open])

  async function loadUsers() {
    setLoadingUsers(true)
    const result = await getAllUsers()
    if (result.users) {
      setUsers(result.users)
    }
    setLoadingUsers(false)
  }

  async function handleInvite(userId: number) {
    setInvitingId(userId)
    setError('')
    const result = await invitePlayer(matchId, userId, 'PLAYER')
    
    if (result?.error) {
      setError(result.error)
    } else {
      setInvitedIds(prev => [...prev, userId])
    }
    setInvitingId(null)
  }

  const availableUsers = users.filter(
    u => !currentParticipantIds.includes(u.id) && !invitedIds.includes(u.id)
  )

  const filteredUsers = availableUsers.filter(
    u => u.name.toLowerCase().includes(search.toLowerCase()) ||
         u.phone_last_four.includes(search)
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Invitar jugadores</DialogTitle>
          <DialogDescription>
            Agrega jugadores al partido
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

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex-1 overflow-y-auto min-h-0 -mx-6 px-6">
          {loadingUsers ? (
            <div className="flex items-center justify-center py-8">
              <InlineLoader />
            </div>
          ) : filteredUsers.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              {search ? 'No se encontraron jugadores' : 'Todos los jugadores ya estan anotados'}
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
                      <p className="font-medium text-foreground">{user.name}</p>
                      <p className="text-sm text-muted-foreground">****{user.phone_last_four}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={isInvited ? "secondary" : "default"}
                      onClick={() => handleInvite(user.id)}
                      disabled={isInviting || isInvited}
                      className="gap-2"
                    >
                      {isInviting ? (
                        <FootballLoader size="sm" />
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
