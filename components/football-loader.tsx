'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

// Ball sizes configuration
const ballSizes = {
  sm: { ball: 16, shadow: 10, height: 24 },
  md: { ball: 32, shadow: 20, height: 48 },
  lg: { ball: 48, shadow: 30, height: 72 },
}

/**
 * Football bouncing ball spinner
 * Based on: https://codepen.io/eyalcohen4/pen/mprbzP
 */
export function FootballLoader({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = ballSizes[size]
  
  return (
    <div 
      className="relative flex items-end justify-center"
      style={{ width: dims.ball, height: dims.height }}
    >
      {/* Ball */}
      <div 
        className="absolute animate-football-bounce"
        style={{ 
          width: dims.ball, 
          height: dims.ball,
          bottom: dims.shadow / 2 + 4,
        }}
      >
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Ball base */}
          <circle cx="50" cy="50" r="47" fill="white" stroke="currentColor" strokeWidth="3" className="text-primary" />
          
          {/* Center pentagon */}
          <path d="M50 25 L62 40 L57 55 L43 55 L38 40 Z" fill="currentColor" className="text-primary" />
          
          {/* Top pentagon */}
          <path d="M50 8 L58 16 L54 24 L46 24 L42 16 Z" fill="currentColor" className="text-primary" />
          
          {/* Right pentagon */}
          <path d="M76 35 L80 45 L72 52 L64 46 L68 36 Z" fill="currentColor" className="text-primary" />
          
          {/* Bottom right pentagon */}
          <path d="M68 68 L72 78 L64 85 L54 80 L58 70 Z" fill="currentColor" className="text-primary" />
          
          {/* Bottom left pentagon */}
          <path d="M32 68 L42 70 L46 80 L36 85 L28 78 Z" fill="currentColor" className="text-primary" />
          
          {/* Left pentagon */}
          <path d="M24 35 L32 36 L36 46 L28 52 L20 45 Z" fill="currentColor" className="text-primary" />
        </svg>
      </div>
      
      {/* Shadow */}
      <div 
        className="animate-football-shadow rounded-full bg-foreground/20"
        style={{ 
          width: dims.shadow, 
          height: dims.shadow / 4,
        }}
      />
    </div>
  )
}

/**
 * Full-page loading overlay
 * Use ONLY for: login, initial app load
 */
export function LoadingOverlay({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
      <FootballLoader size="lg" />
      {message && (
        <p className="text-muted-foreground text-sm animate-pulse">{message}</p>
      )}
    </div>
  )
}

/**
 * Medium blocking loader with semi-transparent overlay
 * Use for: joining match, changing role, saving config, etc.
 */
export function ActionLoader({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-background/50 backdrop-blur-[2px] z-50 flex flex-col items-center justify-center gap-3">
      <FootballLoader size="md" />
      {message && (
        <p className="text-foreground text-sm font-medium">{message}</p>
      )}
    </div>
  )
}

/**
 * Inline/small spinner for non-blocking loading
 * Use for: loading lists, background refreshes
 */
export function InlineLoader({ className }: { className?: string }) {
  return (
    <div className={className}>
      <FootballLoader size="sm" />
    </div>
  )
}

// Context for global action loader
interface ActionLoaderContextType {
  showLoader: (message?: string) => void
  hideLoader: () => void
  isLoading: boolean
}

const ActionLoaderContext = createContext<ActionLoaderContextType | null>(null)

export function ActionLoaderProvider({ children }: { children: ReactNode }) {
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
      {isLoading && <ActionLoader message={message} />}
    </ActionLoaderContext.Provider>
  )
}

export function useActionLoader() {
  const context = useContext(ActionLoaderContext)
  if (!context) {
    throw new Error('useActionLoader must be used within an ActionLoaderProvider')
  }
  return context
}
