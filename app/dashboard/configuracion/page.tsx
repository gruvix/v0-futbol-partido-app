'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Settings, LockKeyhole, Bell, Mail, ChevronDown, User, Loader2 } from 'lucide-react'

import { getCurrentUser, updateMyProfile, changeMyPassword, addEmailToProfile, requestEmailChangeAction } from '@/app/actions/auth'
import {
  getPushNotificationsSettings,
  updatePushNotificationsSettings,
  deletePushSubscription,
  type PushNotificationsSettings,
} from '@/app/actions/notifications'
import { syncPushSubscription, isAnyPushSettingEnabled, canUsePushNotifications } from '@/lib/push-client'
import { cn } from '@/lib/utils'
import { savePixelAvatar, getMyPixelAvatar } from '@/app/actions/avatar'
import { useErrorToast } from '@/components/error-toast-provider'
import { PixelAvatarEditor } from '@/components/pixel-avatar-editor'
import { PixelAvatar } from '@/components/pixel-avatar'
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

type SectionId = 'perfil' | 'avatar' | 'email' | 'password' | 'notifications'

type NotificationFieldKey =
  | 'master'
  | 'newMatch'
  | 'matchCancelled'
  | 'matchFilled'
  | 'matchChanges'
  | 'cancellation'
  | 'reminder'
  | 'reminderTime'

function AnimatedCollapse({
  open,
  children,
}: {
  open: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows] duration-300 ease-in-out',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  )
}

function NotificationSwitchRow({
  id,
  label,
  description,
  checked,
  disabled,
  saving,
  onCheckedChange,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  disabled: boolean
  saving: boolean
  onCheckedChange: (checked: boolean) => void
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" aria-hidden="true" />}
        <Switch
          id={id}
          disabled={disabled || saving}
          checked={checked}
          onCheckedChange={onCheckedChange}
        />
      </div>
    </div>
  )
}

type SettingsSectionProps = {
  id: SectionId
  activeSection: SectionId | null
  onToggle: (id: SectionId) => void
  icon: React.ReactNode
  title: string
  description?: React.ReactNode
  extra?: React.ReactNode
  children: React.ReactNode
}

function SettingsSection({
  id,
  activeSection,
  onToggle,
  icon,
  title,
  description,
  extra,
  children,
}: SettingsSectionProps): React.JSX.Element {
  const isOpen = activeSection === id

  return (
    <Card className="max-w-lg">
      <CardHeader
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        onClick={() => onToggle(id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle(id)
          }
        }}
        className="cursor-pointer select-none"
      >
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-foreground flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          <ChevronDown
            className={cn(
              'w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-300 ease-in-out',
              isOpen && 'rotate-180',
            )}
          />
        </div>
        {description && <CardDescription className="text-muted-foreground">{description}</CardDescription>}
        {extra}
      </CardHeader>
      <AnimatedCollapse open={isOpen}>
        <CardContent>{children}</CardContent>
      </AnimatedCollapse>
    </Card>
  )
}

export default function ConfiguracionPage(): React.JSX.Element {
  const router = useRouter()
  const { showError } = useErrorToast()

  const [activeSection, setActiveSection] = useState<SectionId | null>(null)
  const [loadingUser, setLoadingUser] = useState<boolean>(true)
  const [savingProfile, setSavingProfile] = useState<boolean>(false)
  const [savingPassword, setSavingPassword] = useState<boolean>(false)
  const [savingEmail, setSavingEmail] = useState<boolean>(false)
  const [savingNotificationKey, setSavingNotificationKey] = useState<NotificationFieldKey | null>(null)
  const [savingAvatar, setSavingAvatar] = useState<boolean>(false)
  const [avatarData, setAvatarData] = useState<string | null>(null)
  const [email, setEmail] = useState<string>('')
  const [savedEmail, setSavedEmail] = useState<string | null>(null)
  const [newEmail, setNewEmail] = useState<string>('')
  const [confirmEmail, setConfirmEmail] = useState<string>('')
  const [emailSaved, setEmailSaved] = useState<boolean>(false)
  const [emailChangeSent, setEmailChangeSent] = useState<boolean>(false)

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
    reminder: false,
    reminderTime: 60,
  })
  const [showAdvancedNotifications, setShowAdvancedNotifications] = useState<boolean>(false)
  const [mobilePushAvailable, setMobilePushAvailable] = useState<boolean>(false)

  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [requestingPermission, setRequestingPermission] = useState<boolean>(false)
  const [pushJustActivated, setPushJustActivated] = useState<boolean>(false)
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null)
  const reminderTimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Register service worker on mount and track permission status (phones only)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const available = canUsePushNotifications()
    setMobilePushAvailable(available)

    if (!available) {
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
    const result = await syncPushSubscription(true)
    setPushPermission(Notification.permission)

    if (result.status === 'ok') return true

    if (result.status === 'denied' || result.status === 'needs_permission') {
      showError('Permiso denegado', 'Habilitá las notificaciones en la configuración del navegador para recibir avisos')
      return false
    }

    if (result.status === 'error') {
      showError('Error', result.message)
      return false
    }

    return false
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

    Promise.all([
      getCurrentUser(),
      getPushNotificationsSettings(),
      getMyPixelAvatar(),
    ])
      .then(([u, notifSettings, avatar]) => {
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
        setEmail(u.email ?? '')
        setSavedEmail(u.email ?? null)

        if (notifSettings) {
          setNotifications(notifSettings)
        }

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

  useEffect(() => {
    return () => {
      if (reminderTimeDebounceRef.current) clearTimeout(reminderTimeDebounceRef.current)
    }
  }, [])

  const anyNotificationEnabled = useMemo(
    () =>
      notifications.newMatch ||
      notifications.matchCancelled ||
      notifications.matchFilled ||
      notifications.matchChanges ||
      notifications.cancellation ||
      notifications.reminder,
    [notifications],
  )

  function handleToggleAllNotifications(enabled: boolean): void {
    const next: PushNotificationsSettings = {
      ...notifications,
      newMatch: enabled,
      matchCancelled: enabled,
      matchFilled: enabled,
      matchChanges: enabled,
      cancellation: enabled,
      reminder: enabled,
    }
    setNotifications(next)
    void persistNotificationSettings(next, 'master')
  }

  async function persistNotificationSettings(
    settings: PushNotificationsSettings,
    savingKey: NotificationFieldKey,
  ): Promise<boolean> {
    const anyEnabled = isAnyPushSettingEnabled(settings)

    setSavingNotificationKey(savingKey)
    try {
      if (anyEnabled && pushPermission !== 'unsupported') {
        const ok = await subscribeToPush()
        if (!ok) {
          const fresh = await getPushNotificationsSettings()
          if (fresh) setNotifications(fresh)
          return false
        }
      }

      if (!anyEnabled && pushPermission !== 'unsupported') {
        await unsubscribeFromPush()
      }

      const fd = new FormData()
      fd.set('newMatch', String(settings.newMatch))
      fd.set('matchCancelled', String(settings.matchCancelled))
      fd.set('matchFilled', String(settings.matchFilled))
      fd.set('matchChanges', String(settings.matchChanges))
      fd.set('cancellation', String(settings.cancellation))
      fd.set('reminder', String(settings.reminder))
      fd.set('reminderTime', String(settings.reminderTime))

      const result = await updatePushNotificationsSettings(fd)
      if (result?.error) {
        showError('Error al guardar notificaciones', result.error)
        const fresh = await getPushNotificationsSettings()
        if (fresh) setNotifications(fresh)
        return false
      }
      return true
    } catch (e: unknown) {
      console.error(e)
      showError('Error al guardar notificaciones')
      const fresh = await getPushNotificationsSettings()
      if (fresh) setNotifications(fresh)
      return false
    } finally {
      setSavingNotificationKey(null)
    }
  }

  function handleNotificationFieldChange(
    key: keyof PushNotificationsSettings,
    value: boolean,
    fieldKey: NotificationFieldKey,
  ): void {
    const next = { ...notifications, [key]: value }
    setNotifications(next)
    void persistNotificationSettings(next, fieldKey)
  }

  function handleReminderTimeChange(value: number): void {
    const next = { ...notifications, reminderTime: value }
    setNotifications(next)

    if (reminderTimeDebounceRef.current) clearTimeout(reminderTimeDebounceRef.current)
    reminderTimeDebounceRef.current = setTimeout(() => {
      void persistNotificationSettings(next, 'reminderTime')
    }, 500)
  }

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

  async function handleRequestEmailChange(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setSavingEmail(true)
    setEmailChangeSent(false)
    try {
      const fd = new FormData()
      fd.set('newEmail', newEmail.trim())
      fd.set('confirmEmail', confirmEmail.trim())

      const result = await requestEmailChangeAction(fd)
      if (result?.error) {
        showError('Error al cambiar email', result.error)
        return
      }
      setEmailChangeSent(true)
      setNewEmail('')
      setConfirmEmail('')
    } catch (e: unknown) {
      console.error(e)
      showError('Error al cambiar email')
    } finally {
      setSavingEmail(false)
    }
  }

  async function handleSaveEmail(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setSavingEmail(true)
    setEmailSaved(false)
    try {
      const fd = new FormData()
      fd.set('email', email.trim())

      const result = await addEmailToProfile(fd)
      if (result?.error) {
        showError('Error al guardar email', result.error)
        return
      }
      setEmailSaved(true)
      setSavedEmail(email.trim())
      router.refresh()
    } catch (e: unknown) {
      console.error(e)
      showError('Error al guardar email')
    } finally {
      setSavingEmail(false)
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

  function handleToggleSection(id: SectionId): void {
    setActiveSection((prev) => (prev === id ? null : id))
  }

  async function handleRequestPushPermission(): Promise<void> {
    setRequestingPermission(true)
    setPushJustActivated(false)
    try {
      const ok = await subscribeToPush()
      if (ok) {
        setPushJustActivated(true)
      }
    } finally {
      setRequestingPermission(false)
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

      <SettingsSection
        id="perfil"
        activeSection={activeSection}
        onToggle={handleToggleSection}
        icon={<User className="w-4 h-4" />}
        title="Perfil"
        description={
          <>
            Tu identificación es <span className="font-medium">Nombre + últimos 4 dígitos</span>. Si lo cambiás, debe seguir siendo único.
          </>
        }
      >
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
      </SettingsSection>

      <SettingsSection
        id="avatar"
        activeSection={activeSection}
        onToggle={handleToggleSection}
        icon={<PixelAvatar data={avatarData} size={20} />}
        title="Avatar"
        description="Pintá tu avatar pixel art de 16×16. Se mostrará en la cancha cuando te sumés a un partido."
      >
          {loadingUser ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : (
            <PixelAvatarEditor
              initialData={avatarData}
              onSave={handleSaveAvatar}
              saving={savingAvatar}
            />
          )}
      </SettingsSection>

      <SettingsSection
        id="email"
        activeSection={activeSection}
        onToggle={handleToggleSection}
        icon={<Mail className="w-4 h-4" />}
        title="Email"
        description={
          savedEmail
            ? 'Para cambiar tu email, confirmalo desde el correo nuevo. Cada email solo puede usarse en una cuenta.'
            : 'Agregalo para poder iniciar sesion con tu email y recuperar tu cuenta si olvidas la contraseña. No pedimos verificacion al cargarlo por primera vez.'
        }
      >
          {savedEmail ? (
            <form onSubmit={handleRequestEmailChange} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="current-email">Email actual</Label>
                <Input
                  id="current-email"
                  name="currentEmail"
                  type="email"
                  value={savedEmail}
                  disabled
                  readOnly
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="new-email">Nuevo email</Label>
                <Input
                  id="new-email"
                  name="newEmail"
                  type="email"
                  placeholder="nuevo@email.com"
                  required
                  autoComplete="email"
                  disabled={loadingUser || savingEmail}
                  value={newEmail}
                  onChange={(e) => {
                    setNewEmail(e.target.value)
                    setEmailChangeSent(false)
                  }}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="confirm-email">Confirmar nuevo email</Label>
                <Input
                  id="confirm-email"
                  name="confirmEmail"
                  type="email"
                  placeholder="nuevo@email.com"
                  required
                  autoComplete="email"
                  disabled={loadingUser || savingEmail}
                  value={confirmEmail}
                  onChange={(e) => {
                    setConfirmEmail(e.target.value)
                    setEmailChangeSent(false)
                  }}
                />
              </div>

              {emailChangeSent && (
                <div className="rounded-lg bg-primary/10 p-3 text-sm text-foreground">
                  Te enviamos un email de confirmacion. El cambio se aplica cuando abras el enlace desde el correo nuevo.
                </div>
              )}

              <Button
                type="submit"
                className="gap-2"
                disabled={loadingUser || savingEmail || !newEmail.trim() || !confirmEmail.trim()}
              >
                <Save className="w-4 h-4" />
                Enviar confirmacion
              </Button>
            </form>
          ) : (
          <form onSubmit={handleSaveEmail} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="tu@email.com"
                required
                autoComplete="email"
                disabled={loadingUser || savingEmail}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setEmailSaved(false)
                }}
              />
            </div>

            <Button type="submit" className="gap-2" disabled={loadingUser || savingEmail || !email.trim()}>
              <Save className="w-4 h-4" />
              {emailSaved ? 'Guardado' : 'Guardar email'}
            </Button>
          </form>
          )}
      </SettingsSection>

      <SettingsSection
        id="password"
        activeSection={activeSection}
        onToggle={handleToggleSection}
        icon={<LockKeyhole className="w-4 h-4" />}
        title="Contraseña"
        description="Para cambiarla, ingresá tu contraseña actual y repetí la nueva."
      >
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
      </SettingsSection>

      {mobilePushAvailable && (
      <SettingsSection
        id="notifications"
        activeSection={activeSection}
        onToggle={handleToggleSection}
        icon={<Bell className="w-4 h-4" />}
        title="Notificaciones push"
        description="Elegí qué notificaciones querés recibir."
        extra={
          <>
            {pushPermission === 'unsupported' && (
              <p className="text-xs text-yellow-500 mt-1">
                Tu navegador no soporta notificaciones push.
              </p>
            )}
            {anyNotificationEnabled && (pushPermission === 'denied' || pushPermission === 'default') && (
              <div className="flex flex-col gap-2 mt-1">
                <p className={`text-xs ${pushPermission === 'denied' ? 'text-red-500' : 'text-yellow-600'}`}>
                  {pushPermission === 'denied'
                    ? 'Tenés notificaciones configuradas, pero están bloqueadas en este navegador. Es posible que necesites habilitarlas manualmente desde la configuración del navegador o del sistema.'
                    : 'Tenés notificaciones configuradas, pero este navegador todavía no te pidió permiso para mostrarlas.'}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit gap-2"
                  disabled={requestingPermission}
                  onClick={(e) => {
                    e.stopPropagation()
                    void handleRequestPushPermission()
                  }}
                >
                  <Bell className="w-3.5 h-3.5" />
                  {requestingPermission ? 'Solicitando...' : 'Permitir notificaciones'}
                </Button>
                {pushJustActivated && (
                  <p className="text-xs text-primary">Listo, ya podés recibir avisos en este navegador.</p>
                )}
              </div>
            )}
          </>
        }
      >
          <div className="flex flex-col gap-4">
            <NotificationSwitchRow
              id="notif-master"
              label="Notificaciones"
              description={anyNotificationEnabled ? 'Vas a recibir avisos de tus partidos' : 'No vas a recibir avisos'}
              checked={anyNotificationEnabled}
              disabled={loadingUser}
              saving={savingNotificationKey === 'master'}
              onCheckedChange={handleToggleAllNotifications}
            />

            {anyNotificationEnabled && (
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
                onClick={() => setShowAdvancedNotifications((v) => !v)}
              >
                <ChevronDown
                  className={cn(
                    'w-3.5 h-3.5 transition-transform duration-300 ease-in-out',
                    showAdvancedNotifications && 'rotate-180',
                  )}
                />
                {showAdvancedNotifications ? 'Ocultar tipos de notificación' : 'Elegir qué notificaciones recibir'}
              </button>
            )}

            <AnimatedCollapse open={anyNotificationEnabled && showAdvancedNotifications}>
              <div className="flex flex-col gap-4 pl-1 border-l-2 border-border ml-1 pt-4">
                <div className="pl-3">
                  <NotificationSwitchRow
                    id="notif-new-match"
                    label="Nuevo partido creado"
                    description="Cuando se crea un nuevo partido"
                    checked={notifications.newMatch}
                    disabled={loadingUser}
                    saving={savingNotificationKey === 'newMatch'}
                    onCheckedChange={(v) => handleNotificationFieldChange('newMatch', v, 'newMatch')}
                  />
                </div>

                <div className="pl-3">
                  <NotificationSwitchRow
                    id="notif-match-cancelled"
                    label="Partido cancelado"
                    description="Cuando se cancela un partido"
                    checked={notifications.matchCancelled}
                    disabled={loadingUser}
                    saving={savingNotificationKey === 'matchCancelled'}
                    onCheckedChange={(v) => handleNotificationFieldChange('matchCancelled', v, 'matchCancelled')}
                  />
                </div>

                <div className="pl-3">
                  <NotificationSwitchRow
                    id="notif-match-filled"
                    label="Partido lleno"
                    description="Cuando se completan los cupos de un partido"
                    checked={notifications.matchFilled}
                    disabled={loadingUser}
                    saving={savingNotificationKey === 'matchFilled'}
                    onCheckedChange={(v) => handleNotificationFieldChange('matchFilled', v, 'matchFilled')}
                  />
                </div>

                <div className="pl-3">
                  <NotificationSwitchRow
                    id="notif-match-changes"
                    label="Cambios en el partido"
                    description="Cuando cambian horario, lugar u otros datos del partido"
                    checked={notifications.matchChanges}
                    disabled={loadingUser}
                    saving={savingNotificationKey === 'matchChanges'}
                    onCheckedChange={(v) => handleNotificationFieldChange('matchChanges', v, 'matchChanges')}
                  />
                </div>

                <div className="pl-3">
                  <NotificationSwitchRow
                    id="notif-cancellation"
                    label="Baja de jugador"
                    description="Cuando alguien se da de baja de un partido en el que estás anotado"
                    checked={notifications.cancellation}
                    disabled={loadingUser}
                    saving={savingNotificationKey === 'cancellation'}
                    onCheckedChange={(v) => handleNotificationFieldChange('cancellation', v, 'cancellation')}
                  />
                </div>

                <div className="pl-3">
                  <NotificationSwitchRow
                    id="notif-reminder"
                    label="Recordatorio de partido"
                    description="Un aviso antes de que empiece el partido"
                    checked={notifications.reminder}
                    disabled={loadingUser}
                    saving={savingNotificationKey === 'reminder'}
                    onCheckedChange={(v) => handleNotificationFieldChange('reminder', v, 'reminder')}
                  />
                </div>

                {notifications.reminder && (
                  <div className="flex flex-col gap-2 pl-3">
                    <Label htmlFor="notif-reminder-time">Minutos antes del partido</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="notif-reminder-time"
                        type="number"
                        min={5}
                        max={1440}
                        disabled={loadingUser || savingNotificationKey === 'reminderTime'}
                        value={notifications.reminderTime}
                        onChange={(e) => handleReminderTimeChange(Number(e.target.value) || 60)}
                      />
                      {savingNotificationKey === 'reminderTime' && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" aria-hidden="true" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Entre 5 y 1440 minutos (24 hs)
                    </p>
                  </div>
                )}
              </div>
            </AnimatedCollapse>
          </div>
      </SettingsSection>
      )}
    </div>
  )
}
