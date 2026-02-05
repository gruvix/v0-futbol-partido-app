'use client'

import React from "react"
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { login } from '@/app/actions/auth'
import { LoadingOverlay } from '@/components/football-loader'

const STORAGE_KEY_NAME = 'fulbito_login_name'
const STORAGE_KEY_PHONE = 'fulbito_login_phone'

export default function LoginPage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [phoneLast4, setPhoneLast4] = useState('')
  const router = useRouter()
  
  const nameInputRef = useRef<HTMLInputElement>(null)
  const phoneInputRef = useRef<HTMLInputElement>(null)
  const passwordInputRef = useRef<HTMLInputElement>(null)

  // Load saved values from localStorage on mount
  useEffect(() => {
    const savedName = localStorage.getItem(STORAGE_KEY_NAME)
    const savedPhone = localStorage.getItem(STORAGE_KEY_PHONE)
    if (savedName) setName(savedName)
    if (savedPhone) setPhoneLast4(savedPhone)
  }, [])

  // Save values to localStorage when they change
  useEffect(() => {
    if (name) localStorage.setItem(STORAGE_KEY_NAME, name)
  }, [name])

  useEffect(() => {
    if (phoneLast4) localStorage.setItem(STORAGE_KEY_PHONE, phoneLast4)
  }, [phoneLast4])

  // Keyboard navigation: Enter moves focus to next field
  function handleNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      phoneInputRef.current?.focus()
    }
  }

  function handlePhoneKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      passwordInputRef.current?.focus()
    }
  }

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
      {loading && <LoadingOverlay message="Iniciando sesion..." />}
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-foreground">Fulbito</CardTitle>
          <CardDescription className="text-muted-foreground">
            Organiza partidos con tus amigos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Combined identifier: Name + Last 4 digits side by side */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Identificacion</Label>
              <div className="flex items-center">
                <Input
                  ref={nameInputRef}
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Tu nombre"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleNameKeyDown}
                  required
                  autoComplete="username"
                  disabled={loading}
                  className="rounded-r-none border-r-0 flex-1"
                />
                <div className="flex items-center justify-center px-2 h-9 border-y border-border bg-muted text-muted-foreground text-sm select-none">
                  -
                </div>
                <Input
                  ref={phoneInputRef}
                  id="phoneLast4"
                  name="phoneLast4"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  placeholder="1234"
                  value={phoneLast4}
                  onChange={(e) => setPhoneLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  onKeyDown={handlePhoneKeyDown}
                  required
                  disabled={loading}
                  className="rounded-l-none border-l-0 w-20"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Nombre + ultimos 4 digitos del celular
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                ref={passwordInputRef}
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
              Entrar
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
