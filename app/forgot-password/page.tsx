'use client'

import React from 'react'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingOverlay } from '@/components/football-loader'
import { useErrorToast } from '@/components/error-toast-provider'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const { showError } = useErrorToast()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })

      if (response.ok) {
        setSent(true)
        return
      }

      if (response.status === 400) {
        showError('Datos invalidos', 'Ingresa un email valido.')
        return
      }

      showError('Error', 'No se pudo enviar el correo. Intenta de nuevo mas tarde.')
    } catch {
      showError('Error', 'No se pudo enviar el correo. Intenta de nuevo mas tarde.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-white/40 p-4">
      {loading && <LoadingOverlay message="Enviando email..." />}
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-foreground">Recuperar contraseña</CardTitle>
          <CardDescription className="text-muted-foreground">
            Te enviamos un enlace para restablecer tu contraseña
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="flex flex-col gap-4 text-center">
              <div className="rounded-lg bg-primary/10 p-4">
                <p className="text-foreground font-medium">
                  Si el email esta registrado, vas a recibir un enlace para restablecer tu contraseña.
                </p>
              </div>
              <Link href="/login">
                <Button variant="outline" className="w-full bg-transparent">
                  Volver al login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={loading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                Enviar enlace
              </Button>

              <p className="text-sm text-center text-muted-foreground">
                <Link href="/login" className="text-primary underline underline-offset-2">
                  Volver al login
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
