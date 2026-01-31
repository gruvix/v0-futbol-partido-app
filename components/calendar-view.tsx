'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronLeft, ChevronRight, MapPin, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MatchSummary {
  id: number
  date_time: string
  location_type: string
  location_custom: string | null
  participant_count: number
}

interface CalendarViewProps {
  matches: MatchSummary[]
}

const locationLabels: Record<string, string> = {
  TERRAZAS: 'Terrazas',
  FENIX: 'Fenix',
  OTRO: 'Otro',
}

const monthNames = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

const dayNames = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']

export function CalendarView({ matches }: CalendarViewProps) {
  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1)
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0)
  const startingDayOfWeek = firstDayOfMonth.getDay()
  const daysInMonth = lastDayOfMonth.getDate()

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  function getMatchesForDay(day: number): MatchSummary[] {
    return matches.filter(match => {
      const matchDate = new Date(match.date_time)
      return (
        matchDate.getDate() === day &&
        matchDate.getMonth() === currentMonth &&
        matchDate.getFullYear() === currentYear
      )
    })
  }

  const calendarDays = []
  
  // Empty cells for days before the first of the month
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null)
  }
  
  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day)
  }

  const isToday = (day: number) => {
    return (
      day === today.getDate() &&
      currentMonth === today.getMonth() &&
      currentYear === today.getFullYear()
    )
  }

  const isPast = (day: number) => {
    const date = new Date(currentYear, currentMonth, day)
    return date < new Date(today.getFullYear(), today.getMonth(), today.getDate())
  }

  return (
    <Card>
      <CardContent className="p-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="sm" onClick={prevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-lg font-semibold text-foreground">
            {monthNames[currentMonth]} {currentYear}
          </h2>
          <Button variant="ghost" size="sm" onClick={nextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {dayNames.map(day => (
            <div
              key={day}
              className="text-center text-xs font-medium text-muted-foreground py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="aspect-square" />
            }

            const dayMatches = getMatchesForDay(day)
            const hasMatches = dayMatches.length > 0

            return (
              <div
                key={day}
                className={cn(
                  'aspect-square p-1 rounded-lg transition-colors relative',
                  isToday(day) && 'bg-primary/10 ring-2 ring-primary',
                  isPast(day) && 'opacity-50',
                  hasMatches && !isPast(day) && 'bg-accent/20'
                )}
              >
                <span
                  className={cn(
                    'text-sm font-medium',
                    isToday(day) ? 'text-primary' : 'text-foreground'
                  )}
                >
                  {day}
                </span>
                {hasMatches && (
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                    {dayMatches.slice(0, 3).map((_, i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-primary"
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Upcoming matches list */}
        <div className="mt-6 flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground">Proximos partidos</h3>
          {matches.filter(m => new Date(m.date_time) >= today).length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay partidos programados</p>
          ) : (
            <div className="flex flex-col gap-2">
              {matches
                .filter(m => new Date(m.date_time) >= today)
                .slice(0, 5)
                .map(match => {
                  const date = new Date(match.date_time)
                  const location = match.location_type === 'OTRO' && match.location_custom
                    ? match.location_custom
                    : locationLabels[match.location_type]
                  
                  return (
                    <Link
                      key={match.id}
                      href={`/dashboard/partido/${match.id}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex flex-col items-center justify-center min-w-[40px] py-1 px-2 rounded bg-primary/10">
                        <span className="text-lg font-bold text-primary">{date.getDate()}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">
                          {monthNames[date.getMonth()].slice(0, 3)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          <span>{location}</span>
                          <Users className="w-3 h-3 ml-1" />
                          <span>{match.participant_count}</span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
