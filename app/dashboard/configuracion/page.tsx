'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Settings, LockKeyhole, Bell } from 'lucide-react'

import { getCurrentUser, updateMyProfile, changeMyPassword } from '@/app/actions/auth'
import {
  getPushNotificationsSettings,
  updatePushNotificationsSettings,
  savePushSubscription,
  deletePushSubscription,
  type PushNotificationsSettings,
} from '@/app/actions/notifications'
import { urlBase64ToUint8Array } from '@/lib/push-utils'
import { useErrorToast } from '@/components/error-toast-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
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
  const [savingNotifications, setSavingNotifications] = useState<boolean>(false)

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

  const [notifications, setNotifications] = useState<PushNotificationsSettings>({
    newMatch: false,
    matchCancelled: false,
    matchFilled: false,
    matchChanges: false,
    cancellation: false,
    paymentReminder: false,
    reminder: false,
    reminderTime: 60,
  })

  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null)

  // Register service worker on mount and track permission status
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushPermission('unsupported')
      return
    }

    setPushPermission(Notification.permission)

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        swRegistrationRef.current = reg
      })
      .catch((err) => {
        console.error('SW registration failed:', err)
      })
  }, [])

  /**
   * Request push permission + subscribe and save to server.
   * Returns true if the subscription was saved successfully.
   */
  const subscribeToPush = useCallback(async (): Promise<boolean> => {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) {
      console.error('Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY')
      showError('Error', 'El servidor no tiene configuradas las claves VAPID para push')
      return false
    }

    const permission = await Notification.requestPermission()
    setPushPermission(permission)

    if (permission !== 'granted') {
      showError('Permiso denegado', 'Habilitá las notificaciones en la configuración del navegador para recibir avisos')
      return false
    }

    const reg = swRegistrationRef.current ?? (await navigator.serviceWorker.ready)
    swRegistrationRef.current = reg

    let subscription = await reg.pushManager.getSubscription()
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
    }

    const subJson = subscription.toJSON()
    const result = await savePushSubscription({
      endpoint: subscription.endpoint,
      p256dh: subJson.keys?.p256dh ?? '',
      auth: subJson.keys?.auth ?? '',
    })

    if (result.error) {
      showError('Error', result.error)
      return false
    }
    return true
  }, [showError])

  /**
   * Unsubscribe from push and remove subscription from server.
   */
  const unsubscribeFromPush = useCallback(async (): Promise<void> => {
    try {
      const reg = swRegistrationRef.current ?? (await navigator.serviceWorker.ready)
      const subscription = await reg.pushManager.getSubscription()
      if (subscription) {
        await deletePushSubscription(subscription.endpoint)
        await subscription.unsubscribe()
      }
    } catch (err) {
      console.error('Error unsubscribing from push:', err)
    }
  }, [])

  useEffect(() => {
    setLoadingUser(true)
    Promise.all([getCurrentUser(), getPushNotificationsSettings()])
      .then(([u, notifSettings]) => {
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
        if (notifSettings) {
          setNotifications(notifSettings)
        }
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

  async function handleSaveNotifications(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setSavingNotifications(true)
    try {
      const anyEnabled =
        notifications.newMatch ||
        notifications.matchCancelled ||
        notifications.matchFilled ||
        notifications.matchChanges ||
        notifications.cancellation ||
        notifications.paymentReminder ||
        notifications.reminder

      // If any notification is enabled, request permission + subscribe
      if (anyEnabled && pushPermission !== 'unsupported') {
        const ok = await subscribeToPush()
        if (!ok) {
          // Permission denied or subscription failed — don't save settings
          setSavingNotifications(false)
          return
        }
      }

      // If all notifications disabled, unsubscribe
      if (!anyEnabled && pushPermission !== 'unsupported') {
        await unsubscribeFromPush()
      }

      const fd = new FormData()
      fd.set('newMatch', String(notifications.newMatch))
      fd.set('matchCancelled', String(notifications.matchCancelled))
      fd.set('matchFilled', String(notifications.matchFilled))
      fd.set('matchChanges', String(notifications.matchChanges))
      fd.set('cancellation', String(notifications.cancellation))
      fd.set('paymentReminder', String(notifications.paymentReminder))
      fd.set('reminder', String(notifications.reminder))
      fd.set('reminderTime', String(notifications.reminderTime))

      const result = await updatePushNotificationsSettings(fd)
      if (result?.error) {
        showError('Error al guardar notificaciones', result.error)
        return
      }
    } catch (e: unknown) {
      console.error(e)
      showError('Error al guardar notificaciones')
    } finally {
      setSavingNotifications(false)
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
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notificaciones push
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Elegí qué notificaciones querés recibir.
          </CardDescription>
          {pushPermission === 'unsupported' && (
            <p className="text-xs text-yellow-500 mt-1">
              Tu navegador no soporta notificaciones push.
            </p>
          )}
          {pushPermission === 'denied' && (
            <p className="text-xs text-red-500 mt-1">
              Las notificaciones están bloqueadas. Habilitálas en la configuración del navegador.
            </p>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveNotifications} className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="notif-new-match">Nuevo partido creado</Label>
                <p className="text-xs text-muted-foreground">Cuando se crea un nuevo partido</p>
              </div>
              <Switch
                id="notif-new-match"
                disabled={loadingUser || savingNotifications}
                checked={notifications.newMatch}
                onCheckedChange={(v) => setNotifications((n) => ({ ...n, newMatch: v }))}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="notif-match-cancelled">Partido cancelado</Label>
                <p className="text-xs text-muted-foreground">Cuando se cancela un partido</p>
              </div>
              <Switch
                id="notif-match-cancelled"
                disabled={loadingUser || savingNotifications}
                checked={notifications.matchCancelled}
                onCheckedChange={(v) => setNotifications((n) => ({ ...n, matchCancelled: v }))}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="notif-match-filled">Partido lleno</Label>
                <p className="text-xs text-muted-foreground">Cuando se completan los cupos de un partido</p>
              </div>
              <Switch
                id="notif-match-filled"
                disabled={loadingUser || savingNotifications}
                checked={notifications.matchFilled}
                onCheckedChange={(v) => setNotifications((n) => ({ ...n, matchFilled: v }))}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="notif-match-changes">Cambios en el partido</Label>
                <p className="text-xs text-muted-foreground">Cuando cambian horario, lugar u otros datos del partido</p>
              </div>
              <Switch
                id="notif-match-changes"
                disabled={loadingUser || savingNotifications}
                checked={notifications.matchChanges}
                onCheckedChange={(v) => setNotifications((n) => ({ ...n, matchChanges: v }))}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="notif-cancellation">Baja de jugador</Label>
                <p className="text-xs text-muted-foreground">Cuando alguien se da de baja de un partido en el que estás anotado</p>
              </div>
              <Switch
                id="notif-cancellation"
                disabled={loadingUser || savingNotifications}
                checked={notifications.cancellation}
                onCheckedChange={(v) => setNotifications((n) => ({ ...n, cancellation: v }))}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="notif-reminder">Recordatorio de partido</Label>
                <p className="text-xs text-muted-foreground">Un aviso antes de que empiece el partido</p>
              </div>
              <Switch
                id="notif-reminder"
                disabled={loadingUser || savingNotifications}
                checked={notifications.reminder}
                onCheckedChange={(v) => setNotifications((n) => ({ ...n, reminder: v }))}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="notif-payment-reminder">Recordatorio de pago</Label>
                <p className="text-xs text-muted-foreground">Cuánto le debés al creador del partido</p>
              </div>
              <Switch
                id="notif-payment-reminder"
                disabled={loadingUser || savingNotifications}
                checked={notifications.paymentReminder}
                onCheckedChange={(v) => setNotifications((n) => ({ ...n, paymentReminder: v }))}
              />
            </div>

            {notifications.reminder && (
              <div className="flex flex-col gap-2 pl-1">
                <Label htmlFor="notif-reminder-time">Minutos antes del partido</Label>
                <Input
                  id="notif-reminder-time"
                  type="number"
                  min={5}
                  max={1440}
                  disabled={loadingUser || savingNotifications}
                  value={notifications.reminderTime}
                  onChange={(e) =>
                    setNotifications((n) => ({ ...n, reminderTime: Number(e.target.value) || 60 }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Entre 5 y 1440 minutos (24 hs)
                </p>
              </div>
            )}

            <Button type="submit" className="gap-2" disabled={loadingUser || savingNotifications}>
              <Save className="w-4 h-4" />
              Guardar notificaciones
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
