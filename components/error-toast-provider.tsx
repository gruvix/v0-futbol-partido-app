'use client'

import React, { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

interface ErrorToastState {
  open: boolean
  title: string
  message?: string
}

interface ErrorToastContextType {
  showError: (title: string, message?: string) => void
  hideError: () => void
}

const ErrorToastContext = createContext<ErrorToastContextType | null>(null)

export function ErrorToastProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [state, setState] = useState<ErrorToastState>({ open: false, title: '', message: undefined })

  const showError = useCallback((title: string, message?: string) => {
    setState({ open: true, title, message })
  }, [])

  const hideError = useCallback(() => {
    setState(prev => ({ ...prev, open: false }))
  }, [])

  return (
    <ErrorToastContext.Provider value={{ showError, hideError }}>
      {children}
      <BottomErrorModal open={state.open} title={state.title} message={state.message} onClose={hideError} />
    </ErrorToastContext.Provider>
  )
}

export function useErrorToast(): ErrorToastContextType {
  const ctx = useContext(ErrorToastContext)
  if (!ctx) {
    throw new Error('useErrorToast must be used within an ErrorToastProvider')
  }
  return ctx
}

function BottomErrorModal({
  open,
  title,
  message,
  onClose,
}: {
  open: boolean
  title: string
  message?: string
  onClose: () => void
}): React.JSX.Element {
  if (!open) return <></>

  return (
    <div className="fixed inset-0 z-[10001]">
      {/* backdrop */}
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />

      {/* bottom sheet */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="mx-auto max-w-xl rounded-xl border border-border bg-background shadow-lg p-4 animate-in slide-in-from-bottom-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="font-semibold text-destructive">{title}</p>
              {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
