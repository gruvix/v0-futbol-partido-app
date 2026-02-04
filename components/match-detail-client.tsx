'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  Clock, 
  Users, 
  Shuffle, 
  Trash2,
  UserPlus,
  UserMinus,
  Share2,
  Globe,
  Lock,
  Pencil
} from 'lucide-react'
import { joinMatch, leaveMatch, deleteMatch, randomizeTeams, assignTeam, updateMatchVisibility } from '@/app/actions/matches'
import type { MatchVisibility, ResultTeam } from '@/lib/db'
import { TeamAssignment } from '@/components/team-assignment'
import { InvitePlayersDialog } from '@/components/invite-players-dialog'
import { FootballLoader } from '@/components/football-loader'
import { MatchResultForm } from '@/components/match-result-form'
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
  date_time: string
  location_type: string
  location_custom: string | null
  created_by_user_id: number
  creator_name: string
  visibility: MatchVisibility
  result_winner: ResultTeam | null
  result_score_a: number | null
  result_score_b: number | null
  result_notes: string | null
}

interface Participant {
  id: number
  user_id: number
  name: string
  phone_last_four: string
  role: 'PLAYER' | 'SUBSTITUTE' | 'EXTRA'
  team: 'A' | 'B' | null
}

interface MatchDetailClientProps {
  match: Match
  participants: Participant[]
  isCreator: boolean
  userParticipation?: Participant
  isPast: boolean
  currentUserId: number
}

const locationLabels: Record<string, string> = {
  TERRAZAS: 'Terrazas',
  FENIX: 'Fenix',
  OTRO: 'Otro',
}

const roleLabels: Record<string, string> = {
  PLAYER: 'Jugador',
  SUBSTITUTE: 'Suplente',
  EXTRA: 'Por las dudas',
}

export function MatchDetailClient({
  match,
  participants,
  isCreator,
  userParticipation,
  isPast,
  currentUserId,
}: MatchDetailClientProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showLastPlayerConfirm, setShowLastPlayerConfirm] = useState(false)
  const router = useRouter()

  const date = new Date(match.date_time)
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  
  const formattedDate = `${dayNames[date.getDay()]} ${date.getDate()} de ${monthNames[date.getMonth()]}`
  // Use explicit 24-hour format with padding to avoid locale/timezone issues
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const formattedTime = `${hours}:${minutes}`
  
  const location = match.location_type === 'OTRO' && match.location_custom
    ? match.location_custom
    : locationLabels[match.location_type] || match.location_type

  const players = participants.filter(p => p.role === 'PLAYER')
  const substitutes = participants.filter(p => p.role === 'SUBSTITUTE')
  const extras = participants.filter(p => p.role === 'EXTRA')

  async function handleJoin(role: 'PLAYER' | 'SUBSTITUTE' | 'EXTRA') {
    setLoading(`join-${role}`)
    setError('')
    const result = await joinMatch(match.id, role)
    if (result?.error) {
      setError(result.error)
    }
    setLoading(null)
  }

  async function handleLeave() {
    setLoading('leave')
    setError('')
    const result = await leaveMatch(match.id)
    if (result?.error) {
      setError(result.error)
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
    const result = await deleteMatch(match.id)
    if (result?.error) {
      setError(result.error)
      setLoading(null)
    } else if (result?.redirect) {
      router.push(result.redirect)
    }
  }

  async function handleRandomize() {
    setLoading('randomize')
    setError('')
    const result = await randomizeTeams(match.id)
    if (result?.error) {
      setError(result.error)
    }
    setLoading(null)
  }

  async function handleAssignTeam(participantId: number, team: 'A' | 'B' | null) {
    const result = await assignTeam(match.id, participantId, team)
    if (result?.error) {
      setError(result.error)
    }
  }

  async function handleToggleVisibility() {
    setLoading('visibility')
    setError('')
    const newVisibility: MatchVisibility = match.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC'
    const result = await updateMatchVisibility(match.id, newVisibility)
    if (result?.error) {
      setError(result.error)
    }
    setLoading(null)
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
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl text-foreground flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                {formattedDate}
              </CardTitle>
              <div className="flex items-center gap-4 mt-2 text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formattedTime} hs
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {location}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Organiza: {match.creator_name}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {isPast && <Badge variant="secondary">Finalizado</Badge>}
              <div className="flex items-center gap-2">
                {/* Edit button for organizers */}
                {isCreator && !isPast && (
                  <Link href={`/dashboard/partido/${match.id}/editar`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 bg-transparent"
                    >
                      <Pencil className="w-4 h-4" />
                      Editar
                    </Button>
                  </Link>
                )}
                {/* Visibility badge/toggle */}
                {isCreator && !isPast ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToggleVisibility}
                    disabled={isLoading}
                    className="gap-2 bg-transparent"
                  >
                    {loading === 'visibility' ? (
                      <FootballLoader size="sm" />
                    ) : match.visibility === 'PUBLIC' ? (
                      <>
                        <Globe className="w-4 h-4" />
                        Publico
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        Privado
                      </>
                    )}
                  </Button>
                ) : (
                  <Badge variant="outline" className="gap-1">
                    {match.visibility === 'PUBLIC' ? (
                      <>
                        <Globe className="w-3 h-3" />
                        Publico
                      </>
                    ) : (
                      <>
                        <Lock className="w-3 h-3" />
                        Privado
                      </>
                    )}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
          {/* Join/Leave buttons */}
          {!isPast && (
            <div className="flex flex-col gap-2">
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              
              {userParticipation ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-sm">
                    {roleLabels[userParticipation.role]}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLeave}
                    disabled={isLoading}
                    className="gap-2 bg-transparent"
                  >
                    {loading === 'leave' ? (
                      <FootballLoader size="sm" />
                    ) : (
                      <UserMinus className="w-4 h-4" />
                    )}
                    Borrarme
                  </Button>
                  {userParticipation.role !== 'PLAYER' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleJoin('PLAYER')}
                      disabled={isLoading}
                    >
                      {loading === 'join-PLAYER' ? (
                        <FootballLoader size="sm" />
                      ) : (
                        'Cambiar a Jugador'
                      )}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => handleJoin('PLAYER')}
                    disabled={isLoading}
                    className="gap-2"
                  >
                    {loading === 'join-PLAYER' ? (
                      <FootballLoader size="sm" />
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
                      <FootballLoader size="sm" />
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
                      <FootballLoader size="sm" />
                    ) : (
                      'Por las dudas'
                    )}
                  </Button>
                </div>
              )}
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
                {isCreator && !isPast && players.length >= 2 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRandomize}
                    disabled={isLoading}
                    className="gap-2 bg-transparent"
                  >
                    {loading === 'randomize' ? (
                      <FootballLoader size="sm" />
                    ) : (
                      <Shuffle className="w-4 h-4" />
                    )}
                    Sortear equipos
                  </Button>
                )}
              </div>
            </div>

            {players.length > 0 && (
              <TeamAssignment
                participants={players}
                isCreator={isCreator}
                isPast={isPast}
                onAssignTeam={handleAssignTeam}
                title="Jugadores"
              />
            )}

            {substitutes.length > 0 && (
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-medium text-muted-foreground">Suplentes</h4>
                <div className="flex flex-wrap gap-2">
                  {substitutes.map((p) => (
                    <Badge key={p.id} variant="secondary" className="py-1.5 px-3">
                      {p.name} ({p.phone_last_four})
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {extras.length > 0 && (
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-medium text-muted-foreground">Por las dudas</h4>
                <div className="flex flex-wrap gap-2">
                  {extras.map((p) => (
                    <Badge key={p.id} variant="outline" className="py-1.5 px-3">
                      {p.name} ({p.phone_last_four})
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {participants.length === 0 && (
              <p className="text-muted-foreground text-sm">Todavia no hay nadie anotado</p>
            )}
          </div>

          {/* Match Result for past matches */}
          {isPast && (
            <MatchResultForm
              matchId={match.id}
              isCreator={isCreator}
              currentResult={{
                winner: match.result_winner,
                scoreA: match.result_score_a,
                scoreB: match.result_score_b,
                notes: match.result_notes,
              }}
            />
          )}

          {/* Delete button for creator */}
          {isCreator && !isPast && (
            <div className="pt-4 border-t border-border">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isLoading}
                className="gap-2"
              >
                {loading === 'delete' ? (
                  <FootballLoader size="sm" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Eliminar partido
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <InvitePlayersDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        matchId={match.id}
        currentParticipantIds={participants.map(p => p.user_id)}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar partido</AlertDialogTitle>
            <AlertDialogDescription>
              Seguro que queres eliminar este partido? Esta accion no se puede deshacer.
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
    </div>
  )
}
