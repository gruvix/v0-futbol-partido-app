'use client'

import React from 'react'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requestPasswordResetAction } from '@/app/actions/auth'
import { LoadingOverlay } from '@/components/football-loader'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData()
    formData.set('email', email.trim())
    await requestPasswordResetAction(formData)

    // Always show the same message, regardless of whether the email exists.
    setSent(true)
    setLoading(false)
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
