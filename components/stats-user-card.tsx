'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { saveUserStats, MIN_STAT_VALUE, MAX_STAT_VALUE } from '@/app/actions/stats'
import type { StatsUser } from '@/app/actions/stats'

const STAT_FIELDS: Array<{ key: keyof Pick<StatsUser, 'pac' | 'sho' | 'pas' | 'dri' | 'def' | 'phy'>; code: string; label: string }> = [
  { key: 'pac', code: 'PAC', label: 'Pace' },
  { key: 'sho', code: 'SHO', label: 'Shooting' },
  { key: 'pas', code: 'PAS', label: 'Passing' },
  { key: 'dri', code: 'DRI', label: 'Dribbling' },
  { key: 'def', code: 'DEF', label: 'Defending' },
  { key: 'phy', code: 'PHY', label: 'Physicality' },
]

export function StatsUserCard({ user }: { user: StatsUser }) {
  const [values, setValues] = useState({
    pac: user.pac,
    sho: user.sho,
    pas: user.pas,
    dri: user.dri,
    def: user.def,
    phy: user.phy,
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <p className="font-medium text-foreground">
          {user.name} <span className="text-muted-foreground text-sm">({user.phone_last_four})</span>
        </p>
      </CardHeader>
      <CardContent>
        <form action={saveUserStats} className="flex flex-col gap-3">
          <input type="hidden" name="userId" value={String(user.id)} />
          {STAT_FIELDS.map((stat) => (
            <div key={stat.key} className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
              <label htmlFor={`${stat.key}-${user.id}`} className="text-xs text-muted-foreground min-w-[76px]">
                <span className="font-semibold text-foreground">{stat.code}</span> {stat.label}
              </label>
              <input
                id={`${stat.key}-${user.id}`}
                type="range"
                min={MIN_STAT_VALUE}
                max={MAX_STAT_VALUE}
                step={1}
                name={stat.key}
                value={values[stat.key]}
                onChange={(event) => setValues((prev) => ({ ...prev, [stat.key]: Number(event.target.value) }))}
              />
              <span className="text-sm font-semibold w-6 text-right">{values[stat.key]}</span>
            </div>
          ))}
          <Button type="submit" size="sm">Guardar</Button>
        </form>
      </CardContent>
    </Card>
  )
}
