'use client'

import React from "react"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { login } from '@/app/actions/auth'
import { FootballLoader } from '@/components/football-loader'

export default function LoginPage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await login(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else if (result?.redirect) {
      router.push(result.redirect)
      router.refresh()
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-foreground">Fulbito</CardTitle>
          <CardDescription className="text-muted-foreground">
            Organiza partidos con tus amigos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="Tu nombre"
                required
                autoComplete="username"
                disabled={loading}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="phoneLast4">Ultimos 4 digitos del celular</Label>
              <Input
                id="phoneLast4"
                name="phoneLast4"
                type="text"
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                placeholder="1234"
                required
                disabled={loading}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Tu contraseña"
                required
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <FootballLoader size="sm" />
                  Entrando...
                </span>
              ) : (
                'Entrar'
              )}
            </Button>

            <p className="text-sm text-center text-muted-foreground">
              No tenes cuenta?{' '}
              <Link href="/registro" className="text-primary underline underline-offset-2">
                Registrate
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
