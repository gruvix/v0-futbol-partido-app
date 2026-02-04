import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, Users, Clock, ChevronRight, Lock, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MatchWithDetails } from '@/app/actions/matches'

interface MatchCardProps {
  match: MatchWithDetails
  currentUserId: number
  isPast?: boolean
  isUserMatch?: boolean
}

const locationLabels: Record<string, string> = {
  TERRAZAS: 'Terrazas',
  FENIX: 'Fenix',
  OTRO: 'Otro',
}

export function MatchCard({ match, currentUserId, isPast, isUserMatch }: MatchCardProps) {
  const date = new Date(match.date_time)
  const isCreator = match.created_by_user_id === currentUserId
  const isPrivate = match.visibility === 'PRIVATE'

  const dayNames = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

  const dayName = dayNames[date.getDay()]
  const dayNumber = date.getDate()
  const monthName = monthNames[date.getMonth()]
  // Use explicit 24-hour format with padding
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const time = `${hours}:${minutes}`

  const location = match.location_type === 'OTRO' && match.location_custom
    ? match.location_custom
    : locationLabels[match.location_type] || match.location_type

  return (
    <Link href={`/dashboard/partido/${match.id}`}>
      <Card className={cn(
        'transition-all hover:shadow-md hover:border-primary/30',
        isPast && 'opacity-60'
      )}>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex flex-col items-center justify-center min-w-[60px] py-2 px-3 rounded-lg bg-primary/10">
            <span className="text-xs font-medium text-primary uppercase">{dayName}</span>
            <span className="text-2xl font-bold text-primary">{dayNumber}</span>
            <span className="text-xs text-muted-foreground">{monthName}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold text-foreground">{time} hs</span>
              {isCreator && (
                <Badge variant="secondary" className="text-xs">Organizador</Badge>
              )}
              {isUserMatch && !isCreator && (
                <Badge variant="outline" className="text-xs">Anotado</Badge>
              )}
              {isPrivate && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Lock className="w-3 h-3" />
                  Privado
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span className="truncate">{location}</span>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <Users className="w-4 h-4" />
              <span>{match.participant_count} anotados</span>
              <span className="text-xs">- Organiza {match.creator_name}</span>
            </div>

            {/* Show result for past matches */}
            {isPast && match.result_winner && (
              <div className="flex items-center gap-2 text-sm mt-2 pt-2 border-t border-border">
                <Trophy className="w-4 h-4 text-primary" />
                <span className="font-medium">
                  {match.result_score_a ?? 0} - {match.result_score_b ?? 0}
                </span>
                <span className="text-xs text-muted-foreground">
                  {match.result_winner === 'DRAW' ? 'Empate' : `Gano equipo ${match.result_winner}`}
                </span>
              </div>
            )}
          </div>

          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  )
}
