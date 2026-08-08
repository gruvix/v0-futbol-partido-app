import React, { Suspense } from 'react'
import Link from 'next/link'

import { confirmEmailChange } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

async function ConfirmEmailResult({ token }: { token: string }): Promise<React.JSX.Element> {
  try {
    await confirmEmailChange(token)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al confirmar el email'
    return (
      <div className="flex flex-col gap-4 text-center">
        <div className="rounded-lg bg-destructive/10 p-4">
          <p className="text-foreground font-medium">{message}</p>
        </div>
        <Link href="/login">
          <Button variant="outline" className="w-full bg-transparent">
            Ir al login
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 text-center">
      <div className="rounded-lg bg-primary/10 p-4">
        <p className="text-foreground font-medium">Tu email fue actualizado correctamente.</p>
        <p className="text-sm text-muted-foreground mt-2">
          Por seguridad cerramos tus sesiones. Volvé a iniciar sesión con tu nuevo email.
        </p>
      </div>
      <Link href="/login">
        <Button className="w-full">Ir al login</Button>
      </Link>
    </div>
  )
}

export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}): Promise<React.JSX.Element> {
  const { token } = await searchParams

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
          {!token ? (
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
          ) : (
            <Suspense fallback={<p className="text-sm text-muted-foreground text-center">Confirmando tu nuevo email...</p>}>
              <ConfirmEmailResult token={token} />
            </Suspense>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
