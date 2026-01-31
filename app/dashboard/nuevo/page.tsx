'use client'

import React from "react"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { createMatch } from '@/app/actions/matches'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NuevoPartidoPage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [locationType, setLocationType] = useState('TERRAZAS')
  const router = useRouter()

  // Default to tomorrow
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const defaultDate = tomorrow.toISOString().split('T')[0]

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    formData.set('locationType', locationType)
    
    const result = await createMatch(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
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
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="date">Fecha</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  defaultValue={defaultDate}
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="time">Hora</Label>
                <Input
                  id="time"
                  name="time"
                  type="time"
                  defaultValue="21:00"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Label>Cancha</Label>
              <RadioGroup
                value={locationType}
                onValueChange={setLocationType}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                  <RadioGroupItem value="TERRAZAS" id="terrazas" />
                  <Label htmlFor="terrazas" className="cursor-pointer flex-1 font-normal">
                    Terrazas
                  </Label>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                  <RadioGroupItem value="FENIX" id="fenix" />
                  <Label htmlFor="fenix" className="cursor-pointer flex-1 font-normal">
                    Fenix
                  </Label>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
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

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creando...' : 'Crear partido'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
