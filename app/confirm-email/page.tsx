'use client'

import React, { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { confirmEmailChangeAction } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function ConfirmEmailContent(): React.JSX.Element {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token') ?? ''
  const startedRef = useRef(false)

  const [loading, setLoading] = useState(Boolean(token))
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token || startedRef.current) return
    startedRef.current = true

    confirmEmailChangeAction(token)
      .then((result) => {
        if (result?.error) {
          setError(result.error)
          return
        }
        setSuccess(true)
      })
      .catch(() => {
        setError('Error al confirmar el email')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [token])

  if (!token) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <div className="rounded-lg bg-destructive/10 p-4">
          <p className="text-foreground font-medium">Este enlace es invalido o esta incompleto.</p>
        </div>
        <Link href="/dashboard/configuracion">
          <Button variant="outline" className="w-full bg-transparent">
            Ir a configuracion
          </Button>
        </Link>
      </div>
    )
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground text-center">Confirmando tu nuevo email...</p>
  }

  if (success) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <div className="rounded-lg bg-primary/10 p-4">
          <p className="text-foreground font-medium">Tu email fue actualizado correctamente.</p>
        </div>
        <Button className="w-full" onClick={() => router.push('/dashboard/configuracion')}>
          Ir a configuracion
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 text-center">
      <div className="rounded-lg bg-destructive/10 p-4">
        <p className="text-foreground font-medium">{error ?? 'No se pudo confirmar el email.'}</p>
      </div>
      <Link href="/dashboard/configuracion">
        <Button variant="outline" className="w-full bg-transparent">
          Volver a configuracion
        </Button>
      </Link>
    </div>
  )
}

export default function ConfirmEmailPage(): React.JSX.Element {
  return (
    <main className="min-h-screen flex items-center justify-center bg-white/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-foreground">Confirmar email</CardTitle>
          <CardDescription className="text-muted-foreground">
            Estamos validando tu nuevo email
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<p className="text-sm text-muted-foreground text-center">Cargando...</p>}>
            <ConfirmEmailContent />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  )
}
