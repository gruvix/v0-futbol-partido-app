'use client'

import React from 'react'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { login } from '@/app/actions/auth'
import { LoadingOverlay } from '@/components/football-loader'
import { useErrorToast } from '@/components/error-toast-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff } from 'lucide-react'

const STORAGE_KEY_REMEMBER = 'fulbito_login_remember'
const STORAGE_KEY_CREDENTIALS = 'fulbito_login_credentials_v1'

type RememberedCredentials = {
  name: string
  phoneLast4: string
  password: string
}

function safeParseCredentials(raw: string | null): RememberedCredentials | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null

    const obj = parsed as Record<string, unknown>
    const name = typeof obj.name === 'string' ? obj.name : ''
    const phoneLast4 = typeof obj.phoneLast4 === 'string' ? obj.phoneLast4 : ''
    const password = typeof obj.password === 'string' ? obj.password : ''

    return { name, phoneLast4, password }
  } catch {
    return null
  }
}

export function LoginForm(): React.JSX.Element {
  const [loading, setLoading] = useState<boolean>(false)
  const [name, setName] = useState<string>('')
  const [phoneLast4, setPhoneLast4] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [remember, setRemember] = useState<boolean>(false)
  const [showPassword, setShowPassword] = useState<boolean>(false)

  const previousRememberRef = useRef<boolean>(false)

  const router = useRouter()
  const { showError } = useErrorToast()

  const nameInputRef = useRef<HTMLInputElement>(null)
  const phoneInputRef = useRef<HTMLInputElement>(null)
  const passwordInputRef = useRef<HTMLInputElement>(null)

  // Load saved values from localStorage on mount
  useEffect(() => {
    const rememberEnabled = localStorage.getItem(STORAGE_KEY_REMEMBER) === '1'

    // Legacy keys (before remember checkbox existed)
    const legacyName = localStorage.getItem('fulbito_login_name')
    const legacyPhone = localStorage.getItem('fulbito_login_phone')
    const hasLegacy = Boolean(legacyName || legacyPhone)

    const savedCredentials = safeParseCredentials(localStorage.getItem(STORAGE_KEY_CREDENTIALS))

    // Only restore password if the user explicitly enabled "remember".
    if (rememberEnabled) {
      setRemember(true)
      if (savedCredentials) {
        setName(savedCredentials.name)
        setPhoneLast4(savedCredentials.phoneLast4)
        setPassword(savedCredentials.password)
      }
      return
    }

    // Backwards compatibility: older versions saved name/phone automatically.
    // We still prefill them, but we DO NOT enable "remember" automatically.
    if (hasLegacy) {
      if (legacyName) setName(legacyName)
      if (legacyPhone) setPhoneLast4(legacyPhone)
    }
  }, [])

  // Save values to localStorage when they change (ONLY when remember is enabled)
  useEffect(() => {
    if (remember) {
      localStorage.setItem(STORAGE_KEY_REMEMBER, '1')
      const credentials: RememberedCredentials = { name, phoneLast4, password }
      localStorage.setItem(STORAGE_KEY_CREDENTIALS, JSON.stringify(credentials))

      // Keep legacy keys updated for backwards-compat with older deployments.
      localStorage.setItem('fulbito_login_name', name)
      localStorage.setItem('fulbito_login_phone', phoneLast4)
      previousRememberRef.current = true
    } else if (previousRememberRef.current) {
      localStorage.removeItem(STORAGE_KEY_REMEMBER)
      localStorage.removeItem(STORAGE_KEY_CREDENTIALS)
      localStorage.removeItem('fulbito_login_name')
      localStorage.removeItem('fulbito_login_phone')

      previousRememberRef.current = false
    }
  }, [remember, name, phoneLast4, password])

  // Keyboard navigation: Enter moves focus to next field
  function handleNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      e.preventDefault()
      phoneInputRef.current?.focus()
    }
  }

  function handlePhoneKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      e.preventDefault()
      passwordInputRef.current?.focus()
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    // Username is case-insensitive: always normalize to lowercase before sending.
    const rawName = (formData.get('name') as string | null) ?? ''
    formData.set('name', rawName.trim().toLowerCase())
    const result = await login(formData)

    if (result?.error) {
      showError('Error al iniciar sesion', result.error)
      setLoading(false)
    } else if (result?.redirect) {
      router.push(result.redirect)
      router.refresh()
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-white/40 p-4">
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
                  onChange={(e) => setPhoneLast4(e.target.value)}
                  onKeyDown={handlePhoneKeyDown}
                  required
                  disabled={loading}
                  className="rounded-l-none border-l-0 w-20"
                  onInvalid={(e) =>
                    e.currentTarget.setCustomValidity('Ingresá exactamente 4 dígitos numéricos')
                  }
                  onInput={(e) =>
                    e.currentTarget.setCustomValidity('')
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Nombre + ultimos 4 digitos del celular
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  ref={passwordInputRef}
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Tu contraseña"
                  required
                  autoComplete="current-password"
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-50"
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={loading}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-muted-foreground select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                disabled={loading}
                className="h-4 w-4 accent-primary"
              />
              Recordar credenciales
            </label>

            {/* errors are shown via ErrorToastProvider */}

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
