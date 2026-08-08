'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Copy, Mail, UserPlus } from 'lucide-react'

import { getMyInviteStatus, sendRegistrationInviteAction } from '@/app/actions/invitations'
import { InviteCooldownBanner } from '@/components/invite-cooldown-banner'
import { useErrorToast } from '@/components/error-toast-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { InviteAvailability } from '@/lib/invitations'

export function InviteUserForm(): React.JSX.Element {
  const { showError } = useErrorToast()
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [email, setEmail] = useState('')
  const [availability, setAvailability] = useState<InviteAvailability | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)
  const [copied, setCopied] = useState(false)

  const loadStatus = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getMyInviteStatus()
      if ('error' in result) {
        showError('Error', result.error)
        return
      }
      setAvailability(result)
    } catch {
      showError('Error', 'No se pudo cargar el estado de invitaciones')
    } finally {
      setLoading(false)
    }
  }, [showError])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (!availability?.canInvite) return

    setSending(true)
    setInviteUrl(null)
    setEmailSent(false)
    setCopied(false)

    try {
      const fd = new FormData()
      fd.set('email', email.trim())

      const result = await sendRegistrationInviteAction(fd)
      if ('error' in result && result.error) {
        showError('Error al invitar', result.error)
        return
      }

      if ('success' in result && result.success) {
        setInviteUrl(result.inviteUrl)
        setEmailSent(result.emailSent)
        setEmail('')
        await loadStatus()
      }
    } catch {
      showError('Error al invitar')
    } finally {
      setSending(false)
    }
  }

  async function handleCopyLink(): Promise<void> {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showError('Error', 'No se pudo copiar el enlace')
    }
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
          <UserPlus className="w-5 h-5" />
          Invitar usuario
        </h1>
        <p className="text-sm text-muted-foreground">
          Cada usuario puede invitar a una persona cada 24 horas. Los admins no tienen limite de espera. El enlace es
          de un solo uso y vence en 24 horas.
        </p>
      </div>

      {!loading && availability && !availability.canInvite && availability.nextAvailableAt && (
        <InviteCooldownBanner
          nextAvailableAt={availability.nextAvailableAt}
          blockedByCooldown={availability.blockedByCooldown}
          blockedByNewUserWait={availability.blockedByNewUserWait}
          onExpired={() => void loadStatus()}
        />
      )}

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Nueva invitacion
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Podes enviar la invitacion por email y compartir el mismo enlace. El primero que complete el registro va a
            consumir el token. El email de registro no tiene que coincidir con el destinatario del correo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="invite-email">Email del invitado (opcional)</Label>
                <Input
                  id="invite-email"
                  name="email"
                  type="email"
                  placeholder="amigo@email.com"
                  autoComplete="email"
                  disabled={sending || !availability?.canInvite}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Si lo completas, le mandamos el enlace por correo. Tambien vas a poder copiarlo aca abajo.
                </p>
              </div>

              <Button type="submit" disabled={sending || !availability?.canInvite} className="gap-2">
                <UserPlus className="w-4 h-4" />
                {sending ? 'Generando invitacion...' : 'Crear invitacion'}
              </Button>
            </form>
          )}

          {inviteUrl && (
            <div className="mt-6 flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm font-medium text-foreground">
                {emailSent ? 'Invitacion creada y email enviado' : 'Invitacion creada'}
              </p>
              <p className="text-xs text-muted-foreground break-all">{inviteUrl}</p>
              <Button type="button" variant="outline" className="gap-2 bg-transparent w-fit" onClick={handleCopyLink}>
                <Copy className="w-4 h-4" />
                {copied ? 'Copiado' : 'Copiar enlace'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Compartilo solo con una persona. Cuando alguien se registre con este enlace, queda consumido.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
