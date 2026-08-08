'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail } from 'lucide-react'

import { addEmailToProfile } from '@/app/actions/auth'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type EmailSetupPromptProps = {
  userId: number
  hasEmail: boolean
}

function dismissKey(userId: number): string {
  return `fulbito_email_prompt_dismissed_${userId}`
}

export function EmailSetupPrompt({ userId, hasEmail }: EmailSetupPromptProps): React.JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const { showError } = useErrorToast()

  useEffect(() => {
    if (hasEmail) return
    if (localStorage.getItem(dismissKey(userId)) === '1') return
    setOpen(true)
  }, [hasEmail, userId])

  if (hasEmail) return null

  function handleDismiss(): void {
    localStorage.setItem(dismissKey(userId), '1')
    setOpen(false)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setSaving(true)
    try {
      const fd = new FormData()
      fd.set('email', email.trim())
      const result = await addEmailToProfile(fd)
      if (result?.error) {
        showError('Error al guardar email', result.error)
        return
      }
      setOpen(false)
      router.refresh()
    } catch {
      showError('Error al guardar email')
    } finally {
      setSaving(false)
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
            <Mail className="h-5 w-5" />
            Agregá tu email
          </DialogTitle>
          <DialogDescription className="text-left space-y-2 pt-1">
            <span className="block">
              Estamos migrando al inicio de sesión con email. Si perdés el acceso a tu cuenta, lo vamos a usar para
              ayudarte a recuperarla.
            </span>
            <span className="block">
              No te pedimos verificar el email: con cargarlo alcanza para poder usarlo en el login y en la recuperación
              de contraseña.
            </span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="setup-email">Email</Label>
            <Input
              id="setup-email"
              name="email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={saving}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={handleDismiss} disabled={saving}>
              Ahora no
            </Button>
            <Button type="submit" disabled={saving || !email.trim()}>
              Guardar email
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
