import { savePushSubscription, type PushNotificationsSettings } from '@/app/actions/notifications'
import { urlBase64ToUint8Array } from '@/lib/push-utils'

export type PushSyncResult =
  | { status: 'ok' }
  | { status: 'unsupported' }
  | { status: 'needs_permission' }
  | { status: 'denied' }
  | { status: 'error'; message: string }

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
}

export function isAnyPushSettingEnabled(settings: PushNotificationsSettings): boolean {
  return (
    settings.newMatch ||
    settings.matchCancelled ||
    settings.matchFilled ||
    settings.matchChanges ||
    settings.cancellation ||
    settings.reminder
  )
}

export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register('/sw.js')
}

export async function getPushServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null
  try {
    const existing = await navigator.serviceWorker.getRegistration('/sw.js')
    if (existing) return existing
    return await registerPushServiceWorker()
  } catch {
    return null
  }
}

export async function hasLocalPushSubscription(): Promise<boolean> {
  const reg = await getPushServiceWorkerRegistration()
  if (!reg) return false
  try {
    const sub = await reg.pushManager.getSubscription()
    return sub !== null
  } catch {
    return false
  }
}

/** Browser permission granted and this device has an active push subscription. */
export async function isBrowserPushReady(): Promise<boolean> {
  if (!isPushSupported()) return false
  if (Notification.permission !== 'granted') return false
  return hasLocalPushSubscription()
}

/**
 * Save an existing local subscription to the server. Never requests permission or creates a subscription.
 */
export async function resyncExistingPushSubscription(): Promise<PushSyncResult> {
  if (!isPushSupported()) return { status: 'unsupported' }
  if (Notification.permission !== 'granted') return { status: 'needs_permission' }

  try {
    const reg = await getPushServiceWorkerRegistration()
    if (!reg) return { status: 'error', message: 'No se pudo registrar el service worker' }

    const subscription = await reg.pushManager.getSubscription()
    if (!subscription) return { status: 'needs_permission' }

    const subJson = subscription.toJSON()
    const result = await savePushSubscription({
      endpoint: subscription.endpoint,
      p256dh: subJson.keys?.p256dh ?? '',
      auth: subJson.keys?.auth ?? '',
    })

    if (result.error) return { status: 'error', message: result.error }
    return { status: 'ok' }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Error al sincronizar notificaciones push',
    }
  }
}

/**
 * Ensure browser push subscription exists and is saved server-side.
 * Pass requestPermission=true to trigger Notification.requestPermission().
 */
export async function syncPushSubscription(requestPermission = false): Promise<PushSyncResult> {
  if (!isPushSupported()) return { status: 'unsupported' }

  const currentPermission = Notification.permission

  if (currentPermission === 'denied') return { status: 'denied' }

  if (currentPermission === 'default' && !requestPermission) {
    return { status: 'needs_permission' }
  }

  if (currentPermission === 'default' && requestPermission) {
    const permission = await Notification.requestPermission()
    if (permission === 'denied') return { status: 'denied' }
    if (permission !== 'granted') return { status: 'needs_permission' }
  }

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidKey) {
    return { status: 'error', message: 'El servidor no tiene configuradas las claves VAPID para push' }
  }

  try {
    const reg = await getPushServiceWorkerRegistration()
    if (!reg) return { status: 'error', message: 'No se pudo registrar el service worker' }

    await navigator.serviceWorker.ready

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

    if (result.error) return { status: 'error', message: result.error }
    return { status: 'ok' }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Error al sincronizar notificaciones push',
    }
  }
}
