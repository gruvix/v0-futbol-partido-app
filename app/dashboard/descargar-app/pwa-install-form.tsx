'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Smartphone } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  canOfferPwaInstall,
  getPwaInstallInstructions,
  getPwaInstallPlatform,
  isPwaInstalled,
  type PwaInstallPlatform,
} from '@/lib/pwa-install'
import { subscribeInstallPrompt, triggerInstallPrompt } from '@/lib/pwa-install-prompt'

export function PwaInstallForm(): React.JSX.Element {
  const [installed, setInstalled] = useState(false)
  const [platform, setPlatform] = useState<PwaInstallPlatform>('unsupported')
  const [canPrompt, setCanPrompt] = useState(false)
  const [instructionsOpen, setInstructionsOpen] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    setInstalled(isPwaInstalled())
    setPlatform(getPwaInstallPlatform())

    return subscribeInstallPrompt(setCanPrompt)
  }, [])

  const instructions = useMemo(() => getPwaInstallInstructions(platform), [platform])
  const canInstall = canOfferPwaInstall(platform)
  const showNativeInstall = platform === 'chromium' && canPrompt

  const handleInstallClick = async () => {
    if (showNativeInstall) {
      setInstalling(true)
      try {
        await triggerInstallPrompt()
        setInstalled(isPwaInstalled())
      } finally {
        setInstalling(false)
      }
      return
    }

    setInstructionsOpen(true)
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <Link
        href="/dashboard"
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver
      </Link>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Smartphone className="w-5 h-5" />
          Descargar app
        </h1>
        <p className="text-sm text-muted-foreground">
          Agregá BariFutbol a tu pantalla de inicio para abrirlo como una app. Es un acceso directo: siempre carga la
          versión más reciente del sitio.
        </p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Download className="w-4 h-4" />
            Acceso directo
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {installed
              ? 'Ya tenés BariFutbol instalado en este dispositivo.'
              : canInstall
                ? 'Elegí instalar desde acá o usá el aviso que muestra tu navegador.'
                : 'Tu navegador no permite instalar esta app como acceso directo.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!installed && canInstall && (
            <>
              <Button
                type="button"
                className="gap-2 w-fit"
                onClick={handleInstallClick}
                disabled={installing}
              >
                <Download className="w-4 h-4" />
                {showNativeInstall ? 'Instalar app' : 'Ver cómo instalar'}
              </Button>
              {!showNativeInstall && (
                <p className="text-xs text-muted-foreground">
                  {platform === 'firefox-android'
                    ? 'Firefox no muestra un aviso automático. Seguí los pasos cuando quieras crear el acceso.'
                    : 'Tu navegador requiere unos pasos manuales desde el menú del navegador.'}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={instructionsOpen} onOpenChange={setInstructionsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{instructions.title}</DialogTitle>
            <DialogDescription>
              Creá un acceso directo sin depender de avisos automáticos del navegador.
            </DialogDescription>
          </DialogHeader>
          <ol className="list-decimal list-inside space-y-2 text-sm text-foreground">
            {instructions.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>
    </div>
  )
}
