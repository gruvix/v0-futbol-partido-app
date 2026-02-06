'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import Loader from '@/loader'

export type LoaderSize = 'sm' | 'md' | 'lg'

const sizeToScale: Record<LoaderSize, number> = {
  sm: 0.08,
  md: 0.22,
  lg: 0.3,
}

/**
 * Full-screen overlay loader.
 */
export function FootballLoader(): React.JSX.Element {
  return <Loader />
}

/**
 * Inline loader (for buttons, list placeholders, etc.)
 * Reuses the same SVG/CSS but overrides layout to be non-fixed.
 */
export function InlineLoader({ size = 'md', className }: { size?: LoaderSize; className?: string }): React.JSX.Element {
  const scale = sizeToScale[size]

  return (
    <span
      className={['football-loader-inline', className].filter(Boolean).join(' ')}
      aria-label="Loading"
      style={{
        display: 'inline-block',
        width: 300 * scale,
        height: 300 * scale,
      }}
    >
      <span
        style={{
          display: 'block',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        <Loader />
      </span>
    </span>
  )
}

export function LoadingOverlay({ message }: { message?: string }): React.JSX.Element {
  return (
    <>
      <Loader />
      {message ? (
        <div className="fixed left-1/2 top-[calc(50%+180px)] -translate-x-1/2 text-white/90 text-sm font-medium z-[10000]">
          {message}
        </div>
      ) : null}
    </>
  )
}

export function ActionLoader({ message }: { message?: string }): React.JSX.Element {
  return <LoadingOverlay message={message} />
}

interface ActionLoaderContextType {
  showLoader: (message?: string) => void
  hideLoader: () => void
  isLoading: boolean
}

const ActionLoaderContext = createContext<ActionLoaderContextType | null>(null)

export function ActionLoaderProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | undefined>()

  const showLoader = useCallback((msg?: string) => {
    setMessage(msg)
    setIsLoading(true)
  }, [])

  const hideLoader = useCallback(() => {
    setIsLoading(false)
    setMessage(undefined)
  }, [])

  return (
    <ActionLoaderContext.Provider value={{ showLoader, hideLoader, isLoading }}>
      {children}
      {isLoading ? <ActionLoader message={message} /> : null}
    </ActionLoaderContext.Provider>
  )
}

export function useActionLoader(): ActionLoaderContextType {
  const context = useContext(ActionLoaderContext)
  if (!context) {
    throw new Error('useActionLoader must be used within an ActionLoaderProvider')
  }
  return context
}
