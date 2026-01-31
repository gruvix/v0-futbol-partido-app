'use client'

import { useState } from 'react'
import Link from 'next/link'
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
  UserMinus
} from 'lucide-react'
import { joinMatch, leaveMatch, deleteMatch, randomizeTeams, assignTeam } from '@/app/actions/matches'
import { TeamAssignment } from '@/components/team-assignment'

interface Match {
  id: number
  date_time: string
  location_type: string
  location_custom: string | null
  created_by_user_id: number
  creator_name: string
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const date = new Date(match.date_time)
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  
  const formattedDate = `${dayNames[date.getDay()]} ${date.getDate()} de ${monthNames[date.getMonth()]}`
  const formattedTime = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  
  const location = match.location_type === 'OTRO' && match.location_custom
    ? match.location_custom
    : locationLabels[match.location_type] || match.location_type

  const players = participants.filter(p => p.role === 'PLAYER')
  const substitutes = participants.filter(p => p.role === 'SUBSTITUTE')
  const extras = participants.filter(p => p.role === 'EXTRA')

  async function handleJoin(role: 'PLAYER' | 'SUBSTITUTE' | 'EXTRA') {
    setLoading(true)
    setError('')
    const result = await joinMatch(match.id, role)
    if (result?.error) {
      setError(result.error)
    }
    setLoading(false)
  }

  async function handleLeave() {
    setLoading(true)
    setError('')
    const result = await leaveMatch(match.id)
    if (result?.error) {
      setError(result.error)
    }
    setLoading(false)
  }

  async function handleDelete() {
    if (!confirm('Seguro que queres eliminar este partido?')) return
    setLoading(true)
    await deleteMatch(match.id)
  }

  async function handleRandomize() {
    setLoading(true)
    setError('')
    const result = await randomizeTeams(match.id)
    if (result?.error) {
      setError(result.error)
    }
    setLoading(false)
  }

  async function handleAssignTeam(participantId: number, team: 'A' | 'B' | null) {
    const result = await assignTeam(match.id, participantId, team)
    if (result?.error) {
      setError(result.error)
    }
  }

  return (
    <div className="flex flex-col gap-4">
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
            {isPast && <Badge variant="secondary">Finalizado</Badge>}
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
                    disabled={loading}
                    className="gap-2 bg-transparent"
                  >
                    <UserMinus className="w-4 h-4" />
                    Borrarme
                  </Button>
                  {userParticipation.role !== 'PLAYER' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleJoin('PLAYER')}
                      disabled={loading}
                    >
                      Cambiar a Jugador
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => handleJoin('PLAYER')}
                    disabled={loading}
                    className="gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    Anotarme
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleJoin('SUBSTITUTE')}
                    disabled={loading}
                  >
                    Como suplente
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleJoin('EXTRA')}
                    disabled={loading}
                  >
                    Por las dudas
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Participants */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Users className="w-5 h-5" />
                Anotados ({participants.length})
              </h3>
              {isCreator && !isPast && players.length >= 2 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRandomize}
                  disabled={loading}
                  className="gap-2 bg-transparent"
                >
                  <Shuffle className="w-4 h-4" />
                  Sortear equipos
                </Button>
              )}
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

          {/* Delete button for creator */}
          {isCreator && !isPast && (
            <div className="pt-4 border-t border-border">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={loading}
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar partido
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
