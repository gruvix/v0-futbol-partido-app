export type PwaInstallPlatform =
  | 'chromium'
  | 'firefox-android'
  | 'safari-ios'
  | 'safari-macos'
  | 'unsupported'

export type PwaInstallInstructions = {
  title: string
  steps: string[]
  canPromptNatively: boolean
}

export function isPwaInstalled(): boolean {
  if (typeof window === 'undefined') return false

  const nav = window.navigator as Navigator & { standalone?: boolean }

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    nav.standalone === true
  )
}

export function getPwaInstallPlatform(): PwaInstallPlatform {
  if (typeof navigator === 'undefined') return 'unsupported'

  const ua = navigator.userAgent
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  if (isIos) return 'safari-ios'
  if (/Android/i.test(ua) && /Firefox/i.test(ua)) return 'firefox-android'
  if (/Android/i.test(ua) || /Chrome|Chromium|Edg|OPR|Brave/i.test(ua)) return 'chromium'
  if (/Safari/i.test(ua) && /Macintosh/i.test(ua)) return 'safari-macos'

  return 'unsupported'
}

export function getPwaInstallInstructions(platform: PwaInstallPlatform): PwaInstallInstructions {
  switch (platform) {
    case 'chromium':
      return {
        title: 'Instalar BariFutbol',
        steps: ['Tocá "Instalar app" para agregar un acceso directo en tu dispositivo.'],
        canPromptNatively: true,
      }
    case 'firefox-android':
      return {
        title: 'Agregar a pantalla de inicio',
        steps: [
          'Tocá el menú (⋮) del navegador.',
          'Elegí "Instalar" o "Agregar a pantalla de inicio".',
          'Confirmá para crear el acceso directo.',
        ],
        canPromptNatively: false,
      }
    case 'safari-ios':
      return {
        title: 'Agregar a pantalla de inicio',
        steps: [
          'Tocá el botón Compartir (cuadrado con flecha hacia arriba).',
          'Deslizá y elegí "Agregar a pantalla de inicio".',
          'Confirmá con "Agregar".',
        ],
        canPromptNatively: false,
      }
    case 'safari-macos':
      return {
        title: 'Agregar al Dock',
        steps: [
          'En Safari, abrí el menú Archivo.',
          'Elegí "Agregar al Dock".',
        ],
        canPromptNatively: false,
      }
    default:
      return {
        title: 'Acceso directo no disponible',
        steps: ['Tu navegador no permite instalar esta app como acceso directo.'],
        canPromptNatively: false,
      }
  }
}

export function canOfferPwaInstall(platform: PwaInstallPlatform): boolean {
  return platform !== 'unsupported'
}
