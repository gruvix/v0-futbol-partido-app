'use client'

import React from "react"
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Input } from '@/components/ui/input'
import { updateMatch } from '@/app/actions/matches'
import { ArrowLeft, Calendar, Clock, MapPin, Globe, Lock, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { FootballLoader } from '@/components/football-loader'

const COMMON_TIMES = [
  { label: '19:00', value: '19:00' },
  { label: '19:30', value: '19:30' },
  { label: '20:00', value: '20:00' },
  { label: '20:30', value: '20:30' },
  { label: '21:00', value: '21:00' },
  { label: '21:30', value: '21:30' },
  { label: '22:00', value: '22:00' },
  { label: '22:30', value: '22:30' },
]

interface MatchData {
  id: number
  date_time: string
  location_type: string
  location_custom: string | null
  visibility: 'PUBLIC' | 'PRIVATE'
}

export default function EditarPartidoPage() {
  const params = useParams()
  const matchId = params.id as string
  
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMatch, setLoadingMatch] = useState(true)
  const [locationType, setLocationType] = useState('TERRAZAS')
  const [locationCustom, setLocationCustom] = useState('')
  const [selectedTime, setSelectedTime] = useState('21:00')
  const [customTime, setCustomTime] = useState('')
  const [useCustomTime, setUseCustomTime] = useState(false)
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC')
  const [selectedDate, setSelectedDate] = useState('')
  const router = useRouter()

  // Generate next 14 days for date selection
  const dates = Array.from({ length: 14 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() + i)
    return date
  })
  
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']

  // Load match data
  useEffect(() => {
    async function loadMatch() {
      try {
        const response = await fetch(`/api/matches/${matchId}`)
        if (!response.ok) {
          throw new Error('Match not found')
        }
        const data: MatchData = await response.json()
        
        const matchDate = new Date(data.date_time)
        setSelectedDate(matchDate.toISOString().split('T')[0])
        
        const hours = matchDate.getHours().toString().padStart(2, '0')
        const minutes = matchDate.getMinutes().toString().padStart(2, '0')
        const timeStr = `${hours}:${minutes}`
        
        // Check if time is in common times list
        const isCommonTime = COMMON_TIMES.some(t => t.value === timeStr)
        if (isCommonTime) {
          setSelectedTime(timeStr)
          setUseCustomTime(false)
        } else {
          setCustomTime(timeStr)
          setUseCustomTime(true)
        }
        
        setLocationType(data.location_type)
        setLocationCustom(data.location_custom || '')
        setVisibility(data.visibility || 'PUBLIC')
      } catch {
        setError('Error al cargar el partido')
      } finally {
        setLoadingMatch(false)
      }
    }
    
    loadMatch()
  }, [matchId])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const formData = new FormData()
    formData.set('date', selectedDate)
    formData.set('time', useCustomTime ? customTime : selectedTime)
    formData.set('locationType', locationType)
    formData.set('visibility', visibility)
    
    if (locationType === 'OTRO') {
      if (!locationCustom) {
        setError('Ingresa el nombre de la cancha')
        setLoading(false)
        return
      }
      formData.set('locationCustom', locationCustom)
    }
    
    const result = await updateMatch(parseInt(matchId), formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.push(`/dashboard/partido/${matchId}`)
    }
  }

  if (loadingMatch) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Cargando partido...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <Link href={`/dashboard/partido/${matchId}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ArrowLeft className="w-4 h-4" />
        Volver
      </Link>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-foreground">Editar partido</CardTitle>
          <CardDescription className="text-muted-foreground">
            Modifica los detalles del partido
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {/* Date selection */}
            <div className="flex flex-col gap-3">
              <Label className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Fecha
              </Label>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {dates.map((date) => {
                  const dateStr = date.toISOString().split('T')[0]
                  const isSelected = selectedDate === dateStr
                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => setSelectedDate(dateStr)}
                      className={`flex flex-col items-center p-2 rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      <span className="text-xs font-medium">{dayNames[date.getDay()]}</span>
                      <span className="text-lg font-bold">{date.getDate()}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Time selection */}
            <div className="flex flex-col gap-3">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Hora
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {COMMON_TIMES.map((time) => {
                  const isSelected = !useCustomTime && selectedTime === time.value
                  return (
                    <button
                      key={time.value}
                      type="button"
                      onClick={() => {
                        setSelectedTime(time.value)
                        setUseCustomTime(false)
                      }}
                      className={`py-2 px-3 rounded-lg border-2 font-medium transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      {time.label}
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  id="customTime"
                  checked={useCustomTime}
                  onChange={(e) => setUseCustomTime(e.target.checked)}
                  className="w-4 h-4 rounded border-border"
                />
                <Label htmlFor="customTime" className="text-sm font-normal cursor-pointer">
                  Otra hora
                </Label>
                {useCustomTime && (
                  <Input
                    type="time"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                    className="w-28 ml-2"
                    required={useCustomTime}
                  />
                )}
              </div>
            </div>

            {/* Location selection */}
            <div className="flex flex-col gap-3">
              <Label className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Cancha
              </Label>
              <RadioGroup
                value={locationType}
                onValueChange={setLocationType}
                className="flex flex-col gap-2"
              >
                <div className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer ${
                  locationType === 'TERRAZAS' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                }`}>
                  <RadioGroupItem value="TERRAZAS" id="terrazas" />
                  <Label htmlFor="terrazas" className="cursor-pointer flex-1 font-normal">
                    Terrazas
                  </Label>
                </div>
                <div className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer ${
                  locationType === 'FENIX' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                }`}>
                  <RadioGroupItem value="FENIX" id="fenix" />
                  <Label htmlFor="fenix" className="cursor-pointer flex-1 font-normal">
                    Fenix
                  </Label>
                </div>
                <div className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer ${
                  locationType === 'OTRO' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                }`}>
                  <RadioGroupItem value="OTRO" id="otro" />
                  <Label htmlFor="otro" className="cursor-pointer flex-1 font-normal">
                    Otra cancha
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {locationType === 'OTRO' && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="locationCustom">Nombre de la cancha</Label>
                <Input
                  id="locationCustom"
                  name="locationCustom"
                  type="text"
                  placeholder="Ej: Cancha del barrio"
                  value={locationCustom}
                  onChange={(e) => setLocationCustom(e.target.value)}
                  required={locationType === 'OTRO'}
                />
              </div>
            )}

            {/* Visibility selection */}
            <div className="flex flex-col gap-3">
              <Label className="flex items-center gap-2">
                {visibility === 'PUBLIC' ? (
                  <Globe className="w-4 h-4 text-primary" />
                ) : (
                  <Lock className="w-4 h-4 text-primary" />
                )}
                Visibilidad
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVisibility('PUBLIC')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                    visibility === 'PUBLIC'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  <Globe className="w-5 h-5" />
                  <span className="text-sm font-medium">Publico</span>
                  <span className="text-xs text-muted-foreground text-center">Visible para todos</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility('PRIVATE')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                    visibility === 'PRIVATE'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  <Lock className="w-5 h-5" />
                  <span className="text-sm font-medium">Privado</span>
                  <span className="text-xs text-muted-foreground text-center">Solo con link</span>
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <FootballLoader size="sm" />
                  Guardando...
                </span>
              ) : (
                'Guardar cambios'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
