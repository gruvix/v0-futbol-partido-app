'use client'

import { useState, useCallback, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Settings, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EditableFieldProps {
  /** Current display value when not editing */
  displayValue: ReactNode
  /** Whether user can edit this field */
  canEdit: boolean
  /** Called when user confirms changes */
  onSave: () => Promise<{ error?: string } | void>
  /** Render prop for the edit UI */
  renderEditor: () => ReactNode
  /** Optional warning message shown below the editor */
  warning?: string
  /** Optional className for the container */
  className?: string
  /** Icon to show before the display value */
  icon?: ReactNode
  /** Optional label for screen readers */
  label?: string
}

export function EditableField({
  displayValue,
  canEdit,
  onSave,
  renderEditor,
  warning,
  className,
  icon,
  label,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const handleStartEdit = useCallback(() => {
    setIsEditing(true)
    setError('')
  }, [])

  const handleCancel = useCallback(() => {
    setIsEditing(false)
    setError('')
  }, [])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    setError('')
    try {
      const result = await onSave()
      if (result?.error) {
        setError(result.error)
      } else {
        setIsEditing(false)
      }
    } catch (e) {
      setError('Error al guardar')
      console.error(e)
    } finally {
      setIsSaving(false)
    }
  }, [onSave])

  if (isEditing) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        <div className="flex flex-col gap-2">
          {renderEditor()}
          {warning && (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-md">
              {warning}
            </p>
          )}
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            disabled={isSaving}
            className="h-7 px-2 text-muted-foreground hover:text-destructive"
          >
            <X className="w-4 h-4 mr-1" />
            Cancelar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="h-7 px-2 text-muted-foreground hover:text-primary"
          >
            <Check className="w-4 h-4 mr-1" />
            Confirmar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <div className="flex-1">{displayValue}</div>
      {canEdit && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleStartEdit}
          className="h-6 w-6 p-0 text-muted-foreground hover:text-primary flex-shrink-0"
        >
          <Settings className="w-3.5 h-3.5" />
          <span className="sr-only">Editar {label}</span>
        </Button>
      )}
    </div>
  )
}
