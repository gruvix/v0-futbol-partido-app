'use client'

import React from "react"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Input } from '@/components/ui/input'
import { createMatch } from '@/app/actions/matches'
import { getCurrentUser } from '@/app/actions/auth'
import { ArrowLeft, Calendar, Clock, MapPin, Globe, Lock, Users, Pencil, ChevronLeft, ChevronRight } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import Link from 'next/link'
import { useActionLoader } from '@/components/football-loader'

const COMMON_TIMES = [
  { label: '16:00', value: '16:00' },
  { label: '17:00', value: '17:00' },
  { label: '18:00', value: '18:00' },
  { label: '19:00', value: '19:00' },
  { label: '20:00', value: '20:00' },
  { label: '21:00', value: '21:00' },
  { label: '22:00', value: '22:00' },
  { label: '23:00', value: '23:00' },
]

// Available hours and minutes for custom time picker
const PICKER_HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))
const PICKER_MINUTES = ['00', '15', '30', '45']

export default function NuevoPartidoPage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [locationType, setLocationType] = useState('TERRAZAS')
  const [selectedTime, setSelectedTime] = useState('21:00')
  const [customHour, setCustomHour] = useState('21')
  const [customMinute, setCustomMinute] = useState('00')
  const [useCustomTime, setUseCustomTime] = useState(false)
  const [isPublic, setIsPublic] = useState(true)
  const [teamCount, setTeamCount] = useState(0) // 0 = no teams, 2 = two teams
  const [customTeamCount, setCustomTeamCount] = useState('')
  const [useCustomTeamCount, setUseCustomTeamCount] = useState(false)
  const [teamSize, setTeamSize] = useState(5)
  const [customTeamSize, setCustomTeamSize] = useState('')
  const [useCustomTeamSize, setUseCustomTeamSize] = useState(false)
  const [userName, setUserName] = useState('')
  const [weekOffset, setWeekOffset] = useState(0) // 0 = this week, 1 = next week, etc.
  const router = useRouter()
  const { showLoader, hideLoader } = useActionLoader()

  // Fetch current user's name for placeholder
  useEffect(() => {
    getCurrentUser().then((user) => {
      if (user?.name) {
        setUserName(user.name)
      }
    })
  }, [])

  // Generate 7 days starting from weekOffset * 7 days from tomorrow
  const dates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() + 1 + (weekOffset * 7) + i)
    return date
  })
  
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  })
  
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']
  
  // Max 4 weeks ahead (approximately 1 month)
  const canGoForward = weekOffset < 4
  const canGoBack = weekOffset > 0

  // Calculate actual team count
  const actualTeamCount = useCustomTeamCount && customTeamCount ? parseInt(customTeamCount) : teamCount

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const formData = new FormData()
    formData.set('date', selectedDate)
    formData.set('time', useCustomTime ? `${customHour}:${customMinute}` : selectedTime)
    formData.set('locationType', locationType)
    formData.set('isPublic', isPublic.toString())
    formData.set('title', title)
    formData.set('teamCount', actualTeamCount.toString())
    const finalTeamSize = useCustomTeamSize && customTeamSize ? parseInt(customTeamSize) : teamSize
    formData.set('teamSize', finalTeamSize.toString())
    
    if (locationType === 'OTRO') {
      const customLocation = (e.currentTarget.elements.namedItem('locationCustom') as HTMLInputElement)?.value
      if (!customLocation) {
        setError('Ingresa el nombre de la cancha')
        setLoading(false)
        return
      }
      formData.set('locationCustom', customLocation)
    }
    
    showLoader('Creando partido...')
    const result = await createMatch(formData)
    hideLoader()

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else if (result?.redirect) {
      router.push(result.redirect)
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <Link href="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ArrowLeft className="w-4 h-4" />
        Volver
      </Link>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-foreground">Nuevo partido</CardTitle>
          <CardDescription className="text-muted-foreground">
            Crea un partido y convoca a los pibes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {/* Match title - FIRST */}
            <div className="flex flex-col gap-3">
              <Label className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-primary" />
                Titulo (opcional)
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={userName ? `Partido de ${userName}` : 'Cargando...'}
                maxLength={100}
              />
            </div>

            {/* Date selection */}
            <div className="flex flex-col gap-3">
              <Label className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Fecha
              </Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWeekOffset(prev => prev - 1)}
                  disabled={!canGoBack}
                  className={`p-2 rounded-lg border-2 transition-all ${
                    canGoBack 
                      ? 'border-border hover:border-primary/50 hover:bg-muted/50' 
                      : 'border-border/50 text-muted-foreground/50 cursor-not-allowed'
                  }`}
                  aria-label="Semana anterior"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex-1 grid grid-cols-7 gap-1">
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
                <button
                  type="button"
                  onClick={() => setWeekOffset(prev => prev + 1)}
                  disabled={!canGoForward}
                  className={`p-2 rounded-lg border-2 transition-all ${
                    canGoForward 
                      ? 'border-border hover:border-primary/50 hover:bg-muted/50' 
                      : 'border-border/50 text-muted-foreground/50 cursor-not-allowed'
                  }`}
                  aria-label="Semana siguiente"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
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
              <button
                type="button"
                onClick={() => setUseCustomTime(!useCustomTime)}
                className={`flex items-center gap-2 py-2 px-3 rounded-lg border-2 font-medium transition-all w-full justify-center ${
                  useCustomTime
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }`}
              >
                Otra hora
              </button>
              {useCustomTime && (
                <div className="flex items-center justify-center gap-2 p-3 rounded-lg border border-border bg-muted/30">
                  <select
                    value={customHour}
                    onChange={(e) => setCustomHour(e.target.value)}
                    className="h-10 px-3 rounded-md border border-border bg-background text-foreground text-lg font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {PICKER_HOURS.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <span className="text-xl font-bold text-muted-foreground">:</span>
                  <select
                    value={customMinute}
                    onChange={(e) => setCustomMinute(e.target.value)}
                    className="h-10 px-3 rounded-md border border-border bg-background text-foreground text-lg font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {PICKER_MINUTES.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}
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
                  required={locationType === 'OTRO'}
                />
              </div>
            )}

            {/* Team configuration */}
            <div className="flex flex-col gap-3">
              <Label className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Equipos
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTeamCount(0)
                    setUseCustomTeamCount(false)
                  }}
                  className={`py-2 px-3 rounded-lg border-2 font-medium transition-all ${
                    !useCustomTeamCount && teamCount === 0
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  Sin equipos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTeamCount(2)
                    setUseCustomTeamCount(false)
                  }}
                  className={`py-2 px-3 rounded-lg border-2 font-medium transition-all ${
                    !useCustomTeamCount && teamCount === 2
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  2 Equipos
                </button>
                <button
                  type="button"
                  onClick={() => setUseCustomTeamCount(true)}
                  className={`py-2 px-3 rounded-lg border-2 font-medium transition-all ${
                    useCustomTeamCount
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  Otro
                </button>
              </div>
              
              {useCustomTeamCount && (
                <Input
                  type="number"
                  min="2"
                  max="10"
                  value={customTeamCount}
                  onChange={(e) => setCustomTeamCount(e.target.value)}
                  placeholder="Cantidad de equipos"
                  className="mt-1"
                />
              )}
              
              {actualTeamCount > 0 && (
                <div className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-muted/30">
                  <Label className="text-sm text-muted-foreground">Jugadores por equipo</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTeamSize(5)
                        setUseCustomTeamSize(false)
                      }}
                      className={`py-2 px-3 rounded-lg border-2 font-medium transition-all ${
                        !useCustomTeamSize && teamSize === 5
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      5
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTeamSize(10)
                        setUseCustomTeamSize(false)
                      }}
                      className={`py-2 px-3 rounded-lg border-2 font-medium transition-all ${
                        !useCustomTeamSize && teamSize === 10
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      10
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseCustomTeamSize(true)}
                      className={`py-2 px-3 rounded-lg border-2 font-medium transition-all ${
                        useCustomTeamSize
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      Otro
                    </button>
                  </div>
                  {useCustomTeamSize && (
                    <Input
                      type="number"
                      min="1"
                      max="50"
                      value={customTeamSize}
                      onChange={(e) => setCustomTeamSize(e.target.value)}
                      placeholder="Cantidad de jugadores"
                      className="mt-1"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Visibility toggle */}
            <div className="flex flex-col gap-3">
              <Label className="flex items-center gap-2">
                {isPublic ? <Globe className="w-4 h-4 text-primary" /> : <Lock className="w-4 h-4 text-primary" />}
                Visibilidad
              </Label>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setIsPublic(prev => !prev)}
                onKeyDown={(e) => e.key === 'Enter' && setIsPublic(prev => !prev)}
                className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left cursor-pointer ${
                  isPublic ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground/50'
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-sm">
                    {isPublic ? 'Publico' : 'Privado'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {isPublic 
                      ? 'Visible para todos en el dashboard' 
                      : 'Solo visible para jugadores invitados'}
                  </span>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={isPublic}
                    onCheckedChange={setIsPublic}
                    aria-label="Toggle visibility"
                  />
                </div>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
              Crear partido
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
