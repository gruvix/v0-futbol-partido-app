'use client'

import React, { Suspense } from 'react'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { resetPasswordAction } from '@/app/actions/auth'
import { useErrorToast } from '@/components/error-toast-provider'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { showError } = useErrorToast()
  const token = searchParams.get('token') ?? ''

  const [newPassword, setNewPassword] = useState('')
  const [newPasswordRepeat, setNewPasswordRepeat] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData()
    formData.set('token', token)
    formData.set('newPassword', newPassword)
    formData.set('newPasswordRepeat', newPasswordRepeat)

    const result = await resetPasswordAction(formData)

    if (result?.error) {
      showError('Error al restablecer contraseña', result.error)
      setLoading(false)
    } else if (result?.success) {
      setSuccess(true)
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <div className="rounded-lg bg-destructive/10 p-4">
          <p className="text-foreground font-medium">Este enlace es invalido o esta incompleto.</p>
        </div>
        <Link href="/forgot-password">
          <Button variant="outline" className="w-full bg-transparent">
            Pedir un nuevo enlace
          </Button>
        </Link>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <div className="rounded-lg bg-primary/10 p-4">
          <p className="text-foreground font-medium">Tu contraseña fue actualizada.</p>
        </div>
        <Button className="w-full" onClick={() => router.push('/login')}>
          Ir al login
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="newPassword">Nueva contraseña</Label>
        <div className="relative">
          <Input
            id="newPassword"
            type={showPassword ? 'text' : 'password'}
            placeholder="Minimo 8 caracteres"
            required
            minLength={8}
            autoComplete="new-password"
            disabled={loading}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="pr-10"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-50"
            onClick={() => setShowPassword((prev) => !prev)}
            disabled={loading}
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="newPasswordRepeat">Repetir nueva contraseña</Label>
        <Input
          id="newPasswordRepeat"
          type={showPassword ? 'text' : 'password'}
          required
          minLength={8}
          autoComplete="new-password"
          disabled={loading}
          value={newPasswordRepeat}
          onChange={(e) => setNewPasswordRepeat(e.target.value)}
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        Restablecer contraseña
      </Button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-white/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-foreground">Restablecer contraseña</CardTitle>
          <CardDescription className="text-muted-foreground">Elegi tu nueva contraseña</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<p className="text-sm text-muted-foreground text-center">Cargando...</p>}>
            <ResetPasswordForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  )
}
