'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface DateNavigatorProps {
  date: string // YYYY-MM-DD
  onChange: (nextDate: string) => void
}

function formatDateYYYYMMDD(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function addDays(date: string, deltaDays: number): string {
  const [y, m, d] = date.split('-').map((n) => Number(n))
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + deltaDays)
  return formatDateYYYYMMDD(dt)
}

function formatHuman(date: string): string {
  const [y, m, d] = date.split('-').map((n) => Number(n))
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString('es-AR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
}

interface QuickPick {
  label: string
  date: string
}

export function DateNavigator({ date, onChange }: DateNavigatorProps) {
  const [open, setOpen] = useState<boolean>(false)
  const quickPicks = useMemo<QuickPick[]>(() => {
    const today = formatDateYYYYMMDD(new Date())
    return [
      { label: 'Hoy', date: today },
      { label: 'Mañana', date: addDays(today, 1) },
      { label: 'En 2 días', date: addDays(today, 2) },
      { label: 'En 7 días', date: addDays(today, 7) },
    ]
  }, [])

  return (
    <>
      <div className="flex items-center justify-between gap-3">
      <Button
        variant="outline"
        size="sm"
        className="bg-transparent"
        onClick={() => onChange(addDays(date, -1))}
      >
        <ChevronLeft className="w-4 h-4" />
        <span className="sr-only">Día anterior</span>
      </Button>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-2"
          onClick={() => setOpen(true)}
          title="Cambiar fecha"
        >
          <span className="font-mono text-xs">{date}</span>
          <span className="text-xs text-muted-foreground">({formatHuman(date)})</span>
        </Button>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="bg-transparent"
        onClick={() => onChange(addDays(date, 1))}
      >
        <span className="sr-only">Día siguiente</span>
        <ChevronRight className="w-4 h-4" />
      </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md rounded-2xl p-0 overflow-hidden">
          <div className="p-4 border-b border-border">
            <DialogHeader>
              <DialogTitle>Elegí una fecha</DialogTitle>
            </DialogHeader>
          </div>

          <div className="p-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2">
              {quickPicks.map((p) => (
                <Button
                  key={p.label}
                  type="button"
                  variant={p.date === date ? 'default' : 'outline'}
                  className={p.date === date ? '' : 'bg-transparent'}
                  onClick={() => {
                    onChange(p.date)
                    setOpen(false)
                  }}
                >
                  {p.label}
                </Button>
              ))}
            </div>

            {/* Native date input is still the best UX on iOS/Android (wheel/calendar picker) */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={(e) => onChange(e.target.value)}
                className="h-11 rounded-md border border-input bg-background px-3 text-base"
              />
              <p className="text-xs text-muted-foreground">
                Tip: en celular se abre el selector nativo.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
