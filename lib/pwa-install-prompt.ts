type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type InstallPromptListener = (available: boolean) => void

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<InstallPromptListener>()

function notifyListeners(): void {
  const available = deferredPrompt !== null
  for (const listener of listeners) {
    listener(available)
  }
}

export function subscribeInstallPrompt(listener: InstallPromptListener): () => void {
  listeners.add(listener)
  listener(deferredPrompt !== null)
  return () => listeners.delete(listener)
}

export function captureInstallPrompt(event: Event): void {
  deferredPrompt = event as BeforeInstallPromptEvent
  notifyListeners()
}

export function clearInstallPrompt(): void {
  deferredPrompt = null
  notifyListeners()
}

export async function triggerInstallPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable'

  await deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  deferredPrompt = null
  notifyListeners()
  return outcome
}
