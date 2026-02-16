'use client'

import React from "react"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { register } from '@/app/actions/auth'
import { LoadingOverlay } from '@/components/football-loader'
import { useErrorToast } from '@/components/error-toast-provider'

export default function RegistroPage() {
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { showError } = useErrorToast()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSuccess('')
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await register(formData)

    if (result?.error) {
      showError('Error al crear cuenta', result.error)
      setLoading(false)
    } else if (result?.success) {
      if (result.pending) {
        setSuccess(result.message || 'Solicitud enviada')
        setLoading(false)
      } else if (result.redirect) {
        router.push(result.redirect)
        router.refresh()
      }
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      {loading && !success && <LoadingOverlay message="Creando cuenta..." />}
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-foreground">Registrate</CardTitle>
          <CardDescription className="text-muted-foreground">
            Crea tu cuenta para organizar partidos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="flex flex-col gap-4 text-center">
              <div className="rounded-lg bg-primary/10 p-4">
                <p className="text-foreground font-medium">{success}</p>
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
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Tu nombre"
                  required
                  autoComplete="name"
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
                <p className="text-xs text-muted-foreground">
                  Tu nombre + estos 4 digitos te identifican
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Minimo 8 caracteres"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Debe tener al menos 8 caracteres
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Genero</Label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      value="male"
                      defaultChecked
                      disabled={loading}
                    />
                    <span className="text-sm text-foreground">Masculino</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      value="female"
                      disabled={loading}
                    />
                    <span className="text-sm text-foreground">Femenino</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      value="other"
                      disabled={loading}
                    />
                    <span className="text-sm text-foreground">Otro / no binario</span>
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Este campo se usa para mejorar el balanceo al armar equipos. Se sugiere usar tu genero biologico, pero sos libre de elegir lo que quieras.
                </p>
              </div>

              {/* errors are shown via ErrorToastProvider */}

              <Button type="submit" className="w-full" disabled={loading}>
                Crear cuenta
              </Button>

              <p className="text-sm text-center text-muted-foreground">
                Ya tenes cuenta?{' '}
                <Link href="/login" className="text-primary underline underline-offset-2">
                  Inicia sesion
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
