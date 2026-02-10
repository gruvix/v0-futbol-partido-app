'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DateNavigator } from '@/components/fields/date-navigator'

interface NormalizedSlotAvailability {
  time: string
  available: boolean
  price?: number
  availableFieldNames?: string[]
}

interface NormalizedFieldAvailability {
  fieldId: string
  fieldName: string
  slots: NormalizedSlotAvailability[]
}

interface NormalizedComplexAvailability {
  complexId: string
  complexName: string
  date: string
  fields: NormalizedFieldAvailability[]
}

interface NormalizedAvailabilityResponse {
  date: string
  complexes: NormalizedComplexAvailability[]
}

function todayYYYYMMDD(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function FieldsSection() {
  const [date, setDate] = useState<string>(todayYYYYMMDD())
  const [data, setData] = useState<NormalizedAvailabilityResponse | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/fields/availability?date=${encodeURIComponent(date)}`, {
          cache: 'no-store',
        })
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        const json = (await res.json()) as NormalizedAvailabilityResponse
        if (!cancelled) setData(json)
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [date])

  const complexes = useMemo(() => data?.complexes ?? [], [data])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Canchas</h1>
        <p className="text-muted-foreground">Disponibilidad de complejos (scrapers y APIs)</p>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col gap-4">
          <DateNavigator date={date} onChange={setDate} />
          {isLoading && <p className="text-sm text-muted-foreground">Cargando disponibilidad…</p>}
          {error && <p className="text-sm text-destructive">Error: {error}</p>}
          {!isLoading && !error && complexes.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay complejos disponibles.</p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        {complexes.map((complex) => (
          <Card key={complex.complexId}>
            <CardContent className="p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <h2 className="text-lg font-semibold text-foreground">{complex.complexName}</h2>
                  <p className="text-xs text-muted-foreground">{complex.date}</p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {complex.fields.map((field) => (
                  <div key={field.fieldId} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-foreground">{field.fieldName}</p>
                      <p className="text-xs text-muted-foreground">{field.slots.length} horarios</p>
                    </div>

                    <div className="flex flex-col gap-2">
                      {field.slots.map((slot) => {
                        const availableFieldsText =
                          slot.availableFieldNames && slot.availableFieldNames.length > 0
                            ? slot.availableFieldNames.join(', ')
                            : slot.available
                              ? 'Disponible'
                              : 'No disponible'

                        return (
                          <div
                            key={slot.time}
                            className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                          >
                            <div className="flex items-center gap-3">
                              <Badge
                                variant={slot.available ? 'default' : 'secondary'}
                                className={slot.available ? '' : 'opacity-70'}
                              >
                                {slot.time}
                              </Badge>
                              <span className="text-sm text-foreground">{availableFieldsText}</span>
                            </div>

                            {slot.price !== undefined && (
                              <span className="text-xs text-muted-foreground">${slot.price}</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
