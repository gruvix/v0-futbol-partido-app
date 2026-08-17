'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'

import { getPushNotificationsSettings } from '@/app/actions/notifications'
import { useErrorToast } from '@/components/error-toast-provider'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  isAnyPushSettingEnabled,
  isBrowserPushReady,
  isPushSupported,
  resyncExistingPushSubscription,
  syncPushSubscription,
} from '@/lib/push-client'

type PushNotificationPromptProps = {
  userId: number
}

type PromptMode = 'needs_permission' | 'denied'

function dismissKey(userId: number): string {
  return `fulbito_push_prompt_dismissed_${userId}`
}

export function PushNotificationPrompt({ userId }: PushNotificationPromptProps): React.JSX.Element | null {
  const pathname = usePathname()
  const { showError } = useErrorToast()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<PromptMode>('needs_permission')
  const [activating, setActivating] = useState(false)

  useEffect(() => {
    if (pathname?.includes('/configuracion')) return

    let cancelled = false

    async function checkPushState(): Promise<void> {
      const settings = await getPushNotificationsSettings()
      if (!settings || !isAnyPushSettingEnabled(settings)) return
      if (!isPushSupported()) return

      if (await isBrowserPushReady()) {
        const result = await resyncExistingPushSubscription()
        if (!cancelled && result.status === 'error') {
          console.error('Push resync failed:', result.message)
        }
        return
      }

      if (localStorage.getItem(dismissKey(userId)) === '1') return
      if (cancelled) return

      setMode(Notification.permission === 'denied' ? 'denied' : 'needs_permission')
      setOpen(true)
    }

    checkPushState()

    return () => {
      cancelled = true
    }
  }, [userId, pathname])

  function handleDismiss(): void {
    localStorage.setItem(dismissKey(userId), '1')
    setOpen(false)
  }

  async function handleActivate(): Promise<void> {
    setActivating(true)
    try {
      const result = await syncPushSubscription(true)
      if (result.status === 'ok') {
        setOpen(false)
        return
      }
      if (result.status === 'denied') {
        setMode('denied')
        return
      }
      if (result.status === 'error') {
        showError('Error', result.message)
        return
      }
      showError('Permiso denegado', 'Habilitá las notificaciones en la configuración del navegador para recibir avisos')
    } finally {
      setActivating(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleDismiss()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            ¿Habilitar notificaciones en este navegador?
          </DialogTitle>
          <DialogDescription className="text-left pt-1">
            Tenés notificaciones configuradas pero tu navegador no permite mostrarlas.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={handleDismiss} disabled={activating}>
            Ahora no
          </Button>
          {mode === 'needs_permission' ? (
            <Button type="button" onClick={handleActivate} disabled={activating}>
              Activar notificaciones
            </Button>
          ) : (
            <Button type="button" asChild>
              <Link href="/dashboard/configuracion">Cómo habilitarlas</Link>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
