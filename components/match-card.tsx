import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, Users, Clock, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Match {
  id: number
  date_time: string
  location_type: string
  location_custom: string | null
  created_by_user_id: number
  creator_name: string
  participant_count: number
  title: string | null
}

interface MatchCardProps {
  match: Match
  currentUserId: number
  isPast?: boolean
}

const locationLabels: Record<string, string> = {
  TERRAZAS: 'Terrazas',
  FENIX: 'Fenix',
  OTRO: 'Otro',
}

export function MatchCard({ match, currentUserId, isPast }: MatchCardProps) {
  const date = new Date(match.date_time)
  const isCreator = match.created_by_user_id === currentUserId

  const dayNames = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

  // Use UTC methods to avoid timezone offset issues
  const dayName = dayNames[date.getUTCDay()]
  const dayNumber = date.getUTCDate()
  const monthName = monthNames[date.getUTCMonth()]
  // 24-hour format
  const hours = date.getUTCHours().toString().padStart(2, '0')
  const minutes = date.getUTCMinutes().toString().padStart(2, '0')
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
              <span className="font-semibold text-foreground truncate">
                {match.title || `Partido de ${match.creator_name}`}
              </span>
              {isCreator && (
                <Badge variant="secondary" className="text-xs shrink-0">Tu partido</Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>{time} hs</span>
              <MapPin className="w-4 h-4 ml-2" />
              <span className="truncate">{location}</span>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <Users className="w-4 h-4" />
              <span>{match.participant_count} anotados</span>
            </div>
          </div>

          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  )
}
