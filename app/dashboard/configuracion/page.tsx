'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Settings, LockKeyhole } from 'lucide-react'

import { getCurrentUser, updateMyProfile, changeMyPassword } from '@/app/actions/auth'
import { savePixelAvatar, getMyPixelAvatar } from '@/app/actions/avatar'
import { useErrorToast } from '@/components/error-toast-provider'
import { PixelAvatarEditor } from '@/components/pixel-avatar-editor'
import { PixelAvatar } from '@/components/pixel-avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { UserGender } from '@/lib/auth'

type ProfileFormState = {
  name: string
  lastName: string
  phoneLast4: string
  gender: UserGender
}

type PasswordFormState = {
  currentPassword: string
  newPassword: string
  newPasswordRepeat: string
}

function setAlnumCustomValidity(input: HTMLInputElement, label: string): void {
  if (!input.value) {
    input.setCustomValidity('')
    return
  }
  input.setCustomValidity(/^[a-z0-9]+$/i.test(input.value) ? '' : `${label} solo puede contener letras y numeros (sin espacios ni simbolos)`)
}

export default function ConfiguracionPage(): React.JSX.Element {
  const router = useRouter()
  const { showError } = useErrorToast()

  const [loadingUser, setLoadingUser] = useState<boolean>(true)
  const [savingProfile, setSavingProfile] = useState<boolean>(false)
  const [savingPassword, setSavingPassword] = useState<boolean>(false)
  const [savingAvatar, setSavingAvatar] = useState<boolean>(false)
  const [avatarData, setAvatarData] = useState<string | null>(null)

  const [profile, setProfile] = useState<ProfileFormState>({
    name: '',
    lastName: '',
    phoneLast4: '',
    gender: 'MALE',
  })

  const [passwords, setPasswords] = useState<PasswordFormState>({
    currentPassword: '',
    newPassword: '',
    newPasswordRepeat: '',
  })

  useEffect(() => {
    setLoadingUser(true)
    Promise.all([getCurrentUser(), getMyPixelAvatar()])
      .then(([u, avatar]) => {
        if (!u) {
          router.push('/login')
          return
        }
        setProfile({
          name: u.name ?? '',
          lastName: u.lastName ?? '',
          phoneLast4: u.phoneLast4 ?? '',
          gender: (u.gender ?? 'MALE') as UserGender,
        })
        setAvatarData(avatar)
      })
      .catch((e: unknown) => {
        console.error(e)
        showError('Error', 'No se pudo cargar tu usuario')
      })
      .finally(() => {
        setLoadingUser(false)
      })
  }, [router, showError])

  const profileDirty = useMemo(() => {
    // Without storing an initial snapshot we can approximate: if any field is empty we still allow save.
    // Real dirty state isn't required, but helps disable save when loading.
    return Boolean(profile.name || profile.lastName || profile.phoneLast4)
  }, [profile.lastName, profile.name, profile.phoneLast4])

  async function handleSaveProfile(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const fd = new FormData()
      // Name is case-insensitive: keep it normalized.
      fd.set('name', profile.name.trim().toLowerCase())
      fd.set('lastName', profile.lastName.trim())
      fd.set('phoneLast4', profile.phoneLast4)
      fd.set('gender', profile.gender)

      const result = await updateMyProfile(fd)
      if (result?.error) {
        showError('Error al guardar', result.error)
        return
      }

      // Refresh server components that depend on session user name.
      router.refresh()
    } catch (e: unknown) {
      console.error(e)
      showError('Error al guardar')
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleSaveAvatar(data: string): Promise<void> {
    setSavingAvatar(true)
    try {
      const result = await savePixelAvatar(data)
      if (result?.error) {
        showError('Error al guardar avatar', result.error)
        return
      }
      setAvatarData(data)
    } catch (e: unknown) {
      console.error(e)
      showError('Error al guardar avatar')
    } finally {
      setSavingAvatar(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setSavingPassword(true)
    try {
      const fd = new FormData()
      fd.set('currentPassword', passwords.currentPassword)
      fd.set('newPassword', passwords.newPassword)
      fd.set('newPasswordRepeat', passwords.newPasswordRepeat)

      const result = await changeMyPassword(fd)
      if (result?.error) {
        showError('Error al cambiar contraseña', result.error)
        return
      }

      setPasswords({ currentPassword: '', newPassword: '', newPasswordRepeat: '' })
    } catch (e: unknown) {
      console.error(e)
      showError('Error al cambiar contraseña')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <Link href="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ArrowLeft className="w-4 h-4" />
        Volver
      </Link>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Configuración
        </h1>
        <p className="text-sm text-muted-foreground">Actualizá tus datos y tu contraseña</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-foreground">Perfil</CardTitle>
          <CardDescription className="text-muted-foreground">
            Tu identificación es <span className="font-medium">Nombre + últimos 4 dígitos</span>. Si lo cambiás, debe seguir siendo único.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                name="name"
                type="text"
                required
                autoComplete="name"
                disabled={loadingUser || savingProfile}
                value={profile.name}
                pattern="[A-Za-z0-9]+"
                onInvalid={(e) => setAlnumCustomValidity(e.currentTarget, 'Nombre')}
                onInput={(e) => setAlnumCustomValidity(e.currentTarget, 'Nombre')}
                onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="lastName">Apellido</Label>
              <Input
                id="lastName"
                name="lastName"
                type="text"
                required
                autoComplete="family-name"
                disabled={loadingUser || savingProfile}
                value={profile.lastName}
                pattern="[A-Za-z0-9]+"
                onInvalid={(e) => setAlnumCustomValidity(e.currentTarget, 'Apellido')}
                onInput={(e) => setAlnumCustomValidity(e.currentTarget, 'Apellido')}
                onChange={(e) => setProfile((p) => ({ ...p, lastName: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="phoneLast4">Últimos 4 dígitos del celular</Label>
              <Input
                id="phoneLast4"
                name="phoneLast4"
                type="text"
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                required
                disabled={loadingUser || savingProfile}
                value={profile.phoneLast4}
                onChange={(e) => setProfile((p) => ({ ...p, phoneLast4: e.target.value }))}
                onInvalid={(e) => e.currentTarget.setCustomValidity('Ingresá exactamente 4 dígitos numéricos')}
                onInput={(e) => e.currentTarget.setCustomValidity('')}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Género</Label>
              <RadioGroup
                value={profile.gender}
                onValueChange={(v) => setProfile((p) => ({ ...p, gender: v as UserGender }))}
                className="flex flex-col gap-2"
              >
                <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                  <RadioGroupItem value="MALE" id="gender-male" />
                  <span className="text-sm text-foreground">Masculino</span>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                  <RadioGroupItem value="FEMALE" id="gender-female" />
                  <span className="text-sm text-foreground">Femenino</span>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                  <RadioGroupItem value="OTHER" id="gender-other" />
                  <span className="text-sm text-foreground">Otro / no binario</span>
                </label>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                Este campo se usa para mejorar el balanceo al armar equipos.
              </p>
            </div>

            {/* errors are shown via ErrorToastProvider */}

            <Button type="submit" className="gap-2" disabled={loadingUser || savingProfile || !profileDirty}>
              <Save className="w-4 h-4" />
              Guardar cambios
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <PixelAvatar data={avatarData} size={20} />
            Avatar
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Pintá tu avatar pixel art de 16×16. Se mostrará en la cancha cuando te sumés a un partido.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingUser ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : (
            <PixelAvatarEditor
              initialData={avatarData}
              onSave={handleSaveAvatar}
              saving={savingAvatar}
            />
          )}
        </CardContent>
      </Card>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <LockKeyhole className="w-4 h-4" />
            Contraseña
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Para cambiarla, ingresá tu contraseña actual y repetí la nueva.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="currentPassword">Contraseña actual</Label>
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
                disabled={loadingUser || savingPassword}
                value={passwords.currentPassword}
                onChange={(e) => setPasswords((p) => ({ ...p, currentPassword: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="newPassword">Nueva contraseña</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                disabled={loadingUser || savingPassword}
                value={passwords.newPassword}
                onChange={(e) => setPasswords((p) => ({ ...p, newPassword: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Debe tener al menos 8 caracteres</p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="newPasswordRepeat">Repetir nueva contraseña</Label>
              <Input
                id="newPasswordRepeat"
                name="newPasswordRepeat"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                disabled={loadingUser || savingPassword}
                value={passwords.newPasswordRepeat}
                onChange={(e) => setPasswords((p) => ({ ...p, newPasswordRepeat: e.target.value }))}
              />
            </div>

            {/* errors are shown via ErrorToastProvider */}

            <Button type="submit" className="gap-2" disabled={loadingUser || savingPassword}>
              <Save className="w-4 h-4" />
              Cambiar contraseña
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
