'use client'

import { useEffect } from 'react'
import { captureInstallPrompt, clearInstallPrompt } from '@/lib/pwa-install-prompt'

export function PwaInstallListener(): null {
  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      captureInstallPrompt(event)
    }

    const onAppInstalled = () => {
      clearInstallPrompt()
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  return null
}
