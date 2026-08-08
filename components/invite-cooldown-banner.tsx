'use client'

import React, { useEffect, useState } from 'react'

function formatRemaining(ms: number): string {
  if (ms <= 0) return '0 segundos'

  const totalSeconds = Math.ceil(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const parts: string[] = []
  if (days > 0) parts.push(`${days} ${days === 1 ? 'dia' : 'dias'}`)
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hora' : 'horas'}`)
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`)
  if (seconds > 0 && days === 0) parts.push(`${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}`)

  return parts.join(', ')
}

type InviteCooldownBannerProps = {
  nextAvailableAt: string
  blockedByCooldown: boolean
  blockedByNewUserWait: boolean
  onExpired?: () => void
}

export function InviteCooldownBanner({
  nextAvailableAt,
  blockedByCooldown,
  blockedByNewUserWait,
  onExpired,
}: InviteCooldownBannerProps): React.JSX.Element {
  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, new Date(nextAvailableAt).getTime() - Date.now()),
  )

  useEffect(() => {
    const tick = (): void => {
      const ms = Math.max(0, new Date(nextAvailableAt).getTime() - Date.now())
      setRemainingMs(ms)
      if (ms <= 0) onExpired?.()
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [nextAvailableAt, onExpired])

  let explanation = 'Todavia no podes invitar a nadie.'
  if (blockedByNewUserWait && blockedByCooldown) {
    explanation =
      'Tu cuenta es nueva y ya usaste tu invitacion reciente. Tenes que esperar a que terminen ambos tiempos antes de invitar de nuevo.'
  } else if (blockedByNewUserWait) {
    explanation =
      'Las cuentas nuevas tienen que esperar 1 semana desde el registro antes de poder invitar a otros usuarios.'
  } else if (blockedByCooldown) {
    explanation = 'Solo podes enviar una invitacion cada 24 horas. Espera a que termine el tiempo para invitar de nuevo.'
  }

  return (
    <div className="rounded-lg border-2 border-red-500 bg-red-50 p-4 text-red-900">
      <p className="font-semibold">Todavia no podes invitar</p>
      <p className="mt-1 text-sm">{explanation}</p>
      <p className="mt-3 text-sm font-medium">
        Tiempo restante: <span className="tabular-nums">{formatRemaining(remainingMs)}</span>
      </p>
    </div>
  )
}
